// middleware.ts
import { NextResponse, type NextRequest } from "next/server";

/**
 * Keyvera (premium + stable):
 * We DO NOT enforce Supabase auth/role in middleware because Edge session parsing
 * can false-negative and cause redirect loops (logged-in users getting sent to /login).
 *
 * Route protection is enforced in-page (client gate) for /admin, /landlord, /agent, /tenant.
 */
export function middleware(_req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/:path*"],
};