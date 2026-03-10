import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import Stripe from "stripe";

function cleanLocation(area?: string | null, city?: string | null, state?: string | null) {
  const values = [area, city, state]
    .map((x) => String(x ?? "").trim())
    .filter(Boolean);

  const deduped: string[] = [];
  for (const value of values) {
    if (!deduped.some((x) => x.toLowerCase() === value.toLowerCase())) {
      deduped.push(value);
    }
  }

  return deduped.join(", ") || "Lagos";
}

function getRequiredEnv() {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendApiKey = process.env.RESEND_API_KEY;
  const resendFromEmail = process.env.RESEND_FROM_EMAIL || "Keyvera <no-reply@send.keyvera.org>";

  if (!stripeSecretKey) {
    throw new Error("Missing environment variable: STRIPE_SECRET_KEY");
  }
  if (!stripeWebhookSecret) {
    throw new Error("Missing environment variable: STRIPE_WEBHOOK_SECRET");
  }
  if (!supabaseUrl) {
    throw new Error("Missing environment variable: NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!supabaseServiceRoleKey) {
    throw new Error("Missing environment variable: SUPABASE_SERVICE_ROLE_KEY");
  }
  if (!resendApiKey) {
    throw new Error("Missing environment variable: RESEND_API_KEY");
  }

  return {
    stripeSecretKey,
    stripeWebhookSecret,
    supabaseUrl,
    supabaseServiceRoleKey,
    resendApiKey,
    resendFromEmail,
  };
}

async function sendPaymentConfirmationEmail(params: {
  resend: Resend;
  from: string;
  to: string;
  fullName: string | null;
  propertyTitle: string;
  location: string;
  amountNgn: number;
  inspectionId: string;
}) {
  const { resend, from, to, fullName, propertyTitle, location, amountNgn, inspectionId } = params;

  const greeting = fullName?.trim() ? fullName.trim() : "there";

  await resend.emails.send({
    from,
    to,
    subject: "Payment confirmation - Keyvera inspection",
    html: `
      <div style="font-family: Arial, sans-serif; color: #0b1f2a; line-height: 1.6;">
        <h2 style="margin-bottom: 8px;">Payment successful</h2>
        <p>Hello ${greeting},</p>
        <p>Your inspection payment has been received successfully on Keyvera.</p>
        <div style="margin: 20px 0; padding: 16px; border: 1px solid #e5e7eb; border-radius: 12px; background: #f8fafc;">
          <p style="margin: 0 0 8px;"><strong>Property:</strong> ${propertyTitle}</p>
          <p style="margin: 0 0 8px;"><strong>Location:</strong> ${location}</p>
          <p style="margin: 0 0 8px;"><strong>Inspection fee:</strong> ₦${Number(amountNgn || 0).toLocaleString()}</p>
          <p style="margin: 0;"><strong>Inspection ID:</strong> ${inspectionId}</p>
        </div>
        <p>Your request will now move to the next stage for scheduling.</p>
        <p>Thank you,<br />Keyvera</p>
      </div>
    `,
  });
}

export async function POST(req: Request) {
  try {
    const {
      stripeSecretKey,
      stripeWebhookSecret,
      supabaseUrl,
      supabaseServiceRoleKey,
      resendApiKey,
      resendFromEmail,
    } = getRequiredEnv();

    const stripe = new Stripe(stripeSecretKey);
    const resend = new Resend(resendApiKey);
    const admin = createClient(supabaseUrl, supabaseServiceRoleKey);

    const body = await req.text();
    const headerList = await headers();
    const signature = headerList.get("stripe-signature");

    if (!signature) {
      return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
    }

    const event = stripe.webhooks.constructEvent(body, signature, stripeWebhookSecret);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const inspectionRequestId = String(session.metadata?.inspectionRequestId || "").trim();

      if (inspectionRequestId) {
        const { data: existingInspection, error: inspectionReadError } = await admin
          .from("inspection_requests")
          .select("id, property_id, tenant_user_id, status, inspection_fee_ngn")
          .eq("id", inspectionRequestId)
          .maybeSingle();

        if (inspectionReadError) {
          throw new Error(inspectionReadError.message);
        }

        if (existingInspection && existingInspection.status === "requested") {
          const paymentReference =
            String(session.payment_intent || "").trim() || String(session.id || "").trim() || null;

          const { error: updateError } = await admin
            .from("inspection_requests")
            .update({
              status: "paid",
              paid_at: new Date().toISOString(),
              payment_reference: paymentReference,
            })
            .eq("id", existingInspection.id);

          if (updateError) {
            throw new Error(updateError.message);
          }

          const [{ data: property }, { data: profile }, authUserResult] = await Promise.all([
            admin
              .from("properties")
              .select("title, area, city, state")
              .eq("id", existingInspection.property_id)
              .maybeSingle(),
            admin
              .from("profiles")
              .select("full_name")
              .eq("user_id", existingInspection.tenant_user_id)
              .maybeSingle(),
            admin.auth.admin.getUserById(existingInspection.tenant_user_id),
          ]);

          const tenantEmail = authUserResult?.data?.user?.email || null;

          if (tenantEmail) {
            await sendPaymentConfirmationEmail({
              resend,
              from: resendFromEmail,
              to: tenantEmail,
              fullName: (profile?.full_name as string | null) ?? null,
              propertyTitle: String(property?.title || "Inspection Request"),
              location: cleanLocation(property?.area, property?.city, property?.state),
              amountNgn: Number(existingInspection.inspection_fee_ngn || 0),
              inspectionId: existingInspection.id,
            });
          }
        }
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