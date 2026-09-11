import Image from "next/image";

const logoClassName = "h-auto w-full object-contain";

type FinanceBrandProps = {
  compact?: boolean;
  className?: string;
};

/** The approved Nodvis Finance identity for shell and public surfaces. */
export function FinanceBrand({ compact = false, className = "" }: FinanceBrandProps) {
  if (compact) {
    return (
      <Image
        src="/brand/nodvis-finance-symbol.png"
        alt=""
        aria-hidden="true"
        width={786}
        height={431}
        className={`${logoClassName} ${className}`.trim()}
      />
    );
  }

  return (
    <span className={`block ${className}`.trim()} aria-hidden="true">
      <Image
        src="/brand/nodvis-finance-logo-primary.png"
        alt=""
        width={2172}
        height={724}
        className={`${logoClassName} dark:hidden`}
        priority
      />
      <Image
        src="/brand/nodvis-finance-logo-primary-dark.png"
        alt=""
        width={2172}
        height={724}
        className={`${logoClassName} hidden dark:block`}
        priority
      />
    </span>
  );
}
