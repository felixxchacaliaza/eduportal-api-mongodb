import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { Teacher, User, Subject } from '../models';
import { buildInstitutionalEmail } from '../lib/email-generator';
import { config } from '../config/env';

interface AssignmentInput {
  grade: string;
  section: string;
  subjectId?: string;
  subjectName: string;
  weeklyHours: number;
}

const toAssignmentRow = (a: AssignmentInput) => ({
  _id: randomUUID(),
  grade: a.grade,
  section: a.section,
  subjectId: a.subjectId || `cur-${a.subjectName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
  subjectName: a.subjectName,
  weeklyHours: a.weeklyHours,
  createdAt: new Date()
});

/**
 * Una sección + asignatura solo puede tener un docente: si otro docente la tenía,
 * se le retira y se recalculan sus horas asignadas.
 */
async function releaseAssignments(assignments: AssignmentInput[], keepTeacherId: string | null) {
  for (const a of assignments) {
    const filter: any = {
      'assignments.grade': a.grade,
      'assignments.section': a.section,
      'assignments.subjectName': a.subjectName
    };
    if (keepTeacherId) {
      filter._id = { $ne: keepTeacherId };
    }

    const conflictTeacher = await Teacher.findOne(filter);
    if (conflictTeacher) {
      conflictTeacher.assignments = conflictTeacher.assignments.filter(
        asg => !(asg.grade === a.grade && asg.section === a.section && asg.subjectName === a.subjectName)
      );
      conflictTeacher.assignedHours = conflictTeacher.assignments.reduce((s, r) => s + r.weeklyHours, 0);
      await conflictTeacher.save();
    }
  }
}

export class TeacherController {
  /**
   * Obtiene la plana docente completa con sus asignaciones de aula
   */
  public static async getAll(req: Request, res: Response): Promise<void> {
    try {
      const { search, specialty, status } = req.query;
      const filter: any = {};

      if (specialty && typeof specialty === 'string' && specialty !== 'ALL') {
        filter.specialty = specialty.toUpperCase();
      }

      if (status && typeof status === 'string' && status !== 'ALL') {
        filter.status = status.toUpperCase();
      }

      const teachers = await Teacher.find(filter).sort({ createdAt: -1 });

      let filtered = teachers.map(t => {
        const obj: any = t.toJSON();
        return {
          ...obj,
          subjects: TeacherController.parseSubjects(t.subjects)
        };
      });

      if (search && typeof search === 'string') {
        const q = search.toLowerCase().trim();
        filtered = filtered.filter(t =>
          t.fullName.toLowerCase().includes(q) ||
          t.dni.includes(q) ||
          t.specialty.toLowerCase().includes(q) ||
          t.subjects.some((s: string) => s.toLowerCase().includes(q))
        );
      }

      res.json({
        success: true,
        count: filtered.length,
        data: filtered
      });
    } catch (error) {
      console.error('Error al obtener plana docente:', error);
      res.status(500).json({ success: false, message: 'Error interno al consultar docentes' });
    }
  }

  /**
   * Obtiene la ficha de un docente por ID
   */
  public static async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const teacher = await Teacher.findById(id);

      if (!teacher) {
        res.status(404).json({ success: false, message: 'Docente no encontrado' });
        return;
      }

      const obj: any = teacher.toJSON();
      res.json({
        success: true,
        data: {
          ...obj,
          subjects: TeacherController.parseSubjects(teacher.subjects)
        }
      });
    } catch (error) {
      console.error('Error al obtener docente:', error);
      res.status(500).json({ success: false, message: 'Error interno al consultar docente' });
    }
  }

  /**
   * Registra un nuevo docente con generación automática de correo institucional
   */
  public static async create(req: Request, res: Response): Promise<void> {
    try {
      const { dni, firstName, lastName, phone, specialty, subjects, contractedHours, assignments } = req.body as {
        dni: string;
        firstName: string;
        lastName: string;
        phone?: string;
        specialty: string;
        subjects: string[];
        contractedHours: number;
        assignments: AssignmentInput[];
      };

      // 1. Validar DNI único
      const existingDni = await Teacher.findOne({ dni });
      if (existingDni) {
        res.status(409).json({
          success: false,
          message: `Ya existe un docente registrado con el DNI ${dni}.`
        });
        return;
      }

      // 2. Generar Correo Institucional Oficial en Backend
      const email = buildInstitutionalEmail(firstName, lastName, dni);
      const fullName = `Prof. ${firstName.trim()} ${lastName.trim()}`;
      const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(firstName + lastName)}`;
      const teacherId = `tch-${randomUUID().slice(0, 8)}`;
      const assignedHours = (assignments || []).reduce((sum, a) => sum + a.weeklyHours, 0);
      const password = await bcrypt.hash(config.defaultPassword, 10);

      await releaseAssignments(assignments || [], null);

      const newTeacher = await Teacher.create({
        _id: teacherId,
        dni,
        firstName,
        lastName,
        fullName,
        email,
        phone: phone || null,
        specialty,
        subjects: JSON.stringify(subjects || []),
        level: 'SECUNDARIA',
        contractedHours: contractedHours || 30,
        assignedHours,
        status: 'ACTIVE',
        avatarUrl,
        assignments: (assignments || []).map(toAssignmentRow)
      });

      // 3. Cuenta de acceso vinculada (FK teacherId) con perfil Docente
      const userExists = await User.findOne({ $or: [{ email }, { dni }] });
      if (!userExists) {
        await User.create({
          _id: `usr-${teacherId}`,
          email,
          dni,
          name: fullName,
          password,
          mustChangePassword: true,
          role: 'TEACHER',
          specialty,
          profileId: 'prof-docente',
          teacherId,
          avatarUrl
        });
      }

      const obj: any = newTeacher.toJSON();
      res.status(201).json({
        success: true,
        message: `Docente registrado exitosamente con correo institucional: ${email}`,
        data: {
          ...obj,
          subjects: TeacherController.parseSubjects(newTeacher.subjects)
        }
      });
    } catch (error: any) {
      if (error?.code === 11000) {
        res.status(409).json({ success: false, message: 'El DNI o el correo institucional ya está registrado.' });
        return;
      }
      console.error('Error al registrar docente:', error);
      res.status(500).json({ success: false, message: 'Error interno al registrar docente' });
    }
  }

  /**
   * Actualiza los datos y asignaciones de un docente
   */
  public static async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { firstName, lastName, phone, specialty, subjects, contractedHours, status, assignments } = req.body as {
        firstName?: string;
        lastName?: string;
        phone?: string;
        specialty?: string;
        subjects?: string[];
        contractedHours?: number;
        status?: string;
        assignments?: AssignmentInput[];
      };

      const teacher = await Teacher.findById(id);
      if (!teacher) {
        res.status(404).json({ success: false, message: 'Docente no encontrado' });
        return;
      }

      let fullName: string | null = null;
      let email: string | null = null;
      if (firstName || lastName) {
        const f = firstName || teacher.firstName;
        const l = lastName || teacher.lastName;
        fullName = `Prof. ${f} ${l}`;
        email = buildInstitutionalEmail(f, l, teacher.dni);
        teacher.firstName = f;
        teacher.lastName = l;
        teacher.fullName = fullName;
        teacher.email = email;
      }
      if (phone !== undefined) teacher.phone = phone || null;
      if (specialty) teacher.specialty = specialty;
      if (subjects !== undefined) teacher.subjects = JSON.stringify(subjects);
      if (contractedHours !== undefined) teacher.contractedHours = contractedHours;
      if (status) teacher.status = status;

      if (assignments !== undefined) {
        await releaseAssignments(assignments, id);
        teacher.assignments = assignments.map(toAssignmentRow) as any;
        teacher.assignedHours = assignments.reduce((s, a) => s + a.weeklyHours, 0);
      }

      const saved = await teacher.save();

      // Sincronizar cuenta de usuario y nombre visible en sus asignaturas
      if (fullName && email) {
        await User.updateMany({ teacherId: id }, { $set: { name: fullName, email } });
        await Subject.updateMany({ teacherId: id }, { $set: { teacherName: fullName } });
      }
      if (status) {
        await User.updateMany(
          { teacherId: id },
          { $set: { status: status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE', appAccess: status === 'ACTIVE' } }
        );
      }

      const obj: any = saved.toJSON();
      res.json({
        success: true,
        message: 'Ficha del docente actualizada correctamente',
        data: {
          ...obj,
          subjects: TeacherController.parseSubjects(saved.subjects)
        }
      });
    } catch (error: any) {
      if (error?.code === 11000) {
        res.status(409).json({ success: false, message: 'El correo institucional resultante ya pertenece a otro usuario.' });
        return;
      }
      console.error('Error al actualizar docente:', error);
      res.status(500).json({ success: false, message: 'Error interno al actualizar docente' });
    }
  }

  /**
   * Cambia el estado del docente entre ACTIVE e INACTIVE (y el de su cuenta de acceso)
   */
  public static async toggleStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const teacher = await Teacher.findById(id);
      if (!teacher) {
        res.status(404).json({ success: false, message: 'Docente no encontrado' });
        return;
      }

      const newStatus = teacher.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      teacher.status = newStatus;
      const saved = await teacher.save();

      await User.updateMany(
        { teacherId: id },
        { $set: { status: newStatus, appAccess: newStatus === 'ACTIVE' } }
      );

      const obj: any = saved.toJSON();
      res.json({
        success: true,
        message: `Estado del docente cambiado a ${newStatus}`,
        data: {
          ...obj,
          subjects: TeacherController.parseSubjects(saved.subjects)
        }
      });
    } catch (error) {
      console.error('Error al alternar estado del docente:', error);
      res.status(500).json({ success: false, message: 'Error al cambiar estado del docente' });
    }
  }

  /**
   * Helper para parsear array de asignaturas almacenadas
   */
  private static parseSubjects(subjectsStr: string): string[] {
    try {
      const parsed = JSON.parse(subjectsStr);
      if (Array.isArray(parsed)) return parsed;
    } catch (_) {}
    return (subjectsStr || '').split(',').map(s => s.trim()).filter(Boolean);
  }
}
