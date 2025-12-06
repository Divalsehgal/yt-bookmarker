// src/background/index.ts

import { createBookmark } from "../core/bookmark";

import {
    addBookmark,
    getBookmarks,
    updateBookmark,
    deleteBookmark,
    getAllVideos
} from "../core/storage";
import type { BackgroundMessage } from "../types/messages";
import { getVideoIdFromUrl } from "../utils";

// Background message router
chrome.runtime.onMessage.addListener(
    (
        message: BackgroundMessage,
        sender: chrome.runtime.MessageSender,
        sendResponse: (response?: any) => void
    ) => {
        const { type } = message;

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

        chrome.tabs.sendMessage(tabId, { type: "NEW", videoId });
    }
);
