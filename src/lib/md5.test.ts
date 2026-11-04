import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { PHOTOS } from "../data/photos";
import { md5 } from "./md5";

describe("md5", () => {
  it("matches the standard test vectors", () => {
    expect(md5("")).toBe("d41d8cd98f00b204e9800998ecf8427e");
    expect(md5("The quick brown fox jumps over the lazy dog")).toBe("9e107d9d372bb6826bd81d3542a419d6");
  });

  it("matches Node's md5 for every photo file name and for long and non-ASCII text", () => {
    const samples = [...Object.values(PHOTOS).map((p) => p.file), "Ọbẹ̀_ẹ̀gúsí.jpg", "x".repeat(200)];
    for (const s of samples) expect(md5(s)).toBe(createHash("md5").update(s, "utf8").digest("hex"));
  });
});
