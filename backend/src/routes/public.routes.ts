import { Router } from 'express';
import { PublicController } from '../controllers/public.controller';

const router = Router();

router.get('/import-template', PublicController.downloadImportTemplate);
router.post('/contact', PublicController.submitContact);

export default router;
