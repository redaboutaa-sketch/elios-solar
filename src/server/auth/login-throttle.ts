/**
 * Verrouillage par compte des connexions par mot de passe (complète la limite par IP de better-auth).
 *
 * La limite par IP dépend d'un en-tête X-Forwarded-For digne de confiance ; ce verrou, lui, est indexé
 * sur l'adresse e-mail visée : faire tourner les IP ne permet pas de dépasser `maxFailures` essais.
 * Il s'applique à toute adresse (existante ou non) pour ne rien révéler sur l'existence d'un compte.
 * Stockage en mémoire : instance unique sur le VPS (comme src/server/rate-limit.ts).
 */
export interface ThrottleRule {
  maxFailures: number;
  windowMs: number;
  lockMs: number;
}

export const DEFAULT_LOGIN_RULE: ThrottleRule = { maxFailures: 5, windowMs: 15 * 60_000, lockMs: 15 * 60_000 };

interface Entry {
  failures: number;
  firstAt: number;
  lockedUntil: number;
}

export class LoginThrottle {
  private entries = new Map<string, Entry>();
  constructor(
    private rule: ThrottleRule = DEFAULT_LOGIN_RULE,
    private now: () => number = Date.now,
  ) {}

  static keyOf(email: unknown): string | null {
    return typeof email === "string" && email.trim() ? email.trim().toLowerCase() : null;
  }

  /** Nombre de secondes avant déverrouillage, ou 0 si le compte n'est pas verrouillé. */
  lockedFor(key: string): number {
    const e = this.entries.get(key);
    if (!e) return 0;
    const t = this.now();
    return e.lockedUntil > t ? Math.ceil((e.lockedUntil - t) / 1000) : 0;
  }

  fail(key: string): void {
    const t = this.now();
    let e = this.entries.get(key);
    if (!e || (e.lockedUntil <= t && t - e.firstAt > this.rule.windowMs)) e = { failures: 0, firstAt: t, lockedUntil: 0 };
    e.failures += 1;
    if (e.failures >= this.rule.maxFailures) e.lockedUntil = t + this.rule.lockMs;
    this.entries.set(key, e);
    if (this.entries.size > 10_000) this.prune(t);
  }

  success(key: string): void {
    this.entries.delete(key);
  }

  private prune(t: number) {
    for (const [k, e] of this.entries) if (e.lockedUntil <= t && t - e.firstAt > this.rule.windowMs) this.entries.delete(k);
  }
}
