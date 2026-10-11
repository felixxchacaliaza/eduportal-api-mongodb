import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { Subject, Teacher } from '../models';
import { randomUUID } from 'crypto';

const norm = (v: string) => (v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/** Un docente puede dictar la asignatura si la tiene en su lista de asignaturas o coincide su especialidad/área. */
function teacherCanTeach(
  teacher: { specialty: string; subjects: string },
  subject: { name: string; specialty: string; category: string }
): boolean {
  let list: string[] = [];
  try {
    const parsed = JSON.parse(teacher.subjects);
    if (Array.isArray(parsed)) list = parsed;
  } catch {
    list = (teacher.subjects || '').split(',');
  }
  const t = norm(teacher.specialty);
  return (
    list.some(n => norm(n) === norm(subject.name)) ||
    t === norm(subject.specialty) ||
    t === norm(subject.category)
  );
}

export class SubjectController {
  public static async getAll(req: Request, res: Response): Promise<void> {
    try {
      const { grade, section } = req.query;
      const filter: any = {};

      if (grade && typeof grade === 'string' && grade !== 'ALL') {
        filter.grade = grade;
      }
      if (section && typeof section === 'string' && section !== 'ALL') {
        filter.section = section;
      }

      const subjects = await Subject.find(filter).sort({ grade: 1, section: 1, code: 1 });

      const data = subjects.map(s => {
        const obj: any = s.toJSON();
        if (Array.isArray(obj.teacherHistories)) {
          obj.teacherHistories.sort((x: any, y: any) => new Date(y.assignedAt).getTime() - new Date(x.assignedAt).getTime());
        }
        return obj;
      });

      res.json({
        success: true,
        count: data.length,
        data
      });
    } catch (error) {
      console.error('Error al obtener asignaturas (subjects):', error);
      res.status(500).json({ success: false, message: 'Error al consultar asignaturas' });
    }
  }

  public static async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const subject = await Subject.findById(id);

      if (!subject) {
        res.status(404).json({ success: false, message: 'Asignatura / Curso no encontrado' });
        return;
      }

      const obj: any = subject.toJSON();
      if (Array.isArray(obj.teacherHistories)) {
        obj.teacherHistories.sort((x: any, y: any) => new Date(y.assignedAt).getTime() - new Date(x.assignedAt).getTime());
      }

      res.json({ success: true, data: obj });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error al obtener asignatura' });
    }
  }

  public static async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const {
        code,
        name,
        category,
        specialty,
        grade,
        section,
        classroom,
        teacherName,
        weeklyHours,
        maxCapacity,
        icon,
        color
      } = req.body;

      if (!code || !name) {
        res.status(400).json({
          success: false,
          message: 'El código y el nombre de la asignatura son campos obligatorios.'
        });
        return;
      }

      const existing = await Subject.findOne({ code: code.toUpperCase().trim() });
      if (existing) {
        res.status(400).json({
          success: false,
          message: `El código de asignatura ${code} ya está registrado.`
        });
        return;
      }

      let courseSpecialty = specialty?.trim();
      if (!courseSpecialty) {
        if (category === 'HUMANIDADES' || /comunicaci[oó]n|literatura|lenguaje|lectura/i.test(name)) {
          courseSpecialty = 'Comunicación';
        } else if (category === 'TECNOLOGÍA' || /tecnolog[ií]a|computaci[oó]n|inform[aá]tica/i.test(name)) {
          courseSpecialty = 'Tecnología';
        } else {
          courseSpecialty = 'Matemática';
        }
      }

      const generatedId = `cur-${code.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString(36).slice(-4)}`;
      const teacher = (teacherName || 'Prof. Por Asignar').trim();

      let teacherId: string | null = null;
      if (teacher !== 'Prof. Por Asignar') {
        const teacherRec = await Teacher.findOne({ fullName: teacher });
        if (!teacherRec) {
          res.status(400).json({ success: false, message: `El docente "${teacher}" no existe en la plana docente.` });
          return;
        }
        teacherId = teacherRec._id;

        const currentCount = await Subject.countDocuments({ teacherId });
        if (currentCount >= 3) {
          res.status(400).json({
            success: false,
            message: `Límite de carga horaria excedido: El docente "${teacher}" ya tiene asignadas el máximo permitido de 3 asignaturas académicas (${currentCount}/3). No puede dictar asignaturas adicionales.`
          });
          return;
        }

        if (!teacherCanTeach(teacherRec, { name, specialty: courseSpecialty, category: category || 'CIENCIAS' })) {
          res.status(400).json({
            success: false,
            message: `Incompatibilidad de especialidad: El docente "${teacher}" tiene la especialidad "${teacherRec.specialty}", pero la asignatura "${name}" requiere especialidad en "${courseSpecialty}". Un docente de ${teacherRec.specialty} no puede enseñar asignaturas de ${courseSpecialty}.`
          });
          return;
        }
      }

      const newSubject = await Subject.create({
        _id: generatedId,
        code: code.toUpperCase().trim(),
        name: name.trim(),
        category: category || 'CIENCIAS',
        specialty: courseSpecialty,
        grade: grade || '1° Secundaria',
        section: section || 'A',
        classroom: classroom || 'Aula 101',
        teacherId,
        teacherName: teacher,
        weeklyHours: Number(weeklyHours) || 4,
        maxCapacity: Number(maxCapacity) || 35,
        enrolledCount: 0,
        icon: icon || '📚',
        color: color || '#2563eb',
        teacherHistories: [
          {
            _id: randomUUID(),
            previousTeacher: null,
            newTeacher: teacher,
            assignedBy: req.auth?.email ?? 'sistema',
            reason: 'Asignación inaugural al crear la asignatura',
            assignedAt: new Date()
          }
        ]
      });

      res.status(201).json({
        success: true,
        message: `Asignatura ${newSubject.name} registrada exitosamente.`,
        data: newSubject
      });
    } catch (error) {
      console.error('Error al crear asignatura:', error);
      res.status(500).json({ success: false, message: 'Error interno al registrar asignatura' });
    }
  }

  public static async assignTeacher(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { teacherName, reason } = req.body;

      if (!teacherName || !teacherName.trim()) {
        res.status(400).json({
          success: false,
          message: 'Debe indicar el nombre del nuevo docente titular.'
        });
        return;
      }

      const trimmedTeacher = teacherName.trim();
      const subject = await Subject.findById(id);
      if (!subject) {
        res.status(404).json({ success: false, message: 'Asignatura no encontrada.' });
        return;
      }

      if (subject.teacherName.toLowerCase() === trimmedTeacher.toLowerCase()) {
        res.status(400).json({
          success: false,
          message: `El docente "${trimmedTeacher}" ya es el titular actual de la asignatura "${subject.name}".`
        });
        return;
      }

      const assignedBy = req.auth?.email ?? 'sistema';
      const teacherRec = await Teacher.findOne({ fullName: trimmedTeacher });
      if (!teacherRec) {
        res.status(400).json({ success: false, message: `El docente "${trimmedTeacher}" no existe en la plana docente.` });
        return;
      }

      const currentTeacherCount = await Subject.countDocuments({ teacherId: teacherRec._id });
      if (currentTeacherCount >= 3) {
        res.status(400).json({
          success: false,
          message: `Límite de carga excedido: El docente "${trimmedTeacher}" ya dicta el máximo permitido de 3 asignaturas académicas (${currentTeacherCount}/3). Seleccione un docente con cupo disponible.`
        });
        return;
      }

      const courseSpec = subject.specialty || 'Matemática';
      if (!teacherCanTeach(teacherRec, subject)) {
        res.status(400).json({
          success: false,
          message: `Incompatibilidad de especialidad: El docente "${trimmedTeacher}" cuenta con la especialidad "${teacherRec.specialty}", mientras que la asignatura "${subject.name}" pertenece al área de "${courseSpec}". Un docente de ${teacherRec.specialty} no puede enseñar asignaturas de ${courseSpec}.`
        });
        return;
      }

      const previousTeacher = subject.teacherName;
      subject.teacherId = teacherRec._id;
      subject.teacherName = trimmedTeacher;
      subject.teacherHistories.push({
        _id: randomUUID(),
        previousTeacher,
        newTeacher: trimmedTeacher,
        assignedBy,
        reason: reason?.trim() || 'Reasignación de docente titular por Dirección',
        assignedAt: new Date()
      } as any);

      const saved = await subject.save();
      const obj: any = saved.toJSON();
      if (Array.isArray(obj.teacherHistories)) {
        obj.teacherHistories.sort((x: any, y: any) => new Date(y.assignedAt).getTime() - new Date(x.assignedAt).getTime());
      }

      res.json({
        success: true,
        message: `Docente ${trimmedTeacher} asignado a la asignatura "${subject.name}". Cambio registrado en el historial oficial.`,
        data: obj
      });
    } catch (error) {
      console.error('Error al asignar docente a asignatura:', error);
      res.status(500).json({ success: false, message: 'Error interno al reasignar docente' });
    }
  }

  public static async getTeacherHistory(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const subject = await Subject.findById(id);

      if (!subject) {
        res.status(404).json({ success: false, message: 'Asignatura no encontrada' });
        return;
      }

      const histories = [...(subject.teacherHistories || [])].sort(
        (a, b) => new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime()
      );

      res.json({
        success: true,
        count: histories.length,
        data: histories
      });
    } catch (error) {
      console.error('Error al obtener historial de asignaciones:', error);
      res.status(500).json({ success: false, message: 'Error al consultar historial' });
    }
  }

  public static async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { name, code, weeklyHours, category, specialty, icon, color } = req.body;

      const existing = await Subject.findById(id);
      if (!existing) {
        res.status(404).json({ success: false, message: 'Asignatura no encontrada' });
        return;
      }

      if (code && code.toUpperCase().trim() !== existing.code) {
        const codeConflict = await Subject.findOne({
          code: code.toUpperCase().trim(),
          _id: { $ne: id }
        });
        if (codeConflict) {
          res.status(400).json({
            success: false,
            message: `El código ${code} ya está en uso por otra asignatura.`
          });
          return;
        }
      }

      if (name) existing.name = name.trim();
      if (code) existing.code = code.toUpperCase().trim();
      if (weeklyHours !== undefined) existing.weeklyHours = Number(weeklyHours);
      if (category) existing.category = category;
      if (specialty) existing.specialty = specialty;
      if (icon) existing.icon = icon;
      if (color) existing.color = color;

      const updated = await existing.save();

      res.json({
        success: true,
        message: `Asignatura ${updated.name} actualizada correctamente.`,
        data: updated
      });
    } catch (error) {
      console.error('Error al actualizar asignatura:', error);
      res.status(500).json({ success: false, message: 'Error interno al actualizar asignatura' });
    }
  }

  public static async toggleStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const subject = await Subject.findById(id);
      if (!subject) {
        res.status(404).json({ success: false, message: 'Asignatura no encontrada' });
        return;
      }

      const newStatus = subject.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      subject.status = newStatus;
      const updated = await subject.save();

      const actionText = newStatus === 'ACTIVE' ? 'activada' : 'desactivada';
      res.json({
        success: true,
        message: `La asignatura "${updated.name}" ha sido ${actionText} exitosamente.`,
        data: updated
      });
    } catch (error) {
      console.error('Error al cambiar estado de la asignatura:', error);
      res.status(500).json({ success: false, message: 'Error al cambiar estado de la asignatura' });
    }
  }
}
