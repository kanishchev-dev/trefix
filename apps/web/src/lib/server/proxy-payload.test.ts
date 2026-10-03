import { describe, expect, it } from "vitest";

import {
  isPassthroughContentType,
  payloadToFetchInit,
  prepareProxyBody,
} from "./proxy-payload";

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/admin/avatars/me", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function multipartRequest(): Request {
  const boundary = "----test-boundary";
  const body = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="file"; filename="avatar.webp"',
    "Content-Type: image/webp",
    "",
    "fake-bytes",
    `--${boundary}--`,
    "",
  ].join("\r\n");

  return new Request("http://localhost/api/admin/avatars/me", {
    method: "POST",
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    body,
  });
}

describe("isPassthroughContentType", () => {
  it("detects multipart and binary payloads", () => {
    expect(isPassthroughContentType("multipart/form-data; boundary=x")).toBe(true);
    expect(isPassthroughContentType("application/octet-stream")).toBe(true);
    expect(isPassthroughContentType("application/json")).toBe(false);
  });

  it("is case insensitive", () => {
    expect(isPassthroughContentType("Multipart/Form-Data")).toBe(true);
  });
});

describe("prepareProxyBody", () => {
  it("has nothing to forward for GET", async () => {
    await expect(prepareProxyBody(new Request("http://localhost/x"), "GET")).resolves.toEqual({
      kind: "empty",
    });
  });

  it("re-encodes a JSON body", async () => {
    const payload = await prepareProxyBody(jsonRequest({ firstName: "Ann" }), "POST");

    expect(payload).toEqual({ kind: "json", body: '{"firstName":"Ann"}' });
  });

  /**
   * A multipart body used to be dropped entirely: the proxy parsed only JSON,
   * so the backend received the upload with no file attached.
   */
  it("streams a multipart body through with its content type", async () => {
    const payload = await prepareProxyBody(multipartRequest(), "POST");

    expect(payload.kind).toBe("stream");
    if (payload.kind !== "stream") {
      throw new Error("unreachable");
    }
    expect(payload.contentType).toContain("multipart/form-data");
    expect(payload.body).toBeInstanceOf(ReadableStream);
  });

  it("ignores a body of an unknown content type", async () => {
    const request = new Request("http://localhost/x", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "hello",
    });

    await expect(prepareProxyBody(request, "POST")).resolves.toEqual({ kind: "empty" });
  });
});

describe("payloadToFetchInit", () => {
  it("sends JSON with an explicit content type", () => {
    expect(
      payloadToFetchInit({ kind: "json", body: "{}" }),
    ).toEqual({ body: "{}", headers: { "content-type": "application/json" } });
  });

  it("requests half duplex for a streamed body", () => {
    const body = new ReadableStream<Uint8Array>();

    expect(
      payloadToFetchInit({ kind: "stream", body, contentType: "multipart/form-data" }),
    ).toEqual({
      body,
      headers: { "content-type": "multipart/form-data" },
      duplex: "half",
    });
  });

  it("sends no body when there is nothing to forward", () => {
    const init = payloadToFetchInit({ kind: "empty" });

    expect(init.body).toBeUndefined();
  });
});
