import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { Student, User, Grade } from '../models';
import { config } from '../config/env';
import { buildInstitutionalEmail } from '../lib/email-generator';
import { AuthenticatedRequest, isStudentScoped } from '../middleware/auth.middleware';

const STUDENT_PROFILE = 'prof-alumno';

/** Estado de la cuenta del alumno según su estado de matrícula. */
function accountStateFor(status: string): { appAccess: boolean; status: 'ACTIVE' | 'INACTIVE' } {
  const enabled = status === 'ACTIVE' || status === 'PENDING';
  return { appAccess: enabled, status: enabled ? 'ACTIVE' : 'INACTIVE' };
}

export class StudentController {
  public static async getAll(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { q, search, grade, section, status } = req.query;
      const filter: any = {};

      if (isStudentScoped(req.auth)) filter._id = req.auth.studentId;

      const searchTerm = typeof q === 'string' && q.trim() ? q.trim() : typeof search === 'string' && search.trim() ? search.trim() : null;

      if (searchTerm) {
        const regex = new RegExp(searchTerm.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'i');
        filter.$or = [
          { firstName: regex },
          { lastName: regex },
          { dni: regex },
          { email: regex }
        ];
      }
      if (typeof grade === 'string' && grade !== 'ALL') filter.grade = grade;
      if (typeof section === 'string' && section !== 'ALL') filter.section = section;
      if (typeof status === 'string' && status !== 'ALL') filter.status = status;

      const students = await Student.find(filter).sort({ lastName: 1 });

      res.json({ success: true, count: students.length, data: students });
    } catch (error) {
      console.error('Error al obtener estudiantes:', error);
      res.status(500).json({ success: false, message: 'Error interno al consultar estudiantes' });
    }
  }

  public static async getById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      if (isStudentScoped(req.auth) && req.auth.studentId !== id) {
        res.status(403).json({ success: false, message: 'Solo puede consultar su propio expediente.' });
        return;
      }

      const student = await Student.findById(id);
      if (!student) {
        res.status(404).json({ success: false, message: 'Estudiante no encontrado' });
        return;
      }

      const grades = await Grade.find({ studentId: id }).populate('subjectId');

      const studentObj: any = student.toJSON();
      studentObj.grades = grades.map(g => {
        const gObj: any = g.toJSON();
        gObj.subject = (g as any).subjectId;
        return gObj;
      });

      res.json({ success: true, data: studentObj });
    } catch (error) {
      console.error('Error al obtener estudiante:', error);
      res.status(500).json({ success: false, message: 'Error al obtener estudiante' });
    }
  }

  /** Matricula al alumno y crea su cuenta de acceso (perfil Alumno). */
  public static async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const body = req.body;
      const id = `std-${randomUUID().slice(0, 8)}`;
      const email = buildInstitutionalEmail(body.firstName, body.lastName, body.dni);
      const avatarUrl = body.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(email)}`;
      const registeredAt = body.registeredAt || new Date().toISOString().split('T')[0];
      const contacts: any[] = Array.isArray(body.emergencyContacts) ? body.emergencyContacts : [];
      const password = await bcrypt.hash(config.defaultPassword, 10);

      // Validar DNI o email existente
      const existing = await Student.findOne({ $or: [{ dni: body.dni }, { email }] });
      if (existing) {
        res.status(409).json({ success: false, message: 'El DNI o correo institucional ya está registrado' });
        return;
      }

      const student = await Student.create({
        _id: id,
        dni: body.dni,
        firstName: body.firstName,
        lastName: body.lastName,
        email,
        phone: body.phone || '',
        birthDate: body.birthDate,
        grade: body.grade,
        section: body.section,
        status: body.status || 'ACTIVE',
        attendancePercentage: Number(body.attendancePercentage) || 100,
        avatarUrl,
        registeredAt,
        emergencyContacts: contacts.map(c => ({
          _id: randomUUID(),
          name: c.name,
          relationship: c.relationship,
          phone: c.phone
        }))
      });

      await User.create({
        _id: `usr-${id}`,
        email,
        dni: body.dni,
        password,
        name: `${body.firstName} ${body.lastName}`,
        role: 'STUDENT',
        profileId: STUDENT_PROFILE,
        studentId: id,
        mustChangePassword: true,
        ...accountStateFor(body.status || 'ACTIVE'),
        avatarUrl
      });

      res.status(201).json({ success: true, message: 'Estudiante matriculado correctamente', data: student });
    } catch (error: any) {
      console.error('Error al registrar estudiante:', error);
      if (error?.code === 11000) {
        res.status(409).json({ success: false, message: 'El DNI o correo institucional ya está registrado' });
        return;
      }
      res.status(500).json({ success: false, message: 'Error al registrar estudiante' });
    }
  }

  public static async update(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const body = req.body;
      const contacts: any[] | undefined = Array.isArray(body.emergencyContacts) ? body.emergencyContacts : undefined;

      const current = await Student.findById(id);
      if (!current) {
        res.status(404).json({ success: false, message: 'Estudiante no encontrado' });
        return;
      }

      // El correo institucional es derivado: se regenera si cambian nombre, apellido o DNI.
      const firstName = body.firstName ?? current.firstName;
      const lastName = body.lastName ?? current.lastName;
      const dni = body.dni ?? current.dni;
      const email = buildInstitutionalEmail(firstName, lastName, dni);

      current.dni = dni;
      current.firstName = firstName;
      current.lastName = lastName;
      current.email = email;
      if (body.phone !== undefined) current.phone = body.phone;
      if (body.birthDate !== undefined) current.birthDate = body.birthDate;
      if (body.grade !== undefined) current.grade = body.grade;
      if (body.section !== undefined) current.section = body.section;
      if (body.status !== undefined) current.status = body.status;
      if (body.attendancePercentage !== undefined) current.attendancePercentage = Number(body.attendancePercentage);
      if (contacts !== undefined) {
        current.emergencyContacts = contacts.map(c => ({
          _id: c.id || c._id || randomUUID(),
          name: c.name,
          relationship: c.relationship,
          phone: c.phone
        })) as any;
      }

      const updated = await current.save();

      await User.updateMany(
        { studentId: id },
        {
          $set: {
            email,
            dni,
            name: `${firstName} ${lastName}`,
            ...(body.status ? accountStateFor(body.status) : {})
          }
        }
      );

      res.json({ success: true, message: 'Expediente escolar actualizado exitosamente', data: updated });
    } catch (error: any) {
      console.error('Error al actualizar estudiante:', error);
      if (error?.code === 11000) {
        res.status(409).json({ success: false, message: 'El DNI o correo institucional ya está registrado' });
        return;
      }
      res.status(500).json({ success: false, message: 'Error al actualizar expediente' });
    }
  }

  public static async toggleStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const student = await Student.findById(id);
      if (!student) {
        res.status(404).json({ success: false, message: 'Estudiante no encontrado' });
        return;
      }

      const newStatus = student.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      student.status = newStatus;
      const updated = await student.save();

      await User.updateMany(
        { studentId: id },
        {
          $set: {
            status: newStatus,
            appAccess: newStatus === 'ACTIVE',
            webAccess: newStatus === 'ACTIVE'
          }
        }
      );

      const actionText = newStatus === 'ACTIVE' ? 'habilitado' : 'deshabilitado';
      res.json({
        success: true,
        message: `El estudiante "${updated.firstName} ${updated.lastName}" ha sido ${actionText} exitosamente.`,
        data: updated
      });
    } catch (error) {
      console.error('Error al alternar estado del estudiante:', error);
      res.status(500).json({ success: false, message: 'Error al cambiar estado del estudiante' });
    }
  }
}
