/** Palette de 26 teintes des éléments laqués (collection SELT, catalogue p. 150) — aperçus indicatifs. */
import type { Choice, SourceRef } from "@/domain/system";
import { finishOf } from "./shared";

const SELT = ["RAL 9016", "RAL 7016", "RAL 9006", "RAL 9007", "FSM 71319", "RAL 9010", "RAL 9001", "RAL 1013", "RAL 1015", "RAL 7015", "RAL 7021", "RAL 7012", "RAL 7039", "RAL 7043", "RAL 7035", "RAL 7037", "RAL 7024", "RAL 7001", "RAL 7022", "RAL 9005", "RAL 8003", "RAL 8014", "RAL 8016", "DB 703"];
export const SELT_FINISHES = (sources: SourceRef[]): Choice[] => SELT.map((c) => finishOf(c, sources));
