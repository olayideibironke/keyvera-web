import { supabase } from "@/lib/supabase";

export default async function TestSupabasePage() {
  const { data, error } = await supabase.auth.getSession();

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Keyvera Supabase Test</h1>

      <p>
        If you can load this page without crashing, env + client are wired.
      </p>

      <h2>Session</h2>
      <pre style={{ background: "#f5f5f5", padding: 12, borderRadius: 8 }}>
        {JSON.stringify({ data, error }, null, 2)}
      </pre>

      <p>Next step: we build Login + Role-based portals.</p>
    </main>
  );
}