import { Router } from 'express';
import { ProfileController } from '../controllers/profile.controller';
import { requireAnyPermission, requirePermission } from '../middleware/auth.middleware';
import { schemas, validateBody } from '../middleware/validate.middleware';

const router = Router();
const manage = requirePermission('access_control', 'FULL');

router.get('/', requireAnyPermission(['access_control', 'staff']), ProfileController.getAll);
router.post('/', manage, validateBody(schemas.profile), ProfileController.create);
router.put('/:id', manage, validateBody(schemas.profile), ProfileController.update);
router.patch('/:id/toggle-status', manage, ProfileController.toggleStatus);

export default router;
