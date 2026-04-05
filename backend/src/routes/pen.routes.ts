import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requireFarmAccess } from '../middleware/rbac.middleware';
import { PenController } from '../controllers/pen.controller';

const router = Router();
router.use(authenticate);

router.get('/:farmId/pens', requireFarmAccess('pens:read'), PenController.list);
router.post('/:farmId/pens', requireFarmAccess('pens:write'), PenController.create);
router.patch('/:farmId/pens/:penId', requireFarmAccess('pens:write'), PenController.update);
router.delete('/:farmId/pens/:penId', requireFarmAccess('pens:delete'), PenController.delete);

export default router;
