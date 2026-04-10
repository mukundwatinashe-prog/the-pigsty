import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth.middleware';
import { requireFarmAccess } from '../middleware/rbac.middleware';
import { FeedController } from '../controllers/feed.controller';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.use(authenticate);

router.get('/:farmId/feed/stock', requireFarmAccess('feed:read'), FeedController.getStock);
router.get('/:farmId/feed/summary', requireFarmAccess('feed:read'), FeedController.getSummary);
router.get('/:farmId/feed/purchases', requireFarmAccess('feed:read'), FeedController.listPurchases);
router.get(
  '/:farmId/feed/purchases/export',
  requireFarmAccess('feed:read'),
  FeedController.exportPurchaseHistory,
);
router.post(
  '/:farmId/feed/purchases',
  requireFarmAccess('feed:write'),
  upload.single('receipt'),
  FeedController.createPurchase,
);
router.get(
  '/:farmId/feed/purchases/:purchaseId/receipt',
  requireFarmAccess('feed:read'),
  FeedController.getPurchaseReceipt,
);
router.get('/:farmId/feed/daily', requireFarmAccess('feed:read'), FeedController.listDailyUsage);
router.get('/:farmId/feed/daily/:date', requireFarmAccess('feed:read'), FeedController.getDailyUsageByDate);
router.put('/:farmId/feed/daily/:date', requireFarmAccess('feed:write'), FeedController.upsertDailyUsage);
router.get('/:farmId/feed/reports/export', requireFarmAccess('feed:read'), FeedController.exportReports);
router.get('/:farmId/feed/reports', requireFarmAccess('feed:read'), FeedController.getReports);
router.get('/:farmId/feed/costs', requireFarmAccess('feed:read'), FeedController.getCosts);

export default router;
