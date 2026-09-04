import type { Database } from "@/integrations/supabase/types";

type T = Database["public"]["Tables"];

export type Publication = T["publications"]["Row"];
export type PublicationInsert = T["publications"]["Insert"];
export type PublicationStatus = Database["public"]["Enums"]["publication_status"];

export type Job = T["jobs"]["Row"];
export type JobStatus = Database["public"]["Enums"]["job_status"];
export type AuditLog = T["audit_logs"]["Row"];

export const PUBLICATION_STATUS_LABEL: Record<PublicationStatus, string> = {
  pending: "Pendente",
  processing: "Processando",
  published: "Publicada",
  failed: "Falhou",
  cancelled: "Cancelada",
};
