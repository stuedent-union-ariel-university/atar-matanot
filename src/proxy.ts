import { NextResponse, type NextRequest } from "next/server";

// Content-Security-Policy with a fresh nonce per request. Next.js reads the
// nonce from the request's CSP header and applies it to its own inline scripts,
// so only scripts carrying the nonce (plus same-origin files) can run.
export function proxy(request: NextRequest) {
    const nonce = btoa(crypto.randomUUID());
    const isDev = process.env.NODE_ENV === "development";

    const csp = [
        "default-src 'self'",
        `script-src 'self' 'nonce-${nonce}'${isDev ? " 'unsafe-eval'" : ""}`,
        // Next and Tailwind emit inline style attributes, which can't carry a nonce.
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self'",
        `connect-src 'self'${isDev ? " ws:" : ""}`,
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        ...(isDev ? [] : ["upgrade-insecure-requests"]),
    ].join("; ");

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("Content-Security-Policy", csp);

    const response = NextResponse.next({
        request: { headers: requestHeaders },
    });
    response.headers.set("Content-Security-Policy", csp);
    return response;
}

export const config = {
    matcher: [{ source: "/((?!_next/static|_next/image|favicon.ico).*)" }],
};
