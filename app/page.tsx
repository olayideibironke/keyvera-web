// app/page.tsx
import Link from "next/link";
import RoleRedirectGate from "@/app/ui/role-redirect-gate";

const BRAND_TEAL = "#0ea5a3";
const BRAND_TEAL_DARK = "#0a4f63";
const BRAND_NAVY = "#0b1f2a";

type ShowcaseCardProps = {
  title: string;
  location: string;
  price: string;
  tag: string;
  accent?: "teal" | "navy";
};

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-4 py-2 text-xs font-semibold text-slate-800 shadow-sm backdrop-blur">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: BRAND_TEAL, opacity: 0.75 }} />
      {children}
    </span>
  );
}

function SectionTitle({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <div className="max-w-3xl">
      <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{eyebrow}</div>
      <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 md:text-4xl">{title}</h2>
      <p className="mt-3 text-sm leading-7 text-slate-600 md:text-base">{body}</p>
    </div>
  );
}

function PrimaryButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center rounded-2xl px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      style={{
        background: `linear-gradient(90deg, ${BRAND_TEAL}, ${BRAND_TEAL_DARK})`,
        boxShadow: "0 14px 32px rgba(14,165,163,0.22)",
      }}
    >
      {children}
      <span className="ml-3 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.85)" }} />
    </Link>
  );
}

function SecondaryButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center rounded-2xl border border-black/10 bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-black/[0.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
    >
      {children}
    </Link>
  );
}

function RoleButton({
  href,
  label,
  desc,
  accent = "teal",
}: {
  href: string;
  label: string;
  desc: string;
  accent?: "teal" | "navy";
}) {
  const dot = accent === "navy" ? BRAND_NAVY : BRAND_TEAL;

  return (
    <Link
      href={href}
      className="group flex items-start justify-between gap-4 rounded-2xl border border-black/10 bg-white/75 px-5 py-4 shadow-sm transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md"
    >
      <div>
        <div className="text-sm font-bold text-slate-950">{label}</div>
        <div className="mt-1 text-xs leading-6 text-slate-600">{desc}</div>
      </div>
      <span className="mt-1 h-2.5 w-2.5 flex-none rounded-full" style={{ backgroundColor: dot, opacity: 0.65 }} />
    </Link>
  );
}

function InfoCard({
  title,
  body,
  accent = "teal",
}: {
  title: string;
  body: string;
  accent?: "teal" | "navy";
}) {
  const grad =
    accent === "navy"
      ? "from-[rgba(11,31,42,0.10)] to-transparent"
      : "from-[rgba(14,165,163,0.12)] to-transparent";

  const dot = accent === "navy" ? BRAND_NAVY : BRAND_TEAL;

  return (
    <div className={`rounded-[28px] border border-black/10 bg-white p-6 shadow-sm`}>
      <div className={`h-20 rounded-[22px] bg-gradient-to-br ${grad}`} />
      <div className="mt-5 flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: dot, opacity: 0.7 }} />
        <div className="text-lg font-bold text-slate-950">{title}</div>
      </div>
      <p className="mt-3 text-sm leading-7 text-slate-600">{body}</p>
    </div>
  );
}

function StepCard({
  step,
  title,
  body,
}: {
  step: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-[28px] border border-black/10 bg-white p-6 shadow-sm">
      <div className="inline-flex rounded-full border border-black/10 bg-slate-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-600">
        {step}
      </div>
      <div className="mt-4 text-lg font-bold text-slate-950">{title}</div>
      <p className="mt-2 text-sm leading-7 text-slate-600">{body}</p>
    </div>
  );
}

