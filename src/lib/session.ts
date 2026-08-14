import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "growth_sandbox_session";
const SESSION_SECONDS = 60 * 60 * 24 * 7;

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("SESSION_SECRET未配置或长度不足32位");
  return value;
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export async function createSession(userId: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const payload = `${userId}.${expiresAt}`;
  const value = `${payload}.${sign(payload)}`;
  const store = await cookies();
  store.set(COOKIE_NAME, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

export async function getSessionUserId() {
  const store = await cookies();
  const value = store.get(COOKIE_NAME)?.value;
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [userId, expiresAt, signature] = parts;
  if (Number(expiresAt) < Math.floor(Date.now() / 1000)) return null;
  const expected = sign(`${userId}.${expiresAt}`);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return userId;
}

export async function clearSession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

