import type { ReactNode } from "react";

export default function DashboardCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="kv-stat-card">
      <div className="kv-stat-label">{label}</div>
      <div className="kv-stat-number mt-2">{value}</div>
      {hint ? (
        <div className="mt-2 text-[13px] text-[var(--kv-muted)]">{hint}</div>
      ) : null}
    </div>
  );
}
