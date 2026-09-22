// Mirrors supabase/migrations/0001_init.sql + 0002_org_settings.sql.
// Regenerate with: npx supabase gen types typescript --project-id <ref> > src/lib/database.types.ts

type Role = "owner" | "operator";
type ReminderStatus = "queued" | "sent" | "delivered" | "read" | "failed" | "simulated";

type Table<Row, Insert, Rel = []> = { Row: Row; Insert: Insert; Update: Partial<Insert>; Relationships: Rel };

type OrgRow = {
  id: string; name: string; reminder_offsets: number[]; reminders_enabled: boolean;
  wa_template: string; wa_language: string; support_phone: string | null; created_at: string;
};
type OutletRow = {
  id: string; org_id: string; name: string; licence_no: string; etc_id: string | null;
  address: string | null; phone: string | null; is_active: boolean; created_at: string;
};
type ProfileRow = {
  id: string; org_id: string; role: Role; outlet_id: string | null; full_name: string | null;
  email: string | null; created_at: string;
};
type VehicleRow = {
  org_id: string; vehicle_no: string; mobile: string | null; fuel: string | null; model: string | null;
  last_outlet_id: string | null; last_pucc_no: string | null; last_test_date: string | null;
  valid_until: string | null; opted_out: boolean; first_seen_at: string; updated_at: string;
};
type UploadRow = {
  id: string; org_id: string; outlet_id: string; uploaded_by: string | null; file_name: string | null;
  period_from: string; period_to: string; total_rows: number; new_vehicles: number; renewed: number;
  already_imported: number; history_only: number; rejected: number; errors: unknown; created_at: string;
};
type CertificateRow = {
  id: number; org_id: string; pucc_no: string; vehicle_no: string; outlet_id: string; upload_id: string | null;
  test_date: string; valid_until: string; result: string | null; fuel: string | null; model: string | null;
  engine: string | null; mobile: string | null; km: number | null; hsu: number | null; co: number | null;
  hc: number | null; created_at: string;
};
type ReminderRow = {
  id: string; org_id: string; vehicle_no: string; valid_until: string; kind: "auto" | "manual";
  stage: number | null; mobile: string; status: ReminderStatus; wa_message_id: string | null;
  error: string | null; triggered_by: string | null; created_at: string; updated_at: string;
};

type Opt<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
type Rel = { foreignKeyName: string; columns: string[]; isOneToOne: boolean; referencedRelation: string; referencedColumns: string[] };

type PlannedReminder = {
  vehicle_no: string; mobile: string; valid_until: string; stage: number; days_left: number;
  outlet_name: string | null; outlet_phone: string | null;
};

export type Database = {
  public: {
    Tables: {
      orgs: Table<OrgRow, Opt<OrgRow, "id" | "reminder_offsets" | "reminders_enabled" | "wa_template" | "wa_language" | "support_phone" | "created_at">>;
      outlets: Table<OutletRow, Opt<OutletRow, "id" | "etc_id" | "address" | "phone" | "is_active" | "created_at">, [
        { foreignKeyName: "outlets_org_id_fkey"; columns: ["org_id"]; isOneToOne: false; referencedRelation: "orgs"; referencedColumns: ["id"] },
      ]>;
      profiles: Table<ProfileRow, Opt<ProfileRow, "outlet_id" | "full_name" | "email" | "created_at">, [
        { foreignKeyName: "profiles_org_id_fkey"; columns: ["org_id"]; isOneToOne: false; referencedRelation: "orgs"; referencedColumns: ["id"] },
        { foreignKeyName: "profiles_outlet_id_fkey"; columns: ["outlet_id"]; isOneToOne: false; referencedRelation: "outlets"; referencedColumns: ["id"] },
      ]>;
      vehicles: Table<VehicleRow, Opt<VehicleRow, "mobile" | "fuel" | "model" | "last_outlet_id" | "last_pucc_no" | "last_test_date" | "valid_until" | "opted_out" | "first_seen_at" | "updated_at">, [
        { foreignKeyName: "vehicles_last_outlet_id_fkey"; columns: ["last_outlet_id"]; isOneToOne: false; referencedRelation: "outlets"; referencedColumns: ["id"] },
      ]>;
      uploads: Table<UploadRow, Opt<UploadRow, "id" | "uploaded_by" | "file_name" | "total_rows" | "new_vehicles" | "renewed" | "already_imported" | "history_only" | "rejected" | "errors" | "created_at">, Rel[]>;
      certificates: Table<CertificateRow, Omit<CertificateRow, "id" | "created_at">, Rel[]>;
      reminders: Table<ReminderRow, Opt<ReminderRow, "id" | "stage" | "status" | "wa_message_id" | "error" | "triggered_by" | "created_at" | "updated_at">, Rel[]>;
    };
    Views: Record<never, never>;
    Functions: {
      create_org: { Args: { p_name: string; p_full_name?: string | null }; Returns: string };
      ingest_certificates: {
        Args: {
          p_outlet: string; p_file_name: string; p_from: string; p_to: string; p_rows: unknown;
          p_rejected?: number; p_errors?: unknown; p_dry_run?: boolean;
        };
        Returns: unknown;
      };
      plan_reminders: { Args: { p_org: string }; Returns: PlannedReminder[] };
      preview_reminders: { Args: Record<PropertyKey, never>; Returns: PlannedReminder[] };
      dashboard_summary: { Args: Record<PropertyKey, never>; Returns: unknown };
    };
    Enums: { user_role: Role; reminder_status: ReminderStatus };
    CompositeTypes: Record<never, never>;
  };
};
