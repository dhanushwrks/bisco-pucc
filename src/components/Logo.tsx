export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden>
      <rect width="28" height="28" rx="8" fill="#18181b" />
      <path d="M8 17.5c0-4.4 3.6-8 8-8h4v4c0 4.4-3.6 8-8 8H8v-4Z" fill="#10b981" />
      <path d="M8 21.5 15 14.5" stroke="#18181b" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
