import { Router } from 'express';
import { TeacherController } from '../controllers/teacher.controller';
import { requireAnyPermission, requirePermission } from '../middleware/auth.middleware';
import { MODULE_KEYS } from '../controllers/profile.controller';
import { schemas, validateBody } from '../middleware/validate.middleware';

const router = Router();
const manage = requirePermission('staff', 'FULL');

// Plana Docente (Educación Secundaria)
router.get('/', requireAnyPermission([...MODULE_KEYS]), TeacherController.getAll);
router.get('/:id', requireAnyPermission([...MODULE_KEYS]), TeacherController.getById);
router.post('/', manage, validateBody(schemas.teacherCreate), TeacherController.create);
router.put('/:id', manage, validateBody(schemas.teacherUpdate), TeacherController.update);
router.patch('/:id/toggle-status', manage, TeacherController.toggleStatus);

export default router;
