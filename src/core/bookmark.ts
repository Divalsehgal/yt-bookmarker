export interface Bookmark {
    id: string;
    videoId: string;
    time: number;
    title: string;
    channel: string;
    desc: string;
    createdAt: number;
    source?: "manual" | "hot-moment";
    score?: number;
}

interface CreateBookmarkParams {
    videoId: string;
    time: number | string;
    title: string;
    channel: string;
    desc?: string;
    source?: "manual" | "hot-moment";
    score?: number;
}

export function createBookmark({
    videoId,
    time,
    title,
    channel,
    desc = "",
    source = "manual",
    score
}: CreateBookmarkParams): Bookmark {
    return {
        id: crypto.randomUUID(),
        videoId,
        time: Number(time),
        title,
        channel,
        desc,
        createdAt: Date.now(),
        source,
        score
    };
}
