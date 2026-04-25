import { env } from '../config/env';
import { AppError } from '../middleware/error.middleware';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

export type AiResponse = {
  content: string;
  tokensUsed: number;
  provider: string;
};

class AiService {
  private provider = env.AI_PROVIDER;

  constructor() {
    this.initializeProvider();
  }

  private initializeProvider() {
    switch (this.provider) {
      case 'openai':
        this.initializeOpenAI();
        break;
      case 'claude':
        this.initializeClaude();
        break;
      case 'gemini':
        this.initializeGemini();
        break;
      default:
        throw new AppError(`Unsupported AI provider: ${this.provider}`, 500);
    }
  }

  private initializeOpenAI() {
    if (!env.OPENAI_API_KEY) throw new AppError('OPENAI_API_KEY is not configured', 500);
  }

  private initializeClaude() {
    if (!env.CLAUDE_API_KEY) throw new AppError('CLAUDE_API_KEY is not configured', 500);
  }

  private initializeGemini() {
    if (!env.GEMINI_API_KEY) throw new AppError('GEMINI_API_KEY is not configured', 500);
  }

  async generateResponse(messages: ChatMessage[], systemPrompt: string): Promise<AiResponse> {
    if (!messages.length) throw new AppError('No chat messages provided', 400);
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
      throw new AppError(`OpenAI request failed (${response.status}): ${body || response.statusText}`, 502);
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
      throw new AppError(`Claude request failed (${response.status}): ${body || response.statusText}`, 502);
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
      throw new AppError(`Gemini request failed (${response.status}): ${body || response.statusText}`, 502);
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
