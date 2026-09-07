import type { Database } from "@/integrations/supabase/types";

type T = Database["public"]["Tables"];

export type Source = T["sources"]["Row"];
export type SourceInsert = T["sources"]["Insert"];
export type SourceType = Database["public"]["Enums"]["source_type"];

export type Destination = T["destinations"]["Row"];
export type DestinationInsert = T["destinations"]["Insert"];
export type DestinationType = Database["public"]["Enums"]["destination_type"];

export const SOURCE_TYPES: { value: SourceType; label: string }[] = [
  { value: "telegram", label: "Telegram" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "amazon", label: "Amazon" },
  { value: "api", label: "API" },
  { value: "feed", label: "Feed" },
  { value: "manual", label: "Manual" },
];

export const DESTINATION_TYPES: { value: DestinationType; label: string }[] = [
  { value: "telegram", label: "Telegram" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "other", label: "Outro" },
];
