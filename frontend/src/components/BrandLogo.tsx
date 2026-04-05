const sizes = {
  sm: 'size-8',
  md: 'size-10',
  lg: 'size-12',
  xl: 'size-16',
} as const;

type BrandLogoSize = keyof typeof sizes;

/**
 * Product mark: uses `/favicon.svg` (public). White tile so the mark reads on any background.
 */
export function BrandLogo({
  size = 'md',
  className = '',
  withRing = true,
}: {
  size?: BrandLogoSize;
  className?: string;
  /** Subtle ring; set false for flush placement (e.g. inside a colored bar). */
  withRing?: boolean;
}) {
  const ring = withRing ? 'shadow-md ring-1 ring-gray-200/90' : '';
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white ${ring} ${sizes[size]} ${className}`}
    >
      <img
        src="/favicon.svg"
        alt=""
        className="size-[82%] object-contain"
        width={40}
        height={38}
        decoding="async"
      />
    </span>
  );
}
