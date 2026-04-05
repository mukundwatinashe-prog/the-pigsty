import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requireFarmAccess } from '../middleware/rbac.middleware';
import { FarmController } from '../controllers/farm.controller';
import { BillingController } from '../controllers/billing.controller';
import { FinancialController } from '../controllers/financial.controller';

const router = Router();

router.use(authenticate);

router.post('/', FarmController.create);
router.get('/', FarmController.list);
router.get('/:farmId/billing', requireFarmAccess('pigs:read'), BillingController.summary);
router.post('/:farmId/billing/checkout', requireFarmAccess('farm:settings'), BillingController.createCheckoutSession);
router.post('/:farmId/billing/portal', requireFarmAccess('farm:settings'), BillingController.createPortalSession);
router.get('/:farmId/financials', requireFarmAccess('reports:read'), FinancialController.summary);
router.get('/:farmId', requireFarmAccess('pigs:read'), FarmController.getById);
router.patch('/:farmId', requireFarmAccess('farm:settings'), FarmController.update);
router.delete('/:farmId', requireFarmAccess('farm:delete'), FarmController.delete);
router.post('/:farmId/invite', requireFarmAccess('users:manage'), FarmController.invite);
router.delete('/:farmId/members/:memberId', requireFarmAccess('users:manage'), FarmController.removeMember);

export default router;
