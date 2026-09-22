import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/supabase/server";
import { Logo } from "@/components/Logo";

async function createOrg(formData: FormData) {
  "use server";
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  const { error } = await ctx.db.rpc("create_org", {
    p_name: String(formData.get("name") ?? ""),
    p_full_name: String(formData.get("full_name") ?? "") || null,
  });
  if (error && !/already onboarded/.test(error.message)) {
    redirect(`/onboarding?error=${encodeURIComponent(error.message)}`);
  }
  redirect("/outlets?welcome=1");
}

export default async function Onboarding({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  const { data: profile } = await ctx.db.from("profiles").select("id").eq("id", ctx.userId).maybeSingle();
  if (profile) redirect("/");
  const { error } = await searchParams;

  return (
    <main className="grid min-h-screen place-items-center bg-zinc-50 px-4">
      <form action={createOrg} className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size={40} />
          <h1 className="mt-4 text-xl font-semibold tracking-tight">Set up your business</h1>
          <p className="mt-1 text-sm text-zinc-500">You’ll add your testing outlets next.</p>
        </div>
        <div className="card space-y-4 p-6 shadow-sm">
          <div>
            <label className="label" htmlFor="name">Business name</label>
            <input id="name" name="name" required className="input" placeholder="e.g. Kadri Emission Testing" />
          </div>
          <div>
            <label className="label" htmlFor="full_name">Your name</label>
            <input id="full_name" name="full_name" className="input" placeholder="Optional" />
          </div>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <button className="btn-primary w-full">Continue</button>
        </div>
      </form>
    </main>
  );
}
