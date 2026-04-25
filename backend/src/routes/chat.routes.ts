import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { ChatController } from '../controllers/chat.controller';

const router = Router();

router.use(authenticate);
router.post('/conversations', ChatController.createConversation);
router.get('/conversations', ChatController.getConversations);
router.get('/conversations/:conversationId/history', ChatController.getConversationHistory);
router.put('/conversations/:conversationId', ChatController.updateConversation);
router.delete('/conversations/:conversationId', ChatController.deleteConversation);
router.post('/message', ChatController.sendMessage);

export default router;
