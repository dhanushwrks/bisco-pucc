import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The browser only needs the project URL + publishable key; expose them
  // under NEXT_PUBLIC_* so the four SUPABASE_* vars are the single source.
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
  },
  serverExternalPackages: ["@supabase/server"],
};

export default nextConfig;
