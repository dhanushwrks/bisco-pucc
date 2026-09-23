import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { createSsrClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/Sidebar";
import { NavigationProgress } from "@/components/NavigationProgress";

async function signOut() {
  "use server";
  const supabase = await createSsrClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export default async function DashLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  return (
    <div className="min-h-dvh">
      <NavigationProgress />
      <Sidebar orgName={s.orgName} email={s.email} role={s.role} outletName={s.outletName} signOut={signOut} />
      <main className="pb-[calc(4.25rem+env(safe-area-inset-bottom,0px))] md:pb-0 md:pl-60">
        <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 md:px-10 md:py-10">{children}</div>
      </main>
    </div>
  );
}
