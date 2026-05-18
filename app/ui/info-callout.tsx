import type { ReactNode } from "react";

type Tone = "accent" | "info" | "warn" | "danger";

export default function InfoCallout({
  tone = "accent",
  icon,
  children,
}: {
  tone?: Tone;
  icon?: ReactNode;
  children: ReactNode;
}) {
  const cls = tone === "accent" ? "kv-callout" : `kv-callout kv-callout-${tone}`;
  return (
    <div className={cls}>
      <div className="flex items-start gap-2.5">
        {icon ? <span aria-hidden="true">{icon}</span> : null}
        <div>{children}</div>
      </div>
    </div>
  );
}
