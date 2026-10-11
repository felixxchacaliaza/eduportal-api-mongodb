import { Router } from 'express';
import { GradeSectionController } from '../controllers/grade-section.controller';
import { requireAnyPermission, requirePermission } from '../middleware/auth.middleware';
import { MODULE_KEYS } from '../controllers/profile.controller';
import { schemas, validateBody } from '../middleware/validate.middleware';

const router = Router();
const readAny = requireAnyPermission([...MODULE_KEYS]);
const manageSections = requirePermission('grade_sections', 'FULL');
const manageSubjects = requirePermission('grade_subjects', 'FULL');

router.get('/', readAny, GradeSectionController.getAll);

// Asignaturas / Subjects por grado (malla curricular)
router.get('/subjects', readAny, GradeSectionController.getGradeCourses);
router.get('/subjects/:grade', readAny, GradeSectionController.getGradeCourses);
router.put('/subjects/:grade', manageSubjects, validateBody(schemas.gradeCourses), GradeSectionController.updateGradeCourses);
router.post('/:id/assign-grade-subjects', manageSections, GradeSectionController.assignGradeCoursesToSection);


router.post('/', manageSections, validateBody(schemas.gradeSectionCreate), GradeSectionController.create);
router.put('/:id', manageSections, validateBody(schemas.gradeSectionUpdate), GradeSectionController.update);
router.patch('/:id/toggle-status', manageSections, GradeSectionController.toggleStatus);

export default router;
