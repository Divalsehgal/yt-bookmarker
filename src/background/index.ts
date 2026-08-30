// src/background/index.ts

import { createBookmark } from "../core/bookmark";
import {
    addBookmark,
    addBookmarks,
    deleteBookmark,
    getAllVideos,
    getBookmarks,
    updateBookmark} from "../core/storage";
import type { BackgroundMessage } from "../types/messages";
import { getVideoIdFromUrl } from "../utils";

type CaptionTrack = { baseUrl?: string; languageCode?: string };

const readCaptionTracksFromPage = (): CaptionTrack[] => {
    type PlayerCaptionTrack = {
        baseUrl?: string;
        kind?: string;
        languageCode?: string;
        vssId?: string;
    };
    type PlayerResponse = {
        captions?: {
            playerCaptionsTracklistRenderer?: { captionTracks?: PlayerCaptionTrack[] };
        };
        videoDetails?: { videoId?: string };
    };
    const player = document.querySelector("#movie_player") as (HTMLElement & {
        getOption?: (module: string, option: string) => unknown;
        getPlayerResponse?: () => PlayerResponse;
        getVideoData?: () => { video_id?: string };
    }) | null;
    const playerResponse = player?.getPlayerResponse?.() ||
        (window as Window & { ytInitialPlayerResponse?: PlayerResponse }).ytInitialPlayerResponse;
    const playerCaptionTracks = playerResponse?.captions
        ?.playerCaptionsTracklistRenderer?.captionTracks || [];
    const captionOption = player?.getOption?.("captions", "tracklist") as
        PlayerCaptionTrack[] | { tracks?: PlayerCaptionTrack[] } | undefined;
    const optionTracks = Array.isArray(captionOption)
        ? captionOption
        : captionOption?.tracks || [];
    const videoId = playerResponse?.videoDetails?.videoId ||
        player?.getVideoData?.().video_id ||
        new URL(location.href).searchParams.get("v") || "";

    const tracks: CaptionTrack[] = [];
    for (const track of [...playerCaptionTracks, ...optionTracks]) {
        if (track.baseUrl) {
            tracks.push({ baseUrl: track.baseUrl, languageCode: track.languageCode });
            continue;
        }
        if (!videoId || !track.languageCode) continue;

        const url = new URL("/api/timedtext", location.origin);
        url.searchParams.set("v", videoId);
        url.searchParams.set("lang", track.languageCode);
        if (track.kind === "asr" || track.vssId?.startsWith("a.")) {
            url.searchParams.set("kind", "asr");
        }
        tracks.push({ baseUrl: url.toString(), languageCode: track.languageCode });
    }

    return tracks.filter((track, index) =>
        tracks.findIndex((candidate) => candidate.baseUrl === track.baseUrl) === index
    );
};

const getCaptionTracks = async (tabId: number): Promise<CaptionTrack[]> => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
        const result = await chrome.scripting.executeScript({
            target: { tabId },
            world: "MAIN",
            func: readCaptionTracksFromPage
        });
        const tracks = result[0]?.result || [];
        if (tracks.length) return tracks;
        await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return [];
};

