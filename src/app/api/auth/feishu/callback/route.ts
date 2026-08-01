import { NextRequest, NextResponse } from "next/server";
import { exchangeFeishuCode, getFeishuUserInfo } from "@/lib/feishu";
import { prisma } from "@/lib/prisma";
import { createSession, encryptToken } from "@/lib/session";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get("feishu_oauth_state")?.value;
  const error = request.nextUrl.searchParams.get("error");

  if (error) return NextResponse.redirect(new URL(`/?auth_error=${encodeURIComponent(error)}`, request.url));
  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL("/?auth_error=invalid_oauth_state", request.url));
  }

  try {
    const token = await exchangeFeishuCode(code);
    const userInfo = await getFeishuUserInfo(token.access_token);
    const user = await prisma.user.upsert({
      where: { feishuOpenId: userInfo.open_id },
      update: {
        name: userInfo.name,
        avatarUrl: userInfo.avatar_url,
        accessToken: encryptToken(token.access_token),
        refreshToken: token.refresh_token ? encryptToken(token.refresh_token) : null,
        tokenExpiresAt: new Date(Date.now() + token.expires_in * 1000),
      },
      create: {
        feishuOpenId: userInfo.open_id,
        name: userInfo.name,
        avatarUrl: userInfo.avatar_url,
        accessToken: encryptToken(token.access_token),
        refreshToken: token.refresh_token ? encryptToken(token.refresh_token) : null,
        tokenExpiresAt: new Date(Date.now() + token.expires_in * 1000),
      },
    });
    await createSession(user.id);
    const response = NextResponse.redirect(new URL("/?auth=success", request.url));
    response.cookies.delete("feishu_oauth_state");
    return response;
  } catch (cause) {
    console.error("Feishu OAuth callback failed", cause instanceof Error ? cause.message : cause);
    return NextResponse.redirect(new URL("/?auth_error=oauth_callback_failed", request.url));
  }
}
