// scripts/seed-properties.mjs
//
// Seeds 100 realistic Lagos property listings into the Supabase `properties` table.
//
// Usage:
//   node scripts/seed-properties.mjs
//
// Requires .env.local with:
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY    (used to bypass RLS during seeding)
//
// All inserted rows have status='live' and inspection_fee_validated=true
// so they appear in the tenant browse page immediately.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

// ---- Load .env.local ----------------------------------------------------
function loadEnvFile(path) {
  try {
    const raw = readFileSync(path, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
}

loadEnvFile(resolve(projectRoot, ".env.local"));
loadEnvFile(resolve(projectRoot, ".env"));

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---- Deterministic RNG (seed: 42) so re-runs produce identical fake data
// (helps avoid duplicate titles on repeat runs because we also dedupe by
// title before insert).
function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(42);
const pick = (arr) => arr[Math.floor(rng() * arr.length)];
const randInt = (min, max) => min + Math.floor(rng() * (max - min + 1));
const randFloat = (min, max) => min + rng() * (max - min);

// ---- Reference data ----------------------------------------------------
const LOCATIONS = [
  { area: "Lekki Phase 1", city: "Lekki", luxuryBoost: 1.4 },
  { area: "Lekki Phase 2 (Ajah)", city: "Ajah", luxuryBoost: 1.0 },
  { area: "Victoria Island", city: "Victoria Island", luxuryBoost: 1.6 },
  { area: "Ikoyi", city: "Ikoyi", luxuryBoost: 1.9 },
  { area: "Banana Island", city: "Ikoyi", luxuryBoost: 2.4 },
  { area: "Ikeja GRA", city: "Ikeja", luxuryBoost: 1.1 },
  { area: "Magodo", city: "Magodo", luxuryBoost: 0.95 },
  { area: "Surulere", city: "Surulere", luxuryBoost: 0.75 },
  { area: "Yaba", city: "Yaba", luxuryBoost: 0.8 },
  { area: "Gbagada", city: "Gbagada", luxuryBoost: 0.85 },
];

const PROPERTY_TYPES = ["apartment", "house", "duplex", "studio", "room"];
const PROPERTY_CLASSES = ["standard", "premium", "luxury"];
const RENT_FREQUENCIES = ["yearly", "yearly", "yearly", "yearly", "yearly", "yearly", "yearly", "monthly", "monthly", "daily"];

const IMAGE_URLS = [
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=700&q=80",
  "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=700&q=80",
  "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=700&q=80",
  "https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=700&q=80",
  "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=700&q=80",
  "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c0?w=700&q=80",
  "https://images.unsplash.com/photo-1600573472556-e636c2acda9e?w=700&q=80",
  "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=700&q=80",
  "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=700&q=80",
  "https://images.unsplash.com/photo-1600573472591-ee6b68d14c68?w=700&q=80",
  "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=700&q=80",
  "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=700&q=80",
  "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=700&q=80",
  "https://images.unsplash.com/photo-1600607688969-a5bfcd646154?w=700&q=80",
  "https://images.unsplash.com/photo-1600566752355-35792bedcfea?w=700&q=80",
];

const TITLE_PREFIXES = [
  "Modern", "Newly Built", "Spacious", "Luxury", "Premium", "Contemporary",
  "Executive", "Furnished", "Serviced", "Stylish", "Elegant", "Compact",
  "Family-Friendly", "Smart", "Tastefully Finished", "Exclusive", "Pristine",
  "Charming", "Sun-filled", "Boutique",
];

const HOUSE_DESCRIPTORS = [
  "Detached Duplex", "Semi-Detached Duplex", "Terrace Duplex", "Bungalow",
  "Penthouse", "Maisonette", "Townhouse", "Mansion",
];

const APARTMENT_DESCRIPTORS = [
  "Apartment", "Flat", "Serviced Apartment", "Smart Home Apartment",
  "Loft Apartment", "Garden Apartment",
];

const STUDIO_DESCRIPTORS = [
  "Studio Apartment", "Studio Loft", "Studio Flat", "Mini Flat",
];

const ROOM_DESCRIPTORS = [
  "Self-Contained Room", "Single Room with Bath", "Ensuite Room",
];

const SUFFIXES = [
  "with Pool", "with 24hr Power", "with BQ", "with Ocean View", "with Garden",
  "in Gated Estate", "with CCTV & Security", "with Smart Home Features",
  "with Fitted Kitchen", "with Marble Flooring", "in Prime Location",
  "with Private Parking", "with Generator & Water Treatment", "with Elevator",
  "with Rooftop Terrace", "with Lagoon View", "with Lush Compound",
  "for Young Professionals", "for Discerning Tenants", "with Gym Access",
];

const FEATURE_POOL = [
  "24-hour power supply via dedicated generator and inverter backup",
  "Round-the-clock estate security with CCTV monitoring",
  "Fitted modern kitchen with built-in cabinets and granite countertops",
  "Marble and tiled flooring throughout the living areas",
  "Decorative POP ceiling with concealed LED lighting",
  "Treated borehole water and modern water heating system",
  "Spacious living room with floor-to-ceiling windows",
  "Private parking for multiple vehicles with secure gate access",
  "Air-conditioned bedrooms with wardrobes and en-suite bathrooms",
  "Smart-home automation including app-controlled lighting and locks",
  "Fully serviced compound with cleaning and landscaping included",
  "Boys' quarters (BQ) and dedicated guest toilet",
  "Lift access for all upper-floor units",
  "Private gym, swimming pool, and sit-out area within the estate",
  "Quiet, well-paved tarred estate roads with green common areas",
  "Walking distance to dining, shopping, and reputable schools",
  "Located inside a gated community with controlled access",
  "Recently renovated with contemporary finishings throughout",
  "Easy access to the Lekki–Epe Expressway and major business hubs",
  "Waterfront view with private balcony overlooking the lagoon",
];

// ---- Generators --------------------------------------------------------
function chooseDescriptor(propertyType) {
  if (propertyType === "duplex" || propertyType === "house") {
    return pick(HOUSE_DESCRIPTORS);
  }
  if (propertyType === "studio") return pick(STUDIO_DESCRIPTORS);
  if (propertyType === "room") return pick(ROOM_DESCRIPTORS);
  return pick(APARTMENT_DESCRIPTORS);
}

function chooseBedrooms(propertyType) {
  if (propertyType === "studio" || propertyType === "room") return 1;
  if (propertyType === "duplex") return randInt(3, 6);
  if (propertyType === "house") return randInt(2, 6);
  const weighted = [1, 2, 2, 2, 3, 3, 3, 4, 4, 5];
  return weighted[Math.floor(rng() * weighted.length)];
}

function chooseSize(propertyType, bedrooms) {
  if (propertyType === "studio" || propertyType === "room") return randInt(45, 80);
  if (propertyType === "duplex") return randInt(220, 800);
  if (propertyType === "house") return randInt(160, 700);
  return Math.max(60, bedrooms * randInt(45, 75));
}

function choosePropertyClass(location) {
  // Banana Island & Ikoyi skew luxury heavily.
  if (location.area === "Banana Island") return rng() < 0.85 ? "luxury" : "premium";
  if (location.area === "Ikoyi") return rng() < 0.55 ? "luxury" : "premium";
  if (location.area === "Victoria Island") return rng() < 0.4 ? "luxury" : rng() < 0.8 ? "premium" : "standard";
  if (location.area === "Lekki Phase 1") return rng() < 0.25 ? "luxury" : rng() < 0.75 ? "premium" : "standard";
  if (location.area === "Ikeja GRA") return rng() < 0.15 ? "luxury" : rng() < 0.6 ? "premium" : "standard";
  // The rest skew standard/premium.
  return rng() < 0.05 ? "luxury" : rng() < 0.45 ? "premium" : "standard";
}

function chooseRent(propertyClass, location, propertyType, bedrooms) {
  let min, max;
  if (propertyClass === "standard") {
    min = 1_200_000;
    max = 3_500_000;
  } else if (propertyClass === "premium") {
    min = 4_000_000;
    max = 12_000_000;
  } else {
    if (location.area === "Banana Island" || location.area === "Ikoyi") {
      min = 25_000_000;
      max = 65_000_000;
    } else {
      min = 12_000_000;
      max = 35_000_000;
    }
  }
  // Bedroom scaling and location boost
  const bedroomScale = 0.85 + bedrooms * 0.05;
  const base = randFloat(min, max) * bedroomScale * (location.luxuryBoost || 1);
  // Round to nearest ₦50,000
  return Math.round(base / 50_000) * 50_000;
}

function convertRentForFrequency(yearly, frequency) {
  if (frequency === "yearly") return yearly;
  if (frequency === "monthly") return Math.round(yearly / 12 / 1_000) * 1_000;
  // daily — assume short-stay; daily rate of yearly/300 (with floor)
  return Math.max(15_000, Math.round(yearly / 300 / 500) * 500);
}

function buildTitle(propertyType, propertyClass, bedrooms, descriptor) {
  const prefix = pick(TITLE_PREFIXES);
  const suffix = pick(SUFFIXES);
  if (propertyType === "studio" || propertyType === "room") {
    return `${prefix} ${descriptor} ${suffix}`;
  }
  const bedWord = bedrooms === 1 ? "1-Bedroom" : `${bedrooms}-Bedroom`;
  const classWord =
    propertyClass === "luxury"
      ? rng() < 0.5
        ? "Luxury "
        : "Executive "
      : propertyClass === "premium"
      ? rng() < 0.4
        ? "Premium "
        : ""
      : "";
  return `${prefix} ${classWord}${bedWord} ${descriptor} ${suffix}`.replace(/\s+/g, " ").trim();
}

function buildDescription(propertyType, bedrooms, bathrooms, size, location, propertyClass) {
  const lead =
    propertyClass === "luxury"
      ? `A standout ${size} sqm residence in the heart of ${location.area}, ${location.city}.`
      : propertyClass === "premium"
      ? `A well-appointed ${size} sqm home located within ${location.area}, ${location.city}.`
      : `A comfortable ${size} sqm property in ${location.area}, ${location.city}.`;

  const stats = `Featuring ${bedrooms} bedroom${bedrooms === 1 ? "" : "s"} and ${bathrooms} bathroom${bathrooms === 1 ? "" : "s"}.`;

  // Sample 2 distinct features
  const f1 = pick(FEATURE_POOL);
  let f2 = pick(FEATURE_POOL);
  let attempts = 0;
  while (f2 === f1 && attempts++ < 5) f2 = pick(FEATURE_POOL);
  return `${lead} ${stats} ${f1}. ${f2}.`;
}

function buildAddressLine(location, propertyType) {
  const streetNumber = randInt(1, 220);
  const streetNames = [
    "Admiralty Way", "Adetokunbo Ademola Crescent", "Bishop Aboyade Cole",
    "Olu Holloway Road", "Ahmadu Bello Way", "Allen Avenue", "Awolowo Road",
    "Kingsway Road", "Bourdillon Road", "Glover Road", "Banana Island Road",
    "Oyinkan Abayomi Drive", "Ozumba Mbadiwe Avenue", "Lekki–Epe Expressway",
    "Adeola Hopewell Street", "Adeniyi Jones Avenue", "Toyin Street",
    "Herbert Macaulay Way", "Akin Adesola Street",
  ];
  return `${streetNumber} ${pick(streetNames)}, ${location.area}`;
}

function inspectionFeeFor(propertyClass) {
  if (propertyClass === "luxury") return 15_000;
  if (propertyClass === "premium") return 10_000;
  return 5_000;
}

function randomCreatedAt() {
  const now = Date.now();
  const offset = Math.floor(rng() * 30 * 24 * 60 * 60 * 1000); // last 30 days
  return new Date(now - offset).toISOString();
}

// ---- Find or create a seed landlord ------------------------------------
async function ensureSeedLandlord() {
  // Try owner first
  const ownerEmail = "djimeanofficial@gmail.com";

  // Look up auth user by email via admin API
  const { data: usersList, error: listErr } =
    await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listErr) {
    console.warn("Could not list users (continuing):", listErr.message);
  }

  let ownerUserId = null;
  if (usersList?.users?.length) {
    const found = usersList.users.find(
      (u) => (u.email ?? "").toLowerCase() === ownerEmail
    );
    if (found) ownerUserId = found.id;
  }

  // Otherwise, look at landlords table — pick the first one we can find.
  if (!ownerUserId) {
    const { data: anyLandlord } = await supabase
      .from("landlords")
      .select("id, user_id")
      .limit(1)
      .maybeSingle();
    if (anyLandlord?.id) {
      console.log(`Using existing landlord ${anyLandlord.id}`);
      return { landlordId: anyLandlord.id, userId: anyLandlord.user_id };
    }
  }

  if (!ownerUserId) {
    throw new Error(
      "No landlord row exists and the owner auth user was not found. " +
        "Create a landlord user via the app first, then re-run this seed."
    );
  }

  // Ensure profile is landlord (or admin — admin can own properties too if RLS allows)
  // Find or create landlord row for owner
  const { data: existing } = await supabase
    .from("landlords")
    .select("id, user_id")
    .eq("user_id", ownerUserId)
    .maybeSingle();

  if (existing?.id) {
    console.log(`Using owner landlord row ${existing.id}`);
    return { landlordId: existing.id, userId: ownerUserId };
  }

  const { data: created, error: createErr } = await supabase
    .from("landlords")
    .insert({ user_id: ownerUserId })
    .select("id, user_id")
    .single();

  if (createErr) {
    throw new Error(`Failed to create landlord row: ${createErr.message}`);
  }

  console.log(`Created landlord row ${created.id} for owner user ${ownerUserId}`);
  return { landlordId: created.id, userId: ownerUserId };
}

// ---- Build 100 unique listings -----------------------------------------
function buildListings({ landlordId, userId, count = 100 }) {
  const rows = [];
  const titles = new Set();

  // Distribute LOCATIONS evenly: 10 per location.
  for (let i = 0; i < count; i++) {
    const location = LOCATIONS[i % LOCATIONS.length];
    const propertyType = pick(PROPERTY_TYPES);
    const propertyClass = choosePropertyClass(location);
    const bedrooms = chooseBedrooms(propertyType);
    const bathrooms = bedrooms + (rng() < 0.5 ? 0 : 1);
    const size = chooseSize(propertyType, bedrooms);
    const descriptor = chooseDescriptor(propertyType);
    const frequency = pick(RENT_FREQUENCIES);
    const yearlyRent = chooseRent(propertyClass, location, propertyType, bedrooms);
    const rentForFrequency = convertRentForFrequency(yearlyRent, frequency);

    let title = buildTitle(propertyType, propertyClass, bedrooms, descriptor);
    let attempt = 0;
    while (titles.has(title) && attempt++ < 8) {
      title = buildTitle(propertyType, propertyClass, bedrooms, descriptor);
    }
    if (titles.has(title)) {
      // last-resort uniqueness suffix
      title = `${title} (Listing ${i + 1})`;
    }
    titles.add(title);

    rows.push({
      owner_landlord_id: landlordId,
      created_by_user_id: userId,
      title,
      description: buildDescription(propertyType, bedrooms, bathrooms, size, location, propertyClass),
      address_line: buildAddressLine(location, propertyType),
      area: location.area,
      city: location.city,
      state: "Lagos",
      country: "Nigeria",
      rent_amount_ngn: rentForFrequency,
      rent_frequency: frequency,
      property_type: propertyType,
      property_class: propertyClass,
      status: "live",
      inspection_fee_ngn: inspectionFeeFor(propertyClass),
      inspection_fee_validated: true,
      created_at: randomCreatedAt(),
    });
  }
  return rows;
}

// ---- Insert in batches -------------------------------------------------
async function insertListings(rows) {
  const BATCH = 25;
  let inserted = 0;
  let skipped = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { data, error } = await supabase
      .from("properties")
      .insert(batch)
      .select("id");

    if (error) {
      console.error(`Batch ${i / BATCH + 1} failed:`, error.message);
      skipped += batch.length;
      continue;
    }
    inserted += data?.length ?? 0;
    process.stdout.write(`  Inserted batch ${i / BATCH + 1} (${inserted}/${rows.length})\r`);
  }
  process.stdout.write("\n");
  return { inserted, skipped };
}

// ---- Main --------------------------------------------------------------
async function main() {
  console.log("Keyvera property seed");
  console.log("---------------------");

  const { landlordId, userId } = await ensureSeedLandlord();

  // Count existing rows so we know the baseline
  const { count: beforeCount } = await supabase
    .from("properties")
    .select("id", { count: "exact", head: true });

  console.log(`Existing properties: ${beforeCount ?? "unknown"}`);

  const rows = buildListings({ landlordId, userId, count: 100 });
  console.log(`Generated ${rows.length} unique listings.`);

  const { inserted, skipped } = await insertListings(rows);
  console.log(`Inserted: ${inserted}`);
  if (skipped) console.log(`Skipped:  ${skipped}`);

  const { count: liveCount } = await supabase
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("status", "live")
    .eq("inspection_fee_validated", true);

  const { count: totalCount } = await supabase
    .from("properties")
    .select("id", { count: "exact", head: true });

  console.log("---------------------");
  console.log(`Total properties:                       ${totalCount ?? "?"}`);
  console.log(`Live & inspection-fee-validated:        ${liveCount ?? "?"}`);
  console.log("Done.");
}

main().catch((err) => {
  console.error("Seed failed:", err?.message ?? err);
  process.exit(1);
});
