import { describe, expect, it } from "vitest";
import { ARTICLES } from "./articles";
import { FOODS } from "./foods";
import { EMOJI_ONLY, PHOTOS, photoFor, photoOriginalUrl, photoSources, photoUrl } from "./photos";
import { RECIPES } from "./recipes";

describe("photos", () => {
  it("cover every food, recipe and article (except the listed emoji-only ones)", () => {
    const missing = [
      ...FOODS.map((f) => f.id),
      ...RECIPES.map((r) => `recipe:${r.id}`),
      ...ARTICLES.map((a) => `article:${a.id}`),
    ].filter((k) => !photoFor(k) && !EMOJI_ONLY.has(k));
    expect(missing).toEqual([]);
  });

  it("only reference known dishes", () => {
    const known = new Set([...FOODS.map((f) => f.id), ...RECIPES.map((r) => `recipe:${r.id}`), ...ARTICLES.map((a) => `article:${a.id}`)]);
    expect(Object.keys(PHOTOS).filter((k) => !known.has(k))).toEqual([]);
  });

  it("build resized Wikimedia URLs with the file name encoded", () => {
    expect(photoUrl({ file: "Falafel_&_Hummus_Wrap.jpg" }, 240)).toBe(
      "https://commons.wikimedia.org/wiki/Special:FilePath/Falafel_%26_Hummus_Wrap.jpg?width=240",
    );
  });

  it("point at the original file on upload.wikimedia.org, hashed the way Wikimedia does", () => {
    // Known path of File:Example.jpg on Commons.
    expect(photoOriginalUrl({ file: "Example.jpg" })).toBe("https://upload.wikimedia.org/wikipedia/commons/a/a9/Example.jpg");
  });

  it("try Netlify's Image CDN first on Netlify, then Wikimedia directly", () => {
    const p = { file: "Akara_balls.jpg" };
    const [cdn, direct] = photoSources(p, 240, true);
    expect(cdn).toBe(`/.netlify/images?url=${encodeURIComponent(photoOriginalUrl(p))}&w=240&q=70`);
    expect(direct).toBe(photoUrl(p, 240));
    expect(photoSources(p, 240, false)).toEqual([photoUrl(p, 240)]);
  });
});
