import { withBase } from './api';

export type PublicChatMessage = { role: 'user' | 'assistant'; content: string };

/**
 * Stateless help chat for the public Contact page ("Piggy").
 * Sends the running message history and returns the assistant's reply.
 * No account or server-side persistence.
 */
export async function sendPublicChat(
  messages: PublicChatMessage[],
  options?: { turnstileToken?: string; website?: string },
): Promise<string> {
  const res = await fetch(withBase('/public/chat'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
      turnstileToken: options?.turnstileToken,
      website: options?.website ?? '',
    }),
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(data.message || 'Piggy is unavailable right now. Please try again shortly.');
  }

  const data = (await res.json()) as { content?: string };
  return (data.content || '').trim();
}
