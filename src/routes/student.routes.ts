import { Router } from 'express';
import { StudentController } from '../controllers/student.controller';
import { requireAnyPermission, requirePermission } from '../middleware/auth.middleware';
import { schemas, validateBody } from '../middleware/validate.middleware';

const router = Router();
const manage = requirePermission('students', 'FULL');

router.get('/', requireAnyPermission(['students', 'grades', 'grade_sections', 'dashboard']), StudentController.getAll);
router.get('/:id', requireAnyPermission(['students', 'grades', 'dashboard']), StudentController.getById);
router.post('/', manage, validateBody(schemas.student), StudentController.create);
router.put('/:id', manage, validateBody(schemas.studentUpdate), StudentController.update);
router.patch('/:id/toggle-status', manage, StudentController.toggleStatus);

export default router;
