import type { ReactNode } from "react";

export default function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center text-center py-12">
      {icon ? (
        <div className="text-[44px] leading-none mb-5" aria-hidden="true">
          {icon}
        </div>
      ) : null}
      <h3
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "22px",
          fontWeight: 600,
          letterSpacing: "-0.025em",
          color: "var(--kv-heading)",
        }}
      >
        {title}
      </h3>
      {description ? (
        <p className="mt-2 text-[15px] leading-relaxed text-[var(--kv-muted)]">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
