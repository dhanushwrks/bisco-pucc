"use client";

import { useRouter } from "next/navigation";
import { useCallback, type KeyboardEvent, type ReactNode } from "react";

/** Clickable table row that navigates to a detail URL (avoids invalid <a> wrapping <tr>). */
export function ClickableRow({ href, children, className = "" }: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  const router = useRouter();
  const go = useCallback(() => router.push(href), [href, router]);
  const onKey = (e: KeyboardEvent<HTMLTableRowElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      go();
    }
  };
  return (
    <tr
      role="link"
      tabIndex={0}
      onClick={go}
      onKeyDown={onKey}
      className={`cursor-pointer transition hover:bg-zinc-50 focus-visible:bg-zinc-50 focus-visible:outline-none ${className}`}
    >
      {children}
    </tr>
  );
}
