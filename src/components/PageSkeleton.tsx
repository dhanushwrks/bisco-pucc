export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-zinc-200/80 ${className}`} />;
}

/** Generic dash page placeholder shown while a route segment loads. */
export function PageSkeleton() {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading page…</span>
      <div className="mb-5 space-y-2 sm:mb-7">
        <Skeleton className="h-7 w-40 sm:h-8 sm:w-48" />
        <Skeleton className="h-4 w-56" />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card space-y-3 px-4 py-3.5 sm:px-5 sm:py-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-28" />
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="card space-y-4 p-4 sm:p-5 md:col-span-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-40 w-full" />
        </div>
        <div className="card space-y-4 p-4 sm:p-5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-48" />
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-3 w-full" />
        </div>
        <div className="card space-y-4 p-4 sm:p-5">
          <Skeleton className="h-4 w-20" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-36" />
        </div>
      </div>
    </div>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg className={`animate-spin text-brand-600 ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z" />
    </svg>
  );
}
