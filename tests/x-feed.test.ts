import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { clearCache } from "@/lib/cache";
import { featuredPostUrls, getXFeed, parsePosts, parseProfile, toSegments, xUsername, type XFetcher } from "@/lib/x-feed";

const PROFILE = {
  data: { id: "42", name: "Moofield", username: "moofield", profile_image_url: "https://pbs.twimg.com/profile_images/1/a_normal.jpg", verified_type: "blue" },
};

const POSTS = {
  data: [
    {
      id: "1001",
      text: "Round 1 is live 🐮 @orbiodotso #Moofield https://t.co/abc https://t.co/img",
      created_at: "2026-10-04T12:00:00.000Z",
      public_metrics: { reply_count: 3, retweet_count: 7, like_count: 42 },
      attachments: { media_keys: ["m1"] },
      entities: {
        mentions: [{ start: 18, end: 29, username: "orbiodotso" }],
        hashtags: [{ start: 30, end: 39, tag: "Moofield" }],
        urls: [
          { start: 40, end: 56, url: "https://t.co/abc", expanded_url: "https://moofield.xyz/tournament", display_url: "moofield.xyz/tournament" },
          { start: 57, end: 73, url: "https://t.co/img", expanded_url: "https://x.com/moofield/status/1001/photo/1", media_key: "m1" },
        ],
      },
    },
    { id: "1002", text: "Fish &amp; chips", entities: { urls: [{ start: 0, end: 4, url: "javascript:alert(1)", expanded_url: "javascript:alert(1)" }] } },
    { id: "not-a-number", text: "dropped" },
  ],
  includes: { media: [{ media_key: "m1", type: "photo", url: "https://pbs.twimg.com/media/x.jpg", width: 1200, height: 675, alt_text: "MooBot" }] },
};

describe("x feed parsing", () => {
  it("reads usernames from handles and profile URLs only", () => {
    assert.equal(xUsername("@moofield"), "moofield");
    assert.equal(xUsername("https://x.com/moofield"), "moofield");
    assert.equal(xUsername("https://twitter.com/moofield/"), "moofield");
    assert.equal(xUsername("https://evil.com/moofield"), null);
    assert.equal(xUsername("not a handle!"), null);
  });

  it("keeps only the official account's post URLs", () => {
    const urls = featuredPostUrls(["https://twitter.com/moofield/status/123?s=20", "https://x.com/someone/status/9", "https://x.com/moofield"], "moofield");
    assert.deepEqual(urls, ["https://x.com/moofield/status/123"]);
  });

  it("splits text into links, drops media links and counts emoji as one character", () => {
    const segs = toSegments(POSTS.data[0].text, POSTS.data[0].entities);
    assert.deepEqual(segs, [
      { type: "text", value: "Round 1 is live 🐮 " },
      { type: "link", value: "@orbiodotso", href: "https://x.com/orbiodotso" },
      { type: "text", value: " " },
      { type: "link", value: "#Moofield", href: "https://x.com/hashtag/Moofield" },
      { type: "text", value: " " },
      { type: "link", value: "moofield.xyz/tournament", href: "https://moofield.xyz/tournament" },
    ]);
  });

  it("never links unsafe URLs and decodes HTML entities", () => {
    assert.deepEqual(toSegments(POSTS.data[1].text, POSTS.data[1].entities), [{ type: "text", value: "Fish & chips" }]);
  });

  it("parses posts with media and metrics, skipping bad records", () => {
    const posts = parsePosts(POSTS, "moofield", 3);
    assert.equal(posts.length, 2);
    assert.equal(posts[0].url, "https://x.com/moofield/status/1001");
    assert.deepEqual(posts[0].metrics, { replies: 3, reposts: 7, likes: 42 });
    assert.equal(posts[0].media?.url, "https://pbs.twimg.com/media/x.jpg");
    assert.equal(posts[1].media, null);
  });

  it("parses the profile with a sharper avatar", () => {
    const p = parseProfile(PROFILE);
    assert.equal(p?.avatarUrl, "https://pbs.twimg.com/profile_images/1/a_bigger.jpg");
    assert.equal(p?.verified, true);
  });
});

describe("x feed mode", () => {
  const saved = process.env.X_BEARER_TOKEN;
  beforeEach(() => clearCache());
  afterEach(() => {
    if (saved === undefined) delete process.env.X_BEARER_TOKEN;
    else process.env.X_BEARER_TOKEN = saved;
  });

  const fetcher: XFetcher = async (url, token) => {
    assert.equal(token, "secret");
    return url.includes("/users/by/username/") ? PROFILE : POSTS;
  };

  it("is off until the account is set", async () => {
    assert.equal((await getXFeed({ account: null })).mode, "off");
  });

  it("shows live posts when the token is set", async () => {
    process.env.X_BEARER_TOKEN = "secret";
    const s = await getXFeed({ account: "https://x.com/moofield", fetcher });
    assert.equal(s.mode, "live");
    if (s.mode === "live") assert.equal(s.posts.length, 2);
  });

  it("falls back to featured posts, then the follow card, without a token or when X fails", async () => {
    delete process.env.X_BEARER_TOKEN;
    const featured = await getXFeed({ account: "@moofield", featured: ["https://x.com/moofield/status/5"] });
    assert.equal(featured.mode, "featured");

    process.env.X_BEARER_TOKEN = "secret";
    const down: XFetcher = async () => {
      throw new Error("X is down");
    };
    assert.equal((await getXFeed({ account: "@moofield", fetcher: down })).mode, "follow");
  });
});
