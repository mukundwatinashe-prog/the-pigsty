import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { ContactController } from '../controllers/contact.controller';

const router = Router();

router.use(authenticate);
router.post('/', ContactController.submitAuthenticated);

export default router;
