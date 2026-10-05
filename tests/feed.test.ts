import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { readLog, writeLog } from "@/lib/ecobot/store";
import { getFeed } from "@/lib/feed";
import { kvClearMemory, kvSet } from "@/lib/kv";

/** The homepage "From X" feed, from the site's own post records (no X API). */

beforeEach(() => kvClearMemory());

describe("Homepage feed", () => {
  it("merges the Eco Bot's and the fixed posts, newest first, only ones that went out", async () => {
    const log = await readLog();
    log.posts = [
      { at: "2026-10-05T12:00:00Z", text: "Moo-ment of learning 🐄 What is CREDIT?\n\n— You can hold it or activate it.", signal: "compose:explainer", url: "https://x.com/M00FIELD/status/3", status: "published" },
      { at: "2026-10-05T11:00:00Z", text: "never went out", signal: "move:x", url: null, status: "publishing" },
    ];
    log.replies = [{ at: "2026-10-05T13:00:00Z", text: "a reply", signal: "reply:9", url: "https://x.com/M00FIELD/status/9", status: "published" }];
    await writeLog(log);
    await kvSet("autopost:log", {
      posted: {
        "board:2026-10-05": { key: "board:2026-10-05", at: "2026-10-05T00:05:00Z", status: "published", url: "https://x.com/M00FIELD/status/1", text: "Today's Bloom Pop field", image: "https://moofield.lol/play/2026-10-05/board" },
        launch: { key: "launch", at: "2026-10-04T12:00:00Z", status: "published", url: "https://x.com/M00FIELD/status/0" },
      },
      counts: {},
      attempts: {},
      lastRunAt: null,
      lastError: null,
    });

    const feed = await getFeed();
    assert.deepEqual(feed.map((p) => p.url), ["https://x.com/M00FIELD/status/3", "https://x.com/M00FIELD/status/1"], "replies, unsent posts and posts without text stay out");
    assert.equal(feed[0].text, "Moo-ment of learning 🐄 What is CREDIT?");
    assert.equal(feed[0].more, 1);
    assert.equal(feed[0].kind, "explainer");
    assert.equal(feed[1].kind, "board");
    assert.ok(feed[1].image);
  });

  it("is empty, not broken, before anything is posted", async () => {
    assert.deepEqual(await getFeed(), []);
  });
});
