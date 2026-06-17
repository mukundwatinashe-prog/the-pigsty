import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  Mail,
  MessageCircle,
  Sparkles,
  Send,
  Loader2,
  CheckCircle2,
  X,
} from 'lucide-react';
import { HomeBrandLink } from '../../components/HomeBrandLink';
import { track } from '../../lib/analytics';
import { mailtoContactPage, whatsappHelpUrl } from '../../lib/siteConfig';
import { sendPublicChat, type PublicChatMessage } from '../../services/publicChat.service';
import { ChatHoneypot, TurnstileMount } from '../../components/ChatHumanVerification';
import { useTurnstile } from '../../hooks/useTurnstile';

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
    "Hi, I'm Piggy! 🐷 Ask me anything about The Pigsty — features, pricing, or getting started.",
};

function newId() {
  return `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function PiggyFloatingChat({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<UiMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [honeypot, setHoneypot] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const { containerRef: turnstileRef, getToken: getTurnstileToken } = useTurnstile(open);

  useEffect(() => {
    if (open && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open, sending]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

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
      const turnstileToken = await getTurnstileToken();
      const reply = await sendPublicChat(payload, { turnstileToken, website: honeypot });
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

  if (!open) return null;

  const showSuggestions = messages.length <= 1 && !sending;

  return (
    <div
      role="dialog"
      aria-label="Piggy chat"
      aria-modal="false"
      className="fixed bottom-0 right-0 z-50 flex h-[min(85vh,640px)] w-full flex-col overflow-hidden border border-gray-200 bg-white shadow-2xl sm:bottom-[max(1rem,env(safe-area-inset-bottom))] sm:right-[max(1rem,env(safe-area-inset-right))] sm:h-[min(80vh,620px)] sm:w-[400px] sm:rounded-2xl"
    >
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-emerald-700 px-4 py-3 text-white">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
            <Sparkles className="size-4" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold">Piggy</p>
            <p className="text-[11px] text-white/70">Your instant Pigsty assistant</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Piggy chat"
          className="flex size-11 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="size-5" />
        </button>
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
                className="block w-full min-h-11 rounded-xl border border-gray-200 bg-white px-3 py-3 text-left text-sm text-gray-700 transition-colors hover:border-primary-300 hover:bg-primary-50"
              >
                {q}
              </button>
            ))}
          </div>
        )}
      </div>

      <form
        onSubmit={onSubmit}
        className="relative border-t border-gray-100 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        <ChatHoneypot value={honeypot} onChange={setHoneypot} />
        <TurnstileMount containerRef={turnstileRef} />
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

function ActionCard({
  icon: Icon,
  title,
  description,
  buttonLabel,
  onClick,
  href,
  accent,
}: {
  icon: typeof Mail;
  title: string;
  description: string;
  buttonLabel: string;
  onClick?: () => void;
  href?: string;
  accent: 'primary' | 'emerald';
}) {
  const iconWrap = accent === 'emerald' ? 'bg-emerald-100 text-emerald-700' : 'bg-primary-100 text-primary-700';
  const btnClass =
    accent === 'emerald'
      ? 'bg-emerald-600 hover:bg-emerald-700'
      : 'bg-primary-600 hover:bg-primary-700';

  const button = (
    <span
      className={`inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors ${btnClass}`}
    >
      <Icon className="size-4" aria-hidden />
      {buttonLabel}
    </span>
  );

  return (
    <article className="flex flex-col rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm ring-1 ring-gray-100 sm:p-8">
      <span className={`flex h-12 w-12 items-center justify-center rounded-xl ${iconWrap}`}>
        <Icon className="size-6" aria-hidden />
      </span>
      <h2 className="mt-5 text-xl font-bold text-gray-900">{title}</h2>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-gray-600 sm:text-base">{description}</p>
      <div className="mt-6">
        {href ? (
          <a href={href} onClick={onClick}>
            {button}
          </a>
        ) : (
          <button type="button" onClick={onClick} className="w-full">
            {button}
          </button>
        )}
      </div>
    </article>
  );
}

export default function ContactPage() {
  const [piggyOpen, setPiggyOpen] = useState(false);
  const waUrl = whatsappHelpUrl();
  const mailtoHref = mailtoContactPage('The Pigsty — contact request');

  useEffect(() => {
    track('contact_page_view');
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50/80 via-white to-accent-50/40 pb-safe text-gray-900">
      <header className="sticky top-0 z-20 border-b border-gray-200/80 bg-white/90 pt-[env(safe-area-inset-top,0px)] backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-safe py-3 sm:py-4">
          <HomeBrandLink size="md" />
          <Link
            to="/"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Back home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-safe py-10 sm:py-16">
        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary-100/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary-800">
            <MessageCircle className="size-3.5" aria-hidden />
            We&apos;re here to help
          </span>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">Contact us</h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-gray-600 sm:text-lg">
            Send us an email and we&apos;ll get back to you, or chat with Piggy for instant answers about The Pigsty.
          </p>
        </div>

        <ul className="mx-auto mt-8 flex max-w-lg flex-col gap-3 text-left text-sm text-gray-700 sm:text-base">
          <li className="flex gap-3">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary-600" aria-hidden />
            <span>
              <strong className="font-semibold text-gray-900">Email us</strong> — opens your email app ready to send.
            </span>
          </li>
          <li className="flex gap-3">
            <Sparkles className="mt-0.5 size-5 shrink-0 text-primary-600" aria-hidden />
            <span>
              <strong className="font-semibold text-gray-900">Ask Piggy</strong> — instant help with features, pricing,
              and getting started.
            </span>
          </li>
          <li className="flex gap-3">
            <Clock className="mt-0.5 size-5 shrink-0 text-primary-600" aria-hidden />
            <span>
              <strong className="font-semibold text-gray-900">Built by a farmer</strong> — support from someone who runs
              a pig farm.
            </span>
          </li>
        </ul>

        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          <ActionCard
            icon={Mail}
            title="Send email"
            description="Write to us directly. Your email app will open with our address filled in — just add your message and send."
            buttonLabel="Send email"
            href={mailtoHref}
            onClick={() => track('contact_email_click', { source: 'contact_page' })}
            accent="primary"
          />
          <ActionCard
            icon={Sparkles}
            title="Ask Piggy"
            description="Get instant answers about The Pigsty — what it does, how features work, pricing, and how to get started."
            buttonLabel="Chat with Piggy"
            onClick={() => {
              setPiggyOpen(true);
              track('piggy_open', { source: 'contact_page' });
            }}
            accent="emerald"
          />
        </div>

        {waUrl && (
          <div className="mt-8 rounded-2xl border border-emerald-200/80 bg-emerald-50/60 p-5 text-center sm:p-6">
            <p className="text-sm font-semibold text-emerald-900">Prefer WhatsApp?</p>
            <p className="mt-1 text-sm text-emerald-800/80">Chat with us directly for a faster human response.</p>
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
              onClick={() => track('whatsapp_click', { placement: 'contact_page' })}
            >
              <MessageCircle className="size-4" aria-hidden />
              Open WhatsApp
            </a>
          </div>
        )}
      </main>

      <PiggyFloatingChat open={piggyOpen} onClose={() => setPiggyOpen(false)} />
    </div>
  );
}
