import { Response, NextFunction } from 'express';
import { z } from 'zod';
import type { AuthRequest } from '../middleware/auth.middleware';
import { AppError } from '../middleware/error.middleware';
import { ChatService } from '../services/chat.service';
import { aiService } from '../services/ai.service';
import { getAiSystemPrompt } from '../utils/aiPrompts';

const createConversationSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
});

const sendMessageSchema = z.object({
  conversationId: z.string().uuid(),
  message: z.string().trim().min(1).max(5000),
});

const listConversationsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const updateConversationSchema = z.object({
  title: z.string().trim().min(1).max(255),
});

export class ChatController {
  private static readonly MAX_CONTEXT_MESSAGES = 24;

  static async createConversation(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) throw new AppError('Authentication required', 401);
      const body = createConversationSchema.parse(req.body ?? {});
      const conversation = await ChatService.createConversation(req.userId, body.title);
      res.status(201).json({
        id: conversation.id,
        title: conversation.title,
        createdAt: conversation.createdAt,
      });
    } catch (error) {
      if (error instanceof z.ZodError) return next(new AppError(error.errors[0].message, 400));
      next(error);
    }
  }

  static async getConversations(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) throw new AppError('Authentication required', 401);
      const query = listConversationsSchema.parse(req.query);
      const conversations = await ChatService.getUserConversations(req.userId, query.limit, query.offset);
      res.json({ data: conversations, count: conversations.length });
    } catch (error) {
      if (error instanceof z.ZodError) return next(new AppError(error.errors[0].message, 400));
      next(error);
    }
  }

  static async getConversationHistory(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) throw new AppError('Authentication required', 401);
      const conversationId = String(req.params.conversationId || '');
      await ChatService.getConversationById(conversationId, req.userId);
      const messages = await ChatService.getConversationHistory(conversationId);
      res.json({ data: messages, count: messages.length });
    } catch (error) {
      next(error);
    }
  }

  static async updateConversation(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) throw new AppError('Authentication required', 401);
      const conversationId = String(req.params.conversationId || '');
      const body = updateConversationSchema.parse(req.body ?? {});
      await ChatService.getConversationById(conversationId, req.userId);
      const updated = await ChatService.updateConversationTitle(conversationId, body.title);
      res.json({
        id: updated.id,
        title: updated.title,
        updatedAt: updated.updatedAt,
      });
    } catch (error) {
      if (error instanceof z.ZodError) return next(new AppError(error.errors[0].message, 400));
      next(error);
    }
  }

  static async deleteConversation(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) throw new AppError('Authentication required', 401);
      const conversationId = String(req.params.conversationId || '');
      await ChatService.getConversationById(conversationId, req.userId);
      await ChatService.deleteConversation(conversationId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  static async sendMessage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) throw new AppError('Authentication required', 401);
      const body = sendMessageSchema.parse(req.body ?? {});
      await ChatService.getConversationById(body.conversationId, req.userId);

      await ChatService.addMessage(body.conversationId, 'user', body.message);
      const { messages, omittedCount } = await ChatService.getConversationContextWindow(
        body.conversationId,
        ChatController.MAX_CONTEXT_MESSAGES,
      );
      const aiMessages = messages.map((m: { role: 'user' | 'assistant'; content: string }) => ({
        role: m.role,
        content: m.content,
      }));

      const contextNote =
        omittedCount > 0
          ? `\n\nConversation context note: ${omittedCount} older message(s) were omitted to fit model context. Ask a clarifying question if older context is required.`
          : '';
      const aiResponse = await aiService.generateResponse(aiMessages, `${getAiSystemPrompt()}${contextNote}`);
      if (!aiResponse.content.trim()) {
        throw new AppError('AI provider returned an empty response', 502);
      }
      const storedAssistantMessage = await ChatService.addMessage(
        body.conversationId,
        'assistant',
        aiResponse.content,
        aiResponse.tokensUsed,
      );
      await ChatService.logUsage(req.userId, '/api/chat/message', aiResponse.tokensUsed);

      res.json({
        id: storedAssistantMessage.id,
        role: storedAssistantMessage.role,
        content: storedAssistantMessage.content,
        createdAt: storedAssistantMessage.createdAt,
      });
    } catch (error) {
      if (error instanceof z.ZodError) return next(new AppError(error.errors[0].message, 400));
      next(error);
    }
  }
}
