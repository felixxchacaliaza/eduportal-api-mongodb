import { Response } from 'express';
import { Grade, Student, Subject, AcademicYear, GradeSubject } from '../models';
import { AuthContext, AuthenticatedRequest, isStudentScoped } from '../middleware/auth.middleware';
import {
  BIMESTER_FIELDS,
  BIMESTER_LABELS,
  BimesterField,
  BimesterValues,
  PASSING_GRADE,
  bimesterNumber,
  computeFinalAverage,
  studentAverage
} from '../lib/grading';
import { TeachingScope, isTeacherScoped, loadTeachingScope } from '../lib/teaching-scope';

export { PASSING_GRADE } from '../lib/grading';

/** Error con código HTTP para cortar el flujo */
class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

async function getActiveYear() {
  return AcademicYear.findOne({ isActive: true }).lean();
}

type ActiveYear = NonNullable<Awaited<ReturnType<typeof getActiveYear>>>;

function openBimesters(year: ActiveYear): number[] {
  return (year.bimesters || []).filter(b => b.isOpen).map(b => b.number);
}

/** Solo se registran notas en bimestres abiertos del año lectivo activo. */
function assertBimesterOpen(year: ActiveYear, field: BimesterField): void {
  const n = bimesterNumber(field);
  if (!openBimesters(year).includes(n)) {
    throw new HttpError(
      409,
      `El ${BIMESTER_LABELS[n - 1]} Bimestre está cerrado para el registro de notas. ` +
        'Solicite a Administración que lo habilite en Configuración Escolar.'
    );
  }
}

/** ¿Quién puede editar? Docentes: solo lo que dictan. Otros perfiles con permiso FULL: todo. */
function editPolicy(auth: AuthContext | undefined, scope: TeachingScope | null) {
  const hasFull = auth?.permissions['grades'] === 'FULL';
  return (grade: string, section: string, subjectId: string): boolean => {
    if (!hasFull || isStudentScoped(auth)) return false;
    if (scope) return scope.canTeach(grade, section, subjectId);
    return true;
  };
}

/**
 * Guarda la nota de un bimestre recalculando el promedio anual del área (solo bimestres registrados)
 * y el promedio general del alumno.
 */
async function saveBimester(
  studentId: string,
  subjectId: string,
  academicYearId: string,
  field: BimesterField,
  value: number | null
) {
  let grade = await Grade.findOne({
    studentId,
    subjectId,
    academicYearId
  });

  const bimesters: BimesterValues = {
    bimester1: grade?.bimester1 ?? null,
    bimester2: grade?.bimester2 ?? null,
    bimester3: grade?.bimester3 ?? null,
    bimester4: grade?.bimester4 ?? null,
    [field]: value === null ? null : Math.round(value)
  };
  const finalAverage = computeFinalAverage(bimesters);
  const isPassing = finalAverage >= PASSING_GRADE;

  if (!grade) {
    grade = new Grade({
      studentId,
      subjectId,
      academicYearId,
      ...bimesters,
      finalAverage,
      isPassing
    });
  } else {
    grade.bimester1 = bimesters.bimester1;
    grade.bimester2 = bimesters.bimester2;
    grade.bimester3 = bimesters.bimester3;
    grade.bimester4 = bimesters.bimester4;
    grade.finalAverage = finalAverage;
    grade.isPassing = isPassing;
  }
  const saved = await grade.save();

  const all = await Grade.find({ studentId, academicYearId }).lean();
  const allFormatted = all.map(g => ({
    bimester1: g.bimester1 ?? null,
    bimester2: g.bimester2 ?? null,
    bimester3: g.bimester3 ?? null,
    bimester4: g.bimester4 ?? null,
    finalAverage: g.finalAverage
  }));

  await Student.findByIdAndUpdate(studentId, { averageGrade: studentAverage(allFormatted) });
  return saved;
}

