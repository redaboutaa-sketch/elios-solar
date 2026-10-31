import { describe, expect, it } from "vitest";
import { aggregate, csvLine, rate, sourceOf } from "@/domain/acquisition";

const q = (attribution: unknown, status = "NEW", qualification = "TO_QUALIFY", cashedNetCents: number | null = null) => ({ attribution, status, qualification, cashedNetCents });

describe("mesure commerciale par origine", () => {
  it("origine : utm, puis identifiant de clic, puis référent, sinon non renseignée", () => {
    expect(sourceOf({ params: { utm_source: "newsletter", utm_medium: "email" } })).toBe("newsletter / email");
    expect(sourceOf({ params: { gclid: "x" } })).toBe("google / cpc (gclid)");
    expect(sourceOf({ params: {}, referrerHost: "www.google.com" })).toBe("www.google.com / référent");
    expect(sourceOf(null)).toBe("direct ou non renseigné");
  });
  it("gagné, perdu, qualifié ; un encaissement absent reste non renseigné, jamais 0", () => {
    const rows = aggregate([
      q(null, "ACCEPTED", "QUALIFIED", 120000),
      q(null, "ACCEPTED", "QUALIFIED", null),
      q(null, "DECLINED", "QUALIFIED"),
      q(null, "EXPIRED", "NOT_QUALIFIED"),
      q({ params: { utm_source: "salon", utm_medium: "qr" } }, "ACCEPTED", "QUALIFIED", null),
    ], (x) => sourceOf(x.attribution));
    const direct = rows.find((r) => r.key === "direct ou non renseigné")!;
    expect(direct).toMatchObject({ requests: 4, qualified: 3, notQualified: 1, won: 2, lost: 2, cashedKnown: 1, cashedNetCents: 120000 });
    expect(rows.find((r) => r.key === "salon / qr")!.cashedNetCents).toBeNull();
  });
  it("taux non calculable sans dénominateur", () => {
    expect(rate(1, 0)).toBeNull();
    expect(rate(1, 3)).toBe(33.3);
  });
  it("CSV : séparateur, guillemets et formules neutralisées", () => {
    expect(csvLine(["a;b", 'c"d', "=1+1", null, 3])).toBe('"a;b";"c""d";\'=1+1;;3');
  });
});
