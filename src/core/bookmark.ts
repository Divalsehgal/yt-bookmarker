export interface Bookmark {
    id: string;
    videoId: string;
    time: number;
    title: string;
    channel: string;
    desc: string;
    createdAt: number;
    source?: "hot-moment" | "manual";
    score?: number;
}

interface CreateBookmarkParams {
    videoId: string;
    time: number | string;
    title: string;
    channel: string;
    desc?: string;
    source?: "hot-moment" | "manual";
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
