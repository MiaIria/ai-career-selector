import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { buildFeishuAuthorizeUrl } from "@/lib/feishu";

export async function GET() {
  const state = randomBytes(24).toString("base64url");
  const response = NextResponse.redirect(buildFeishuAuthorizeUrl(state));
  response.cookies.set("feishu_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return response;
}
