// Cron endpoints must fail CLOSED when CRON_SECRET is missing.
//
// The previous check was `auth !== \`Bearer ${process.env.CRON_SECRET}\``.
// Unset → accepts `Bearer undefined`; empty → accepts `Bearer `. Either lets
// anyone trigger every brand's full AI / DataForSEO pipeline.

import fs from "fs";
import { test, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { requireCronSecret } from "../cronAuth";

const ROOT = process.cwd();
const read = (p: string) => fs.readFileSync(`${ROOT}/${p}`, "utf8");

const CRON_ROUTES = [
  "app/api/cron/orchestrate/route.ts",
  "app/api/cron/rank-sync/route.ts",
  "app/api/cron/rank-enrich/route.ts",
  "app/api/cron/prune/route.ts",
];

const saved = process.env.CRON_SECRET;

beforeEach(() => {
  delete process.env.CRON_SECRET;
});

afterEach(() => {
  if (saved === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = saved;
});

function req(auth: string | null): NextRequest {
  const headers = new Headers();
  if (auth !== null) headers.set("authorization", auth);
  return new NextRequest("https://example.test/api/cron/x", { headers });
}

test("a missing CRON_SECRET refuses every request", () => {
  delete process.env.CRON_SECRET;
  const res = requireCronSecret(req("Bearer anything"));
  expect(res).not.toBeNull();
  expect(res!.status).toBe(401);
});

test("an empty CRON_SECRET refuses every request", () => {
  process.env.CRON_SECRET = "";
  const res = requireCronSecret(req("Bearer "));
  expect(res).not.toBeNull();
  expect(res!.status).toBe(401);
});

test("a matching bearer token is accepted", () => {
  process.env.CRON_SECRET = "correct-horse-battery";
  expect(requireCronSecret(req("Bearer correct-horse-battery"))).toBeNull();
});

test("a wrong bearer token is refused", () => {
  process.env.CRON_SECRET = "correct-horse-battery";
  const res = requireCronSecret(req("Bearer wrong-secret"));
  expect(res).not.toBeNull();
  expect(res!.status).toBe(401);
});

test("every cron route uses requireCronSecret, not the open comparison", () => {
  for (const file of CRON_ROUTES) {
    const src = read(file);
    expect(src, `${file} missing requireCronSecret`).toMatch(/requireCronSecret\(req\)/);
    // The old fail-open pattern must not remain anywhere.
    expect(src, `${file} still uses the open comparison`).not.toMatch(
      /Bearer \$\{process\.env\.CRON_SECRET\}/
    );
  }
});

test("prune is scheduled in vercel.json", () => {
  const src = read("vercel.json");
  expect(src).toMatch(/\/api\/cron\/prune/);
});

test(".env.example never documents a NEXT_PUBLIC cron secret", () => {
  // A NEXT_PUBLIC_* value ships in the browser bundle. The dashboard uses
  // /api/run with a session, not the cron secret.
  expect(read(".env.example")).not.toMatch(/NEXT_PUBLIC_CRON_SECRET/);
});
