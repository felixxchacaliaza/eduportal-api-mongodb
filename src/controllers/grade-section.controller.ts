import { Request, Response } from 'express';
import { GradeSection, Student, GradeSubject, Subject } from '../models';

export class GradeSectionController {
  /**
   * Lista todas las secciones con métricas en tiempo real (alumnos matriculados y cursos/subjects asignados)
   */
  public static async getAll(req: Request, res: Response): Promise<void> {
    try {
      const { status, grade } = req.query;
      const filter: any = {};

      if (status && typeof status === 'string' && status !== 'ALL') {
        filter.status = status.toUpperCase();
      }

      if (grade && typeof grade === 'string' && grade !== 'ALL') {
        filter.grade = grade;
      }

      const sections = await GradeSection.find(filter).sort({ grade: 1, section: 1 });
      const students = await Student.find({}, { grade: 1, section: 1 }).lean();

      const studentCountMap: Record<string, number> = {};
      for (const s of students) {
        const key = `${s.grade}_${s.section}`.toLowerCase();
        studentCountMap[key] = (studentCountMap[key] || 0) + 1;
      }

      const enriched = sections.map(sec => {
        const key = `${sec.grade}_${sec.section}`.toLowerCase();
        const enrolledStudents = studentCountMap[key] || 0;
        const assignedSubjects = sec.assignedSubjects ?? 0;
        const weeklyHours = sec.weeklyHours ?? 0;
        const availableSlots = Math.max(0, sec.maxCapacity - enrolledStudents);

        return {
          id: sec._id,
          grade: sec.grade,
          section: sec.section,
          classroom: sec.classroom,
          maxCapacity: sec.maxCapacity,
          shift: sec.shift,
          status: sec.status,
          assignedSubjects,
          weeklyHours,
          enrolledStudents,
          availableSlots,
          createdAt: sec.createdAt,
          updatedAt: sec.updatedAt
        };
      });

      res.json({
        success: true,
        count: enriched.length,
        data: enriched
      });
    } catch (error) {
      console.error('Error al obtener grados y secciones:', error);
      res.status(500).json({ success: false, message: 'Error interno al consultar grados y secciones' });
    }
  }

  public static async create(req: Request, res: Response): Promise<void> {
    try {
      const { grade, section, classroom, maxCapacity, shift } = req.body;

      if (!grade || !section || !classroom) {
        res.status(400).json({
          success: false,
          message: 'El grado, sección y aula son campos requeridos.'
        });
        return;
      }

      const normalizedGrade = grade.trim();
      const normalizedSection = section.trim().toUpperCase();

      const existing = await GradeSection.findOne({
        grade: normalizedGrade,
        section: normalizedSection
      });

      if (existing) {
        res.status(400).json({
          success: false,
          message: `La sección "${normalizedSection}" ya se encuentra registrada para "${normalizedGrade}".`
        });
        return;
      }

      const id = `sec-${normalizedGrade.replace(/[^0-9]/g, '')}-${normalizedSection.toLowerCase()}-${Date.now().toString().slice(-4)}`;

      const newSection = await GradeSection.create({
        _id: id,
        grade: normalizedGrade,
        section: normalizedSection,
        classroom: classroom.trim(),
        maxCapacity: maxCapacity ? Number(maxCapacity) : 30,
        shift: shift ? shift.trim().toUpperCase() : 'MAÑANA',
        status: 'ACTIVE',
        assignedSubjects: 0,
        weeklyHours: 0
      });

      res.status(201).json({
        success: true,
        message: `Sección ${normalizedGrade} "${normalizedSection}" creada exitosamente.`,
        data: newSection
      });
    } catch (error) {
      console.error('Error al crear sección:', error);
      res.status(500).json({ success: false, message: 'Error interno al registrar grado y sección' });
    }
  }

  public static async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { classroom, maxCapacity, shift } = req.body;

      const existing = await GradeSection.findById(id);
      if (!existing) {
        res.status(404).json({ success: false, message: 'Sección no encontrada' });
        return;
      }

      if (classroom !== undefined) existing.classroom = classroom.trim();
      if (maxCapacity !== undefined) existing.maxCapacity = Number(maxCapacity);
      if (shift !== undefined) existing.shift = shift.trim().toUpperCase();

      const updated = await existing.save();

