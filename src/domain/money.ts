/** Montants en centimes d'euro (entiers). Jamais de flottants dans les calculs. */
export type Cents = number;

export function assertCents(value: number, label = "montant"): Cents {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} invalide : ${value} (centimes entiers positifs attendus)`);
  }
  return value;
}

/** Arrondi commercial (demi vers le haut) d'un produit cents × ratio en points de base. */
export function applyBps(amount: Cents, bps: number): Cents {
  return Math.round((amount * bps) / 10_000);
}

/** Part de taxe contenue dans un montant TTC pour un taux en points de base (2000 = 20 %). */
export function taxIncludedIn(gross: Cents, taxRateBps: number): Cents {
  const net = Math.round((gross * 10_000) / (10_000 + taxRateBps));
  return gross - net;
}

export function formatEur(cents: Cents, opts: { showCents?: boolean } = {}): string {
  const showCents = opts.showCents ?? cents % 100 !== 0;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  }).format(cents / 100);
}
