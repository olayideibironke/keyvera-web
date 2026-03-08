import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

type RequestBody = {
  inspectionRequestId?: string;
};

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function getBaseUrl(req: NextRequest) {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envUrl) return envUrl.replace(/\/+$/, "");

  const origin = req.headers.get("origin")?.trim();
  if (origin) return origin.replace(/\/+$/, "");

  return "http://localhost:3000";
}

export async function POST(req: NextRequest) {
  try {
    const stripeSecretKey = getRequiredEnv("STRIPE_SECRET_KEY");
    const supabaseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
    const supabaseServiceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

    const stripe = new Stripe(stripeSecretKey);
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const body = (await req.json()) as RequestBody;
    const inspectionRequestId = String(body?.inspectionRequestId || "").trim();

    if (!inspectionRequestId) {
      return NextResponse.json({ error: "Missing inspectionRequestId." }, { status: 400 });
    }

    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing authorization token." }, { status: 401 });
    }

    const accessToken = authHeader.replace("Bearer ", "").trim();
    if (!accessToken) {
      return NextResponse.json({ error: "Invalid authorization token." }, { status: 401 });
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(accessToken);

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized tenant session." }, { status: 401 });
    }

    const { data: inspection, error: inspectionError } = await supabase
      .from("inspection_requests")
      .select("id, tenant_user_id, property_id, status, inspection_fee_ngn")
      .eq("id", inspectionRequestId)
      .maybeSingle();

    if (inspectionError) {
      return NextResponse.json({ error: inspectionError.message }, { status: 500 });
    }

    if (!inspection) {
      return NextResponse.json({ error: "Inspection request not found." }, { status: 404 });
    }

    if (inspection.tenant_user_id !== user.id) {
      return NextResponse.json({ error: "You do not have access to this inspection request." }, { status: 403 });
    }

    if (inspection.status !== "requested") {
      return NextResponse.json(
        { error: "Only requested inspections can be sent to Stripe checkout." },
        { status: 400 }
      );
    }

    const feeNgn = Number(inspection.inspection_fee_ngn || 0);
    if (!Number.isFinite(feeNgn) || feeNgn <= 0) {
      return NextResponse.json(
        { error: "Inspection fee is invalid or not ready for payment." },
        { status: 400 }
      );
    }

    const baseUrl = getBaseUrl(req);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${baseUrl}/tenant/inspections/${inspection.id}?payment=success`,
      cancel_url: `${baseUrl}/tenant/inspections/${inspection.id}?payment=cancelled`,
      customer_email: user.email ?? undefined,
      metadata: {
        inspection_request_id: inspection.id,
        property_id: String(inspection.property_id),
        tenant_user_id: user.id,
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "ngn",
            unit_amount: Math.round(feeNgn * 100),
            product_data: {
              name: "Keyvera Inspection Fee",
              description: `Inspection request ${inspection.id}`,
            },
          },
        },
      ],
    });

    return NextResponse.json({
      checkoutUrl: session.url,
      sessionId: session.id,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error?.message ?? "Failed to create Stripe checkout session.",
      },
      { status: 500 }
    );
  }
}