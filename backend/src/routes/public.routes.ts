import { Router } from 'express';
import { PublicController } from '../controllers/public.controller';
import { InvitationController } from '../controllers/invitation.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/import-template', PublicController.downloadImportTemplate);
router.post('/contact', PublicController.submitContact);
router.get('/invitations/:token', InvitationController.getByToken);
router.post('/invitations/:token/accept', authenticate, InvitationController.accept);

export default router;
