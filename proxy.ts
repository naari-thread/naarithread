import { NextResponse, type NextRequest } from "next/server";

const ADMIN_GATE_COOKIE = "nt_admin_session";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdminPage = pathname.startsWith("/admindashboard");
  const isAdminApi = pathname.startsWith("/api/admin");
  const isSessionApi = pathname === "/api/admin/session";

  if (!isAdminPage && !isAdminApi) {
    return NextResponse.next();
  }

  if (isSessionApi) {
    return NextResponse.next();
  }

  const hasGateCookie = Boolean(request.cookies.get(ADMIN_GATE_COOKIE)?.value);

  if (hasGateCookie) {
    return NextResponse.next();
  }

  if (isAdminApi) {
    return NextResponse.json({ error: "Admin gateway session required." }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  url.pathname = "/account";
  url.searchParams.set("admin", "required");
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admindashboard/:path*", "/api/admin/:path*"],
};
