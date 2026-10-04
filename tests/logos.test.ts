import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GET as logoRoute } from "@/app/api/agents/[token]/logo/route";
import { fetchLogo, isPrivateAddress, MAX_BYTES, pageImage, sniffImageType, unwrapLogoUrl, type Resolver } from "@/lib/logo-fetch";
import { logoPath } from "@/lib/safe-url";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const publicDns: Resolver = async () => ["93.184.216.34"];

/** A fake web: url -> response. */
function web(routes: Record<string, () => Response>) {
  const calls: { url: string; ua: string }[] = [];
  const f = (async (url: string, init?: RequestInit) => {
    calls.push({ url, ua: (init?.headers as Record<string, string>)["user-agent"] });
    const r = routes[url];
    if (!r) throw new Error(`no route ${url}`);
    return r();
  }) as typeof fetch;
  return { f, calls };
}
const img = (type = "image/png", body: BodyInit = PNG) => () => new Response(body, { headers: { "content-type": type } });

describe("logo paths", () => {
  it("point at the site's own logo route, only for https logos and real token addresses", () => {
    const token = "0x388785c9FE745142A24Ab4EaF64013d3D11a4e71";
    assert.match(logoPath(token, "https://a.example/x.png")!, /^\/api\/agents\/0x388785c9fe745142a24ab4eaf64013d3d11a4e71\/logo\?v=/);
    assert.equal(logoPath(token, "http://a.example/x.png"), null);
    assert.equal(logoPath(token, null), null);
    assert.equal(logoPath("0xnope", "https://a.example/x.png"), null);
  });
});

describe("fetching a logo", () => {
  it("returns the picture", async () => {
    const { f } = web({ "https://cdn.example/a.png": img() });
    assert.deepEqual(await fetchLogo("https://cdn.example/a.png", { fetch: f, resolve: publicDns }), { body: PNG, type: "image/png" });
  });

  it("asks again like a browser when a host refuses robots", async () => {
    let n = 0;
    const { f, calls } = web({ "https://picky.example/a.webp": () => (n++ === 0 ? new Response("no", { status: 403 }) : img("image/webp")()) });
    assert.equal((await fetchLogo("https://picky.example/a.webp", { fetch: f, resolve: publicDns }))?.type, "image/webp");
    assert.equal(calls.length, 2);
    assert.match(calls[1].ua, /Chrome/);
  });

  it("follows a page link to the picture the page announces", async () => {
    const html = `<html><head><meta property="og:image" content="https://i.example/real.png"></head></html>`;
    const { f } = web({ "https://share.example/abc": () => new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } }), "https://i.example/real.png": img() });
    assert.equal((await fetchLogo("https://share.example/abc", { fetch: f, resolve: publicDns }))?.type, "image/png");
  });

  it("unwraps Google Lens and imgur page links", () => {
    assert.equal(unwrapLogoUrl("https://lens.google.com/uploadbyurl?url=https://gmgn.ai/external-res/x.webp"), "https://gmgn.ai/external-res/x.webp");
    assert.equal(unwrapLogoUrl("https://imgur.com/AbC123x"), "https://i.imgur.com/AbC123x.png");
    assert.equal(unwrapLogoUrl("https://imgur.com/a/AbC123x"), "https://imgur.com/a/AbC123x");
    assert.equal(pageImage(`<meta content="/p.jpg" name="twitter:image">`, "https://x.example/page"), "https://x.example/p.jpg");
    assert.equal(pageImage(`<meta property="og:image" content="javascript:alert(1)">`, "https://x.example/"), null);
  });

  it("recognises a picture sent without an image type", async () => {
    const { f } = web({ "https://raw.example/a": img("application/octet-stream") });
    assert.equal((await fetchLogo("https://raw.example/a", { fetch: f, resolve: publicDns }))?.type, "image/png");
    assert.equal(sniffImageType(new Uint8Array([1, 2, 3])), null);
  });

  it("never reaches a private network address, even through a redirect", async () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "192.168.0.1", "172.16.5.5", "169.254.169.254", "100.64.0.1", "::1", "fd00::1", "::ffff:127.0.0.1"]) assert.ok(isPrivateAddress(ip), ip);
    assert.ok(!isPrivateAddress("93.184.216.34"));
    const { f, calls } = web({
      "https://public.example/a.png": () => new Response(null, { status: 302, headers: { location: "https://internal.example/a.png" } }),
    });
    const resolve: Resolver = async (h) => (h === "internal.example" ? ["10.0.0.5"] : ["93.184.216.34"]);
    assert.equal(await fetchLogo("https://public.example/a.png", { fetch: f, resolve }), null);
    assert.equal(calls.length, 1, "the private address is never requested");
    assert.equal(await fetchLogo("https://localhost/a.png", { fetch: f, resolve }), null);
  });

  it("refuses http, oversized files, non-pictures and dead hosts", async () => {
    const { f } = web({
      "https://down.example/a.png": () => {
        throw new Error("ECONNRESET");
      },
      "https://big.example/a.png": () => new Response(new Uint8Array(MAX_BYTES + 1), { headers: { "content-type": "image/png" } }),
      "https://text.example/a": () => new Response("hello", { headers: { "content-type": "text/plain" } }),
      "https://redirect.example/a": () => new Response(null, { status: 301, headers: { location: "http://plain.example/a.png" } }),
    });
    for (const u of ["http://plain.example/a.png", "https://down.example/a.png", "https://big.example/a.png", "https://text.example/a", "https://redirect.example/a"]) {
      assert.equal(await fetchLogo(u, { fetch: f, resolve: publicDns }), null, u);
    }
  });
});

describe("the logo route", () => {
  it("refuses anything but a token address", async () => {
    const res = await logoRoute(new Request("http://x/api/agents/nope/logo"), { params: Promise.resolve({ token: "nope" }) });
    assert.equal(res.status, 400);
  });
});
