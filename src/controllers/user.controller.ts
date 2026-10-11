import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { User, Profile, Teacher } from '../models';
import { config } from '../config/env';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { buildInstitutionalEmail } from '../lib/email-generator';
import { serializeUser } from '../lib/serializers';

const SUPER_ADMIN_PROFILE = 'prof-super-admin';
const BLOCKED_PROFILE = 'prof-sin-acceso';

const STAFF_ROLES = [
  'ADMIN',
  'DIRECTOR',
  'SUBDIRECTOR',
  'COORDINADOR_PEDAGOGICO',
  'COORDINADOR_TUTORIA',
  'TEACHER',
  'AUXILIAR_EDUCACION',
  'PSICOLOGO',
  'ADMINISTRATIVO'
];

/** Perfil por defecto según el rol (editable luego desde Accesos). */
export function defaultProfileForRole(role: string): string {
  switch (role) {
    case 'DIRECTOR':
    case 'SUBDIRECTOR':
      return 'prof-director';
    case 'TEACHER':
    case 'COORDINADOR_PEDAGOGICO':
    case 'COORDINADOR_TUTORIA':
      return 'prof-docente';
    case 'STUDENT':
      return 'prof-alumno';
    case 'ADMIN':
    case 'ADMINISTRATIVO':
      return 'prof-admin';
    default:
      return BLOCKED_PROFILE;
  }
}

async function profileHasOptions(profileId: string | null): Promise<boolean> {
  if (!profileId) return false;
  const p = await Profile.findById(profileId).lean();
  return (p?.options?.length ?? 0) > 0;
}

/**
 * La cuenta del Super Usuario solo la puede modificar él mismo
 */
function protectsSuperUser(target: { id: string; profileId?: string | null }, req: AuthenticatedRequest, res: Response): boolean {
  if (target.profileId === SUPER_ADMIN_PROFILE && req.auth?.id !== target.id) {
    res.status(403).json({ success: false, message: 'La cuenta del Super Usuario solo puede ser modificada por él mismo.' });
    return true;
  }
  return false;
}

export class UserController {
  /** Lista de usuarios con perfil y carga académica. ?role=STUDENT|TEACHER|... para filtrar. */
  public static async getAll(req: Request, res: Response): Promise<void> {
    try {
      const { role } = req.query;
      const filter = role && typeof role === 'string' && role !== 'ALL' ? { role: role.toUpperCase() } : {};

      const [users, profiles, teachers] = await Promise.all([
        User.find(filter).sort({ role: 1, name: 1 }).lean(),
        Profile.find().lean(),
        Teacher.find().lean()
      ]);

      const profileMap = new Map(profiles.map(p => [p._id, p]));
      const teacherMap = new Map(teachers.map(t => [t._id, t]));

      const data = users.map(u => {
        const teacher = u.teacherId ? teacherMap.get(u.teacherId) : null;
        let subjectsCount = 0;
        try {
          subjectsCount = teacher ? (JSON.parse(teacher.subjects) as unknown[]).length : 0;
        } catch {
          subjectsCount = 0;
        }

        const userWithProfile = {
          ...u,
          profile: u.profileId ? profileMap.get(u.profileId) : null
        };

        return serializeUser(userWithProfile, {
          assignedCoursesCount: teacher?.assignments?.length ?? 0,
          assignedSubjectsCount: subjectsCount
        });
      });

      res.json({ success: true, count: data.length, data });
    } catch (error) {
      console.error('Error al listar usuarios:', error);
      res.status(500).json({ success: false, message: 'Error interno al consultar usuarios' });
    }
  }

  /** Crea personal. El correo institucional lo genera SIEMPRE el servidor. */
  public static async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const body = req.body as {
        name: string; dni: string; role: string; cargo?: string; specialty?: string; password?: string;
        profileId?: string; appAccess?: boolean; webAccess?: boolean;
      };

      if (!STAFF_ROLES.includes(body.role)) {
        res.status(400).json({ success: false, message: `El rol '${body.role}' no es válido.` });
        return;
      }

