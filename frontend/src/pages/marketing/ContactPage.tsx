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
} from 'lucide-react';
import { BrandLogo } from '../../components/BrandLogo';
import { ContactForm } from '../../components/ContactForm';
import { track } from '../../lib/analytics';
import { whatsappHelpUrl } from '../../lib/siteConfig';
import { sendPublicChat, type PublicChatMessage } from '../../services/publicChat.service';

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

function PiggyChat({ compact }: { compact?: boolean }) {
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
  const heightClass = compact ? 'h-[min(52vh,480px)]' : 'h-[min(62vh,540px)] lg:h-[min(68vh,620px)]';

  return (
    <div className={`flex ${heightClass} flex-col overflow-hidden`}>
      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto overscroll-contain rounded-t-2xl bg-gradient-to-b from-accent-50/80 to-white px-4 py-4"
      >
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                m.role === 'user'
                  ? 'rounded-br-md bg-primary-600 text-white shadow-sm'
                  : m.error
                    ? 'rounded-bl-md border border-red-200 bg-red-50 text-red-700'
                    : 'rounded-bl-md border border-gray-100 bg-white text-gray-800 shadow-sm'
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
          <div className="grid gap-2 pt-1 sm:grid-cols-2">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => void handleSend(q)}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-left text-sm text-gray-700 transition-colors hover:border-primary-300 hover:bg-primary-50"
              >
                {q}
              </button>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={onSubmit} className="border-t border-gray-100 bg-white px-4 py-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            maxLength={2000}
            placeholder="Ask Piggy a question…"
            className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
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
      </form>
    </div>
  );
}

function ContactPanel({ children, icon: Icon, title, subtitle, accent }: {
  children: React.ReactNode;
  icon: typeof Mail;
  title: string;
  subtitle: string;
  accent: 'primary' | 'emerald';
}) {
  const headerBg = accent === 'emerald' ? 'bg-emerald-700' : 'bg-primary-700';
  const iconBg = accent === 'emerald' ? 'bg-emerald-500/30' : 'bg-white/15';

  return (
    <section className="flex flex-col overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm ring-1 ring-gray-100">
      <div className={`flex items-start gap-3 px-5 py-4 text-white ${headerBg}`}>
        <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-bold tracking-tight">{title}</h2>
          <p className="mt-0.5 text-sm text-white/80">{subtitle}</p>
        </div>
      </div>
      <div className="flex flex-1 flex-col">{children}</div>
    </section>
  );
}

export default function ContactPage() {
  const waUrl = whatsappHelpUrl();

  useEffect(() => {
    track('contact_page_view');
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50/80 via-white to-accent-50/40 pb-safe text-gray-900">
      <header className="sticky top-0 z-20 border-b border-gray-200/80 bg-white/90 pt-[env(safe-area-inset-top,0px)] backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-safe py-3 sm:py-4">
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

      <main className="mx-auto max-w-6xl px-safe py-10 sm:py-14">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start lg:gap-12">
          <div className="lg:sticky lg:top-28">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary-100/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary-800">
              <MessageCircle className="size-3.5" aria-hidden />
              We&apos;re here to help
            </span>
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl lg:text-[2.5rem] lg:leading-tight">
              Contact us
            </h1>
            <p className="mt-4 text-base leading-relaxed text-gray-600 sm:text-lg">
              Send us a message and we&apos;ll reply by email, or get instant answers from Piggy — our AI assistant
              that knows The Pigsty inside out.
            </p>

            <ul className="mt-8 space-y-3">
              <li className="flex gap-3 text-sm text-gray-700 sm:text-base">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary-600" aria-hidden />
                <span>
                  <strong className="font-semibold text-gray-900">Email reply</strong> — we respond to the address you
                  provide in the form.
                </span>
              </li>
              <li className="flex gap-3 text-sm text-gray-700 sm:text-base">
                <Sparkles className="mt-0.5 size-5 shrink-0 text-primary-600" aria-hidden />
                <span>
                  <strong className="font-semibold text-gray-900">Instant help</strong> — Piggy answers questions about
                  features, pricing, and getting started.
                </span>
              </li>
              <li className="flex gap-3 text-sm text-gray-700 sm:text-base">
                <Clock className="mt-0.5 size-5 shrink-0 text-primary-600" aria-hidden />
                <span>
                  <strong className="font-semibold text-gray-900">Built by a farmer</strong> — real support from someone
                  who runs a pig farm.
                </span>
              </li>
            </ul>

            {waUrl && (
              <div className="mt-8 rounded-2xl border border-emerald-200/80 bg-emerald-50/60 p-5">
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
          </div>

          <div className="space-y-6">
            <ContactPanel
              icon={Mail}
              title="Send a message"
              subtitle="Required: first name, last name, and email. We'll reply to you."
              accent="primary"
            >
              <div className="p-5 sm:p-6">
                <ContactForm variant="contact" onSubmitted={() => track('contact_submit', { source: 'contact_page' })} />
              </div>
            </ContactPanel>

            <ContactPanel
              icon={Sparkles}
              title="Ask Piggy"
              subtitle="Instant answers about The Pigsty — no account needed."
              accent="emerald"
            >
              <PiggyChat />
              <p className="border-t border-gray-100 px-4 py-2.5 text-center text-[11px] text-gray-400">
                Piggy explains how the app works. Always double-check important farm decisions.
              </p>
            </ContactPanel>
          </div>
        </div>
      </main>
    </div>
  );
}
