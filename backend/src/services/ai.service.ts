import { env } from '../config/env';
import { AppError } from '../middleware/error.middleware';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

export type AiResponse = {
  content: string;
  tokensUsed: number;
  provider: string;
};

function friendlyProviderError(provider: string, status: number, body: string): string {
  let parsed: { error?: { message?: string; type?: string } } = {};
  try {
    parsed = JSON.parse(body) as typeof parsed;
  } catch {
    /* raw text body */
  }
  const msg = parsed.error?.message?.toLowerCase() ?? body.toLowerCase();

  if (msg.includes('credit balance') || msg.includes('billing') || msg.includes('purchase credits')) {
    return (
      `${provider} API credits are exhausted for the API key configured on the server. ` +
      'API billing is separate from claude.ai subscriptions — credits must be added at console.anthropic.com ' +
      'in the same workspace that owns the API key. Check the workspace switcher (top-left) and create a new key from the credited workspace if needed.'
    );
  }
  if (status === 401 || msg.includes('invalid') && msg.includes('api key')) {
    return `${provider} API key is invalid or missing. Check server environment variables.`;
  }
  if (status === 429 || msg.includes('rate limit')) {
    return `${provider} rate limit reached. Try again in a few minutes.`;
  }
  if (parsed.error?.message) return `${provider}: ${parsed.error.message}`;
  return `${provider} request failed (${status})`;
}

class AiService {
  private provider = env.AI_PROVIDER;

  /** Validate provider credentials only when chat is used — missing keys must not block API startup. */
  private assertProviderConfigured() {
    switch (this.provider) {
      case 'openai':
        if (!env.OPENAI_API_KEY) throw new AppError('OPENAI_API_KEY is not configured', 503);
        break;
      case 'claude':
        if (!env.CLAUDE_API_KEY) throw new AppError('CLAUDE_API_KEY is not configured', 503);
        break;
      case 'gemini':
        if (!env.GEMINI_API_KEY) throw new AppError('GEMINI_API_KEY is not configured', 503);
        break;
      default:
        throw new AppError(`Unsupported AI provider: ${this.provider}`, 500);
    }
  }

  async generateResponse(messages: ChatMessage[], systemPrompt: string): Promise<AiResponse> {
    if (!messages.length) throw new AppError('No chat messages provided', 400);
    this.assertProviderConfigured();
    switch (this.provider) {
      case 'openai':
        return this.generateOpenAiResponse(messages, systemPrompt);
      case 'claude':
        return this.generateClaudeResponse(messages, systemPrompt);
      case 'gemini':
        return this.generateGeminiResponse(messages, systemPrompt);
      default:
        throw new AppError(`Unsupported AI provider: ${this.provider}`, 500);
    }
  }

  private async generateOpenAiResponse(
    messages: ChatMessage[],
    systemPrompt: string,
  ): Promise<AiResponse> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL,
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        temperature: 0.4,
        max_tokens: 800,
      }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new AppError(friendlyProviderError('OpenAI', response.status, body), 502);
    }
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { total_tokens?: number };
    };
    return {
      content: data.choices?.[0]?.message?.content?.trim() || '',
      tokensUsed: data.usage?.total_tokens || 0,
      provider: 'openai',
    };
  }

  private async generateClaudeResponse(
    messages: ChatMessage[],
    systemPrompt: string,
  ): Promise<AiResponse> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: env.CLAUDE_MODEL,
        system: systemPrompt,
        max_tokens: 800,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new AppError(friendlyProviderError('Claude', response.status, body), 502);
    }
    const data = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const text = data.content?.find((block) => block.type === 'text');
    return {
      content: text?.text?.trim() || '',
      tokensUsed: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
      provider: 'claude',
    };
  }

  private async generateGeminiResponse(
    messages: ChatMessage[],
    systemPrompt: string,
  ): Promise<AiResponse> {
    const transformed = messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: transformed,
        }),
      },
    );
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new AppError(friendlyProviderError('Gemini', response.status, body), 502);
    }
    const data = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };
    return {
      content: data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '',
      tokensUsed: 0,
      provider: 'gemini',
    };
  }
}

export const aiService = new AiService();
