import type { Database } from "@/integrations/supabase/types";

export type Tables = Database["public"]["Tables"];
export type Row<T extends keyof Tables> = Tables[T]["Row"];
export type Insert<T extends keyof Tables> = Tables[T]["Insert"];
export type Update<T extends keyof Tables> = Tables[T]["Update"];
export type Enums = Database["public"]["Enums"];

export * from "./banner";
export * from "./offer";
export * from "./automation";
export * from "./monitor";
export * from "./template";
export * from "./marketplace";
export * from "./publication";
export * from "./integration";
export * from "./channel";
export * from "./common";
