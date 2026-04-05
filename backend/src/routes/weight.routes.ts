import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requireFarmAccess } from '../middleware/rbac.middleware';
import { WeightController } from '../controllers/weight.controller';

const router = Router();
router.use(authenticate);

router.post('/:farmId/weights', requireFarmAccess('weights:write'), WeightController.logWeight);
router.post('/:farmId/weights/bulk', requireFarmAccess('weights:write'), WeightController.bulkLogByPen);
router.get('/:farmId/weights', requireFarmAccess('weights:read'), WeightController.getRecentLogs);
router.get('/:farmId/pigs/:pigId/weights', requireFarmAccess('weights:read'), WeightController.getHistory);

export default router;
