import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { verifyCredentials, createContextClient } from "@supabase/server/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Cookie-session client (@supabase/ssr). Owns sign-in/out and token refresh.
 * Use getDb() for data access.
 */
export async function createSsrClient() {
  const cookieStore = await cookies();
  return createServerClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components can't write cookies — middleware refreshes the session.
        }
      },
    },
  });
}

export type AuthContext = {
  userId: string;
  email: string;
  /** RLS-scoped client bound to the verified user token. */
  db: SupabaseClient<Database>;
};

/**
 * Reads the (middleware-refreshed) session cookie, verifies the access token
 * against the project's JWKS with @supabase/server, and returns an RLS-scoped
 * client. Returns null when signed out or the token doesn't verify.
 */
export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  const ssr = await createSsrClient();
  const { data: { session } } = await ssr.auth.getSession();
  if (!session?.access_token) return null;

  const { data: auth, error } = await verifyCredentials(
    { token: session.access_token, apikey: null },
    { auth: "user" },
  );
  if (error || !auth?.token) return null;

  const claims = auth.userClaims;
  return {
    userId: claims?.id ?? "",
    email: claims?.email ?? "",
    db: createContextClient<Database>({ auth: { token: auth.token } }),
  };
});
