import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

// Signed, HttpOnly session cookie that carries the verified user ID. Keeps the
// ID out of URLs (history, logs, Referer) and makes the server the only place
// that decides who the caller is.

export const SESSION_COOKIE = "atar_session";
const SESSION_TTL_SECONDS = 60 * 60 * 2;

function getSecret(): string {
    const secret = process.env.SESSION_SECRET;
    if (!secret || secret.length < 32) {
        throw new Error("SESSION_SECRET must be set to at least 32 characters");
    }
    return secret;
}

function sign(payload: string): string {
    return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

// Token format: <userId>.<expiresAtUnixSeconds>.<hmac>
export function createSessionToken(userId: string, now = Date.now()): string {
    const exp = Math.floor(now / 1000) + SESSION_TTL_SECONDS;
    const payload = `${userId}.${exp}`;
    return `${payload}.${sign(payload)}`;
}

export function readSessionUserId(
    token: string | undefined,
    now = Date.now(),
): string | null {
    if (!token) return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [userId, exp, sig] = parts;
    if (!/^[0-9]{7,10}$/.test(userId) || !/^[0-9]+$/.test(exp)) return null;
    if (Number(exp) * 1000 <= now) return null;

    const expected = Buffer.from(sign(`${userId}.${exp}`));
    const actual = Buffer.from(sig);
    if (actual.length !== expected.length) return null;
    if (!timingSafeEqual(actual, expected)) return null;
    return userId;
}

export async function getSessionUserId(): Promise<string | null> {
    const jar = await cookies();
    return readSessionUserId(jar.get(SESSION_COOKIE)?.value);
}

export const sessionCookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
};
