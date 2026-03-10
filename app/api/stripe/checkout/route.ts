import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!stripeSecretKey) {
  throw new Error("Missing environment variable: STRIPE_SECRET_KEY");
}
if (!supabaseUrl) {
  throw new Error("Missing environment variable: NEXT_PUBLIC_SUPABASE_URL");
}
if (!supabaseServiceRoleKey) {
  throw new Error("Missing environment variable: SUPABASE_SERVICE_ROLE_KEY");
}

const stripe = new Stripe(stripeSecretKey);
const admin = createClient(supabaseUrl, supabaseServiceRoleKey);

function getBaseUrl(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (origin) return origin;
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    if (!token) {
      return NextResponse.json({ error: "Missing bearer token." }, { status: 401 });
    }

    const {
      data: { user },
      error: authError,
    } = await admin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = await req.json();
    const inspectionRequestId = String(body?.inspectionRequestId || "").trim();

    if (!inspectionRequestId) {
      return NextResponse.json({ error: "inspectionRequestId is required." }, { status: 400 });
    }

    const { data: inspection, error: inspectionError } = await admin
      .from("inspection_requests")
      .select("id, property_id, tenant_user_id, status, inspection_fee_ngn")
      .eq("id", inspectionRequestId)
      .eq("tenant_user_id", user.id)
      .maybeSingle();

    if (inspectionError) {
      return NextResponse.json({ error: inspectionError.message }, { status: 400 });
    }

    if (!inspection) {
      return NextResponse.json({ error: "Inspection request not found." }, { status: 404 });
    }

    if (inspection.status !== "requested") {
      return NextResponse.json({ error: "This inspection is not payable." }, { status: 400 });
    }

    const { data: property } = await admin
      .from("properties")
      .select("title, area, city, state")
      .eq("id", inspection.property_id)
      .maybeSingle();

    const propertyTitle = String(property?.title || "Inspection Request");
    const amountNgn = Number(inspection.inspection_fee_ngn || 0);

    if (!Number.isFinite(amountNgn) || amountNgn <= 0) {
      return NextResponse.json({ error: "Invalid inspection amount." }, { status: 400 });
    }

    const baseUrl = getBaseUrl(req);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: user.email || undefined,
      metadata: {
        inspectionRequestId: inspection.id,
        tenantUserId: user.id,
        propertyId: inspection.property_id,
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "ngn",
            unit_amount: Math.round(amountNgn * 100),
            product_data: {
              name: `Inspection Fee - ${propertyTitle}`,
              description: "Keyvera inspection payment",
            },
          },
        },
      ],
      success_url: `${baseUrl}/tenant/inspections/success`,
      cancel_url: `${baseUrl}/tenant/inspections/${inspection.id}`,
    });

    return NextResponse.json({
      checkoutUrl: session.url,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to create Stripe checkout session." },
      { status: 500 }
    );
  }
}