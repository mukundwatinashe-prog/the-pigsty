import type { RefObject } from 'react';

/** Visually hidden honeypot input — bots fill this; humans never see it. */
export function ChatHoneypot({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      type="text"
      name="website"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      tabIndex={-1}
      autoComplete="off"
      aria-hidden="true"
      className="pointer-events-none absolute -left-[9999px] h-0 w-0 opacity-0"
    />
  );
}

/** Invisible Turnstile mount point — keep in the DOM while chat is open. */
export function TurnstileMount({ containerRef }: { containerRef: RefObject<HTMLDivElement | null> }) {
  return <div ref={containerRef} className="hidden" aria-hidden="true" />;
}
