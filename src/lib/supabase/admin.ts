import "server-only";
import { createAdminClient as create } from "@supabase/server/core";
import type { Database } from "@/lib/database.types";

/** Secret-key client (bypasses RLS). Server-only — never import from client code. */
export const createAdminClient = () => create<Database>();
