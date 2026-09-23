import { Spinner } from "@/components/PageSkeleton";

export default function Loading() {
  return (
    <main className="grid min-h-dvh place-items-center bg-zinc-50 px-4">
      <div className="flex flex-col items-center gap-3 text-sm text-zinc-500" role="status" aria-live="polite">
        <Spinner className="h-8 w-8" />
        <span>Loading…</span>
      </div>
    </main>
  );
}
