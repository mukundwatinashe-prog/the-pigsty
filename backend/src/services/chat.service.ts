import prisma from '../config/database';
import { AppError } from '../middleware/error.middleware';

export type ChatConversationRecord = {
  id: string;
  userId: string;
  title: string;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type ChatMessageRecord = {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  tokensUsed: number | null;
  createdAt: Date;
};

export type ChatContextWindow = {
  messages: ChatMessageRecord[];
  omittedCount: number;
};

export class ChatService {
  static async createConversation(userId: string, title?: string) {
    const rows = await prisma.$queryRawUnsafe<ChatConversationRecord[]>(
      `INSERT INTO "ai_conversations" ("id", "userId", "title")
       VALUES (gen_random_uuid()::text, $1, $2)
       RETURNING *`,
      userId,
      title?.trim() || 'New Conversation',
    );
    return rows[0];
  }

  static async getConversationById(conversationId: string, userId: string) {
    const rows = await prisma.$queryRawUnsafe<ChatConversationRecord[]>(
      `SELECT * FROM "ai_conversations" WHERE "id" = $1 LIMIT 1`,
      conversationId,
    );
    const conversation = rows[0];
    if (!conversation || conversation.isArchived) {
      throw new AppError('Conversation not found', 404);
    }
    if (conversation.userId !== userId) {
      throw new AppError('Unauthorized', 403);
    }
    return conversation;
  }

  static async getUserConversations(userId: string, limit = 50, offset = 0) {
    return prisma.$queryRawUnsafe<ChatConversationRecord[]>(
      `SELECT * FROM "ai_conversations"
       WHERE "userId" = $1 AND "isArchived" = false
       ORDER BY "updatedAt" DESC
       LIMIT $2 OFFSET $3`,
      userId,
      limit,
      offset,
    );
  }

  static async addMessage(
    conversationId: string,
    role: 'user' | 'assistant',
    content: string,
    tokensUsed?: number,
  ) {
    return prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<ChatMessageRecord[]>(
        `INSERT INTO "ai_messages" ("id", "conversationId", "role", "content", "tokensUsed")
         VALUES (gen_random_uuid()::text, $1, $2::"AiMessageRole", $3, $4)
         RETURNING *`,
        conversationId,
        role,
        content,
        tokensUsed ?? null,
      );
      await tx.$executeRawUnsafe(
        `UPDATE "ai_conversations" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = $1`,
        conversationId,
      );
      return rows[0];
    });
  }

  static async getConversationHistory(conversationId: string) {
    return prisma.$queryRawUnsafe<ChatMessageRecord[]>(
      `SELECT * FROM "ai_messages"
       WHERE "conversationId" = $1
       ORDER BY "createdAt" ASC`,
      conversationId,
    );
  }

  static async getConversationContextWindow(conversationId: string, maxMessages = 24): Promise<ChatContextWindow> {
    const rows = await prisma.$queryRawUnsafe<Array<{ total: bigint }>>(
      `SELECT COUNT(*)::bigint AS total FROM "ai_messages" WHERE "conversationId" = $1`,
      conversationId,
    );
    const total = Number(rows[0]?.total ?? 0);
    const omittedCount = Math.max(total - maxMessages, 0);

    const messages = await prisma.$queryRawUnsafe<ChatMessageRecord[]>(
      `SELECT * FROM "ai_messages"
       WHERE "conversationId" = $1
       ORDER BY "createdAt" ASC
       LIMIT $2 OFFSET $3`,
      conversationId,
      maxMessages,
      omittedCount,
    );

    return { messages, omittedCount };
  }

  static async updateConversationTitle(conversationId: string, title: string) {
    const rows = await prisma.$queryRawUnsafe<ChatConversationRecord[]>(
      `UPDATE "ai_conversations"
       SET "title" = $2, "updatedAt" = CURRENT_TIMESTAMP
       WHERE "id" = $1
       RETURNING *`,
      conversationId,
      title.trim(),
    );
    return rows[0];
  }

  static async deleteConversation(conversationId: string) {
    await prisma.$executeRawUnsafe(`DELETE FROM "ai_conversations" WHERE "id" = $1`, conversationId);
  }

  static async logUsage(userId: string, endpoint: string, tokensUsed: number, cost?: number) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "ai_usage_logs" ("id", "userId", "endpoint", "tokensUsed", "cost")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4)`,
      userId,
      endpoint,
      tokensUsed,
      cost ?? null,
    );
  }
}
