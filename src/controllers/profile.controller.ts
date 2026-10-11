import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { Profile, User } from '../models';
import { serializeProfile } from '../lib/serializers';

export const MODULE_KEYS = [
  'dashboard',
  'students',
  'staff',
  'grades',
  'grade_sections',
  'grade_subjects',
  'subjects',
  'access_control',
  'school_config'
] as const;

const SUPER_ADMIN_PROFILE = 'prof-super-admin';

type Body = {
  name: string;
  description: string;
  icon?: string;
  colorClass?: string;
  options: string[];
  permissions: Record<string, 'FULL' | 'READ_ONLY'>;
};

/** Normaliza options/permissions en una lista (clave, nivel) solo con módulos válidos. */
function resolveOptions(body: Body): { optionKey: string; level: 'FULL' | 'READ_ONLY' }[] {
  const keys = new Set<string>([...(body.options || []), ...Object.keys(body.permissions || {})]);
  return [...keys]
    .filter(k => (MODULE_KEYS as readonly string[]).includes(k as any))
    .map(k => ({ optionKey: k, level: (body.permissions?.[k] as 'FULL' | 'READ_ONLY') ?? 'FULL' }));
}

export class ProfileController {
  public static async getAll(_req: Request, res: Response): Promise<void> {
    try {
      const profiles = await Profile.find().sort({ createdAt: 1 });
      const counts = await User.aggregate([
        { $group: { _id: '$profileId', count: { $sum: 1 } } }
      ]);
      const countMap = new Map(counts.map(c => [c._id, c.count]));

      const data = profiles.map(p => {
        const serialized = serializeProfile(p);
        return {
          ...serialized,
          userCount: countMap.get(p._id) || 0
        };
      });

      res.json({
        success: true,
        count: data.length,
        data
      });
    } catch (error) {
      console.error('Error al listar perfiles:', error);
      res.status(500).json({ success: false, message: 'Error interno al consultar perfiles' });
    }
  }

  public static async create(req: Request, res: Response): Promise<void> {
    try {
      const body = req.body as Body;
      const existing = await Profile.findOne({ name: body.name });
      if (existing) {
        res.status(409).json({ success: false, message: 'Ya existe un perfil con ese nombre.' });
        return;
      }

      const created = await Profile.create({
        _id: `prof-${randomUUID().slice(0, 8)}`,
        name: body.name,
        description: body.description,
        icon: body.icon ?? 'shield',
        colorClass: body.colorClass ?? 'prof-blue',
        options: resolveOptions(body)
      });

      res.status(201).json({ success: true, message: 'Perfil creado.', data: serializeProfile(created) });
    } catch (error) {
      console.error('Error al crear perfil:', error);
      res.status(500).json({ success: false, message: 'Error interno al crear perfil' });
    }
  }

  public static async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const body = req.body as Body;
      const current = await Profile.findById(id);
      if (!current) {
        res.status(404).json({ success: false, message: 'Perfil no encontrado' });
        return;
      }

      const clash = await Profile.findOne({ name: body.name, _id: { $ne: id } });
      if (clash) {
        res.status(409).json({ success: false, message: 'Ya existe un perfil con ese nombre.' });
        return;
      }

      // El Super Usuario conserva SIEMPRE control total de todos los módulos.
      const options =
        id === SUPER_ADMIN_PROFILE
          ? MODULE_KEYS.map(k => ({ optionKey: k, level: 'FULL' as const }))
          : resolveOptions(body);

      current.name = current.isSystem ? current.name : body.name;
      current.description = body.description;
      if (body.icon) current.icon = body.icon;
      if (body.colorClass) current.colorClass = body.colorClass;
      current.options = options;

      const updated = await current.save();

      // Un perfil sin módulos no puede ingresar a la web.
      if (updated.options.length === 0) {
        await User.updateMany({ profileId: id }, { $set: { webAccess: false } });
      }

      res.json({ success: true, message: 'Perfil actualizado.', data: serializeProfile(updated) });
    } catch (error) {
      console.error('Error al actualizar perfil:', error);
      res.status(500).json({ success: false, message: 'Error interno al actualizar perfil' });
    }
  }

  public static async toggleStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const profile = await Profile.findById(id);
      if (!profile) {
        res.status(404).json({ success: false, message: 'Perfil no encontrado' });
        return;
      }
      if (profile.isSystem) {
        res.status(409).json({ success: false, message: 'Los perfiles predefinidos del sistema no se pueden deshabilitar.' });
        return;
      }

      const newStatus = profile.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      profile.status = newStatus;
      const updated = await profile.save();

      // Si se desactiva el perfil, deshabilitar acceso web a los usuarios vinculados
      if (newStatus === 'INACTIVE') {
        await User.updateMany({ profileId: id }, { $set: { webAccess: false } });
      }

      const actionText = newStatus === 'ACTIVE' ? 'activado' : 'desactivado';
      res.json({
        success: true,
        message: `El perfil "${updated.name}" ha sido ${actionText} exitosamente.`,
        data: serializeProfile(updated)
      });
    } catch (error) {
      console.error('Error al cambiar estado del perfil:', error);
      res.status(500).json({ success: false, message: 'Error interno al cambiar estado del perfil' });
    }
  }
}
