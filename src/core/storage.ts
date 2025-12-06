import { Bookmark } from "./bookmark";

const STORAGE = chrome.storage.local;
const KEY_PREFIX = "video:";

const keyFor = (videoId: string): string => `${KEY_PREFIX}${videoId}`;

// -----------------------------
// Get all bookmarks for a video
// -----------------------------
export function getBookmarks(videoId: string): Promise<Bookmark[]> {
    return new Promise((resolve) => {
        const key = keyFor(videoId);

        STORAGE.get([key], (data) => {
            const bookmarks: Bookmark[] = (data[key] as Bookmark[]) || [];
            resolve(bookmarks);
        });
    });
}

// -----------------------------
// Save all bookmarks for a video
// -----------------------------
export function saveBookmarks(
    videoId: string,
    bookmarks: Bookmark[]
): Promise<void> {
    return new Promise((resolve) => {
        const key = keyFor(videoId);
        STORAGE.set({ [key]: bookmarks }, () => resolve());
    });
}

// -----------------------------
// Add a new bookmark
// -----------------------------
export async function addBookmark(
    videoId: string,
    bookmark: Bookmark
): Promise<Bookmark[]> {
    const current = await getBookmarks(videoId);
    const updated = [...current, bookmark].sort((a, b) => a.time - b.time);

    await saveBookmarks(videoId, updated);
    return updated;
}

// -----------------------------
// Update an existing bookmark
// -----------------------------
export async function updateBookmark(
    videoId: string,
    updatedBookmark: Bookmark
): Promise<Bookmark[]> {
    const current = await getBookmarks(videoId);

    const updated = current.map((b) =>
        b.id === updatedBookmark.id ? updatedBookmark : b
    );

    await saveBookmarks(videoId, updated);
    return updated;
}

// -----------------------------
// Delete a bookmark by ID
// -----------------------------
export async function deleteBookmark(
    videoId: string,
    bookmarkId: string
): Promise<Bookmark[]> {
    const current = await getBookmarks(videoId);
    const updated = current.filter((b) => b.id !== bookmarkId);

    await saveBookmarks(videoId, updated);
    return updated;
}

// -----------------------------
// For future "All videos" view
// -----------------------------
export function getAllVideos(): Promise<[string, Bookmark[]][]> {
    return new Promise((resolve) => {
        STORAGE.get(null, (data) => {
            const entries = Object.entries(data).filter(([key]) =>
                key.startsWith(KEY_PREFIX)
            ) as [string, Bookmark[]][];

            resolve(entries);
        });
    });
}
