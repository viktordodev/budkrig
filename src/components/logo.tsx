import Link from "next/link";

/**
 * The Budkrig mark: three ascending rank bars, the leader tipped in gold —
 * a pay-to-rank leaderboard where the price only goes up. Colours are CSS
 * vars, so it tracks light/dark with the rest of the app.
 */
export function BudkrigMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <rect x="4" y="18" width="6" height="10" rx="2.4" fill="var(--accent)" />
      <rect x="13" y="12.5" width="6" height="15.5" rx="2.4" fill="var(--accent)" />
      <rect x="22" y="6" width="6" height="22" rx="2.4" fill="var(--accent)" />
      <path d="M22 13.5V8.4Q22 6 24.4 6h1.2Q28 6 28 8.4V13.5Z" fill="var(--gold)" />
    </svg>
  );
}

/** Mark + wordmark, links home. Used in the site header. */
export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="Budkrig"
      className={`flex items-center gap-2 font-semibold tracking-tight ${className ?? ""}`}
    >
      <BudkrigMark className="h-[22px] w-[22px] shrink-0" />
      <span className="text-[15px]">
        <span className="text-[var(--accent)]">Bud</span>
        <span>krig</span>
      </span>
    </Link>
  );
}
