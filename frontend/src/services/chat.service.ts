import api from './api';

export type ChatConversation = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
};

type ListConversationsResponse = {
  data: ChatConversation[];
  count: number;
};

type ListMessagesResponse = {
  data: ChatMessage[];
  count: number;
};

export const chatService = {
  createConversation(title?: string) {
    return api
      .post<{ id: string; title: string; createdAt: string }>('/chat/conversations', {
        title: title?.trim() || undefined,
      })
      .then((r) => r.data);
  },

  getConversations(limit = 50, offset = 0) {
    return api
      .get<ListConversationsResponse>('/chat/conversations', { params: { limit, offset } })
      .then((r) => r.data);
  },

  getConversationHistory(conversationId: string) {
    return api
      .get<ListMessagesResponse>(`/chat/conversations/${conversationId}/history`)
      .then((r) => r.data);
  },

  sendMessage(conversationId: string, message: string) {
    return api
      .post<ChatMessage>('/chat/message', {
        conversationId,
        message: message.trim(),
      })
      .then((r) => r.data);
  },

  updateConversationTitle(conversationId: string, title: string) {
    return api
      .put<{ id: string; title: string; updatedAt: string }>(`/chat/conversations/${conversationId}`, {
        title: title.trim(),
      })
      .then((r) => r.data);
  },

  deleteConversation(conversationId: string) {
    return api.delete(`/chat/conversations/${conversationId}`).then((r) => r.data);
  },
};
