// app/lib/adminGuard.ts
import { supabase } from "@/lib/supabase";

export async function requireAdmin() {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  if (!userData.user) return { ok: false as const };

  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", userData.user.id)
    .single();

  if (error) throw error;
  return { ok: data?.role === "admin" };
}