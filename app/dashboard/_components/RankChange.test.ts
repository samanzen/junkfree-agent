import { test, expect } from "vitest";
import fs from "fs";
import path from "path";

test("RankChange component renders old → new with delta badge pattern", () => {
  const src = fs.readFileSync(
    path.join(process.cwd(), "app/dashboard/_components/RankChange.tsx"),
    "utf8"
  );
  expect(src).toContain("rk-old");
  expect(src).toContain("rk-new");
  expect(src).toContain("rk-delta");
  expect(src).toContain("rk-arrow");
  expect(src).toContain("#FF6A3D"); // orange arrow like Ubersuggest
  expect(src).toContain("Math.round");
});
