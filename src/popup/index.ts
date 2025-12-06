

import type { Bookmark } from "../core/bookmark";
import { formatTime, getActiveTabURL, getVideoIdFromUrl } from "../utils";

const bookmarksElement = document.getElementById(
    "bookmarks"
) as HTMLElement | null;

type PopupContext = {
    videoId: string;
    tabId: number;
};

const addNewBookmark = (
    container: HTMLElement,
    bookmark: Bookmark,
    context: PopupContext
): void => {
    const { videoId, tabId } = context;

    const newBookmarkElement = document.createElement("div");
    newBookmarkElement.id = "bookmark-" + bookmark.id;
    newBookmarkElement.className = "ytb-bookmark";
    newBookmarkElement.setAttribute("data-id", bookmark.id);
    newBookmarkElement.setAttribute("data-time", String(bookmark.time));

    // Top row container
    const topRow = document.createElement("div");
    topRow.className = "ytb-bookmark-top";

    // Timestamp
    const timestampElement = document.createElement("div");
    timestampElement.textContent = formatTime(bookmark.time);
    timestampElement.className = "ytb-bookmark-timestamp";

    // Title
    const bookmarkTitleElement = document.createElement("div");
    bookmarkTitleElement.textContent = bookmark.desc || bookmark.title;
    bookmarkTitleElement.className = "ytb-bookmark-title";

    // Controls
    const controlsElement = document.createElement("div");
    controlsElement.className = "ytb-bookmark-controls";

    setBookmarkAttributes("play", (e) => onPlay(e, tabId), controlsElement);
    setBookmarkAttributes("delete", (e) => onDelete(e, videoId, tabId), controlsElement);

    // Assemble top row
    topRow.appendChild(timestampElement);
    topRow.appendChild(bookmarkTitleElement);
    topRow.appendChild(controlsElement);

    // Edit button
    const editButton = document.createElement("button");
    editButton.textContent = "Edit";
    editButton.className = "ytb-edit-btn";
    editButton.addEventListener("click", () =>
        onEdit(bookmark, bookmarkTitleElement, context)
    );

    // Assemble bookmark
    newBookmarkElement.appendChild(topRow);
    newBookmarkElement.appendChild(editButton);

    container.appendChild(newBookmarkElement);
};

const viewBookmarks = (
    currentBookmarks: Bookmark[] = [],
    videoId: string,
    tabId: number
): void => {
    if (!bookmarksElement) return;

    bookmarksElement.innerHTML = "";

    if (currentBookmarks.length > 0) {
        currentBookmarks
            .slice()
            .sort((a, b) => a.time - b.time)
            .forEach((bookmark) => {
                addNewBookmark(bookmarksElement, bookmark, { videoId, tabId });
            });
    } else {
        bookmarksElement.innerHTML = '<i class="row">No bookmarks to show</i>';
    }
};

const onEdit = (
    bookmark: Bookmark,
    bookmarkTitleElement: HTMLElement,
    context: PopupContext
): void => {
    const { tabId } = context;

    const inputField = document.createElement("input");
    inputField.type = "text";
    inputField.value = bookmark.desc || bookmark.title;
    inputField.className = "ytb-edit-input";

    bookmarkTitleElement.innerHTML = "";
    bookmarkTitleElement.appendChild(inputField);
    inputField.focus();

    const originalText = bookmark.desc || bookmark.title;

    const saveEdit = (): void => {
        const newTitle = inputField.value.trim();
        if (!newTitle) {
            bookmarkTitleElement.textContent = originalText;
            return;
        }

        const updatedBookmark: Bookmark = {
            ...bookmark,
            desc: newTitle
        };

        chrome.runtime.sendMessage(
            {
                type: "UPDATE_BOOKMARK",
                bookmark: updatedBookmark
            },
            (res) => {
                if (chrome.runtime.lastError) {
                    console.warn(
                        "UPDATE_BOOKMARK lastError:",
                        chrome.runtime.lastError
                    );
                    bookmarkTitleElement.textContent = originalText;
                    return;
                }

                if (res?.ok) {
                    bookmarkTitleElement.textContent = newTitle;

                    chrome.tabs.sendMessage(
                        tabId,
                        {
                            type: "SHOW_TOAST",
                            message: "Bookmark updated"
                        },
                        () => {
                            if (chrome.runtime.lastError) {
                                console.warn(
                                    "SHOW_TOAST (updated) lastError:",
                                    chrome.runtime.lastError
                                );
                            }
                        }
                    );
                } else {
                    bookmarkTitleElement.textContent = originalText;
                }
            }
        );
    };

    inputField.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            saveEdit();
        } else if (event.key === "Escape") {
            bookmarkTitleElement.textContent = originalText;
        }
    });

    inputField.addEventListener("blur", saveEdit);
};

