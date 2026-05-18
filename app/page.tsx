// app/page.tsx
import Image from "next/image";
import Link from "next/link";
import RoleRedirectGate from "@/app/ui/role-redirect-gate";
import RevealOnScroll from "@/app/ui/reveal-on-scroll";

const HERO_MAIN =
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80";
const HERO_FLOAT =
  "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=600&q=80";

const LISTINGS = [
  {
    location: "Lekki Phase 1",
    title: "Modern Duplex with Premium Finishing",
    beds: 4,
    baths: 5,
    sqm: 320,
    price: "₦8.5M",
    cadence: "/ year",
    image:
      "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=700&q=80",
  },
  {
    location: "Ikoyi",
    title: "Luxury Family Home with Premium Compound",
    beds: 6,
    baths: 7,
    sqm: 580,
    price: "₦18M",
    cadence: "/ year",
    image:
      "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=700&q=80",
  },
  {
    location: "Victoria Island",
    title: "Contemporary Apartment for Professionals",
    beds: 2,
    baths: 3,
    sqm: 145,
    price: "₦5.2M",
    cadence: "/ year",
    image:
      "https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=700&q=80",
  },
];

const TRUST_ITEMS = [
  { icon: "🔐", label: "Verified Roles" },
  { icon: "🏠", label: "Lagos-Focused" },
  { icon: "📋", label: "Structured Inspections" },
  { icon: "💰", label: "Transparent Fees" },
  { icon: "🛡️", label: "Admin Oversight" },
];

const ROLES = [
  {
    icon: "🏠",
    title: "Tenant",
    desc: "Browse listings, request inspections, and manage your payment workflow.",
    href: "/tenant",
  },
  {
    icon: "🔑",
    title: "Landlord",
    desc: "Join Keyvera, access your dashboard, and manage listing activity.",
    href: "/landlord",
  },
  {
    icon: "📋",
    title: "Agent",
    desc: "Get verified, access scheduling workflows, and support inspections.",
    href: "/agent",
  },
  {
    icon: "⚙️",
    title: "Admin",
    desc: "Internal portal for platform operations, approvals, and control.",
    href: "/admin",
  },
];

