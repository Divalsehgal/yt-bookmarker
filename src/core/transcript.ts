export type TranscriptSection = {
    start: number;
    text: string;
};

type CaptionEvent = {
    tStartMs?: number;
    dDurationMs?: number;
    segs?: Array<{ utf8?: string }>;
};

const normaliseText = (text: string): string =>
    text.replace(/\s+/g, " ").trim();

/** Converts YouTube's json3 caption payload into easy-to-read, minute-long sections. */
export const parseTranscriptJson = (payload: string): TranscriptSection[] => {
    let data: { events?: CaptionEvent[] };
    try {
        data = JSON.parse(payload) as { events?: CaptionEvent[] };
    } catch {
        return [];
    }

    const sections = new Map<number, string[]>();
    for (const event of data.events || []) {
        const text = normaliseText((event.segs || []).map((segment) => segment.utf8 || "").join(""));
        if (!text) continue;

        const start = Math.floor((event.tStartMs || 0) / 1000);
        const sectionStart = Math.floor(start / 60) * 60;
        const lines = sections.get(sectionStart) || [];
        // YouTube sometimes repeats the last live-caption line in the next event.
        if (lines[lines.length - 1] !== text) lines.push(text);
        sections.set(sectionStart, lines);
    }

    return Array.from(sections.entries())
        .map(([start, lines]) => ({ start, text: lines.join(" ") }))
        .filter((section) => section.text.length > 0)
        .sort((a, b) => a.start - b.start);
};
