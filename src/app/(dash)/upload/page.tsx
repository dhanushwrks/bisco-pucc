import { getDb, getSession } from "@/lib/session";
import { PageHeader } from "@/components/ui";
import { UploadForm } from "@/components/UploadForm";

export default async function UploadPage({ searchParams }: { searchParams: Promise<{ outlet?: string }> }) {
  const me = await getSession();
  const db = await getDb();
  const { outlet } = await searchParams;
  const { data: outlets } = await db.from("outlets").select("id, name, licence_no").eq("is_active", true).order("name");

  return (
    <>
      <PageHeader title="Upload certificates"
        subtitle="Drop the day’s export (.xlsx or .csv). You’ll see a preview before anything is saved." />
      <UploadForm outlets={outlets ?? []} fixed={me.role === "operator"} initialOutlet={outlet ?? me.outletId ?? outlets?.[0]?.id ?? ""} />
    </>
  );
}