const HOW_STEPS = [
  {
    num: "01",
    title: "Choose Your Role",
    desc: "Tenants, landlords, and agents enter through dedicated flows built for their part of the marketplace.",
  },
  {
    num: "02",
    title: "Verify & Build Trust",
    desc: "Key workflows are structured around verification, clear roles, and admin oversight to reduce marketplace noise.",
  },
  {
    num: "03",
    title: "Move with Confidence",
    desc: "From listing discovery to inspections and operational follow-through, every step is built to feel accountable.",
  },
];

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path
        d="M20 20l-3.5-3.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 21s-7-4.35-9.5-9C1 8.5 3.5 5 7 5c2 0 3.5 1 5 3 1.5-2 3-3 5-3 3.5 0 6 3.5 4.5 7-2.5 4.65-9.5 9-9.5 9z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BedIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 18v-7a3 3 0 013-3h12a3 3 0 013 3v7M3 14h18M7 11a2 2 0 100-2 2 2 0 000 2z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BathIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 12h16v4a3 3 0 01-3 3H7a3 3 0 01-3-3v-4zM6 12V7a2 2 0 014 0v1M5 19l-1 2M19 19l1 2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AreaIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 4h6v2H6v4H4V4zm10 0h6v6h-2V6h-4V4zm6 10v6h-6v-2h4v-4h2zM4 14h2v4h4v2H4v-6z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function HomePage() {
  return (
    <>
      <RoleRedirectGate />
      <RevealOnScroll />

      {/* HERO */}
      <section
        className="relative overflow-hidden"
        style={{
          minHeight: "100vh",
          paddingTop: "120px",
          paddingBottom: "80px",
          background: "var(--kv-bg)",
        }}
      >
        <div className="kv-hero-pattern pointer-events-none absolute inset-0" aria-hidden="true" />

        <div className="relative mx-auto flex h-full max-w-7xl items-center px-6 lg:px-10">
          <div className="grid w-full items-center gap-12 lg:grid-cols-12">
            {/* LEFT */}
            <div className="lg:col-span-6 xl:col-span-6">
              <div
                className="kv-hero-anim inline-flex items-center gap-2 rounded-full px-4 py-2"
                style={{
                  background: "var(--kv-accent-soft)",
                  border: "1px solid rgba(34,166,118,0.15)",
                  animationDelay: "0s",
                }}
              >
                <span
                  className="kv-pulse-dot inline-block h-2 w-2 rounded-full"
                  style={{ background: "var(--kv-accent)" }}
                />
                <span
                  className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em]"
                  style={{ color: "var(--kv-accent)", letterSpacing: "0.12em" }}
                >
                  Lagos Verified Marketplace
                </span>
              </div>

              <h1
                className="kv-hero-anim mt-7"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(38px, 5vw, 66px)",
                  fontWeight: 600,
                  lineHeight: 1.1,
                  letterSpacing: "-0.03em",
                  color: "var(--kv-heading)",
                  animationDelay: "0.08s",
                }}
              >
                Beautiful Lagos homes.
                <br />
                <em style={{ color: "var(--kv-accent)", fontStyle: "italic", fontWeight: 600 }}>
                  Verified &amp; trusted.
                </em>
              </h1>

              <p
                className="kv-hero-anim mt-6"
                style={{
                  fontSize: "18px",
                  lineHeight: 1.75,
                  color: "var(--kv-body)",
                  maxWidth: "520px",
                  animationDelay: "0.16s",
                }}
              >
                Keyvera is building a more professional rental experience in Lagos with verified roles,
                structured inspections, transparent fees, and trust-first workflows that help reduce
                confusion and fraud.
              </p>

              <div
                className="kv-hero-anim mt-9 flex flex-wrap gap-3"
                style={{ animationDelay: "0.24s" }}
              >
                <Link href="/tenant" className="kv-btn kv-btn-primary">
                  <SearchIcon />
                  Browse as Tenant
                </Link>
                <Link href="/landlord" className="kv-btn kv-btn-secondary">
                  List Your Property
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>

            {/* RIGHT — hero visual (desktop only) */}
            <div className="hidden lg:col-span-6 xl:col-span-6 lg:block">
              <div
                className="kv-hero-anim-right relative"
                style={{
                  height: "560px",
                  animationDelay: "0.2s",
                }}
              >
                {/* Main image */}
                <div
                  className="absolute"
                  style={{
                    top: 0,
                    right: 0,
                    width: "100%",
                    height: "72%",
                    borderRadius: "24px",
                    overflow: "hidden",
                    boxShadow: "var(--shadow-xl)",
                  }}
                >
                  <Image
                    src={HERO_MAIN}
                    alt="Premium Lagos home"
                    fill
                    sizes="(max-width: 1280px) 50vw, 600px"
                    className="object-cover"
                    priority
                  />
                </div>

                {/* Floating smaller image */}
                <div
                  className="absolute"
                  style={{
                    bottom: 0,
                    left: "-36px",
                    width: "52%",
                    height: "44%",
                    borderRadius: "20px",
                    overflow: "hidden",
                    border: "3px solid #ffffff",
                    boxShadow: "var(--shadow-xl)",
                  }}
                >
                  <Image
                    src={HERO_FLOAT}
                    alt="Lagos interior"
                    fill
                    sizes="(max-width: 1280px) 30vw, 320px"
                    className="object-cover"
                  />
                </div>

                {/* Stat card */}
                <div
                  className="absolute"
                  style={{
                    bottom: "8%",
                    right: "-20px",
                    background: "rgba(255,255,255,0.92)",
                    backdropFilter: "blur(16px)",
                    WebkitBackdropFilter: "blur(16px)",
                    borderRadius: "16px",
                    boxShadow: "var(--shadow-lg)",
                    border: "1px solid var(--kv-border)",
                    padding: "20px 24px",
                    minWidth: "220px",
                  }}
                >
                  <div
                    className="font-mono"
                    style={{
                      fontSize: "11px",
                      textTransform: "uppercase",
                      letterSpacing: "0.12em",
                      color: "var(--kv-muted)",
                      fontWeight: 500,
                    }}
                  >
                    Verified Listings
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: "30px",
                      fontWeight: 700,
                      color: "var(--kv-accent)",
                      lineHeight: 1.1,
                      marginTop: "4px",
                    }}
                  >
                    100%
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "var(--kv-muted)",
                      marginTop: "2px",
                    }}
                  >
                    Admin-reviewed properties
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST BAR */}
      <section
        style={{
          padding: "44px 24px",
          background: "var(--kv-bg-warm)",
          borderTop: "1px solid var(--kv-border)",
          borderBottom: "1px solid var(--kv-border)",
        }}
      >
        <div
          className="mx-auto flex max-w-7xl flex-wrap items-center justify-center"
          style={{ gap: "40px" }}
        >
          {TRUST_ITEMS.map((it) => (
            <div key={it.label} className="flex items-center gap-3">
              <div
                className="flex items-center justify-center"
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "12px",
                  background: "#ffffff",
                  border: "1px solid var(--kv-border)",
                  boxShadow: "var(--shadow-sm)",
                  fontSize: "18px",
                }}
                aria-hidden="true"
              >
                {it.icon}
              </div>
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: 500,
                  color: "var(--kv-body)",
                }}
              >
                {it.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES BENTO */}
      <section className="kv-section" style={{ background: "var(--kv-bg)" }}>
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <div className="reveal mx-auto max-w-3xl text-center">
            <div className="kv-eyebrow">Platform Features</div>
            <h2
              className="mt-4"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(32px, 4vw, 48px)",
                fontWeight: 600,
                letterSpacing: "-0.03em",
                color: "var(--kv-heading)",
              }}
            >
              Built for real Lagos rental operations.
            </h2>
            <p
              className="mt-4"
              style={{
                fontSize: "17px",
                color: "var(--kv-body)",
                lineHeight: 1.7,
              }}
            >
              Every part of the platform is structured around trust, transparency, and accountability — so
              tenants, landlords, and agents can move with confidence.
            </p>
          </div>

          <div
            className="reveal mt-14 grid gap-5"
            style={{
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gridAutoRows: "minmax(220px, auto)",
            }}
          >
            {/* Featured dark card spans 2x2 */}
            <article
              className="relative overflow-hidden"
              style={{
                gridColumn: "span 2",
                gridRow: "span 2",
                background: "linear-gradient(135deg, #1a3c4a 0%, #1f4f5f 100%)",
                borderRadius: "22px",
                padding: "48px 44px",
                color: "#ffffff",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                boxShadow: "var(--shadow-lg)",
              }}
            >
              <div>
                <div
                  className="inline-flex items-center justify-center"
                  style={{
                    width: "54px",
                    height: "54px",
                    borderRadius: "14px",
                    background: "rgba(255,255,255,0.12)",
                    fontSize: "26px",
                  }}
                  aria-hidden="true"
                >
                  ✨
                </div>
                <div
                  className="mt-7 inline-flex"
                  style={{
                    background: "rgba(34,166,118,0.2)",
                    color: "#5eedb8",
                    fontFamily: "var(--font-mono)",
                    fontSize: "11px",
                    fontWeight: 500,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    padding: "5px 12px",
                    borderRadius: "8px",
                  }}
                >
                  Verified
                </div>
                <h3
                  className="mt-4"
                  style={{
                    fontFamily: "var(--font-display)",
                    color: "#ffffff",
                    fontSize: "clamp(26px, 3vw, 36px)",
                    fontWeight: 600,
                    lineHeight: 1.15,
                    letterSpacing: "-0.025em",
                    maxWidth: "520px",
                  }}
                >
                  Verified Marketplace Infrastructure
                </h3>
                <p
                  className="mt-4"
                  style={{
                    color: "rgba(255,255,255,0.75)",
                    fontSize: "16px",
                    lineHeight: 1.7,
                    maxWidth: "540px",
                  }}
                >
                  Every role on Keyvera goes through structured verification and admin oversight. Listings
                  are reviewed, agents are vetted, and tenants get a marketplace that takes credibility
                  seriously from the very first click.
                </p>
              </div>

              <div
                className="mt-10 grid gap-5"
                style={{ gridTemplateColumns: "1fr 1fr", maxWidth: "520px" }}
              >
                <div
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "16px",
                    padding: "20px 22px",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "var(--font-display)",
                      color: "#5eedb8",
                      fontSize: "32px",
                      fontWeight: 700,
                      lineHeight: 1,
                    }}
                  >
                    4
                  </div>
                  <div
                    className="mt-2"
                    style={{ color: "rgba(255,255,255,0.7)", fontSize: "13px", lineHeight: 1.55 }}
                  >
                    Role types verified
                  </div>
                </div>
                <div
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "16px",
                    padding: "20px 22px",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "var(--font-display)",
                      color: "#5eedb8",
                      fontSize: "32px",
                      fontWeight: 700,
                      lineHeight: 1,
                    }}
                  >
                    24h
                  </div>
                  <div
                    className="mt-2"
                    style={{ color: "rgba(255,255,255,0.7)", fontSize: "13px", lineHeight: 1.55 }}
                  >
                    Avg. review turnaround
                  </div>
                </div>
              </div>
            </article>

            {/* Regular cards */}
            <BentoCard
              icon="🔍"
              title="Inspection Workflow"
              desc="Structured inspection scheduling and follow-through so tenants and agents are aligned at every step."
              tag="STRUCTURED"
            />
            <BentoCard
              icon="💎"
              title="Transparent Pricing"
              desc="Clear, upfront fees with no surprise charges — pricing tenants and landlords can rely on."
              tag="TRANSPARENT"
            />
            <BentoCard
              icon="🛡️"
              title="Admin Oversight"
              desc="Active review of listings and accounts to keep the marketplace clean, credible, and trusted."
              tag="CONTROLLED"
            />
            <BentoCard
              icon="📊"
              title="Role-Based Dashboards"
              desc="Each role gets its own purpose-built dashboard — focused tools, fewer distractions."
              tag="PERSONALIZED"
            />
          </div>
        </div>
      </section>

      {/* LISTINGS SHOWCASE */}
      <section
        id="listings"
        className="kv-section"
        style={{ background: "var(--kv-bg-section)" }}
      >
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <div className="reveal mx-auto max-w-3xl text-center">
            <div className="kv-eyebrow">Featured Listings</div>
            <h2
              className="mt-4"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(32px, 4vw, 48px)",
                fontWeight: 600,
                letterSpacing: "-0.03em",
                color: "var(--kv-heading)",
              }}
            >
              Premium Lagos properties, professionally presented.
            </h2>
            <p
              className="mt-4"
              style={{
                fontSize: "17px",
                color: "var(--kv-body)",
                lineHeight: 1.7,
              }}
            >
              A curated selection of verified Lagos homes, ready for inspection and move-in.
            </p>
          </div>

          <div
            className="reveal mt-14 grid gap-6"
            style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}
          >
            {LISTINGS.map((l) => (
              <article key={l.title} className="kv-card kv-listing-card">
                <div className="relative" style={{ height: "240px", overflow: "hidden" }}>
                  <Image
                    src={l.image}
                    alt={l.title}
                    fill
                    sizes="(max-width: 1024px) 50vw, 33vw"
                    className="kv-listing-img object-cover"
                  />
                  {/* Verified badge */}
                  <div
                    className="absolute"
                    style={{
                      top: "16px",
                      left: "16px",
                      background: "rgba(255,255,255,0.92)",
                      backdropFilter: "blur(10px)",
                      WebkitBackdropFilter: "blur(10px)",
                      borderRadius: "100px",
                      padding: "6px 12px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "var(--kv-heading)",
                      boxShadow: "var(--shadow-sm)",
                    }}
                  >
                    <span
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "999px",
                        background: "var(--kv-accent)",
                      }}
                    />
                    Verified
                  </div>

                  {/* Heart save */}
                  <button
                    type="button"
                    className="kv-save-btn absolute"
                    style={{ top: "12px", right: "12px" }}
                    aria-label="Save listing"
                  >
                    <HeartIcon />
                  </button>
                </div>

                <div style={{ padding: "26px 26px 28px" }}>
                  <div
                    className="font-mono"
                    style={{
                      fontSize: "11px",
                      fontWeight: 500,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: "var(--kv-muted)",
                    }}
                  >
                    {l.location}
                  </div>
                  <h3
                    className="mt-2"
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: "19px",
                      fontWeight: 600,
                      letterSpacing: "-0.02em",
                      color: "var(--kv-heading)",
                      lineHeight: 1.3,
                    }}
                  >
                    {l.title}
                  </h3>

                  {/* Meta row */}
                  <div
                    className="mt-4 flex items-center"
                    style={{ color: "var(--kv-body)", fontSize: "13px" }}
                  >
                    <div className="flex items-center gap-1.5 pr-3">
                      <BedIcon />
                      <span>{l.beds} Beds</span>
                    </div>
                    <div
                      className="flex items-center gap-1.5 px-3"
                      style={{ borderLeft: "1px solid var(--kv-border)" }}
                    >
                      <BathIcon />
                      <span>{l.baths} Baths</span>
                    </div>
                    <div
                      className="flex items-center gap-1.5 pl-3"
                      style={{ borderLeft: "1px solid var(--kv-border)" }}
                    >
                      <AreaIcon />
                      <span>{l.sqm}sqm</span>
                    </div>
                  </div>

                  {/* Price + CTA */}
                  <div
                    className="mt-5 flex items-center justify-between"
                    style={{ borderTop: "1px solid var(--kv-border)", paddingTop: "20px" }}
                  >
                    <div>
                      <span
                        style={{
                          fontFamily: "var(--font-display)",
                          fontSize: "22px",
                          fontWeight: 700,
                          color: "var(--kv-teal)",
                          letterSpacing: "-0.02em",
                        }}
                      >
                        {l.price}
                      </span>
                      <span
                        style={{
                          fontSize: "13px",
                          color: "var(--kv-muted)",
                          marginLeft: "4px",
                        }}
                      >
                        {l.cadence}
                      </span>
                    </div>
                    <Link href="/tenant" className="kv-view-cta">
                      View <span>→</span>
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ROLES SECTION */}
      <section id="roles" className="kv-section" style={{ background: "var(--kv-bg)" }}>
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <div className="reveal mx-auto max-w-3xl text-center">
            <div className="kv-eyebrow">Explore Keyvera</div>
            <h2
              className="mt-4"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(32px, 4vw, 48px)",
                fontWeight: 600,
                letterSpacing: "-0.03em",
                color: "var(--kv-heading)",
              }}
            >
              Start with the role that fits you.
            </h2>
            <p
              className="mt-4"
              style={{ fontSize: "17px", color: "var(--kv-body)", lineHeight: 1.7 }}
            >
              Each role enters Keyvera through a purpose-built workflow designed for what they actually
              need to do.
            </p>
          </div>

          <div
            className="reveal mt-14 grid gap-5"
            style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}
          >
            {ROLES.map((r) => (
              <Link
                key={r.title}
                href={r.href}
                className="kv-card kv-role-card flex flex-col items-center text-center"
                style={{ padding: "40px 28px" }}
              >
                <div
                  className="flex items-center justify-center"
                  style={{
                    width: "64px",
                    height: "64px",
                    borderRadius: "16px",
                    background: "var(--kv-accent-soft)",
                    fontSize: "30px",
                  }}
                  aria-hidden="true"
                >
                  {r.icon}
                </div>
                <h3
                  className="mt-5"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "20px",
                    fontWeight: 600,
                    letterSpacing: "-0.02em",
                    color: "var(--kv-heading)",
                  }}
                >
                  {r.title}
                </h3>
                <p
                  className="mt-2"
                  style={{ fontSize: "14px", lineHeight: 1.65, color: "var(--kv-body)" }}
                >
                  {r.desc}
                </p>
                <div
                  className="kv-role-arrow mt-5 inline-flex items-center"
                  style={{
                    color: "var(--kv-accent)",
                    fontWeight: 600,
                    fontSize: "13px",
                    gap: "6px",
                  }}
                >
                  Enter <span>→</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="kv-section" style={{ background: "var(--kv-bg-section)" }}>
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <div className="reveal mx-auto max-w-3xl text-center">
            <div className="kv-eyebrow">How It Works</div>
            <h2
              className="mt-4"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(32px, 4vw, 48px)",
                fontWeight: 600,
                letterSpacing: "-0.03em",
                color: "var(--kv-heading)",
              }}
            >
              A smoother Lagos rental flow.
            </h2>
            <p
              className="mt-4"
              style={{ fontSize: "17px", color: "var(--kv-body)", lineHeight: 1.7 }}
            >
              From first click to move-in — built around trust and structure.
            </p>
          </div>

          <div className="reveal relative mt-16">
            {/* Connecting line */}
            <div
              aria-hidden="true"
              className="hidden md:block absolute"
              style={{
                top: "44px",
                left: "12%",
                right: "12%",
                height: "2px",
                background:
                  "linear-gradient(90deg, var(--kv-border) 0%, rgba(34,166,118,0.4) 50%, var(--kv-border) 100%)",
              }}
            />

            <div
              className="grid"
              style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 0 }}
            >
              {HOW_STEPS.map((s) => (
                <div
                  key={s.num}
                  className="kv-step-card flex flex-col items-center text-center"
                  style={{ padding: "0 20px" }}
                >
                  <div
                    className="kv-step-circle flex items-center justify-center"
                    style={{
                      width: "88px",
                      height: "88px",
                      borderRadius: "999px",
                      background: "#ffffff",
                      border: "2px solid var(--kv-border)",
                      boxShadow: "var(--shadow-md)",
                    }}
                  >
                    <span
                      className="kv-step-number"
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: "30px",
                        fontWeight: 700,
                        color: "var(--kv-teal)",
                        letterSpacing: "-0.02em",
                        transition: "color 0.5s var(--kv-ease)",
                      }}
                    >
                      {s.num}
                    </span>
                  </div>
                  <h3
                    className="mt-6"
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: "22px",
                      fontWeight: 600,
                      letterSpacing: "-0.02em",
                      color: "var(--kv-heading)",
                    }}
                  >
                    {s.title}
                  </h3>
                  <p
                    className="mt-3"
                    style={{
                      fontSize: "15px",
                      lineHeight: 1.7,
                      color: "var(--kv-body)",
                      maxWidth: "280px",
                    }}
                  >
                    {s.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* TRUST SECTION */}
      <section id="trust" className="kv-section" style={{ background: "var(--kv-bg)" }}>
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <div className="reveal mx-auto max-w-3xl text-center">
            <div className="kv-eyebrow">Why Keyvera</div>
            <h2
              className="mt-4"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(32px, 4vw, 48px)",
                fontWeight: 600,
                letterSpacing: "-0.03em",
                color: "var(--kv-heading)",
              }}
            >
              Built for everyone in the rental journey.
            </h2>
          </div>

          <div
            className="reveal mt-14 grid gap-6"
            style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}
          >
            <TrustPanel
              eyebrow="For Landlords"
              title="A safer, more professional place to present your Lagos properties."
              points={[
                "Cleaner role separation across landlord, tenant, agent, and admin access.",
                "Better listing credibility through structured process signals.",
                "A stronger public-facing presence that shows your property in a serious environment.",
              ]}
            />
            <TrustPanel
              eyebrow="For Tenants"
              title="A rental experience that feels more secure, transparent, and intentional."
              points={[
                "Clearer listing presentation with a marketplace-first experience.",
                "Better trust positioning through verification and administrative structure.",
                "More confidence before inspections, payments, and next-step decisions.",
              ]}
            />
          </div>
        </div>
      </section>

      {/* CTA SECTION */}
      <section
        className="kv-section relative overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, #1a3c4a 0%, #1f4f5f 50%, #1a4050 100%)",
        }}
      >
        <div
          className="pointer-events-none absolute"
          aria-hidden="true"
          style={{
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "700px",
            height: "700px",
            background:
              "radial-gradient(circle, rgba(34,166,118,0.1) 0%, transparent 70%)",
          }}
        />

        <div className="reveal relative mx-auto max-w-3xl px-6 text-center">
          <div
            className="kv-eyebrow"
            style={{ color: "#5eedb8" }}
          >
            Ready to enter Keyvera
          </div>
          <h2
            className="mt-4"
            style={{
              fontFamily: "var(--font-display)",
              color: "#ffffff",
              fontSize: "clamp(34px, 4.5vw, 54px)",
              fontWeight: 600,
              letterSpacing: "-0.03em",
              lineHeight: 1.1,
            }}
          >
            Start with the role that fits you best.
          </h2>
          <p
            className="mt-5"
            style={{
              color: "rgba(255,255,255,0.7)",
              fontSize: "17px",
              lineHeight: 1.75,
              maxWidth: "560px",
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            Each role enters Keyvera through a cleaner public landing before accessing its private
            workflow. Pick yours and get going.
          </p>

          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link href="/tenant" className="kv-btn kv-btn-light">
              Browse as Tenant
            </Link>
            <Link href="/landlord" className="kv-btn kv-btn-ghost-light">
              Landlord Access <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Responsive grid overrides */}
      <style>{`
        @media (max-width: 1024px) {
          section .grid[style*="repeat(3"] { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          section .grid[style*="repeat(4"] { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          section article[style*="grid-column: span 2"],
          section article[style*="grid-column:span 2"] { grid-column: span 2 !important; grid-row: span 1 !important; }
        }
        @media (max-width: 640px) {
          section .grid[style*="repeat(3"],
          section .grid[style*="repeat(4"],
          section .grid[style*="repeat(2"] { grid-template-columns: 1fr !important; }
          section article[style*="grid-column: span 2"],
          section article[style*="grid-column:span 2"] { grid-column: span 1 !important; grid-row: span 1 !important; padding: 32px 26px !important; }
          .kv-section { padding-top: 64px !important; padding-bottom: 64px !important; }
        }
      `}</style>
    </>
  );
}

