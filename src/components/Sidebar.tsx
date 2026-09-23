"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Car, LayoutGrid, LogOut, MessageCircle, Settings, Store, Upload } from "lucide-react";
import { Logo } from "@/components/Logo";

const NAV = [
  { href: "/", label: "Overview", short: "Home", icon: LayoutGrid, owner: false },
  { href: "/upload", label: "Upload", short: "Upload", icon: Upload, owner: false },
  { href: "/vehicles", label: "Vehicles", short: "Vehicles", icon: Car, owner: false },
  { href: "/outlets", label: "Outlets", short: "Outlets", icon: Store, owner: true },
  { href: "/reminders", label: "Reminders", short: "Remind", icon: MessageCircle, owner: true },
  { href: "/settings", label: "Settings", short: "Settings", icon: Settings, owner: false },
];

export function Sidebar({ orgName, email, role, outletName, signOut }: {
  orgName: string; email: string; role: "owner" | "operator"; outletName: string | null;
  signOut: () => Promise<void>;
}) {
  const path = usePathname();
  const items = NAV.filter((n) => role === "owner" || !n.owner);
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <>
      {/* desktop */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-zinc-200/80 bg-white md:flex">
        <div className="flex items-center gap-2.5 px-5 pb-6 pt-5">
          <Logo />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold leading-tight">{orgName}</div>
            <div className="text-xs text-zinc-500">{role === "owner" ? "Owner" : outletName}</div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 px-3">
          {items.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition ${
                active(href) ? "bg-zinc-100 font-medium text-zinc-900" : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"}`}>
              <Icon size={16} strokeWidth={active(href) ? 2.2 : 1.8} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-zinc-100 p-3">
          <div className="truncate px-3 pb-2 text-xs text-zinc-500">{email}</div>
          <form action={signOut}>
            <button className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-zinc-600 hover:bg-zinc-50">
              <LogOut size={16} strokeWidth={1.8} /> Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* mobile top bar */}
      <header className="sticky top-0 z-20 border-b border-zinc-200/80 bg-white/95 backdrop-blur md:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <Logo size={24} />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold leading-tight">{orgName}</div>
              <div className="truncate text-[11px] text-zinc-500">{role === "owner" ? "Owner" : outletName}</div>
            </div>
          </div>
          <form action={signOut}>
            <button type="submit" className="inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm text-zinc-600 hover:bg-zinc-100" aria-label="Sign out">
              <LogOut size={16} strokeWidth={1.8} />
              <span className="sr-only">Sign out</span>
            </button>
          </form>
        </div>
      </header>

      {/* mobile bottom tabs */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200/80 bg-white/95 backdrop-blur md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex items-stretch justify-around px-1 pt-1">
          {items.map(({ href, short, icon: Icon }) => {
            const on = active(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[10px] font-medium ${
                  on ? "text-zinc-900" : "text-zinc-500"
                }`}
              >
                <Icon size={20} strokeWidth={on ? 2.2 : 1.8} className={on ? "text-brand-600" : ""} />
                <span className="max-w-full truncate">{short}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
