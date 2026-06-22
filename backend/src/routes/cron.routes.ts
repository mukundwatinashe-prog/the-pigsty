import { Router } from 'express';
import { CronController } from '../controllers/cron.controller';

const router = Router();

router.get('/enterprise-automation', CronController.runEnterpriseAutomation);

export default router;
