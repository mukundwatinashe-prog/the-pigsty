import { Link } from 'react-router-dom';
import { BrandLogo, type BrandLogoSize } from './BrandLogo';

type Props = {
  size?: BrandLogoSize;
  showName?: boolean;
  className?: string;
  logoClassName?: string;
  nameClassName?: string;
};

/** Product logo (and optional wordmark) linking to the marketing home page. */
export function HomeBrandLink({
  size = 'md',
  showName = true,
  className = '',
  logoClassName = '',
  nameClassName = '',
}: Props) {
  return (
    <Link
      to="/"
      className={`inline-flex min-w-0 items-center gap-0 font-bold text-gray-900 transition-opacity hover:opacity-90 focus-visible:rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 ${className}`}
      aria-label="The Pigsty home"
    >
      <BrandLogo size={size} className={`-mr-3 shrink-0 sm:-mr-4 ${logoClassName}`} />
      {showName ? <span className={`truncate leading-none ${nameClassName}`}>The Pigsty</span> : null}
    </Link>
  );
}
