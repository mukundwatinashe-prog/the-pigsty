import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requireAiAccess } from '../middleware/aiAccess.middleware';
import { ChatController } from '../controllers/chat.controller';

const router = Router();

router.use(authenticate);
// Creating a conversation and sending a message consume the AI assistant, which
// is gated behind the first paid plan. Reading/deleting existing conversations
// stays available (e.g. after a downgrade).
router.post('/conversations', requireAiAccess, ChatController.createConversation);
router.get('/conversations', ChatController.getConversations);
router.get('/conversations/:conversationId/history', ChatController.getConversationHistory);
router.put('/conversations/:conversationId', ChatController.updateConversation);
router.delete('/conversations/:conversationId', ChatController.deleteConversation);
router.post('/message', requireAiAccess, ChatController.sendMessage);

export default router;
