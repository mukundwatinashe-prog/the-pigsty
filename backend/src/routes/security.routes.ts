import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requirePlatformAdmin } from '../middleware/admin.middleware';
import { SecurityController } from '../controllers/security.controller';

const router = Router();

router.use(authenticate, requirePlatformAdmin);

router.get('/summary', SecurityController.summary);
router.get('/events', SecurityController.listEvents);
router.post('/events/:id/acknowledge', SecurityController.acknowledge);
router.post('/events/acknowledge-all', SecurityController.acknowledgeAll);

export default router;
