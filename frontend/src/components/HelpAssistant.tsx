import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, X, Send, Loader2 } from 'lucide-react';
import { chatService, type ChatMessage } from '../services/chat.service';
import { apiErrorMessage } from '../services/api';
import { ChatHoneypot, TurnstileMount } from './ChatHumanVerification';
import { useTurnstile } from '../hooks/useTurnstile';
import { useFarm } from '../context/FarmContext';

type UiMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  pending?: boolean;
  error?: boolean;
};

const CONVERSATION_STORAGE_KEY = 'pigsty.help.conversationId';

const SUGGESTED_QUESTIONS = [
  'How do I add a new pig?',
  'How do I log weights for a whole pen?',
  'How do I record a sale?',
  'How do I invite a team member?',
];

const WELCOME_MESSAGE: UiMessage = {
  id: 'welcome',
  role: 'assistant',
  content:
    "Hi! I'm The Pigsty Assistant. Ask me how to do anything in the app — like adding pigs, logging feed, tracking sows, running reports, or managing your team.",
};

function newId() {
  return `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function HelpAssistant() {
  const { currentFarm } = useFarm();
  // AI assistant is behind the first paid wall. Show the chat unless the current
  // farm is explicitly on the Free plan (the server enforces this too).
  const aiEnabled = currentFarm?.plan !== 'FREE';
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<UiMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [honeypot, setHoneypot] = useState('');

  const conversationIdRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const { containerRef: turnstileRef, getToken: getTurnstileToken } = useTurnstile(open);

  useEffect(() => {
    conversationIdRef.current = sessionStorage.getItem(CONVERSATION_STORAGE_KEY);
  }, []);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open, sending]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const existingId = conversationIdRef.current;
    if (!existingId || historyLoaded) return;
    let cancelled = false;
    chatService
      .getConversationHistory(existingId)
      .then((res) => {
        if (cancelled) return;
        const past: UiMessage[] = (res.data || []).map((m: ChatMessage) => ({
          id: m.id,
          role: m.role,
          content: m.content,
        }));
        if (past.length) setMessages([WELCOME_MESSAGE, ...past]);
        setHistoryLoaded(true);
      })
      .catch(() => {
        // Stale/invalid conversation id — start fresh on next send.
        sessionStorage.removeItem(CONVERSATION_STORAGE_KEY);
        conversationIdRef.current = null;
        setHistoryLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, historyLoaded]);

  async function ensureConversation(): Promise<string> {
    if (conversationIdRef.current) return conversationIdRef.current;
    const conversation = await chatService.createConversation('Help chat');
    conversationIdRef.current = conversation.id;
    sessionStorage.setItem(CONVERSATION_STORAGE_KEY, conversation.id);
    return conversation.id;
  }

  async function handleSend(rawText: string) {
    const text = rawText.trim();
    if (!text || sending) return;

    const userMsg: UiMessage = { id: newId(), role: 'user', content: text };
    const pendingId = newId();
    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: pendingId, role: 'assistant', content: '', pending: true },
    ]);
    setInput('');
    setSending(true);

    try {
      const conversationId = await ensureConversation();
      const turnstileToken = await getTurnstileToken();
      const reply = await chatService.sendMessage(conversationId, text, {
        turnstileToken,
        website: honeypot,
      });
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId
            ? { id: reply.id, role: 'assistant', content: reply.content }
            : m,
        ),
      );
    } catch (err) {
      const message = apiErrorMessage(err, 'Sorry, I could not reach the assistant just now.');
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId
            ? { id: pendingId, role: 'assistant', content: message, error: true }
            : m,
        ),
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
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open help assistant"
          className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary-600 text-white shadow-lg shadow-primary-700/30 transition-transform hover:scale-105 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2"
        >
          <Sparkles className="size-6" />
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-label="Help assistant"
          aria-modal="false"
          className="fixed bottom-0 right-0 z-50 flex h-[min(85vh,640px)] w-full flex-col overflow-hidden border border-gray-200 bg-white shadow-2xl sm:bottom-[max(1rem,env(safe-area-inset-bottom))] sm:right-[max(1rem,env(safe-area-inset-right))] sm:h-[min(80vh,620px)] sm:w-[400px] sm:rounded-2xl"
        >
          <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-primary-700 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
                <Sparkles className="size-4" />
              </span>
              <div className="leading-tight">
                <p className="text-sm font-semibold">The Pigsty Assistant</p>
                <p className="text-[11px] text-white/70">Here to help you use the app</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close help assistant"
              className="flex size-11 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="size-5" />
            </button>
          </div>

          {!aiEnabled ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-accent-50 px-6 py-8 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-primary-700">
                <Sparkles className="size-6" />
              </span>
              <h3 className="text-base font-semibold text-gray-900">Unlock the AI assistant</h3>
              <p className="text-sm text-gray-600">
                The Pigsty Assistant is available on the Grower and Enterprise plans. Upgrade to get
                instant help with your herd, reports, and more.
              </p>
              <Link
                to="/billing"
                onClick={() => setOpen(false)}
                className="mt-1 inline-flex min-h-11 items-center rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700"
              >
                View plans
              </Link>
            </div>
          ) : (
          <>
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto overscroll-contain bg-accent-50 px-4 py-4">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
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
                placeholder="Ask how to do something…"
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
              The assistant explains how to use The Pigsty. Always double-check important actions.
            </p>
          </form>
          </>
          )}
        </div>
      )}
    </>
  );
}

export default HelpAssistant;
