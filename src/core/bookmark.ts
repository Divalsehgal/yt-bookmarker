export interface Bookmark {
    id: string;
    videoId: string;
    time: number;
    title: string;
    channel: string;
    desc: string;
    createdAt: number;
}

interface CreateBookmarkParams {
    videoId: string;
    time: number | string;
    title: string;
    channel: string;
    desc?: string;
}

export function createBookmark({
    videoId,
    time,
    title,
    channel,
    desc = ""
}: CreateBookmarkParams): Bookmark {
    return {
        id: crypto.randomUUID(),
        videoId,
        time: Number(time),
        title,
        channel,
        desc,
        createdAt: Date.now()
    };
}
