"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { ArrowUpDown, Search } from "lucide-react";

const STATUS = [
  { value: "all", label: "All statuses" },
  { value: "expiring", label: "Expiring ≤30d" },
  { value: "expired", label: "Expired" },
  { value: "valid", label: "Valid" },
  { value: "nomobile", label: "No mobile" },
  { value: "optedout", label: "Opted out" },
] as const;

const SORTS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "expiring", label: "Expiring soon" },
  { value: "valid_longest", label: "Valid longest" },
  { value: "tested", label: "Recently tested" },
  { value: "plate", label: "Plate A–Z" },
] as const;

const FUELS = [
  { value: "", label: "All fuels" },
  { value: "PETROL", label: "Petrol" },
  { value: "DIESEL", label: "Diesel" },
  { value: "CNG", label: "CNG" },
  { value: "LPG", label: "LPG" },
] as const;

export function VehiclesToolbar({
  outlets,
  showOutlets,
  total,
}: {
  outlets: { id: string; name: string }[];
  showOutlets: boolean;
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();

  const setParam = useCallback(
    (key: string, value: string, resetPage = true) => {
      const next = new URLSearchParams(sp.toString());
      if (!value || value === "all") next.delete(key);
      else next.set(key, value);
      if (resetPage) next.delete("page");
      const q = next.toString();
      start(() => router.push(q ? `${pathname}?${q}` : pathname));
    },
    [pathname, router, sp],
  );

  const onSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setParam("q", String(fd.get("q") ?? "").trim());
  };

  return (
    <div className={`space-y-3 ${pending ? "opacity-70" : ""}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={onSearch} className="relative w-full sm:max-w-sm">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            name="q"
            key={sp.get("q") ?? ""}
            defaultValue={sp.get("q") ?? ""}
            className="input pl-9"
            placeholder="Search plate or mobile"
            aria-label="Search vehicles"
          />
        </form>
        <p className="text-sm tabular text-zinc-500">
          <span className="font-medium text-zinc-800">{total.toLocaleString("en-IN")}</span> vehicles
        </p>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-zinc-200/80 bg-white p-3 sm:flex-row sm:flex-wrap sm:items-center">
        <label className="flex min-w-0 flex-1 items-center gap-2 sm:max-w-[11rem]">
          <span className="sr-only">Status</span>
          <select
            className="input"
            value={sp.get("status") ?? "all"}
            onChange={(e) => setParam("status", e.target.value)}
          >
            {STATUS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>

        <label className="flex min-w-0 flex-1 items-center gap-2 sm:max-w-[9rem]">
          <span className="sr-only">Fuel</span>
          <select
            className="input"
            value={sp.get("fuel") ?? ""}
            onChange={(e) => setParam("fuel", e.target.value)}
          >
            {FUELS.map((o) => (
              <option key={o.value || "all"} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>

        {showOutlets && outlets.length > 0 && (
          <label className="flex min-w-0 flex-1 items-center gap-2 sm:max-w-[14rem]">
            <span className="sr-only">Outlet</span>
            <select
              className="input"
              value={sp.get("outlet") ?? ""}
              onChange={(e) => setParam("outlet", e.target.value)}
            >
              <option value="">All outlets</option>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </label>
        )}

        <label className="flex min-w-0 flex-1 items-center gap-2 sm:ml-auto sm:max-w-[13rem]">
          <ArrowUpDown size={14} className="shrink-0 text-zinc-400" aria-hidden />
          <span className="sr-only">Sort</span>
          <select
            className="input"
            value={sp.get("sort") ?? "newest"}
            onChange={(e) => setParam("sort", e.target.value === "newest" ? "" : e.target.value)}
          >
            {SORTS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
