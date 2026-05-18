import type { ReactNode } from "react";

type Variant =
  | "pending"
  | "verified"
  | "approved"
  | "live"
  | "rejected"
  | "suspended"
  | "draft"
  | "neutral"
  | "info";

function variantFor(status: string): Variant {
  const s = String(status || "").toLowerCase().trim();
  if (s === "pending" || s === "pending_review" || s === "requested") return "pending";
  if (s === "verified" || s === "approved" || s === "scheduled" || s === "paid" || s === "completed")
    return s === "verified" ? "verified" : s === "approved" ? "approved" : "live";
  if (s === "live") return "live";
  if (s === "rejected" || s === "cancelled" || s === "revoked") return "rejected";
  if (s === "disabled" || s === "suspended") return "suspended";
  if (s === "draft" || s === "archived" || s === "unsubmitted") return "draft";
  return "neutral";
}

export default function StatusBadge({
  status,
  children,
  variant,
}: {
  status?: string;
  children?: ReactNode;
  variant?: Variant;
}) {
  const v = variant ?? variantFor(status ?? "");
  const label = children ?? status ?? "";
  return <span className={`kv-badge kv-badge-${v}`}>{label}</span>;
}
