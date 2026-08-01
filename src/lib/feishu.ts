const FEISHU_BASE = "https://open.feishu.cn/open-apis";

function config() {
  const appId = process.env.FEISHU_APP_ID;
  const appSecret = process.env.FEISHU_APP_SECRET;
  const redirectUri = process.env.FEISHU_REDIRECT_URI;
  if (!appId || !appSecret || !redirectUri) throw new Error("飞书环境变量尚未完整配置");
  return { appId, appSecret, redirectUri };
}

export function buildFeishuAuthorizeUrl(state: string) {
  const { appId, redirectUri } = config();
  const url = new URL("https://accounts.feishu.cn/open-apis/authen/v1/authorize");
  url.searchParams.set("app_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  return url.toString();
}

export type FeishuOAuthToken = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  refresh_expires_in?: number;
  token_type?: string;
  scope?: string;
};

export async function exchangeFeishuCode(code: string): Promise<FeishuOAuthToken> {
  const { appId, appSecret, redirectUri } = config();
  const response = await fetch(`${FEISHU_BASE}/authen/v2/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: appId,
      client_secret: appSecret,
      code,
      redirect_uri: redirectUri,
    }),
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) {
    throw new Error(`飞书OAuth换取令牌失败：${data.error_description ?? data.msg ?? response.status}`);
  }
  return data;
}

export type FeishuUserInfo = {
  open_id: string;
  union_id?: string;
  user_id?: string;
  name?: string;
  en_name?: string;
  avatar_url?: string;
};

export async function getFeishuUserInfo(accessToken: string): Promise<FeishuUserInfo> {
  const response = await fetch(`${FEISHU_BASE}/authen/v1/user_info`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const payload = await response.json();
  const data = payload.data ?? payload;
  if (!response.ok || !data.open_id) {
    throw new Error(`读取飞书用户信息失败：${payload.msg ?? response.status}`);
  }
  return data;
}
