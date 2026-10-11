import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, Profile } from '../models';
import { config } from '../config/env';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { serializeUser } from '../lib/serializers';

// Hash de relleno para igualar el tiempo de respuesta cuando el usuario no existe
const DUMMY_HASH = bcrypt.hashSync('no-existe', 10);

export class AuthController {
  public static async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body as { email: string; password: string };

      const user = await User.findOne({ email: email.toLowerCase().trim() }).lean();
      const passwordOk = await bcrypt.compare(password, user?.password ?? DUMMY_HASH);

      // Mensaje único: no revela si el correo existe
      if (!user || !passwordOk) {
        res.status(401).json({ success: false, message: 'Correo o contraseña incorrectos.' });
        return;
      }

      if (user.status !== 'ACTIVE' || !user.appAccess) {
        res.status(403).json({
          success: false,
          message: 'Su cuenta se encuentra inhabilitada. Comuníquese con la Dirección o Administración de la I.E.'
        });
        return;
      }

      const profile = user.profileId ? await Profile.findById(user.profileId).lean() : null;

      if (!user.webAccess || !profile || (profile.options?.length ?? 0) === 0) {
        res.status(403).json({
          success: false,
          message: 'Su perfil no tiene acceso a la plataforma web. Comuníquese con Administración.'
        });
        return;
      }

      const token = jwt.sign({ id: user._id }, config.jwtSecret, { expiresIn: config.jwtExpiresIn } as jwt.SignOptions);

      const userWithProfile = { ...user, profile };
      const serialized = serializeUser(userWithProfile, { token });

      res.json({
        success: true,
        message: 'Sesión iniciada correctamente',
        token,
        user: serialized,
        data: { token, user: serialized }
      });
    } catch (error) {
      console.error('Error en login:', error);
      res.status(500).json({ success: false, message: 'Error al procesar el inicio de sesión' });
    }
  }

  public static async me(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const user = await User.findById(req.auth!.id).lean();
      if (!user) {
        res.status(404).json({ success: false, message: 'Usuario no encontrado' });
        return;
      }
      const profile = user.profileId ? await Profile.findById(user.profileId).lean() : null;
      const userWithProfile = { ...user, profile };
      const serialized = serializeUser(userWithProfile);
      res.json({ success: true, user: serialized, data: serialized });
    } catch (error) {
      console.error('Error en /auth/me:', error);
      res.status(500).json({ success: false, message: 'Error al obtener datos de usuario' });
    }
  }

  public static async changePassword(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
      const user = await User.findById(req.auth!.id);
      if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
        res.status(400).json({ success: false, message: 'La contraseña actual es incorrecta.' });
        return;
      }
      user.password = await bcrypt.hash(newPassword, 10);
      user.mustChangePassword = false;
      await user.save();

      res.json({ success: true, message: 'Contraseña actualizada correctamente.' });
    } catch (error) {
      console.error('Error al cambiar contraseña:', error);
      res.status(500).json({ success: false, message: 'Error al cambiar la contraseña' });
    }
  }
}
