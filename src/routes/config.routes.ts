import { Router } from 'express';
import { ConfigController } from '../controllers/config.controller';
import { requirePermission } from '../middleware/auth.middleware';
import { schemas, validateBody } from '../middleware/validate.middleware';

const router = Router();
const manage = requirePermission('school_config', 'FULL');

// Lectura: cualquier usuario autenticado (el router ya exige token)
router.get('/academic-years', ConfigController.listYears);
router.put('/academic-years', manage, validateBody(schemas.academicYear), ConfigController.upsertYear);
router.patch('/academic-years/:id/activate', manage, ConfigController.activateYear);

router.get('/:key', ConfigController.getSetting);
router.put('/:key', manage, validateBody(schemas.settingValue), ConfigController.putSetting);

export default router;
