import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail, MessageCircle, Sparkles, Send, Loader2 } from 'lucide-react';
import { BrandLogo } from '../../components/BrandLogo';
import { ContactForm } from '../../components/ContactForm';
import { track } from '../../lib/analytics';
import { whatsappHelpUrl } from '../../lib/siteConfig';
import { sendPublicChat, type PublicChatMessage } from '../../services/publicChat.service';

type Tab = 'message' | 'chat';

type UiMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  pending?: boolean;
  error?: boolean;
};

const SUGGESTED_QUESTIONS = [
  'What can The Pigsty do?',
  'How do I add a new pig?',
  "What's included in the free plan?",
  'How do I invite my team?',
];

const WELCOME_MESSAGE: UiMessage = {
  id: 'welcome',
  role: 'assistant',
  content:
    "Hi, I'm Piggy! 🐷 Ask me anything about The Pigsty — what it does, how features work, pricing, or getting started. How can I help?",
};

function newId() {
  return `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function PiggyChat() {
  const [messages, setMessages] = useState<UiMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, sending]);

  async function handleSend(rawText: string) {
    const text = rawText.trim();
    if (!text || sending) return;

    const userMsg: UiMessage = { id: newId(), role: 'user', content: text };
    const pendingId = newId();
    const history = messages;
    setMessages((prev) => [...prev, userMsg, { id: pendingId, role: 'assistant', content: '', pending: true }]);
    setInput('');
    setSending(true);

    try {
      const payload: PublicChatMessage[] = [...history, userMsg]
        .filter((m) => m.id !== 'welcome' && m.content.trim())
        .map((m) => ({ role: m.role, content: m.content }));
      const reply = await sendPublicChat(payload);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId
            ? { id: newId(), role: 'assistant', content: reply || 'Sorry, I did not catch that. Could you rephrase?' }
            : m,
        ),
      );
      track('piggy_message', { source: 'contact_page' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sorry, I could not reach Piggy just now.';
      setMessages((prev) =>
        prev.map((m) => (m.id === pendingId ? { id: pendingId, role: 'assistant', content: message, error: true } : m)),
      );
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    void handleSend(input);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend(input);
    }
  }

  const showSuggestions = messages.length <= 1 && !sending;

  return (
    <div className="flex h-[min(70vh,560px)] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-gray-100 bg-primary-700 px-4 py-3 text-white">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
          <Sparkles className="size-4" />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold">Piggy</p>
          <p className="text-[11px] text-white/70">Your instant Pigsty assistant</p>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto overscroll-contain bg-accent-50 px-4 py-4">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                m.role === 'user'
                  ? 'rounded-br-sm bg-primary-600 text-white'
                  : m.error
                    ? 'rounded-bl-sm border border-red-200 bg-red-50 text-red-700'
                    : 'rounded-bl-sm border border-gray-100 bg-white text-gray-800 shadow-sm'
              }`}
            >
              {m.pending ? (
                <span className="flex items-center gap-2 text-gray-500">
                  <Loader2 className="size-4 animate-spin" />
                  Thinking…
                </span>
              ) : (
                m.content
              )}
            </div>
          </div>
        ))}

        {showSuggestions && (
          <div className="space-y-2 pt-1">
            <p className="px-1 text-xs font-medium text-gray-500">Try asking:</p>
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => void handleSend(q)}
                className="block w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:border-primary-300 hover:bg-primary-50"
              >
                {q}
              </button>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={onSubmit} className="border-t border-gray-100 bg-white p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            maxLength={2000}
            placeholder="Ask Piggy a question…"
            className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            aria-label="Send message"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {sending ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-5" />}
          </button>
        </div>
        <p className="mt-1.5 px-1 text-[11px] text-gray-400">
          Piggy explains how The Pigsty works. Always double-check important actions.
        </p>
      </form>
    </div>
  );
}

export default function ContactPage() {
  const [tab, setTab] = useState<Tab>('message');
  const waUrl = whatsappHelpUrl();

  useEffect(() => {
    track('contact_page_view');
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50/80 via-white to-accent-50/40 pb-safe text-gray-900">
      <header className="sticky top-0 z-20 border-b border-gray-200/80 bg-white/90 pt-[env(safe-area-inset-top,0px)] backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-safe py-3 sm:py-4">
          <Link to="/" className="flex min-w-0 items-center gap-0 font-bold text-gray-900">
            <BrandLogo size="md" className="-mr-3 shrink-0 sm:-mr-4" />
            <span className="truncate leading-none">The Pigsty</span>
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Back home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-safe py-10 sm:py-14">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary-700">We&apos;re here to help</p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">Contact us</h1>
          <p className="mt-4 text-base text-gray-600 sm:text-lg">
            Choose how you&apos;d like to reach us — send a message and we&apos;ll get back to you by email, or get
            instant answers from Piggy, our app assistant.
          </p>
        </div>

        <div className="mx-auto mt-8 flex max-w-md items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white p-1.5 shadow-sm">
          <button
            type="button"
            onClick={() => setTab('message')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
              tab === 'message' ? 'bg-primary-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Mail className="size-4" aria-hidden />
            Send a message
          </button>
          <button
            type="button"
            onClick={() => setTab('chat')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
              tab === 'chat' ? 'bg-primary-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Sparkles className="size-4" aria-hidden />
            Instant help with Piggy
          </button>
        </div>

        <div className="mx-auto mt-8 max-w-2xl">
          {tab === 'message' ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="text-lg font-bold text-gray-900">Send us a message</h2>
              <p className="mt-1.5 text-sm text-gray-600">
                First name, last name, and email are required. Everything else is optional. We&apos;ll reply to the
                email you provide.
              </p>
              <div className="mt-6">
                <ContactForm variant="contact" onSubmitted={() => track('contact_submit', { source: 'contact_page' })} />
              </div>
              {waUrl && (
                <div className="mt-6 border-t border-gray-100 pt-5 text-center">
                  <p className="text-sm text-gray-500">Prefer to chat with a human?</p>
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
                    onClick={() => track('whatsapp_click', { placement: 'contact_page' })}
                  >
                    <MessageCircle className="size-4" aria-hidden />
                    Chat on WhatsApp
                  </a>
                </div>
              )}
            </div>
          ) : (
            <PiggyChat />
          )}
        </div>
      </main>
    </div>
  );
}
