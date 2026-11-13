import { type NextRequest, type NextResponse } from "next/server";

import { prepareProxyBody } from "@/lib/server/proxy-payload";
import {
  forwardWithSession,
  type HttpMethod,
  withBackendAvailability,
} from "@/lib/server/session";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ path: string[] }> };

/** Authenticated pass-through to the backend API for the admin screens. */
async function proxy(
  request: NextRequest,
  context: RouteContext,
  method: HttpMethod,
): Promise<NextResponse> {
  return withBackendAvailability(async () => {
    const { path } = await context.params;
    const payload = await prepareProxyBody(request, method);
    return forwardWithSession(request, `/${path.join("/")}`, method, payload);
  });
}

export function GET(request: NextRequest, context: RouteContext) {
  return proxy(request, context, "GET");
}

export function POST(request: NextRequest, context: RouteContext) {
  return proxy(request, context, "POST");
}

export function PUT(request: NextRequest, context: RouteContext) {
  return proxy(request, context, "PUT");
}

export function PATCH(request: NextRequest, context: RouteContext) {
  return proxy(request, context, "PATCH");
}

export function DELETE(request: NextRequest, context: RouteContext) {
  return proxy(request, context, "DELETE");
}
