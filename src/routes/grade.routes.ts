import { Router } from 'express';
import { GradeController } from '../controllers/grade.controller';
import { requireAnyPermission, requirePermission } from '../middleware/auth.middleware';
import { schemas, validateBody } from '../middleware/validate.middleware';

const router = Router();

router.get('/', requireAnyPermission(['grades', 'dashboard']), GradeController.getAll);
router.patch(
  '/batch',
  requirePermission('grades', 'FULL'),
  validateBody(schemas.gradeBatchUpdate),
  GradeController.batchUpdate
);
router.patch(
  '/:studentId/:subjectId',
  requirePermission('grades', 'FULL'),
  validateBody(schemas.gradeUpdate),
  GradeController.updateGrade
);

export default router;
