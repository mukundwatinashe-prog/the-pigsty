import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requirePlatformAdmin } from '../middleware/admin.middleware';
import { AdminController } from '../controllers/admin.controller';

const router = Router();

router.use(authenticate, requirePlatformAdmin);

router.get('/summary', AdminController.summary);
router.get('/farms', AdminController.listFarms);
router.get('/users/export', AdminController.exportUsers);
router.get('/users', AdminController.listUsers);
router.get('/users/:userId', AdminController.getUser);
router.post('/users/:userId/unlock', AdminController.unlockUser);
router.post('/users/:userId/logout', AdminController.forceLogout);
router.post('/users/:userId/reset-trial', AdminController.resetGrowerTrial);
router.patch('/users/:userId', AdminController.updateUser);
router.delete('/users/:userId', AdminController.deleteUser);
router.patch('/farms/:farmId/plan', AdminController.setFarmPlan);

export default router;