function ShowcaseCard({
  title,
  location,
  price,
  tag,
  accent = "teal",
}: ShowcaseCardProps) {
  const imageBg =
    accent === "navy"
      ? "linear-gradient(135deg, rgba(11,31,42,0.92), rgba(11,31,42,0.52), rgba(255,255,255,0.10))"
      : "linear-gradient(135deg, rgba(14,165,163,0.92), rgba(10,79,99,0.68), rgba(255,255,255,0.16))";

  return (
    <div className="overflow-hidden rounded-[28px] border border-black/10 bg-white shadow-sm">
      <div className="relative h-56 overflow-hidden">
        <div className="absolute inset-0" style={{ background: imageBg }} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.30),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.18),transparent_28%)]" />
        <div className="absolute left-5 top-5 rounded-full border border-white/30 bg-white/20 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur">
          {tag}
        </div>
        <div className="absolute bottom-5 left-5 right-5">
          <div className="max-w-[85%] text-lg font-bold leading-tight text-white">{title}</div>
          <div className="mt-1 text-sm text-white/85">{location}</div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 p-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">From</div>
          <div className="mt-1 text-base font-bold text-slate-950">{price}</div>
        </div>

        <Link
          href="/tenant"
          className="inline-flex items-center justify-center rounded-2xl border border-black/10 bg-white px-4 py-2 text-xs font-semibold text-slate-900 shadow-sm transition hover:bg-black/[0.03]"
        >
          View Flow
        </Link>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="space-y-12 md:space-y-16">
      <RoleRedirectGate />

      <section className="relative overflow-hidden rounded-[36px] border border-black/10 bg-white shadow-sm">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(900px 420px at 14% 4%, rgba(14,165,163,0.18), rgba(255,255,255,0) 60%), radial-gradient(760px 360px at 88% 4%, rgba(11,31,42,0.10), rgba(255,255,255,0) 58%)",
          }}
        />

        <div className="relative grid gap-10 p-8 md:grid-cols-12 md:p-10 lg:p-12">
          <div className="md:col-span-7">
            <Pill>Nigeria-focused verified property marketplace</Pill>

            <h1 className="mt-5 max-w-4xl text-4xl font-extrabold leading-tight tracking-tight text-slate-950 md:text-5xl">
              Beautiful homes. Verified listings. Safer renting for tenants, landlords, and agents.
            </h1>

            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-700">
              Keyvera is building a more professional rental experience with verified roles, structured inspections,
              transparent fees, and trust-first workflows that help reduce confusion and fraud.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <PrimaryButton href="/tenant">Browse as Tenant</PrimaryButton>
              <SecondaryButton href="/landlord">List Your Property</SecondaryButton>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-black/10 bg-white/75 p-4 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Marketplace</div>
                <div className="mt-2 text-lg font-bold text-slate-950">Verified workflows</div>
                <div className="mt-1 text-xs leading-6 text-slate-600">Built for real rental operations, not guesswork.</div>
              </div>

              <div className="rounded-2xl border border-black/10 bg-white/75 p-4 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Inspection</div>
                <div className="mt-2 text-lg font-bold text-slate-950">Clear fee structure</div>
                <div className="mt-1 text-xs leading-6 text-slate-600">Structured inspection flow before deeper engagement.</div>
              </div>

              <div className="rounded-2xl border border-black/10 bg-white/75 p-4 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Trust</div>
                <div className="mt-2 text-lg font-bold text-slate-950">Admin oversight</div>
                <div className="mt-1 text-xs leading-6 text-slate-600">Role verification and cleaner marketplace quality.</div>
              </div>
            </div>
          </div>

          <div className="md:col-span-5">
            <div className="rounded-[30px] border border-black/10 bg-white/75 p-5 shadow-sm backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-slate-950">Explore Keyvera</div>
                  <div className="mt-1 text-xs text-slate-600">Choose how you want to enter the marketplace.</div>
                </div>
                <div className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700">
                  Public Access
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                <RoleButton
                  href="/tenant"
                  label="Tenant"
                  desc="Browse listings, request inspections, and manage payment workflow."
                  accent="teal"
                />
                <RoleButton
                  href="/landlord"
                  label="Landlord"
                  desc="Join Keyvera, access your dashboard, and manage listing activity."
                  accent="navy"
                />
                <RoleButton
                  href="/agent"
                  label="Agent"
                  desc="Get verified, access scheduling workflows, and support inspections."
                  accent="teal"
                />
                <RoleButton
                  href="/admin"
                  label="Admin"
                  desc="Internal portal for platform operations, approvals, and control."
                  accent="navy"
                />
              </div>

              <div className="mt-5 rounded-[24px] border border-black/10 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Why Keyvera</div>
                <div className="mt-2 text-sm leading-7 text-slate-700">
                  A more serious, secure, and transparent property workflow for Nigerian rentals.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <SectionTitle
          eyebrow="Featured marketplace feel"
          title="A premium front door for discovering properties."
          body="This homepage sets the tone for trust, quality, and credibility. For now, we are using premium branded showcase cards. Later, we can swap these with real Nigerian property imagery and live featured listings."
        />

        <div className="grid gap-5 md:grid-cols-3">
          <ShowcaseCard
            title="Modern Lekki duplex with clean finishing"
            location="Lekki Phase 1, Lagos"
            price="₦8,500,000 / year"
            tag="Verified Listing Feel"
            accent="teal"
          />
          <ShowcaseCard
            title="Luxury family home with premium compound"
            location="Ikoyi, Lagos"
            price="₦18,000,000 / year"
            tag="Professional Presentation"
            accent="navy"
          />
          <ShowcaseCard
            title="Contemporary apartment for young professionals"
            location="Abuja Municipal, FCT"
            price="₦5,200,000 / year"
            tag="Inspection Ready"
            accent="teal"
          />
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        <InfoCard
          title="For tenants"
          body="Browse with more clarity, understand inspection expectations, and deal with a platform that is built to feel safer and more accountable."
          accent="teal"
        />
        <InfoCard
          title="For landlords"
          body="Present properties more professionally, onboard into a structured workflow, and gain better control over listing access and property handling."
          accent="navy"
        />
        <InfoCard
          title="For agents"
          body="Operate inside a clearer system with verification-first expectations, cleaner responsibilities, and more trustworthy marketplace participation."
          accent="teal"
        />
      </section>

      <section className="space-y-6 rounded-[34px] border border-black/10 bg-white p-8 shadow-sm md:p-10">
        <SectionTitle
          eyebrow="How it works"
          title="A smoother rental flow built around trust and structure."
          body="Keyvera is designed to feel modern and professional from the first touchpoint. The goal is simple: cleaner listings, clearer expectations, and a better experience for everyone involved."
        />

        <div className="grid gap-5 md:grid-cols-3">
          <StepCard
            step="Step 01"
            title="Create or access your role"
            body="Tenants, landlords, and agents enter through dedicated role flows designed for their part of the marketplace."
          />
          <StepCard
            step="Step 02"
            title="Verify trust and intent"
            body="Key workflows are structured around verification, clear roles, and better administrative control to reduce marketplace noise."
          />
          <StepCard
            step="Step 03"
            title="Move through the rental process"
            body="From listing discovery to inspections and operational follow-through, the platform is built to feel accountable and organized."
          />
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2">
        <div className="rounded-[34px] border border-black/10 bg-white p-8 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Why landlords should trust us</div>
          <h3 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-950">
            A safer, more professional place to present your properties.
          </h3>
          <p className="mt-4 text-sm leading-8 text-slate-600">
            Keyvera aims to help landlords feel protected by creating more structure around who can access workflows,
            how inspections are handled, and how listings are presented in the marketplace.
          </p>

          <div className="mt-6 space-y-3">
            <div className="rounded-2xl border border-black/10 bg-slate-50 p-4 text-sm text-slate-700">
              Cleaner role separation across landlord, tenant, agent, and admin access.
            </div>
            <div className="rounded-2xl border border-black/10 bg-slate-50 p-4 text-sm text-slate-700">
              Better listing credibility through structured process signals.
            </div>
            <div className="rounded-2xl border border-black/10 bg-slate-50 p-4 text-sm text-slate-700">
              A stronger public-facing presence that shows your property in a serious environment.
            </div>
          </div>
        </div>

        <div className="rounded-[34px] border border-black/10 bg-white p-8 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Why tenants should trust us</div>
          <h3 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-950">
            A rental experience that feels more secure, transparent, and intentional.
          </h3>
          <p className="mt-4 text-sm leading-8 text-slate-600">
            Tenants should feel like they are walking into a serious platform, not a random listing board. Keyvera is
            being built to provide better signals, cleaner workflow steps, and more confidence before deeper commitment.
          </p>

          <div className="mt-6 space-y-3">
            <div className="rounded-2xl border border-black/10 bg-slate-50 p-4 text-sm text-slate-700">
              Clearer listing presentation with a marketplace-first experience.
            </div>
            <div className="rounded-2xl border border-black/10 bg-slate-50 p-4 text-sm text-slate-700">
              Better trust positioning through verification and administrative structure.
            </div>
            <div className="rounded-2xl border border-black/10 bg-slate-50 p-4 text-sm text-slate-700">
              More confidence before inspections, payments, and next-step decisions.
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[34px] border border-black/10 bg-white p-8 shadow-sm md:p-10">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Ready to enter Keyvera</div>
            <h3 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-950 md:text-3xl">
              Start with the role that fits you best.
            </h3>
            <p className="mt-3 text-sm leading-8 text-slate-600">
              We’ll next clean the landlord, agent, and tenant entry pages so each one becomes a proper sign in / sign
              up landing experience instead of exposing dashboard controls too early.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <PrimaryButton href="/tenant">Browse as Tenant</PrimaryButton>
            <SecondaryButton href="/landlord">Landlord Access</SecondaryButton>
          </div>
        </div>
      </section>
    </div>
  );
}