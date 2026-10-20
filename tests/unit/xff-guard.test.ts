import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";

process.env.XFF_GUARD_NO_INSTALL = "1";
const { forwardedFor, parseTrusted } = createRequire(import.meta.url)("../../docker/xff-guard.cjs") as {
  forwardedFor: (received: string | string[] | undefined, peer: string | undefined, trusted: unknown) => string | null;
  parseTrusted: (spec: string) => { count: number; invalid: string[] };
};

describe("garde X-Forwarded-For", () => {
  const proxy = parseTrusted("172.29.0.1, 10.8.0.0/24");

  it("remplace l'en-tête fourni par un pair non déclaré (usurpation d'IP impossible)", () => {
    expect(forwardedFor("198.18.0.7", "172.23.0.5", proxy)).toBe("172.23.0.5");
    expect(forwardedFor("1.1.1.1, 2.2.2.2", "::ffff:172.23.0.5", proxy)).toBe("172.23.0.5");
  });

  it("sans proxy configuré, seule l'adresse du pair compte", () => {
    expect(forwardedFor("198.18.0.7", "172.29.0.1", parseTrusted(""))).toBe("172.29.0.1");
  });

  it("conserve la chaîne d'un proxy déclaré et y ajoute le proxy", () => {
    expect(forwardedFor("198.18.0.7", "::ffff:172.29.0.1", proxy)).toBe("198.18.0.7, 172.29.0.1");
    expect(forwardedFor("203.0.113.9", "10.8.0.42", proxy)).toBe("203.0.113.9, 10.8.0.42");
    expect(forwardedFor(undefined, "172.29.0.1", proxy)).toBe("172.29.0.1");
  });

  it("ignore les entrées invalides et supprime l'en-tête sans pair connu", () => {
    const t = parseTrusted("pas-une-ip, 10.0.0.0/99, 192.0.2.1");
    expect(t.count).toBe(1);
    expect(t.invalid).toEqual(["pas-une-ip", "10.0.0.0/99"]);
    expect(forwardedFor("1.2.3.4", undefined, proxy)).toBeNull();
  });
});
