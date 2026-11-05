import { describe, expect, it } from "vitest";
import { mediaSrcSet } from "@/components/ui/media-image";

describe("srcset des médias", () => {
  it("variantes plus étroites que l'original seulement, original en dernier", () => {
    expect(mediaSrcSet({ path: "/m.webp", alt: "", width: 1325, smallPath: "/s.webp", mediumPath: "/md.webp" })).toBe("/s.webp 640w, /md.webp 1080w, /m.webp 1325w");
    expect(mediaSrcSet({ path: "/m.webp", alt: "", width: 1000, smallPath: "/s.webp", mediumPath: "/md.webp" })).toBe("/s.webp 640w, /m.webp 1000w");
    expect(mediaSrcSet({ path: "/m.webp", alt: "", width: 600, smallPath: "/s.webp" })).toBeUndefined();
    expect(mediaSrcSet({ path: "/m.webp", alt: "", width: 1400, provenance: { variants: { medium: { path: "/md.webp" } } } })).toBe("/md.webp 1080w, /m.webp 1400w");
  });
});
