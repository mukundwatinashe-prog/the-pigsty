import { Router } from 'express';
import { PublicController } from '../controllers/public.controller';

const router = Router();

router.get('/import-template', PublicController.downloadImportTemplate);
router.post('/leads', PublicController.captureLead);

export default router;
