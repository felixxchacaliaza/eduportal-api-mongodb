import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { schemas, validateBody } from '../middleware/validate.middleware';

const router = Router();

// Anti fuerza bruta: 10 intentos por IP cada 15 minutos
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Demasiados intentos. Intente nuevamente en 15 minutos.' }
});

router.post('/login', loginLimiter, validateBody(schemas.login), AuthController.login);
router.get('/me', authenticate as any, AuthController.me as any);
router.post(
  '/change-password',
  authenticate as any,
  validateBody(schemas.changePassword),
  AuthController.changePassword as any
);

export default router;
