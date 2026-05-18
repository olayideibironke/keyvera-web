// app/landlord/settings/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { LoadingText } from "@/app/ui/loading";

type ProfileRow = {
  user_id: string;
  full_name: string | null;
  role: string | null;
};

export default function LandlordSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string>("");
  const [fullName, setFullName] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          router.replace("/login?next=/landlord/settings");
          return;
        }
        setUserId(user.id);
        setEmail(user.email ?? "");

        const { data: profile } = await supabase
          .from("profiles")
          .select("user_id,full_name,role")
          .eq("user_id", user.id)
          .maybeSingle();

        const p = profile as ProfileRow | null;
        setFullName(p?.full_name ?? "");
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to load profile.";
        setErrorMsg(msg);
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;

    setSaving(true);
    setSavedMsg(null);
    setErrorMsg(null);

    try {
      const cleanName = fullName.trim();
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: cleanName || null })
        .eq("user_id", userId);

      if (error) throw error;
      setSavedMsg("Profile updated.");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to save profile.";
      setErrorMsg(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="kv-portal-top">
        <div>
          <h1 className="kv-portal-title">Settings</h1>
          <p className="kv-portal-subtitle">
            Manage your profile, notifications, and account preferences.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="kv-card" style={{ padding: 32 }}>
          <LoadingText>Loading profile…</LoadingText>
        </div>
      ) : (
        <div className="grid gap-6" style={{ gridTemplateColumns: "minmax(0, 1fr)", maxWidth: 760 }}>
          <section className="kv-card" style={{ padding: "32px 36px", borderRadius: 22 }}>
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "20px",
                fontWeight: 600,
                color: "var(--kv-heading)",
                letterSpacing: "-0.02em",
              }}
            >
              Profile
            </h2>
            <p className="mt-1 text-[14px] text-[var(--kv-muted)]">
              Information shown across your landlord dashboard.
            </p>

            {errorMsg ? (
              <div className="mt-5 kv-callout kv-callout-danger" style={{ fontSize: 13 }}>
                {errorMsg}
              </div>
            ) : null}
            {savedMsg ? (
              <div className="mt-5 kv-callout" style={{ fontSize: 13 }}>
                {savedMsg}
              </div>
            ) : null}

            <form onSubmit={handleSave} className="mt-6 space-y-5">
              <div>
                <label className="kv-label" htmlFor="ls-email">
                  Email
                </label>
                <input
                  id="ls-email"
                  type="email"
                  value={email}
                  readOnly
                  className="kv-input"
                  style={{ background: "var(--kv-bg-warm)" }}
                />
                <div className="kv-help">Email changes are handled via support.</div>
              </div>

              <div>
                <label className="kv-label" htmlFor="ls-name">
                  Full name
                </label>
                <input
                  id="ls-name"
                  type="text"
                  className="kv-input"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="kv-btn kv-btn-primary"
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </section>

          <section className="kv-card" style={{ padding: "32px 36px", borderRadius: 22 }}>
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "20px",
                fontWeight: 600,
                color: "var(--kv-heading)",
                letterSpacing: "-0.02em",
              }}
            >
              Notifications
            </h2>
            <p className="mt-1 text-[14px] text-[var(--kv-muted)]">
              Configure how you receive updates about properties, inspections, and approvals.
            </p>
            <div className="mt-5 kv-callout">
              Notification preferences are coming soon. You will be able to manage email and
              in-app alerts here.
            </div>
          </section>

          <section className="kv-card" style={{ padding: "32px 36px", borderRadius: 22 }}>
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "20px",
                fontWeight: 600,
                color: "var(--kv-heading)",
                letterSpacing: "-0.02em",
              }}
            >
              Account
            </h2>
            <p className="mt-1 text-[14px] text-[var(--kv-muted)]">
              Sign out of your landlord account on this device.
            </p>
            <div className="mt-5">
              <button
                type="button"
                className="kv-btn kv-btn-secondary"
                onClick={async () => {
                  await supabase.auth.signOut();
                  router.push("/login");
                }}
              >
                Sign Out
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
