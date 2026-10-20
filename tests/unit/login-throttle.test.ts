import { describe, expect, it } from "vitest";
import { LoginThrottle } from "@/server/auth/login-throttle";

describe("verrouillage des connexions par compte", () => {
  const rule = { maxFailures: 5, windowMs: 15 * 60_000, lockMs: 15 * 60_000 };
  it("verrouille après 5 échecs, quelle que soit l'IP, puis se libère après le délai", () => {
    let t = 0;
    const th = new LoginThrottle(rule, () => t);
    for (let i = 0; i < 4; i++) th.fail("a@test.invalid");
    expect(th.lockedFor("a@test.invalid")).toBe(0);
    th.fail("a@test.invalid");
    expect(th.lockedFor("a@test.invalid")).toBe(900);
    t += 15 * 60_000 + 1;
    expect(th.lockedFor("a@test.invalid")).toBe(0);
  });
  it("un succès remet le compteur à zéro ; les comptes sont indépendants", () => {
    const th = new LoginThrottle(rule, () => 0);
    for (let i = 0; i < 4; i++) th.fail("a@test.invalid");
    th.success("a@test.invalid");
    th.fail("a@test.invalid");
    expect(th.lockedFor("a@test.invalid")).toBe(0);
    for (let i = 0; i < 5; i++) th.fail("b@test.invalid");
    expect(th.lockedFor("b@test.invalid")).toBeGreaterThan(0);
    expect(th.lockedFor("a@test.invalid")).toBe(0);
  });
  it("les échecs anciens sortent de la fenêtre", () => {
    let t = 0;
    const th = new LoginThrottle(rule, () => t);
    for (let i = 0; i < 4; i++) th.fail("c@test.invalid");
    t += 16 * 60_000;
    th.fail("c@test.invalid");
    expect(th.lockedFor("c@test.invalid")).toBe(0);
  });
  it("clé normalisée (casse, espaces) ; entrée invalide ignorée", () => {
    expect(LoginThrottle.keyOf("  Admin@Test.Invalid ")).toBe("admin@test.invalid");
    expect(LoginThrottle.keyOf(undefined)).toBeNull();
    expect(LoginThrottle.keyOf("")).toBeNull();
  });
});
