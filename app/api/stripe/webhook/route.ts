import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export async function POST(req: NextRequest) {
  try {
    const stripeSecretKey = getRequiredEnv("STRIPE_SECRET_KEY");
    const stripeWebhookSecret = getRequiredEnv("STRIPE_WEBHOOK_SECRET");
    const supabaseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
    const supabaseServiceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

    const stripe = new Stripe(stripeSecretKey);
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      return NextResponse.json({ error: "Missing Stripe signature header." }, { status: 400 });
    }

    const rawBody = await req.text();
    const event = stripe.webhooks.constructEvent(rawBody, signature, stripeWebhookSecret);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const inspectionRequestId = String(session.metadata?.inspection_request_id || "").trim();
      if (!inspectionRequestId) {
        return NextResponse.json({ received: true, skipped: "Missing inspection_request_id metadata." });
      }

      if (session.payment_status !== "paid") {
        return NextResponse.json({ received: true, skipped: "Checkout session not marked paid." });
      }

      const paymentReference =
        typeof session.payment_intent === "string" && session.payment_intent
          ? session.payment_intent
          : session.id;

      const { data: existing, error: fetchError } = await supabase
        .from("inspection_requests")
        .select("id,status")
        .eq("id", inspectionRequestId)
        .maybeSingle();

      if (fetchError) {
        return NextResponse.json({ error: fetchError.message }, { status: 500 });
      }

      if (!existing) {
        return NextResponse.json({ received: true, skipped: "Inspection request not found." });
      }

      if (existing.status === "paid" || existing.status === "scheduled" || existing.status === "completed") {
        return NextResponse.json({ received: true, ok: true, already_processed: true });
      }

      const { error: updateError } = await supabase
        .from("inspection_requests")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
          payment_reference: paymentReference,
        })
        .eq("id", inspectionRequestId);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Stripe webhook failed." },
      { status: 400 }
    );
  }
}