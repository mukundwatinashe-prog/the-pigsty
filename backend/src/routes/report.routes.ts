import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requireFarmAccess } from '../middleware/rbac.middleware';
import { ReportController } from '../controllers/report.controller';

const router = Router();
router.use(authenticate);

router.get('/:farmId/reports/herd-inventory', requireFarmAccess('reports:read'), ReportController.herdInventory);
router.get('/:farmId/reports/weight-gain', requireFarmAccess('reports:read'), ReportController.weightGain);
router.get('/:farmId/reports/activity-log', requireFarmAccess('audit:read'), ReportController.activityLog);
router.get('/:farmId/reports/sales', requireFarmAccess('reports:read'), ReportController.salesReport);
router.get('/:farmId/reports/financials', requireFarmAccess('reports:read'), ReportController.financials);
router.get('/:farmId/reports/daily-summary', requireFarmAccess('reports:read'), ReportController.dailySummary);

export default router;
