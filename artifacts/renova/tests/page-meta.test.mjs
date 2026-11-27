import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  SITE_DESCRIPTION,
  SITE_TITLE,
  getCanonicalUrl,
  getPageMeta,
} from "../src/experience/page-meta.ts";

test("getPageMeta: the Get Started picker gets its own search title and description", () => {
  assert.equal(getPageMeta("/get-started").title, "NIRMAQ | Get Started");
  assert.match(
    getPageMeta("/get-started").description,
    /Start with your role/,
  );
  assert.equal(
    getCanonicalUrl("/get-started"),
    "https://nirmaq.in/get-started",
  );
});

test("getPageMeta: the privacy-request page gets its own search title and description", () => {
  assert.equal(
    getPageMeta("/privacy/request").title,
    "NIRMAQ | File a Privacy Request",
  );
  assert.match(
    getPageMeta("/privacy/request").description,
    /show, correct or delete/,
  );
  assert.equal(
    getCanonicalUrl("/privacy/request"),
    "https://nirmaq.in/privacy/request",
  );
});

test("getPageMeta: the feasibility family gets its own search title and description", () => {
  assert.equal(getPageMeta("/feasibility-check").title, "NIRMAQ | Feasibility Check");
  assert.match(
    getPageMeta("/feasibility-check").description,
    /first look at your building/,
  );
  assert.equal(
    getPageMeta("/societies/intake-form").title,
    "NIRMAQ | Society Intake Form",
  );
  assert.equal(
    getPageMeta("/societies/documents").title,
    "NIRMAQ | Feasibility Documents",
  );
  assert.match(
    getPageMeta("/societies/documents").description,
    /eight documents/,
  );
  assert.equal(
    getPageMeta("/knowledge-centre/dcpr-2034").title,
    "NIRMAQ | DCPR 2034 Guide",
  );
});

test("getPageMeta: the homepage and unknown routes get the site default, never an empty title", () => {
  assert.deepEqual(getPageMeta("/"), {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  });
  const unknown = getPageMeta("/some-future-page");
  assert.equal(unknown.title, SITE_TITLE);
  assert.equal(unknown.description, SITE_DESCRIPTION);
  assert.ok(unknown.title.length > 0);
});

test("getCanonicalUrl: one address per route, no trailing slash except the homepage", () => {
  assert.equal(getCanonicalUrl("/"), "https://nirmaq.in");
  assert.equal(
    getCanonicalUrl("/societies/documents"),
    "https://nirmaq.in/societies/documents",
  );
  assert.equal(
    getCanonicalUrl("/feasibility-check"),
    "https://nirmaq.in/feasibility-check",
  );
});

const sitemap = readFileSync(new URL("../public/sitemap.xml", import.meta.url), "utf8");
const robots = readFileSync(new URL("../public/robots.txt", import.meta.url), "utf8");

test("sitemap.xml: a real sitemap, listing the public pages Google should index", () => {
  assert.ok(sitemap.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  assert.ok(sitemap.includes("<urlset"));
  assert.ok(sitemap.trimEnd().endsWith("</urlset>"));
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.ok(locs.length >= 20, `expected 20+ urls, got ${locs.length}`);
  for (const loc of locs) {
    assert.ok(
      loc.startsWith("https://nirmaq.in/") || loc === "https://nirmaq.in",
      `sitemap loc must be a nirmaq.in URL: ${loc}`,
    );
  }
  for (const url of [
    "https://nirmaq.in/",
    "https://nirmaq.in/societies",
    "https://nirmaq.in/feasibility-check",
    "https://nirmaq.in/societies/intake-form",
    "https://nirmaq.in/societies/documents",
    "https://nirmaq.in/feasibility-dashboard",
    "https://nirmaq.in/get-started",
    "https://nirmaq.in/knowledge-centre/dcpr-2034",
    "https://nirmaq.in/about",
    "https://nirmaq.in/contact",
    "https://nirmaq.in/privacy/request",
  ]) {
    assert.ok(locs.includes(url), `sitemap is missing ${url}`);
  }
});

test("sitemap.xml: login-gated and redirecting pages are left out", () => {
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  for (const loc of locs) {
    assert.ok(!loc.includes("/platform/"), `sitemap must not list the login-gated workspace: ${loc}`);
    assert.ok(!loc.includes("/projects"), `sitemap must not list pages that redirect to the workspace: ${loc}`);
    assert.ok(!loc.includes("/join"), `sitemap must not list pages that redirect to the workspace: ${loc}`);
    assert.ok(!loc.includes("/spike/"), `sitemap must not list the design record: ${loc}`);
  }
});

test("robots.txt: crawling stays open and points Google at the sitemap", () => {
  assert.match(robots, /User-agent: \*\s*\nAllow: \//);
  assert.ok(robots.includes("Sitemap: https://nirmaq.in/sitemap.xml"));
});
