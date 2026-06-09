import { Link } from 'react-router-dom';
import { appLogoUrl } from '../lib/siteConfig';

const sizes = {
  sm: 'size-24',
  md: 'size-36',
  lg: 'size-48',
  xl: 'size-[min(15rem,85vw)]',
} as const;

export type BrandLogoSize = keyof typeof sizes;

type Props = {
  size?: BrandLogoSize;
  className?: string;
  /** When true, the logo image links to the marketing home page. */
  linkToHome?: boolean;
};

/** Product mark from `public/logo.png` — no frame or fill behind the image (PNG with alpha shows as empty around the art). */
export function BrandLogo({ size = 'md', className = '', linkToHome = false }: Props) {
  const mark = (
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

  if (!linkToHome) return mark;

  return (
    <Link
      to="/"
      className="inline-flex rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
      aria-label="The Pigsty home"
    >
      {mark}
    </Link>
  );
}
