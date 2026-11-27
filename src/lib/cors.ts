import { NextResponse } from "next/server";

export function getExtensionCorsHeaders(
  request: Request
): Record<string, string> {
  const origin = request.headers.get("origin") || "";
  const isAllowed =
    origin.startsWith("moz-extension://") ||
    origin.startsWith("chrome-extension://") ||
    origin === "http://localhost:3000" ||
    origin === "http://127.0.0.1:3000";

  if (!isAllowed) return {};

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-zeronote-password",
    Vary: "Origin",
  };
}

export function withCors(
  request: Request,
  response: NextResponse
): NextResponse {
  const headers = getExtensionCorsHeaders(request);
  for (const [k, v] of Object.entries(headers)) {
    response.headers.set(k, v);
  }
  return response;
}

export function handleCorsPreflight(request: Request): NextResponse {
  const headers = getExtensionCorsHeaders(request);
  return new NextResponse(null, { status: 204, headers });
}
