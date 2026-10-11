import { Subject, Teacher } from '../models';
import { AuthContext } from '../middleware/auth.middleware';

/**
 * Alcance docente: qué (grado, sección, asignatura/subject) puede calificar un profesor.
 *
 * Regla:
 *  1. Si existe una asignación (TeacherAssignment) para ese grado, sección y asignatura,
 *     solo el docente de esa asignación puede calificar.
 *  2. Si nadie tiene asignada esa sección para la asignatura, califica el docente
 *     titular de la asignatura (Subject.teacherId).
 */
export interface TeachingScope {
  canTeach(grade: string, section: string, subjectId: string): boolean;
}

const key = (grade: string, section: string, subjectId: string) =>
  `${grade}|${section}|${subjectId}`.toLowerCase();

/** El usuario está sujeto al alcance docente (rol TEACHER o cuenta vinculada a una ficha docente). */
export function isTeacherScoped(auth?: AuthContext): boolean {
  return !!auth && (auth.role === 'TEACHER' || !!auth.teacherId);
}

export async function loadTeachingScope(teacherId: string | null): Promise<TeachingScope> {
  if (!teacherId) {
    return { canTeach: () => false };
  }

  const [subjects, teachers] = await Promise.all([
    Subject.find({}, { _id: 1, name: 1, teacherId: 1 }).lean(),
    Teacher.find({}, { _id: 1, assignments: 1 }).lean()
  ]);

  const assignments: { teacherId: string; grade: string; section: string; subjectId: string; subjectName: string }[] = [];
  for (const t of teachers) {
    for (const a of t.assignments || []) {
      assignments.push({
        teacherId: t._id,
        grade: a.grade,
        section: a.section,
        subjectId: a.subjectId || '',
        subjectName: a.subjectName
      });
    }
  }

  // Las asignaciones antiguas pueden traer solo el nombre de la asignatura: se resuelve al id real.
  const idByName = new Map(subjects.map(a => [a.name.toLowerCase(), a._id]));
  const titularOf = new Map(subjects.map(a => [a._id, a.teacherId]));

  const ownerBySlot = new Map<string, string>();
  for (const a of assignments) {
    const subjectId = titularOf.has(a.subjectId) ? a.subjectId : idByName.get(a.subjectName.toLowerCase());
    if (!subjectId) continue;
    ownerBySlot.set(key(a.grade, a.section, subjectId), a.teacherId);
  }

  return {
    canTeach(grade: string, section: string, subjectId: string): boolean {
      const owner = ownerBySlot.get(key(grade, section, subjectId));
      if (owner) return owner === teacherId;
      return titularOf.get(subjectId) === teacherId;
    }
  };
}
