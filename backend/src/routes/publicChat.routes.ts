import { Router } from 'express';
import { PublicController } from '../controllers/public.controller';

const router = Router();

router.post('/', PublicController.chat);

export default router;
