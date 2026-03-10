"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

function PrimaryLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-[#0ea5a3] to-[#0a4f63] px-6 py-3 text-sm font-semibold text-white shadow-[0_16px_38px_rgba(10,79,99,0.28)] transition hover:shadow-[0_20px_46px_rgba(10,79,99,0.34)]"
    >
      {children}
    </Link>
  );
}

function SecondaryButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center rounded-2xl border border-black/10 bg-white px-6 py-3 text-sm font-semibold text-[#0b1f2a] shadow-sm transition hover:bg-black/[0.03]"
    >
      {children}
    </button>
  );
}

export default function TenantInspectionSuccessPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-gradient-to-b from-white via-white to-[rgba(14,165,163,0.06)]">
      <div className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-6 py-10">
        <section className="w-full rounded-[32px] border border-black/10 bg-white/80 p-8 shadow-[0_18px_54px_rgba(11,31,42,0.10)] backdrop-blur-xl md:p-10">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-[#0ea5a3] to-[#0a4f63] text-2xl text-white shadow-[0_16px_38px_rgba(10,79,99,0.28)]">
              ✓
            </div>

            <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-[#0b1f2a] md:text-4xl">
              Payment successful
            </h1>

            <p className="mt-4 text-base leading-8 text-black/65">
              Your inspection payment was received successfully. A confirmation email has been sent, and your request will move to the next stage.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <PrimaryLink href="/tenant/inspections">Continue</PrimaryLink>
              <SecondaryButton onClick={() => router.push("/tenant")}>Back to Tenant Home</SecondaryButton>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}