export class GradeController {
  /**
   * Actas del año lectivo activo.
   * - Incluye a todo alumno del filtro con los cursos de la malla de su grado
   *   (las que aún no tienen notas llegan con bimestres en null).
   * - Alumno: solo su propia acta.
   * - Docente: solo los alumnos de las secciones donde dicta; `editable` indica qué áreas puede calificar.
   */
  public static async getAll(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { grade, section } = req.query;
      const year = await getActiveYear();
      if (!year) {
        res.status(409).json({ success: false, message: 'No hay un año lectivo activo.' });
        return;
      }

      const filter: any = {};
      if (isStudentScoped(req.auth)) filter._id = req.auth.studentId;
      if (typeof grade === 'string' && grade !== 'ALL') filter.grade = grade;
      if (typeof section === 'string' && section !== 'ALL') filter.section = section;

      const scope = isTeacherScoped(req.auth) ? await loadTeachingScope(req.auth!.teacherId) : null;
      const canEdit = editPolicy(req.auth, scope);

      const [students, allGrades, malla, subjects] = await Promise.all([
        Student.find(filter).sort({ lastName: 1 }).lean(),
        Grade.find({ academicYearId: year._id }).lean(),
        GradeSubject.find().lean(),
        Subject.find().lean()
      ]);

      const subjectMap = new Map(subjects.map(a => [a._id, a]));
      const gradesByStudent = new Map<string, any[]>();
      for (const g of allGrades) {
        const list = gradesByStudent.get(g.studentId) || [];
        list.push(g);
        gradesByStudent.set(g.studentId, list);
      }

      const mallaByGrade = new Map<string, { id: string; name: string }[]>();
      for (const ga of malla) {
        const sub = subjectMap.get(ga.subjectId);
        if (sub) {
          const list = mallaByGrade.get(ga.grade) ?? [];
          list.push({ id: sub._id, name: sub.name });
          mallaByGrade.set(ga.grade, list);
        }
      }

      const records = students
        .map(s => {
          const sGrades = gradesByStudent.get(s._id) || [];
          const sSubjects = sGrades.map(g => {
            const sub = subjectMap.get(g.subjectId);
            return {
              subjectId: sub?._id || g.subjectId,
              subjectName: sub?.name || '',
              bimester1: g.bimester1 ?? null,
              bimester2: g.bimester2 ?? null,
              bimester3: g.bimester3 ?? null,
              bimester4: g.bimester4 ?? null,
              finalAverage: g.finalAverage,
              isPassing: g.isPassing
            };
          });

          for (const a of mallaByGrade.get(s.grade) ?? []) {
            if (!sSubjects.some(x => x.subjectId === a.id)) {
              sSubjects.push({
                subjectId: a.id,
                subjectName: a.name,
                bimester1: null,
                bimester2: null,
                bimester3: null,
                bimester4: null,
                finalAverage: 0,
                isPassing: false
              });
            }
          }

          const grades = sSubjects.map(g => ({ ...g, editable: canEdit(s.grade, s.section, g.subjectId) }));
          // El docente solo ve las secciones donde dicta al menos un área.
          const visible = !scope || sSubjects.some(g => scope.canTeach(s.grade, s.section, g.subjectId));
          return { student: s, grades, visible };
        })
        .filter(({ grades, visible }) => visible && grades.length > 0)
        .map(({ student: s, grades }) => {
          const overallAverage = studentAverage(grades);

          let academicStanding = 'DESAPROBADO';
          if (overallAverage >= 17) academicStanding = 'EXCELENCIA';
          else if (overallAverage >= PASSING_GRADE) academicStanding = 'APROBADO';
          else if (overallAverage >= 9) academicStanding = 'EN_RIESGO';

          return {
            studentId: s._id,
            studentName: `${s.firstName} ${s.lastName}`,
            dni: s.dni,
            gradeLevel: s.grade,
            section: s.section,
            academicYear: String(year.year),
            overallAverage,
            academicStanding,
            grades
          };
        });

      res.json({
        success: true,
        count: records.length,
        academicYear: String(year.year),
        openBimesters: openBimesters(year),
        data: records
      });
    } catch (error) {
      console.error('Error al obtener actas de notas:', error);
      res.status(500).json({ success: false, message: 'Error al consultar calificaciones' });
    }
  }

  /** PATCH /grades/:studentId/:subjectId  { field: 'bimester1'..'bimester4', value: 0-20 | null } */
  public static async updateGrade(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { studentId, subjectId } = req.params;
      const { field, value } = req.body as { field: BimesterField; value: number | null };

      const year = await getActiveYear();
      if (!year) throw new HttpError(409, 'No hay un año lectivo activo.');
      assertBimesterOpen(year, field);

      const [student, subject] = await Promise.all([
        Student.findById(studentId, { _id: 1, grade: 1, section: 1 }).lean(),
        Subject.findById(subjectId, { _id: 1, name: 1 }).lean()
      ]);
      if (!student || !subject) throw new HttpError(404, 'Alumno o curso no encontrado.');

      const scope = isTeacherScoped(req.auth) ? await loadTeachingScope(req.auth!.teacherId) : null;
      if (!editPolicy(req.auth, scope)(student.grade, student.section, subject._id)) {
        throw new HttpError(
          403,
          `No dicta ${subject.name} en ${student.grade} "${student.section}": no puede registrar esta nota.`
        );
      }

      const updated = await saveBimester(studentId, subject._id, year._id, field, value);

      res.json({ success: true, message: 'Calificación actualizada', data: updated });
    } catch (error) {
      if (error instanceof HttpError) {
        res.status(error.status).json({ success: false, message: error.message });
        return;
      }
      console.error('Error al actualizar nota:', error);
      res.status(500).json({ success: false, message: 'Error al actualizar calificación' });
    }
  }

  /** PATCH /grades/batch  { subjectId, academicYearId?, bimester: 1-4, grades: [{ studentId, score }] } */
  public static async batchUpdate(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { subjectId, academicYearId, bimester, grades } = req.body as {
        subjectId: string;
        academicYearId?: string;
        bimester: number;
        grades: { studentId: string; score: number | null }[];
      };

      const year = await getActiveYear();
      if (!year) throw new HttpError(409, 'No hay un año lectivo activo.');
      if (academicYearId && academicYearId !== year._id) {
        throw new HttpError(409, 'Solo se pueden registrar notas en el año lectivo activo.');
      }

      const field = BIMESTER_FIELDS[bimester - 1];
      assertBimesterOpen(year, field);

      const subject = await Subject.findById(subjectId, { _id: 1, name: 1 }).lean();
      if (!subject) throw new HttpError(404, 'Curso no encontrado.');

      const ids = [...new Set(grades.map(g => g.studentId))];
      const students = await Student.find({ _id: { $in: ids } }, { _id: 1, grade: 1, section: 1 }).lean();
      const missing = ids.filter(id => !students.some(s => s._id === id));
      if (missing.length > 0) {
        throw new HttpError(404, `Alumnos no encontrados: ${missing.join(', ')}.`);
      }

      const scope = isTeacherScoped(req.auth) ? await loadTeachingScope(req.auth!.teacherId) : null;
      const canEdit = editPolicy(req.auth, scope);
      const forbidden = students.filter(s => !canEdit(s.grade, s.section, subject._id));
      if (forbidden.length > 0) {
        throw new HttpError(
          403,
          `No dicta ${subject.name} a ${forbidden.length} de los alumnos enviados: no se guardó ninguna nota.`
        );
      }

      for (const item of grades) {
        await saveBimester(item.studentId, subject._id, year._id, field, item.score);
      }

      res.json({
        success: true,
        message: `${grades.length} calificaciones actualizadas exitosamente con recálculo de promedio MINEDU`
      });
    } catch (error) {
      if (error instanceof HttpError) {
        res.status(error.status).json({ success: false, message: error.message });
        return;
      }
      console.error('Error al actualizar notas en lote:', error);
      res.status(500).json({ success: false, message: 'Error al actualizar calificaciones en lote' });
    }
  }
}
