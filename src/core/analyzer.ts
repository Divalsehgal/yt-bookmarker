// src/core/analyzer.ts

export interface Point {
  x: number;
  y: number;
}

export interface Peak {
  time: number;
  score: number;
}

export interface HeatMapChapter {
  pathData: string;
  svgWidth: number;
  svgHeight: number;
  leftRatio: number;
  widthRatio: number;
}

export interface ChapterLayout {
  left: number;
  width: number;
}

export interface ChapterRatio {
  leftRatio: number;
  widthRatio: number;
}

/**
 * Parses an SVG path string into a list of points.
 * Supports absolute (M, L, C, H, V) and relative (m, l, c, h, v) commands.
 */
export function parseSvgPath(d: string): Point[] {
  const points: Point[] = [];
  const commands = d.match(/[a-df-z][^a-df-z]*/ig);

  let curX = 0;
  let curY = 0;

  commands?.forEach((cmd) => {
    const type = cmd.charAt(0);
    const upperType = type.toUpperCase();
    const isRelative = type === type.toLowerCase();
    
    const coords = cmd.slice(1).match(/-?\d*\.?\d+(?:e[-+]?\d+)?/ig)?.map(Number) || [];

    if (upperType === "M" || upperType === "L") {
      for (let i = 0; i + 1 < coords.length; i += 2) {
        let x = coords[i]!;
        let y = coords[i + 1]!;
        if (isRelative) {
          x += curX;
          y += curY;
        }
        points.push({ x, y });
        curX = x;
        curY = y;
      }
    } else if (upperType === "C") {
      for (let i = 0; i + 5 < coords.length; i += 6) {
        let x = coords[i + 4]!;
        let y = coords[i + 5]!;
        if (isRelative) {
          x += curX;
          y += curY;
        }
        points.push({ x, y });
        curX = x;
        curY = y;
      }
    } else if (upperType === "H") {
      for (let i = 0; i < coords.length; i++) {
        let x = coords[i]!;
        if (isRelative) x += curX;
        points.push({ x, y: curY });
        curX = x;
      }
    } else if (upperType === "V") {
      for (let i = 0; i < coords.length; i++) {
        let y = coords[i]!;
        if (isRelative) y += curY;
        points.push({ x: curX, y });
        curY = y;
      }
    }
  });

  return points;
}

/**
 * Extracts points with high engagement score.
 */
export function findLocalPeaks(
  points: Point[],
  svgHeight: number,
  svgWidth: number,
  sensitivity: number,
  chapterLeftRatio: number,
  chapterWidthRatio: number,
  duration: number
): Peak[] {
  const peaks: Peak[] = [];
  const ordered = [...points].sort((a, b) => a.x - b.x);

  ordered.forEach((p, index) => {
    const score = Math.max(0, Math.min(1, (svgHeight - p.y) / svgHeight));
    const previousScore = index === 0
      ? -Infinity
      : (svgHeight - ordered[index - 1]!.y) / svgHeight;
    const nextScore = index === ordered.length - 1
      ? -Infinity
      : (svgHeight - ordered[index + 1]!.y) / svgHeight;

    if (score >= sensitivity && score >= previousScore && score >= nextScore) {
      const globalTimeRatio = chapterLeftRatio + (p.x / svgWidth) * chapterWidthRatio;
      peaks.push({
        time: globalTimeRatio * duration,
        score
      });
    }
  });

  return peaks;
}

export function extractHeatMapPeaks(
  chapters: HeatMapChapter[],
  duration: number,
  limit = 5
): Peak[] {
  if (!Number.isFinite(duration) || duration <= 0) return [];

  const peaks = chapters.flatMap((chapter) =>
    findLocalPeaks(
      parseSvgPath(chapter.pathData),
      chapter.svgHeight,
      chapter.svgWidth,
      0.18,
      chapter.leftRatio,
      chapter.widthRatio,
      duration
    )
  );

  return filterClusters(peaks, Math.max(15, duration * 0.025))
    .slice(0, limit)
    .sort((a, b) => b.score - a.score);
}

export function normalizeChapterLayout(
  layouts: ChapterLayout[],
  containerWidth: number
): ChapterRatio[] {
  if (layouts.length === 1) {
    return [{ leftRatio: 0, widthRatio: 1 }];
  }

  const measuredWidth = Number.isFinite(containerWidth) && containerWidth > 0
    ? containerWidth
    : Math.max(0, ...layouts.map(({ left, width }) => left + width));

  if (!measuredWidth) {
    const widthRatio = layouts.length ? 1 / layouts.length : 0;
    return layouts.map((_, index) => ({
      leftRatio: index * widthRatio,
      widthRatio
    }));
  }

  return layouts.map(({ left, width }) => ({
    leftRatio: left / measuredWidth,
    widthRatio: width / measuredWidth
  }));
}

/**
 * Filters out peaks that are too close to each other.
 */
export function filterClusters(peaks: Peak[], minGap: number): Peak[] {
  const sorted = [...peaks].sort((a, b) => b.score - a.score);
  const distinct: Peak[] = [];

  for (const peak of sorted) {
    if (!distinct.some(p => Math.abs(p.time - peak.time) < minGap)) {
      distinct.push(peak);
    }
  }

  return distinct;
}