const onPlay = (e: Event, tabId: number): void => {
    const target = e.target as HTMLElement | null;
    const bookmarkElement = target?.closest(".ytb-bookmark") as
        | HTMLElement
        | null;

    if (!bookmarkElement) return;

    const bookmarkTime = Number(bookmarkElement.getAttribute("data-time"));
    if (Number.isNaN(bookmarkTime)) return;

    chrome.tabs.sendMessage(
        tabId,
        {
            type: "PLAY",
            time: bookmarkTime
        },
        () => {
            if (chrome.runtime.lastError) {
                console.warn("PLAY lastError:", chrome.runtime.lastError);
            }
        }
    );
};

const onDelete = (e: Event, videoId: string, tabId: number): void => {
    const target = e.target as HTMLElement | null;
    const bookmarkElement = target?.closest(".ytb-bookmark") as
        | HTMLElement
        | null;
    if (!bookmarkElement) return;

    const bookmarkId = bookmarkElement.getAttribute("data-id");
    if (!bookmarkId) return;

    chrome.runtime.sendMessage(
        {
            type: "DELETE_BOOKMARK",
            videoId,
            bookmarkId
        },
        (res) => {
            if (chrome.runtime.lastError) {
                console.warn(
                    "DELETE_BOOKMARK lastError:",
                    chrome.runtime.lastError
                );
                return;
            }

            if (res?.ok) {
                viewBookmarks(res.bookmarks || [], videoId, tabId);

                chrome.tabs.sendMessage(
                    tabId,
                    {
                        type: "SHOW_TOAST",
                        message: "Bookmark deleted"
                    },
                    () => {
                        if (chrome.runtime.lastError) {
                            console.warn(
                                "SHOW_TOAST (deleted) lastError:",
                                chrome.runtime.lastError
                            );
                        }
                    }
                );
            }
        }
    );
};

const setBookmarkAttributes = (
    src: "play" | "delete",
    eventListener: (e: Event) => void,
    controlParentElement: HTMLElement
): void => {
    const controlElement = document.createElement("img");

    controlElement.src = `../assets/${src}.png`;
    controlElement.title = src;
    controlElement.addEventListener("click", eventListener);

    if (src === "play") {
        controlElement.classList.add("control-play");
    } else if (src === "delete") {
        controlElement.classList.add("control-delete");
    }

    controlParentElement.appendChild(controlElement);
};

document.addEventListener("DOMContentLoaded", async () => {
    console.log("[popup] DOMContentLoaded");

    if (!bookmarksElement) return;

    const activeTab = await getActiveTabURL();
    console.log("[popup] activeTab:", activeTab);

    if (!activeTab?.url || activeTab.id == null) {
        bookmarksElement.innerHTML =
            '<div class="row">No active tab found.</div>';
        return;
    }

    const videoId = getVideoIdFromUrl(activeTab.url);
    console.log("[popup] videoId:", videoId);

    if (!activeTab.url.includes("youtube.com/watch") || !videoId) {
        bookmarksElement.innerHTML =
            '<div class="row">This is not a youtube video page.</div>';
        return;
    }

    chrome.runtime.sendMessage(
        {
            type: "GET_BOOKMARKS_FOR_VIDEO",
            videoId
        },
        (res) => {
            if (chrome.runtime.lastError) {
                console.warn(
                    "GET_BOOKMARKS_FOR_VIDEO lastError:",
                    chrome.runtime.lastError
                );
                bookmarksElement.innerHTML =
                    '<div class="row">Could not load bookmarks.</div>';
                return;
            }

            if (!res?.ok) {
                viewBookmarks([], videoId, activeTab.id!);
                return;
            }

            viewBookmarks(res.bookmarks || [], videoId, activeTab.id!);
        }
    );
});
