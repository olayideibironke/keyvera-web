import type { ReactNode } from "react";

export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <span
      className="kv-spinner"
      role="status"
      aria-label="Loading"
      style={{ width: size, height: size, borderWidth: Math.max(2, Math.round(size / 10)) }}
    />
  );
}

export function LoadingText({ children = "Loading…" }: { children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8">
      <Spinner />
      <span className="text-[14px] text-[var(--kv-muted)]">{children}</span>
    </div>
  );
}

export function Skeleton({
  className = "",
  height = 16,
  width = "100%",
}: {
  className?: string;
  height?: number | string;
  width?: number | string;
}) {
  return (
    <span
      className={`kv-skeleton block ${className}`}
      style={{ height, width }}
      aria-hidden="true"
    />
  );
}

export default LoadingText;
