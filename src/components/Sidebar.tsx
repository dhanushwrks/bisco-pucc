"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Car, LayoutGrid, LogOut, MessageCircle, Settings, Store, Upload } from "lucide-react";
import { Logo } from "@/components/Logo";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutGrid, owner: false },
  { href: "/upload", label: "Upload", icon: Upload, owner: false },
  { href: "/vehicles", label: "Vehicles", icon: Car, owner: false },
  { href: "/outlets", label: "Outlets", icon: Store, owner: true },
  { href: "/reminders", label: "Reminders", icon: MessageCircle, owner: true },
  { href: "/settings", label: "Settings", icon: Settings, owner: true },
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
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
                active(href) ? "bg-zinc-100 font-medium text-zinc-900" : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"}`}>
              <Icon size={16} strokeWidth={active(href) ? 2.2 : 1.8} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-zinc-100 p-3">
          <div className="truncate px-3 pb-2 text-xs text-zinc-500">{email}</div>
          <form action={signOut}>
            <button className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50">
              <LogOut size={16} strokeWidth={1.8} /> Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* mobile */}
      <header className="sticky top-0 z-10 border-b border-zinc-200/80 bg-white/90 backdrop-blur md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2"><Logo size={24} /><span className="text-sm font-semibold">{orgName}</span></div>
          <form action={signOut}><button className="btn-ghost btn-sm"><LogOut size={14} /></button></form>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
          {items.map(({ href, label }) => (
            <Link key={href} href={href}
              className={`rounded-md px-3 py-1.5 text-sm whitespace-nowrap ${active(href) ? "bg-zinc-100 font-medium" : "text-zinc-600"}`}>
              {label}
            </Link>
          ))}
        </nav>
      </header>
    </>
  );
}
