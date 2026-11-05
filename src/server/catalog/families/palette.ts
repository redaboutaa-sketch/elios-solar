/**
 * 24 des 26 teintes de la palette SELT des éléments laqués (catalogue THYSENS p. 150 ; VSR 240 et VSR 780 omis faute
 * d'aperçu) — aperçus indicatifs. Palette de Veranda (THYSENS p. 106) : pour HelioRoof (VERANDA V ZiiiP), seules cinq
 * teintes sont standard (Supplément SCREENS p. 230), les autres sont des options avec supplément.
 */
import type { Choice, SourceRef } from "@/domain/system";
import { finishOf } from "./shared";

const SELT = ["RAL 9016", "RAL 7016", "RAL 9006", "RAL 9007", "FSM 71319", "RAL 9010", "RAL 9001", "RAL 1013", "RAL 1015", "RAL 7015", "RAL 7021", "RAL 7012", "RAL 7039", "RAL 7043", "RAL 7035", "RAL 7037", "RAL 7024", "RAL 7001", "RAL 7022", "RAL 9005", "RAL 8003", "RAL 8014", "RAL 8016", "DB 703"];
export const SELT_FINISHES = (sources: SourceRef[]): Choice[] => SELT.map((c) => finishOf(c, sources));
/** Teintes standard (sans supplément) du système VERANDA V ZiiiP : Supplément SCREENS p. 230, page produit. */
export const VZIIIP_STANDARD: ReadonlySet<string> = new Set(["RAL 9010", "RAL 9006", "RAL 7016", "RAL 9005", "FSM 71319"]);