      res.json({
        success: true,
        message: 'Grado y sección actualizados correctamente.',
        data: {
          ...updated.toJSON(),
          assignedSubjects: updated.assignedSubjects
        }
      });
    } catch (error) {
      console.error('Error al actualizar sección:', error);
      res.status(500).json({ success: false, message: 'Error al modificar grado y sección' });
    }
  }

  public static async toggleStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const existing = await GradeSection.findById(id);
      if (!existing) {
        res.status(404).json({ success: false, message: 'Sección no encontrada' });
        return;
      }

      const newStatus = existing.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      existing.status = newStatus;
      const updated = await existing.save();

      const actionText = newStatus === 'INACTIVE'
        ? `Sección ${existing.grade} "${existing.section}" desactivada de forma segura. Alumnos y cursos conservan su historial académico íntegro.`
        : `Sección ${existing.grade} "${existing.section}" reactivada operativamente para nuevas matrículas.`;

      res.json({
        success: true,
        message: actionText,
        data: {
          ...updated.toJSON(),
          assignedSubjects: updated.assignedSubjects
        }
      });
    } catch (error) {
      console.error('Error al alternar estado de sección:', error);
      res.status(500).json({ success: false, message: 'Error al cambiar estado de grado y sección' });
    }
  }

  public static async assignGradeCoursesToSection(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const section = await GradeSection.findById(id);
      if (!section) {
        res.status(404).json({ success: false, message: 'Sección no encontrada' });
        return;
      }

      const gradeSubjects = await GradeSubject.find({ grade: section.grade }).lean();
      const subjectIds = gradeSubjects.map(ga => ga.subjectId);
      const subjects = await Subject.find({ _id: { $in: subjectIds } }).lean();

      const totalSubjects = subjects.length;
      const totalHours = subjects.reduce((sum, a) => sum + (a.weeklyHours || 0), 0);

      section.assignedSubjects = totalSubjects;
      section.weeklyHours = totalHours;
      const updated = await section.save();

      res.json({
        success: true,
        message: `Se asignaron ${totalSubjects} cursos (${totalHours} hrs/sem) a la sección ${section.grade} "${section.section}".`,
        data: {
          ...updated.toJSON(),
          assignedSubjects: updated.assignedSubjects
        }
      });
    } catch (error) {
      console.error('Error al asignar cursos a la sección:', error);
      res.status(500).json({ success: false, message: 'Error al asignar cursos a la sección' });
    }
  }

  public static async getGradeCourses(req: Request, res: Response): Promise<void> {
    try {
      const { grade } = req.params;
      if (grade) {
        const decodedGrade = decodeURIComponent(grade);
        const list = await GradeSubject.find({ grade: decodedGrade }).lean();
        const subjectIds = list.map(item => item.subjectId);
        const subjects = await Subject.find({ _id: { $in: subjectIds } }).lean();

        res.json({
          success: true,
          grade: decodedGrade,
          data: subjects
        });
        return;
      }

      const allAssignments = await GradeSubject.find().sort({ grade: 1 }).lean();
      const subjectIds = allAssignments.map(a => a.subjectId);
      const subjects = await Subject.find({ _id: { $in: subjectIds } }).lean();
      const subjectMap = new Map(subjects.map(a => [a._id, a]));

      const map: Record<string, any[]> = {};
      for (const item of allAssignments) {
        if (!map[item.grade]) {
          map[item.grade] = [];
        }
        const sub = subjectMap.get(item.subjectId);
        if (sub) {
          map[item.grade].push(sub);
        }
      }

      res.json({
        success: true,
        data: map
      });
    } catch (error) {
      console.error('Error al obtener cursos por grado:', error);
      res.status(500).json({ success: false, message: 'Error interno al consultar cursos por grado' });
    }
  }

  public static async updateGradeCourses(req: Request, res: Response): Promise<void> {
    try {
      const { grade } = req.params;
      const ids = req.body.subjectIds;

      if (!grade || !Array.isArray(ids)) {
        res.status(400).json({
          success: false,
          message: 'Se requiere el parámetro grado y la lista de IDs de subjects.'
        });
        return;
      }

      const decodedGrade = decodeURIComponent(grade);
      const uniqueIds = [...new Set(ids as string[])];

      const found = await Subject.find({ _id: { $in: uniqueIds } }, { _id: 1 }).lean();
      const unknown = uniqueIds.filter(aId => !found.some(f => f._id === aId));
      if (unknown.length > 0) {
        res.status(400).json({ success: false, message: `Cursos inexistentes: ${unknown.join(', ')}.` });
        return;
      }

      await GradeSubject.deleteMany({ grade: decodedGrade });
      await GradeSubject.insertMany(
        uniqueIds.map(aId => ({
          grade: decodedGrade,
          subjectId: aId
        }))
      );

      const subjects = await Subject.find({ _id: { $in: uniqueIds } }).lean();
      const totalHours = subjects.reduce((sum, a) => sum + (a.weeklyHours || 0), 0);

      res.json({
        success: true,
        message: `Plan de estudios para ${decodedGrade} actualizado correctamente (${subjects.length} cursos, ${totalHours} hrs/sem).`,
        grade: decodedGrade,
        totalHours,
        data: subjects
      });
    } catch (error) {
      console.error('Error al actualizar cursos por grado:', error);
      res.status(500).json({ success: false, message: 'Error interno al actualizar cursos del grado' });
    }
  }
}
