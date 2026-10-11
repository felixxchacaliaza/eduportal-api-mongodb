import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { User, Profile } from '../models';

export type PermissionLevel = 'FULL' | 'READ_ONLY';

export interface AuthContext {
  id: string;
  email: string;
  name: string;
  role: string;
  profileId: string | null;
  permissions: Record<string, PermissionLevel>;
  studentId: string | null;
  teacherId: string | null;
}

export interface AuthenticatedRequest extends Request {
  auth?: AuthContext;
}

function deny(res: Response, status: number, message: string): void {
  res.status(status).json({ success: false, message });
}

/**
 * Autentica la petición: valida el JWT y recarga al usuario desde MongoDB en cada
 * llamada, de modo que un cambio de perfil, de estado o de acceso web rige de inmediato.
 */
export async function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    deny(res, 401, 'Autenticación requerida.');
    return;
  }

  let userId: string;
  try {
    const decoded = jwt.verify(header.slice(7), config.jwtSecret) as { id?: string };
    if (!decoded?.id) throw new Error('payload');
    userId = decoded.id;
  } catch {
    deny(res, 401, 'Token inválido o expirado.');
    return;
  }

  try {
    const user = await User.findById(userId).lean();

    if (!user || user.status !== 'ACTIVE' || !user.appAccess || !user.webAccess) {
      deny(res, 401, 'La cuenta no está habilitada para acceder a la plataforma.');
      return;
    }

    const profile = user.profileId ? await Profile.findById(user.profileId).lean() : null;

    const permissions: Record<string, PermissionLevel> = {};
    for (const opt of profile?.options ?? []) {
      permissions[opt.optionKey] = opt.level === 'READ_ONLY' ? 'READ_ONLY' : 'FULL';
    }

    req.auth = {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      profileId: user.profileId || null,
      permissions,
      studentId: user.studentId || null,
      teacherId: user.teacherId || null
    };
    next();
  } catch (error) {
    next(error);
  }
}

function satisfies(auth: AuthContext | undefined, key: string, level: PermissionLevel): boolean {
  const granted = auth?.permissions[key];
  if (!granted) return false;
  return level === 'READ_ONLY' ? true : granted === 'FULL';
}

/** Exige permiso sobre un módulo (FULL para modificar, READ_ONLY para consultar). */
export function requirePermission(key: string, level: PermissionLevel = 'FULL') {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (satisfies(req.auth, key, level)) {
      next();
      return;
    }
    deny(res, 403, 'Acceso denegado: su perfil no tiene permiso para esta operación.');
  };
}

/** Exige al menos uno de los permisos indicados. */
export function requireAnyPermission(keys: string[], level: PermissionLevel = 'READ_ONLY') {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (keys.some(k => satisfies(req.auth, k, level))) {
      next();
      return;
    }
    deny(res, 403, 'Acceso denegado: su perfil no tiene permiso para esta consulta.');
  };
}

/** Un alumno solo puede ver su propia información. */
export function isStudentScoped(auth?: AuthContext): auth is AuthContext & { studentId: string } {
  return !!auth && auth.role === 'STUDENT' && !!auth.studentId;
}
