import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const authToken = request.cookies.get("accessToken")?.value;

  const isAuthPage = pathname.startsWith("/login") || 
                     pathname.startsWith("/register") ||
                     pathname.startsWith("/forgot-password") ||
                     pathname.startsWith("/reset-password");

  if (isAuthPage && authToken) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/profile/:path*",
    "/sessions/:path*",
    "/users/:path*",
    "/security/:path*",
    "/health/:path*",
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
  ],
};
