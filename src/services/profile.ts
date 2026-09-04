import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/types";

export const profileService = {
  async get(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  },

  async upsert(userId: string, values: { name?: string; avatar_url?: string }): Promise<Profile> {
    const { data, error } = await supabase
      .from("profiles")
      .upsert({ user_id: userId, ...values }, { onConflict: "user_id" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },
};