      const parts = body.name.replace(/\([^)]*\)/g, '').trim().split(/\s+/);
      const nameNoTitle = parts.filter((p, i) => !(i === 0 && /\.$/.test(p)));
      const email = buildInstitutionalEmail(nameNoTitle[0], nameNoTitle[1] ?? '', body.dni);

      const clash = await User.findOne({ $or: [{ email }, { dni: body.dni }] });
      if (clash) {
        res.status(409).json({ success: false, message: 'Ya existe un usuario con ese DNI o correo institucional.' });
        return;
      }

      const profileId = body.profileId || defaultProfileForRole(body.role);
      const profile = await Profile.findById(profileId);
      if (!profile) {
        res.status(400).json({ success: false, message: 'El perfil indicado no existe.' });
        return;
      }
      if (profileId === SUPER_ADMIN_PROFILE && (await User.countDocuments({ profileId: SUPER_ADMIN_PROFILE })) > 0) {
        res.status(409).json({ success: false, message: 'Solo puede existir un (1) Super Usuario en el sistema.' });
        return;
      }

      const hasOptions = await profileHasOptions(profileId);
      const appAccess = body.appAccess ?? true;
      const created = await User.create({
        _id: `usr-${randomUUID().slice(0, 8)}`,
        email,
        dni: body.dni,
        name: body.name,
        role: body.role,
        cargo: body.cargo ?? null,
        specialty: body.specialty ?? null,
        password: await bcrypt.hash(body.password ?? config.defaultPassword, 10),
        mustChangePassword: !body.password,
        profileId,
        appAccess,
        webAccess: appAccess && hasOptions ? (body.webAccess ?? true) : false,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(email)}`
      });

      const userWithProfile = { ...created.toJSON(), profile: profile.toJSON() };

      res.status(201).json({
        success: true,
        message: `Usuario registrado con correo institucional ${email}.`,
        data: serializeUser(userWithProfile)
      });
    } catch (error) {
      console.error('Error al registrar usuario:', error);
      res.status(500).json({ success: false, message: 'Error interno al crear usuario' });
    }
  }

  /** Cambia el perfil de acceso del usuario aplicando las reglas de negocio. */
  public static async assignProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { profileId } = req.body as { profileId: string };

      const user = await User.findById(id);
      if (!user) {
        res.status(404).json({ success: false, message: 'Usuario no encontrado' });
        return;
      }
      if (protectsSuperUser({ id: user._id, profileId: user.profileId }, req, res)) return;

      const profile = await Profile.findById(profileId);
      if (!profile) {
        res.status(400).json({ success: false, message: 'El perfil indicado no existe.' });
        return;
      }
      if (
        profileId === SUPER_ADMIN_PROFILE &&
        (await User.countDocuments({ profileId: SUPER_ADMIN_PROFILE, _id: { $ne: id } })) > 0
      ) {
        res.status(409).json({ success: false, message: 'Solo puede existir un (1) Super Usuario en el sistema.' });
        return;
      }
      if (user.profileId === SUPER_ADMIN_PROFILE && profileId !== SUPER_ADMIN_PROFILE) {
        res.status(409).json({ success: false, message: 'El Super Usuario no puede perder su perfil: el sistema quedaría sin administrador.' });
        return;
      }

      const hasOptions = await profileHasOptions(profileId);
      user.profileId = profileId;
      user.webAccess = hasOptions && user.appAccess;
      await user.save();

      const userWithProfile = { ...user.toJSON(), profile: profile.toJSON() };
      res.json({ success: true, message: 'Perfil asignado correctamente.', data: serializeUser(userWithProfile) });
    } catch (error) {
      console.error('Error al asignar perfil:', error);
      res.status(500).json({ success: false, message: 'Error interno al asignar perfil' });
    }
  }

  /** Estado en el colegio (appAccess) y acceso web (webAccess). */
  public static async setAccess(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { appAccess, webAccess } = req.body as { appAccess?: boolean; webAccess?: boolean };

      const user = await User.findById(id);
      if (!user) {
        res.status(404).json({ success: false, message: 'Usuario no encontrado' });
        return;
      }
      if (user.profileId === SUPER_ADMIN_PROFILE && (appAccess === false || webAccess === false)) {
        res.status(409).json({ success: false, message: 'El Super Usuario no puede ser desactivado.' });
        return;
      }
      if (protectsSuperUser({ id: user._id, profileId: user.profileId }, req, res)) return;

      const nextApp = appAccess ?? user.appAccess;
      const hasOptions = await profileHasOptions(user.profileId ?? null);
      const nextWeb = nextApp && hasOptions ? (webAccess ?? user.webAccess) : false;

      user.appAccess = nextApp;
      user.webAccess = nextWeb;
      user.status = nextApp ? 'ACTIVE' : 'INACTIVE';
      await user.save();

      const profile = user.profileId ? await Profile.findById(user.profileId).lean() : null;
      const userWithProfile = { ...user.toJSON(), profile };

      res.json({ success: true, message: 'Accesos actualizados.', data: serializeUser(userWithProfile) });
    } catch (error) {
      console.error('Error al actualizar accesos:', error);
      res.status(500).json({ success: false, message: 'Error interno al actualizar accesos' });
    }
  }

  /** Administración restablece la contraseña de un usuario. */
  public static async setPassword(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { password } = req.body as { password?: string };
      const user = await User.findById(id);
      if (!user) {
        res.status(404).json({ success: false, message: 'Usuario no encontrado' });
        return;
      }
      if (protectsSuperUser({ id: user._id, profileId: user.profileId }, req, res)) return;

      user.password = await bcrypt.hash(password ?? config.defaultPassword, 10);
      user.mustChangePassword = !password;
      await user.save();

      res.json({ success: true, message: 'Contraseña restablecida correctamente.' });
    } catch (error) {
      console.error('Error al restablecer contraseña:', error);
      res.status(500).json({ success: false, message: 'Error interno al restablecer contraseña' });
    }
  }

  /** Alterna el estado ACTIVE/INACTIVE (equivale a appAccess). */
  public static async toggleStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const user = await User.findById(req.params.id);
      if (!user) {
        res.status(404).json({ success: false, message: 'Usuario no encontrado' });
        return;
      }
      req.body = { appAccess: user.status !== 'ACTIVE' };
      await UserController.setAccess(req, res);
    } catch (error) {
      console.error('Error al alternar estado:', error);
      res.status(500).json({ success: false, message: 'Error interno al cambiar estado' });
    }
  }
}