function BentoCard({
  icon,
  title,
  desc,
  tag,
}: {
  icon: string;
  title: string;
  desc: string;
  tag: string;
}) {
  return (
    <article
      className="kv-card kv-bento-card"
      style={{ padding: "36px 32px", display: "flex", flexDirection: "column" }}
    >
      <div
        className="flex items-center justify-center"
        style={{
          width: "52px",
          height: "52px",
          borderRadius: "14px",
          background: "var(--kv-accent-soft)",
          fontSize: "24px",
        }}
        aria-hidden="true"
      >
        {icon}
      </div>
      <h3
        className="relative mt-6"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "22px",
          fontWeight: 600,
          letterSpacing: "-0.02em",
          color: "var(--kv-heading)",
          lineHeight: 1.25,
        }}
      >
        {title}
      </h3>
      <p
        className="relative mt-3"
        style={{ fontSize: "15px", lineHeight: 1.7, color: "var(--kv-body)" }}
      >
        {desc}
      </p>
      <div className="relative mt-5 kv-tag">{tag}</div>
    </article>
  );
}

function TrustPanel({
  eyebrow,
  title,
  points,
}: {
  eyebrow: string;
  title: string;
  points: string[];
}) {
  return (
    <div
      className="kv-trust-panel"
      style={{
        background: "#ffffff",
        border: "1px solid var(--kv-border)",
        borderRadius: "24px",
        padding: "48px 40px",
        transition: "all 0.5s var(--kv-ease)",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          color: "var(--kv-accent)",
          fontSize: "12px",
          fontWeight: 500,
          textTransform: "uppercase",
          letterSpacing: "0.14em",
        }}
      >
        {eyebrow}
      </div>
      <h3
        className="mt-4"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "24px",
          fontWeight: 600,
          letterSpacing: "-0.025em",
          color: "var(--kv-heading)",
          lineHeight: 1.3,
        }}
      >
        {title}
      </h3>

      <ul className="mt-7 space-y-4">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-4">
            <span
              className="flex items-center justify-center"
              style={{
                width: "26px",
                height: "26px",
                minWidth: "26px",
                borderRadius: "8px",
                background: "var(--kv-accent-soft)",
                border: "1px solid rgba(34,166,118,0.25)",
                color: "var(--kv-accent)",
                fontWeight: 700,
                fontSize: "13px",
                marginTop: "2px",
              }}
              aria-hidden="true"
            >
              ✓
            </span>
            <span style={{ fontSize: "15px", lineHeight: 1.7, color: "var(--kv-body)" }}>{p}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
