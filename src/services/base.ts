import { supabase } from "@/integrations/supabase/client";
import type { Insert, Row, Tables, Update } from "@/types";

/**
 * Erro usado por funcionalidades que dependem de integrações externas
 * ainda não implementadas nesta etapa do projeto.
 */
export class NotImplementedError extends Error {
  constructor(public feature: string) {
    super("Esta funcionalidade será configurada posteriormente.");
    this.name = "NotImplementedError";
  }
}

export function notImplemented(feature: string): never {
  throw new NotImplementedError(feature);
}

/** Mensagem segura para o usuário — nunca expõe detalhes internos. */
export function toUserMessage(error: unknown): string {
  if (error instanceof NotImplementedError) return error.message;
  if (error instanceof Error && error.message && error.message.length < 160) return error.message;
  return "Não foi possível concluir a operação. Tente novamente.";
}

export async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Sessão expirada. Entre novamente.");
  return data.user.id;
}

// Acesso dinâmico por nome de tabela. O cliente tipado não suporta genéricos
// dinâmicos, por isso um único ponto de conversão controlado.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const untyped = supabase as unknown as { from: (table: string) => any };

export interface ListOptions {
  orderBy?: string;
  ascending?: boolean;
  limit?: number;
  select?: string;
  filters?: Record<string, string | number | boolean | null | undefined>;
  search?: { column: string; value: string };
}

export function createCrud<K extends keyof Tables & string>(table: K) {
  return {
    table,

    async list(options: ListOptions = {}): Promise<Row<K>[]> {
      let query = untyped
        .from(table)
        .select(options.select ?? "*")
        .order(options.orderBy ?? "created_at", { ascending: options.ascending ?? false });

      for (const [key, value] of Object.entries(options.filters ?? {})) {
        if (value === undefined || value === null || value === "") continue;
        query = query.eq(key, value);
      }
      if (options.search?.value) {
        query = query.ilike(options.search.column, `%${options.search.value}%`);
      }
      if (options.limit) query = query.limit(options.limit);

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data ?? []) as Row<K>[];
    },

    async getById(id: string, select = "*"): Promise<Row<K> | null> {
      const { data, error } = await untyped.from(table).select(select).eq("id", id).maybeSingle();
      if (error) throw new Error(error.message);
      return (data ?? null) as Row<K> | null;
    },

    async create(values: Omit<Insert<K>, "user_id"> & { user_id?: string }): Promise<Row<K>> {
      const userId = await requireUserId();
      const payload = { ...values, user_id: userId };
      const { data, error } = await untyped.from(table).insert(payload).select().single();
      if (error) throw new Error(error.message);
      return data as Row<K>;
    },

    /** Insert sem user_id (tabelas filhas isoladas pelo relacionamento). */
    async createChild(values: Insert<K>): Promise<Row<K>> {
      const { data, error } = await untyped.from(table).insert(values).select().single();
      if (error) throw new Error(error.message);
      return data as Row<K>;
    },

    async update(id: string, values: Update<K>): Promise<Row<K>> {
      const { data, error } = await untyped
        .from(table)
        .update(values)
        .eq("id", id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as Row<K>;
    },

    async remove(id: string): Promise<void> {
      const { error } = await untyped.from(table).delete().eq("id", id);
      if (error) throw new Error(error.message);
    },

    async count(filters: Record<string, string | number | null> = {}): Promise<number> {
      let query = untyped.from(table).select("id", { count: "exact", head: true });
      for (const [key, value] of Object.entries(filters)) {
        if (value === null || value === undefined || value === "") continue;
        query = query.eq(key, value);
      }
      const { count, error } = await query;
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
  };
}
