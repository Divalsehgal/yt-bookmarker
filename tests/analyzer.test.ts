import assert from "node:assert/strict";
import test from "node:test";

import {
  extractHeatMapPeaks,
  filterClusters,
  normalizeChapterLayout,
  parseSvgPath
} from "../src/core/analyzer";

const SAMPLE_PATH =
  "M 0,100 C 10,90 20,15 30,10 C 40,15 50,90 60,100 " +
  "C 70,90 80,30 90,25 C 95,30 98,90 100,100";
const YOUTUBE_PATH_FIXTURE =
  "M 0.0,100.0 C 1.0,88.1 2.0,42.4 5.0,40.4 " +
  "C 8.0,38.3 11.0,83.1 15.0,89.6 " +
  "C 19.0,96.2 21.0,81.5 25.0,73.2 " +
  "C 29.0,64.9 31.0,51.2 35.0,48.0 " +
  "C 39.0,44.9 41.0,55.0 45.0,57.5";

test("parseSvgPath captures cubic curve endpoints", () => {
  assert.deepEqual(parseSvgPath(SAMPLE_PATH), [
    { x: 0, y: 100 },
    { x: 30, y: 10 },
    { x: 60, y: 100 },
    { x: 90, y: 25 },
    { x: 100, y: 100 }
  ]);
});

test("parseSvgPath supports relative coordinates and scientific notation", () => {
  assert.deepEqual(parseSvgPath("m 1e1,20 l 5,-5 h 5 v 10"), [
    { x: 10, y: 20 },
    { x: 15, y: 15 },
    { x: 20, y: 15 },
    { x: 20, y: 25 }
  ]);
});

test("YouTube modern heat-map path format produces replay peaks", () => {
  const peaks = extractHeatMapPeaks(
    [{
      pathData: YOUTUBE_PATH_FIXTURE,
      svgWidth: 1000,
      svgHeight: 100,
      leftRatio: 0,
      widthRatio: 1
    }],
    1200
  );

  assert.ok(peaks.length > 0);
  assert.equal(peaks[0]?.time, 6);
  assert.equal(peaks[0]?.score, 0.596);
});

test("extractHeatMapPeaks ranks the strongest replay moments", () => {
  const peaks = extractHeatMapPeaks(
    [{
      pathData: SAMPLE_PATH,
      svgWidth: 100,
      svgHeight: 100,
      leftRatio: 0,
      widthRatio: 1
    }],
    600
  );

  assert.deepEqual(peaks, [
    { time: 180, score: 0.9 },
    { time: 540, score: 0.75 }
  ]);
});

test("extractHeatMapPeaks maps chapter positions onto the full video", () => {
  const peaks = extractHeatMapPeaks(
    [{
      pathData: "M 0,100 L 50,0 L 100,100",
      svgWidth: 100,
      svgHeight: 100,
      leftRatio: 0.5,
      widthRatio: 0.25
    }],
    800
  );

  assert.deepEqual(peaks, [{ time: 500, score: 1 }]);
});

test("filterClusters keeps the strongest nearby moment", () => {
  assert.deepEqual(
    filterClusters(
      [
        { time: 120, score: 0.4 },
        { time: 125, score: 0.9 },
        { time: 300, score: 0.5 }
      ],
      15
    ),
    [
      { time: 125, score: 0.9 },
      { time: 300, score: 0.5 }
    ]
  );
});

test("extractHeatMapPeaks ignores invalid video durations", () => {
  assert.deepEqual(
    extractHeatMapPeaks(
      [{
        pathData: SAMPLE_PATH,
        svgWidth: 100,
        svgHeight: 100,
        leftRatio: 0,
        widthRatio: 1
      }],
      Number.NaN
    ),
    []
  );
});

test("single-chapter heat maps do not require rendered container width", () => {
  assert.deepEqual(
    normalizeChapterLayout([{ left: 0, width: 0 }], 0),
    [{ leftRatio: 0, widthRatio: 1 }]
  );
});

test("multi-chapter heat maps fall back to YouTube inline style geometry", () => {
  assert.deepEqual(
    normalizeChapterLayout(
      [
        { left: 0, width: 300 },
        { left: 300, width: 700 }
      ],
      0
    ),
    [
      { leftRatio: 0, widthRatio: 0.3 },
      { leftRatio: 0.3, widthRatio: 0.7 }
    ]
  );
});