// Background message router
chrome.runtime.onMessage.addListener(
    (
        message: BackgroundMessage,
        sender: chrome.runtime.MessageSender,
        sendResponse: (response?: any) => void
    ) => {
        const { type } = message;

        if (type === "GET_CAPTION_TRACKS") {
            getCaptionTracks(message.tabId)
                .then((tracks) => sendResponse({ ok: true, tracks }))
                .catch((err) => {
                    console.error("GET_CAPTION_TRACKS error:", err);
                    sendResponse({ ok: false, error: String(err) });
                });
            return true;
        }

        // ---------------------------
        // 1) ADD BOOKMARK
        // ---------------------------
        if (type === "ADD_BOOKMARK") {
            const { time, title, channel, desc = "", videoId: fromPayload } =
                message.payload;

            let videoId = fromPayload;

            // Fallback: derive from sender tab URL if not passed
            if (!videoId && sender?.tab?.url) {
                videoId = getVideoIdFromUrl(sender.tab.url || "") || "";
            }

            if (!videoId) {
                sendResponse({ ok: false, error: "NO_VIDEO_ID" });
                return false;
            }

            const bookmark = createBookmark({
                videoId,
                time,
                title,
                channel,
                desc
            });

            addBookmark(videoId, bookmark)
                .then((updated) => sendResponse({ ok: true, bookmarks: updated }))
                .catch((err) => {
                    console.error("ADD_BOOKMARK error:", err);
                    sendResponse({ ok: false, error: String(err) });
                });

            return true; // async
        }

        if (type === "ADD_HOT_MOMENTS") {
            const { videoId, title, channel, moments } = message.payload;

            if (!videoId || !moments.length) {
                sendResponse({ ok: false, error: "NO_HOT_MOMENTS" });
                return false;
            }

            const bookmarks = moments.map(({ time, score }, index) =>
                createBookmark({
                    videoId,
                    time,
                    title,
                    channel,
                    desc:
                        index === 0
                            ? "Most replayed moment"
                            : `Hot moment ${index + 1}`,
                    source: "hot-moment",
                    score
                })
            );

            addBookmarks(videoId, bookmarks)
                .then((result) => sendResponse({ ok: true, ...result }))
                .catch((err) => {
                    console.error("ADD_HOT_MOMENTS error:", err);
                    sendResponse({ ok: false, error: String(err) });
                });

            return true;
        }

        // ---------------------------
        // 2) GET BOOKMARKS FOR VIDEO
        // ---------------------------
        if (type === "GET_BOOKMARKS_FOR_VIDEO") {
            const { videoId } = message;

            if (!videoId) {
                sendResponse({ ok: false, error: "NO_VIDEO_ID" });
                return false;
            }

            getBookmarks(videoId)
                .then((bookmarks) => sendResponse({ ok: true, bookmarks }))
                .catch((err) => {
                    console.error("GET_BOOKMARKS_FOR_VIDEO error:", err);
                    sendResponse({ ok: false, error: String(err) });
                });

            return true;
        }

        // ---------------------------
        // 3) UPDATE BOOKMARK
        // ---------------------------
        if (type === "UPDATE_BOOKMARK") {
            const { bookmark } = message;

            if (!bookmark?.videoId || !bookmark.id) {
                sendResponse({ ok: false, error: "INVALID_BOOKMARK" });
                return false;
            }

            updateBookmark(bookmark.videoId, bookmark)
                .then((updated) => sendResponse({ ok: true, bookmarks: updated }))
                .catch((err) => {
                    console.error("UPDATE_BOOKMARK error:", err);
                    sendResponse({ ok: false, error: String(err) });
                });

            return true;
        }

        // ---------------------------
        // 4) DELETE BOOKMARK
        // ---------------------------
        if (type === "DELETE_BOOKMARK") {
            const { videoId, bookmarkId } = message;

            if (!videoId || !bookmarkId) {
                sendResponse({ ok: false, error: "MISSING_VIDEO_OR_ID" });
                return false;
            }

            deleteBookmark(videoId, bookmarkId)
                .then((updated) => sendResponse({ ok: true, bookmarks: updated }))
                .catch((err) => {
                    console.error("DELETE_BOOKMARK error:", err);
                    sendResponse({ ok: false, error: String(err) });
                });

            return true;
        }

        // ---------------------------
        // 5) GET ALL VIDEOS (optional)
        // ---------------------------
        if (type === "GET_ALL_VIDEOS") {
            getAllVideos()
                .then((entries) => sendResponse({ ok: true, entries }))
                .catch((err) => {
                    console.error("GET_ALL_VIDEOS error:", err);
                    sendResponse({ ok: false, error: String(err) });
                });

            return true;
        }

        // Unknown message
        return false;
    }
);

// ---------------------------
// TAB UPDATE LISTENER
// ---------------------------
chrome.tabs.onUpdated.addListener(
    (tabId: number, changeInfo: any, tab: chrome.tabs.Tab) => {
        if (!tab?.url) return;
        if (changeInfo.status !== "complete") return;
        if (!tab.url.includes("youtube.com/watch")) return;

        const videoId = getVideoIdFromUrl(tab.url);
        if (!videoId) return;

        chrome.tabs.sendMessage(tabId, { type: "NEW", videoId }, () => {
            // YouTube can report the tab as complete just before the content script is
            // attached. In that short window there is no receiving end yet.
            void chrome.runtime.lastError;
        });
    }
);
