import { parseTranscriptJson, type TranscriptSection } from "../core/transcript";

export type CaptionTrack = {
  baseUrl?: string;
  languageCode?: string;
};

export type TranscriptResult = {
  ok: boolean;
  sections?: TranscriptSection[];
  error?: "CAPTIONS_UNAVAILABLE" | "EMPTY_CAPTIONS" | "NO_CAPTIONS" | "TRANSCRIPT_LOAD_FAILED";
};

export const fetchTranscript = async (tracks: CaptionTrack[]): Promise<TranscriptResult> => {
  const track = tracks.find((candidate) => candidate.baseUrl);
  if (!track?.baseUrl) return { ok: false, error: "NO_CAPTIONS" };

  try {
    const url = new URL(track.baseUrl);
    url.searchParams.set("fmt", "json3");
    const response = await fetch(url.toString());
    if (!response.ok) return { ok: false, error: "CAPTIONS_UNAVAILABLE" };

    const sections = parseTranscriptJson(await response.text());
    return sections.length ? { ok: true, sections } : { ok: false, error: "EMPTY_CAPTIONS" };
  } catch {
    return { ok: false, error: "TRANSCRIPT_LOAD_FAILED" };
  }
};

const parseTimestamp = (value: string): number | null => {
  const parts = value.trim().split(":").map(Number);
  if (!parts.length || parts.some((part) => !Number.isFinite(part))) return null;
  return parts.reduce((seconds, part) => seconds * 60 + part, 0);
};

const readTranscriptSegments = (): TranscriptSection[] => {
  const sections = new Map<number, string[]>();
  const segments = document.querySelectorAll<HTMLElement>("ytd-transcript-segment-renderer");

  segments.forEach((segment) => {
    const timestamp = segment.querySelector<HTMLElement>(".segment-timestamp")?.innerText || "";
    const text = segment.querySelector<HTMLElement>(".segment-text")?.innerText.trim() || "";
    const start = parseTimestamp(timestamp);
    if (start === null || !text) return;

    const sectionStart = Math.floor(start / 60) * 60;
    const lines = sections.get(sectionStart) || [];
    if (lines[lines.length - 1] !== text) lines.push(text);
    sections.set(sectionStart, lines);
  });

  return Array.from(sections.entries())
    .map(([start, lines]) => ({ start, text: lines.join(" ") }))
    .sort((first, second) => first.start - second.start);
};

const findTranscriptButton = (): HTMLElement | null =>
  Array.from(document.querySelectorAll<HTMLElement>("button, yt-button-shape button"))
    .find((button) =>
      /show transcript/i.test(button.innerText) ||
      /transcript/i.test(button.getAttribute("aria-label") || "")
    ) || null;

/** Uses YouTube's rendered transcript panel when its caption API does not expose a track. */
export const readTranscriptFromPage = async (): Promise<TranscriptResult> => {
  const currentSections = readTranscriptSegments();
  if (currentSections.length) return { ok: true, sections: currentSections };

  const transcriptButton = findTranscriptButton();
  if (!transcriptButton) return { ok: false, error: "NO_CAPTIONS" };
  transcriptButton.click();

  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolve) => window.setTimeout(resolve, 250));
    const sections = readTranscriptSegments();
    if (sections.length) return { ok: true, sections };
  }
  return { ok: false, error: "EMPTY_CAPTIONS" };
};
