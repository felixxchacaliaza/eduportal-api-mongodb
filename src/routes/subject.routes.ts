import { Router } from 'express';
import { SubjectController } from '../controllers/subject.controller';
import { requireAnyPermission, requirePermission } from '../middleware/auth.middleware';
import { MODULE_KEYS } from '../controllers/profile.controller';
import { schemas, validateBody } from '../middleware/validate.middleware';

const router = Router();
const manage = requirePermission('subjects', 'FULL');

router.get('/', requireAnyPermission([...MODULE_KEYS]), SubjectController.getAll);
router.get('/:id', requireAnyPermission([...MODULE_KEYS]), SubjectController.getById);
router.get('/:id/history', requireAnyPermission(['subjects', 'staff']), SubjectController.getTeacherHistory);
router.post('/', manage, validateBody(schemas.subjectCreate), SubjectController.create);
router.put('/:id', manage, validateBody(schemas.subjectUpdate), SubjectController.update);
router.patch('/:id/toggle-status', manage, SubjectController.toggleStatus);
router.patch('/:id/teacher', manage, validateBody(schemas.assignTeacher), SubjectController.assignTeacher);

export default router;
