import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/supabase/server";

export type Role = "owner" | "operator";
export type Session = {
  userId: string;
  email: string;
  role: Role;
  orgId: string;
  orgName: string;
  outletId: string | null;
  outletName: string | null;
};

/** Current user + profile. Redirects to /login or /onboarding when incomplete. */
export const getSession = cache(async (): Promise<Session> => {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");

  const { data: p } = await ctx.db
    .from("profiles")
    .select("role, org_id, outlet_id, orgs(name), outlets(name)")
    .eq("id", ctx.userId)
    .maybeSingle();
  if (!p) redirect("/onboarding");

  const one = <T,>(x: T | T[] | null): T | null => (Array.isArray(x) ? x[0] ?? null : x);
  return {
    userId: ctx.userId,
    email: ctx.email,
    role: p.role as Role,
    orgId: p.org_id,
    orgName: one(p.orgs as { name: string } | null)?.name ?? "",
    outletId: p.outlet_id,
    outletName: one(p.outlets as { name: string } | null)?.name ?? null,
  };
});

export async function requireOwner() {
  const s = await getSession();
  if (s.role !== "owner") redirect("/");
  return s;
}

/** RLS-scoped database client for the signed-in user (redirects when signed out). */
export async function getDb() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  return ctx.db;
}
