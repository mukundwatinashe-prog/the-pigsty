import { appLogoUrl } from '../lib/siteConfig';

const sizes = {
  sm: 'size-24',
  md: 'size-36',
  lg: 'size-48',
  xl: 'size-[min(15rem,85vw)]',
} as const;

type BrandLogoSize = keyof typeof sizes;

/** Product mark from `public/logo.png` — no frame or fill behind the image (PNG with alpha shows as empty around the art). */
export function BrandLogo({
  size = 'md',
  className = '',
}: {
  size?: BrandLogoSize;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center bg-transparent [contain:layout] transform-gpu ${sizes[size]} ${className}`}
    >
      <img
        src={appLogoUrl}
        alt=""
        className="block h-full w-full min-h-0 min-w-0 bg-transparent object-contain object-center contrast-[1.06] drop-shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
        width={1024}
        height={1024}
        decoding="async"
        fetchPriority="high"
      />
    </span>
  );
}
