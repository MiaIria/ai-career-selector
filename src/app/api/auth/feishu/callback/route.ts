import { NextRequest, NextResponse } from "next/server";
import { exchangeFeishuCode, getFeishuUserInfo } from "@/lib/feishu";
import { prisma } from "@/lib/prisma";
import { createSession, encryptToken } from "@/lib/session";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get("feishu_oauth_state")?.value;
  const error = request.nextUrl.searchParams.get("error");
  const popup = request.cookies.get("feishu_oauth_popup")?.value === "1";

  if (error) return finishPopupOrRedirect(request, popup, false, error);
  if (!code || !state || !expectedState || state !== expectedState) {
    return finishPopupOrRedirect(request, popup, false, "invalid_oauth_state");
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
    const response = popup ? popupResponse(true) : NextResponse.redirect(new URL("/?auth=success", request.url));
    response.cookies.delete("feishu_oauth_state");
    response.cookies.delete("feishu_oauth_popup");
    return response;
  } catch (cause) {
    console.error("Feishu OAuth callback failed", cause instanceof Error ? cause.message : cause);
    return finishPopupOrRedirect(request, popup, false, "oauth_callback_failed");
  }
}

function finishPopupOrRedirect(request: NextRequest, popup: boolean, success: boolean, error?: string) {
  const response = popup ? popupResponse(success, error) : NextResponse.redirect(new URL(`/?auth_error=${encodeURIComponent(error ?? "oauth_failed")}`, request.url));
  response.cookies.delete("feishu_oauth_state");
  response.cookies.delete("feishu_oauth_popup");
  return response;
}

function popupResponse(success: boolean, error?: string) {
  const payload = JSON.stringify({ type: "growth-sandbox-feishu-auth", success, error: error ?? null });
  return new NextResponse(`<!doctype html><html><body><script>window.opener&&window.opener.postMessage(${payload},window.location.origin);window.close();</script><p>登录${success ? "成功" : "失败"}，可关闭此窗口。</p></body></html>`, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
