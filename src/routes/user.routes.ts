import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { requireAnyPermission, requirePermission } from '../middleware/auth.middleware';
import { schemas, validateBody } from '../middleware/validate.middleware';

const router = Router();
const manage = requirePermission('access_control', 'FULL');

router.get('/', requireAnyPermission(['access_control', 'staff']), UserController.getAll);
router.post('/', manage, validateBody(schemas.staffUser), UserController.create);
router.patch('/:id/profile', manage, validateBody(schemas.assignProfile), UserController.assignProfile);
router.patch('/:id/access', manage, validateBody(schemas.userAccess), UserController.setAccess);
router.put('/:id/password', manage, validateBody(schemas.resetPassword), UserController.setPassword);
router.patch('/:id/toggle-status', manage, UserController.toggleStatus);

export default router;
