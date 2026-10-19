import type { Family, Layout, Mounting, Segment, Side, SideKey } from "./types";

/**
 * Construit la géométrie des côtés et segments d'une pergola.
 *
 * Convention d'orientation (plan vu de dessus) :
 * - `back`  : côté arrière, longueur commerciale ; c'est le côté contre le mur en adossée ;
 * - `front` : côté avant, même longueur ;
 * - `left` / `right` : côtés de largeur.
 * Lorsque la longueur du côté atteint `dividerThresholdMm`, un poteau intermédiaire divise
 * le côté en deux segments égaux (règle fournisseur à confirmer par gamme ; voir matrice).
 */
export function buildLayout(opts: {
  widthMm: number;
  lengthMm: number;
  mounting: Mounting;
  dividerThresholdMm?: number;
}): Layout {
  const { widthMm, lengthMm, mounting } = opts;
  if (!(widthMm > 0 && lengthMm > 0)) throw new Error("dimensions invalides");
  const threshold = opts.dividerThresholdMm ?? Number.POSITIVE_INFINITY;

  const makeSide = (key: SideKey, len: number, isWall: boolean): Side => {
    const segments: Segment[] = [];
    if (!isWall) {
      const count = len >= threshold ? 2 : 1;
      const segLen = Math.round(len / count);
      for (let i = 1; i <= count; i += 1) {
        segments.push({
          id: `${key}-${i}`,
          side: key,
          index: i,
          lengthMm: segLen,
          hasDividerPost: count > 1 && i < count,
        });
      }
    }
    return { key, lengthMm: len, isWall, segments };
  };

  const sides: Side[] = [
    makeSide("back", lengthMm, mounting === "wall"),
    makeSide("right", widthMm, false),
    makeSide("front", lengthMm, false),
    makeSide("left", widthMm, false),
  ];

  const dividerPosts = sides.reduce(
    (n, s) => n + s.segments.filter((seg) => seg.hasDividerPost).length,
    0,
  );
  const cornerPosts = mounting === "wall" ? 2 : 4;

  return { widthMm, lengthMm, mounting, sides, postCount: cornerPosts + dividerPosts };
}

export function layoutForFamily(
  family: Family,
  widthMm: number,
  lengthMm: number,
  mounting: Mounting,
): Layout {
  return buildLayout({ widthMm, lengthMm, mounting, dividerThresholdMm: family.dividerThresholdMm });
}

export function allSegments(layout: Layout): Segment[] {
  return layout.sides.flatMap((s) => s.segments);
}

export const SIDE_LABELS: Record<SideKey, string> = {
  back: "Arrière",
  front: "Avant",
  left: "Gauche",
  right: "Droite",
};

export function segmentLabel(segment: Segment, layout: Layout): string {
  const side = layout.sides.find((s) => s.key === segment.side);
  const multi = (side?.segments.length ?? 1) > 1;
  const base = SIDE_LABELS[segment.side];
  return multi ? `${base} – segment ${segment.index}` : base;
}
