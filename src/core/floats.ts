export interface Exclusion {
  side: 'left' | 'right';
  top: number;
  bottom: number;
  width: number;
}

export class ExclusionList {
  private readonly items: Exclusion[] = [];

  add(ex: Exclusion): void {
    this.items.push(ex);
  }

  /**
   * Return (leftOffset, availableWidth) at line-y `y` given the container width.
   * Subtracts left floats from the start and right floats from the end at that y.
   */
  availableAt(y: number, containerWidth: number): { x: number; width: number } {
    let leftUsed = 0;
    let rightUsed = 0;
    for (const ex of this.items) {
      if (y < ex.top || y >= ex.bottom) continue;
      if (ex.side === 'left') leftUsed = Math.max(leftUsed, ex.width);
      else rightUsed = Math.max(rightUsed, ex.width);
    }
    const width = Math.max(0, containerWidth - leftUsed - rightUsed);
    return { x: leftUsed, width };
  }

  /**
   * Find the smallest y >= startY where a box of (blockWidth) fits inside
   * (containerWidth) — i.e., where exclusions leave enough horizontal room.
   */
  findFitY(startY: number, blockWidth: number, containerWidth: number): number {
    if (blockWidth <= 0 || containerWidth <= 0) return startY;

    const candidates = new Set<number>([startY]);
    for (const ex of this.items) {
      if (ex.bottom > startY) candidates.add(ex.bottom);
    }
    const sorted = [...candidates].sort((a, b) => a - b);

    for (const y of sorted) {
      const { width } = this.availableAt(y, containerWidth);
      if (width >= blockWidth) return y;
    }
    return sorted[sorted.length - 1] ?? startY;
  }

  /**
   * For `clear: side`, jump to the y below all exclusions on that side.
   */
  clearY(startY: number, side: 'left' | 'right' | 'both'): number {
    let y = startY;
    for (const ex of this.items) {
      if (side !== 'both' && ex.side !== side) continue;
      if (ex.bottom > y) y = ex.bottom;
    }
    return y;
  }

  /**
   * Lowest bottom edge of any exclusion — useful to extend parent height so
   * floats don't leak out of the containing block.
   */
  maxBottom(): number {
    let max = 0;
    for (const ex of this.items) {
      if (ex.bottom > max) max = ex.bottom;
    }
    return max;
  }

  all(): readonly Exclusion[] {
    return this.items;
  }
}

export function isFloated(box: { computed: { float?: string } }): boolean {
  return box.computed.float === 'left' || box.computed.float === 'right';
}

export function clearValue(box: {
  computed: { clear?: string };
}): 'left' | 'right' | 'both' | 'none' {
  const v = box.computed.clear;
  if (v === 'left' || v === 'right' || v === 'both') return v;
  return 'none';
}
