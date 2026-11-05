import { describe, expect, it } from "vitest";
import { robotsHeaderFor } from "@/lib/robots-header";

describe("en-tête X-Robots-Tag", () => {
  it("préproduction : tout en noindex", () => {
    expect(robotsHeaderFor("/", false)).toBe("noindex, nofollow, noarchive");
    expect(robotsHeaderFor("/pergolas/malaga", false)).toBe("noindex, nofollow, noarchive");
  });
  it("production : pages commerciales sans en-tête, pages privées en noindex", () => {
    expect(robotsHeaderFor("/", true)).toBeNull();
    expect(robotsHeaderFor("/screens/helioscreen", true)).toBeNull();
    expect(robotsHeaderFor("/compte", true)).toBe("noindex, nofollow");
    expect(robotsHeaderFor("/commande/abc/payer", true)).toBe("noindex, nofollow");
    expect(robotsHeaderFor("/projets/xyz", true)).toBe("noindex, nofollow");
    expect(robotsHeaderFor("/admin/devis", true)).toBe("noindex, nofollow");
    expect(robotsHeaderFor("/api/health", true)).toBe("noindex, nofollow");
    expect(robotsHeaderFor("/compteur", true)).toBeNull();
  });
});
