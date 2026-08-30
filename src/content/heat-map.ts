import { extractHeatMapPeaks, type HeatMapChapter, normalizeChapterLayout, type Peak } from "../core/analyzer";

export const getHeatMapPeaks = (player: HTMLVideoElement | null): Peak[] => {
  if (!player || !Number.isFinite(player.duration)) return [];

  const container = document.querySelector(".ytp-heat-map-container") as HTMLElement | null;
  if (!container) return [];

  const areas = Array.from(container.querySelectorAll<HTMLElement>(".ytp-heat-map-chapter"));
  const searchAreas: HTMLElement[] = areas.length ? areas : [container];
  const containerRect = container.getBoundingClientRect();
  const layouts = searchAreas.map((area) => {
    const areaRect = area.getBoundingClientRect();
    return {
      left: areaRect.width ? areaRect.left - containerRect.left : Number.parseFloat(area.style.left) || 0,
      width: areaRect.width || Number.parseFloat(area.style.width) || 0
    };
  });
  const ratios = normalizeChapterLayout(layouts, containerRect.width);

  const chapters = searchAreas.flatMap<HeatMapChapter>((area, index) => {
    const path = area.querySelector<SVGPathElement>("path.ytp-modern-heat-map") ||
      Array.from(area.querySelectorAll<SVGPathElement>("path.ytp-heat-map-path"))
        .find((candidate) => Boolean(candidate.getAttribute("d")));
    const svg = path?.closest("svg");
    const pathData = path?.getAttribute("d");
    if (!svg || !pathData) return [];

    const viewBox = svg.getAttribute("viewBox")?.trim().split(/\s+/).map(Number);
    const ratio = ratios[index] || { leftRatio: 0, widthRatio: 1 };
    return [{
      pathData,
      svgWidth: svg.viewBox.baseVal.width || viewBox?.[2] || 1000,
      svgHeight: svg.viewBox.baseVal.height || viewBox?.[3] || 100,
      leftRatio: ratio.leftRatio,
      widthRatio: ratio.widthRatio
    }];
  });

  return extractHeatMapPeaks(chapters, player.duration);
};
