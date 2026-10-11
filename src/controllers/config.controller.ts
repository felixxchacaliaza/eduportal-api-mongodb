import { Request, Response } from 'express';
import { SchoolSetting, AcademicYear } from '../models';
import { randomUUID } from 'crypto';

const SETTING_KEYS = ['school', 'rules'] as const;

export class ConfigController {
  /** GET /config/:key  (school | rules). Devuelve {} si aún no se configuró. */
  public static async getSetting(req: Request, res: Response): Promise<void> {
    const key = req.params.key as (typeof SETTING_KEYS)[number];
    if (!SETTING_KEYS.includes(key)) {
      res.status(404).json({ success: false, message: 'Configuración no encontrada' });
      return;
    }
    try {
      const row = await SchoolSetting.findById(key);
      res.json({ success: true, data: row ? row.value : {} });
    } catch (error) {
      console.error('Error al leer configuración:', error);
      res.status(500).json({ success: false, message: 'Error interno al consultar configuración' });
    }
  }

  public static async putSetting(req: Request, res: Response): Promise<void> {
    const key = req.params.key as (typeof SETTING_KEYS)[number];
    if (!SETTING_KEYS.includes(key)) {
      res.status(404).json({ success: false, message: 'Configuración no encontrada' });
      return;
    }
    try {
      await SchoolSetting.findByIdAndUpdate(
        key,
        { _id: key, value: req.body },
        { upsert: true, new: true }
      );
      res.json({ success: true, message: 'Configuración guardada.', data: req.body });
    } catch (error) {
      console.error('Error al guardar configuración:', error);
      res.status(500).json({ success: false, message: 'Error interno al guardar configuración' });
    }
  }

  // ─── Año lectivo y bimestres ───────────────────────────────

  public static async listYears(_req: Request, res: Response): Promise<void> {
    try {
      const years = await AcademicYear.find().sort({ year: -1 });
      const data = years.map(y => {
        const obj: any = y.toJSON();
        if (Array.isArray(obj.bimesters)) {
          obj.bimesters.sort((a: any, b: any) => a.number - b.number);
        }
        return obj;
      });
      res.json({ success: true, count: data.length, data });
    } catch (error) {
      console.error('Error al listar años lectivos:', error);
      res.status(500).json({ success: false, message: 'Error interno al consultar años lectivos' });
    }
  }

  public static async upsertYear(req: Request, res: Response): Promise<void> {
    try {
      const body = req.body as {
        year: number; name: string; startsAt: Date; endsAt: Date; isActive?: boolean;
        bimesters?: { number: number; startsAt: Date; endsAt: Date; isOpen: boolean }[];
      };
      if (new Date(body.endsAt) <= new Date(body.startsAt)) {
        res.status(400).json({ success: false, message: 'La fecha de fin debe ser posterior al inicio.' });
        return;
      }

      if (body.isActive) {
        await AcademicYear.updateMany({}, { $set: { isActive: false } });
      }

      let year = await AcademicYear.findOne({ year: body.year });
      if (!year) {
        year = new AcademicYear({
          _id: randomUUID(),
          year: body.year,
          name: body.name,
          startsAt: body.startsAt,
          endsAt: body.endsAt,
          isActive: !!body.isActive,
          bimesters: (body.bimesters || []).map(b => ({
            _id: randomUUID(),
            number: b.number,
            startsAt: b.startsAt,
            endsAt: b.endsAt,
            isOpen: b.isOpen
          }))
        });
      } else {
        year.name = body.name;
        year.startsAt = body.startsAt;
        year.endsAt = body.endsAt;
        if (body.isActive !== undefined) year.isActive = body.isActive;
        if (body.bimesters) {
          year.bimesters = body.bimesters.map(b => ({
            _id: randomUUID(),
            number: b.number,
            startsAt: b.startsAt,
            endsAt: b.endsAt,
            isOpen: b.isOpen
          })) as any;
        }
      }

      const saved = await year.save();
      const obj: any = saved.toJSON();
      if (Array.isArray(obj.bimesters)) {
        obj.bimesters.sort((a: any, b: any) => a.number - b.number);
      }

      res.json({ success: true, message: 'Año lectivo guardado.', data: obj });
    } catch (error) {
      console.error('Error al guardar año lectivo:', error);
      res.status(500).json({ success: false, message: 'Error interno al guardar año lectivo' });
    }
  }

  public static async activateYear(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const year = await AcademicYear.findById(id);
      if (!year) {
        res.status(404).json({ success: false, message: 'Año lectivo no encontrado' });
        return;
      }

      await AcademicYear.updateMany({}, { $set: { isActive: false } });
      year.isActive = true;
      await year.save();

      res.json({ success: true, message: 'Año lectivo activado.' });
    } catch (error) {
      console.error('Error al activar año lectivo:', error);
      res.status(500).json({ success: false, message: 'Error interno al activar año lectivo' });
    }
  }
}
