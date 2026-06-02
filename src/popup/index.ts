

import type { Bookmark } from "../core/bookmark";
import { formatTime, getActiveTabURL, getVideoIdFromUrl } from "../utils";

const bookmarksElement = document.getElementById(
    "bookmarks"
) as HTMLElement | null;
const summaryElement = document.getElementById("summary");

const controlIcons = {
    play: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8.5 5.55a1 1 0 0 1 1.52-.85l9.14 6.12a1 1 0 0 1 0 1.66l-9.14 6.12a1 1 0 0 1-1.52-.83V5.55Z"/>
        </svg>`,
    delete: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9.25 3.5a2.75 2.75 0 0 1 5.5 0h4a.75.75 0 0 1 0 1.5h-.83l-.69 14.42A2.7 2.7 0 0 1 14.53 22H9.47a2.7 2.7 0 0 1-2.7-2.58L6.08 5h-.83a.75.75 0 0 1 0-1.5h4Zm1.5 0h2.5a1.25 1.25 0 0 0-2.5 0Zm-3.17 1.5.69 14.35c.03.64.56 1.15 1.2 1.15h5.06c.64 0 1.17-.51 1.2-1.15L16.42 5H7.58Zm2.67 3a.75.75 0 0 1 .75.75v7.5a.75.75 0 0 1-1.5 0v-7.5a.75.75 0 0 1 .75-.75Zm3.5 0a.75.75 0 0 1 .75.75v7.5a.75.75 0 0 1-1.5 0v-7.5a.75.75 0 0 1 .75-.75Z"/>
        </svg>`
};

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

    if (bookmark.source === "hot-moment") {
        const hotMomentBadge = document.createElement("span");
        hotMomentBadge.className = "ytb-hot-moment-badge";
        hotMomentBadge.textContent = bookmark.score
            ? `Hot Moment ${Math.round(bookmark.score * 100)}%`
            : "Hot Moment";
        newBookmarkElement.appendChild(hotMomentBadge);
    }

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

const createSection = (
    title: string,
    subtitle: string,
    count: number,
    variant: "bookmarks" | "hot-moments"
): HTMLElement => {
    const section = document.createElement("section");
    section.className = `ytb-section ytb-section--${variant}`;

    const heading = document.createElement("div");
    heading.className = "ytb-section-heading";

    const copy = document.createElement("div");
    copy.className = "ytb-section-copy";

    const titleElement = document.createElement("h2");
    titleElement.className = "ytb-section-title";
    titleElement.textContent = title;

    const subtitleElement = document.createElement("p");
    subtitleElement.className = "ytb-section-subtitle";
    subtitleElement.textContent = subtitle;

    const countElement = document.createElement("span");
    countElement.className = "ytb-section-count";
    countElement.textContent = String(count);

    copy.appendChild(titleElement);
    copy.appendChild(subtitleElement);
    heading.appendChild(copy);
    heading.appendChild(countElement);
    section.appendChild(heading);

    return section;
};

const appendSection = (
    container: HTMLElement,
    title: string,
    subtitle: string,
    bookmarks: Bookmark[],
    context: PopupContext,
    variant: "bookmarks" | "hot-moments"
): void => {
    const section = createSection(title, subtitle, bookmarks.length, variant);
    const list = document.createElement("div");
    list.className = "ytb-section-list";

    if (bookmarks.length) {
        bookmarks
            .slice()
            .sort((a, b) => a.time - b.time)
            .forEach((bookmark) => addNewBookmark(list, bookmark, context));
    } else {
        const emptyState = document.createElement("div");
        emptyState.className = "ytb-section-empty";
        emptyState.textContent = variant === "hot-moments"
            ? "No replay heat map is available for this video yet."
            : "Use the bookmark icon in the player to save a timestamp.";
        list.appendChild(emptyState);
    }

    section.appendChild(list);
    container.appendChild(section);
};

const viewBookmarks = (
    currentBookmarks: Bookmark[] = [],
    videoId: string,
    tabId: number
): void => {
    if (!bookmarksElement) return;

    bookmarksElement.innerHTML = "";
    const hotMoments = currentBookmarks.filter(
        (bookmark) => bookmark.source === "hot-moment"
    );
    const savedBookmarks = currentBookmarks.filter(
        (bookmark) => bookmark.source !== "hot-moment"
    );

    if (summaryElement) {
        summaryElement.textContent = currentBookmarks.length
            ? `${savedBookmarks.length} saved · ${hotMoments.length} hot moment${hotMoments.length === 1 ? "" : "s"}`
            : "Ready for your next bookmark";
    }

    const context = { videoId, tabId };
    appendSection(
        bookmarksElement,
        "Saved Bookmarks",
        "Your manually saved timestamps",
        savedBookmarks,
        context,
        "bookmarks"
    );
    appendSection(
        bookmarksElement,
        "Hot Moments",
        "Automatically extracted from replay activity",
        hotMoments,
        context,
        "hot-moments"
    );
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
    const controlElement = document.createElement("button");
    controlElement.className = `ytb-control control-${src}`;
    controlElement.type = "button";
    controlElement.title = src === "play" ? "Play from here" : "Delete bookmark";
    controlElement.setAttribute("aria-label", controlElement.title);
    controlElement.innerHTML = controlIcons[src];
    controlElement.addEventListener("click", eventListener);

    controlParentElement.appendChild(controlElement);
};

document.addEventListener("DOMContentLoaded", async () => {
    if (!bookmarksElement) return;

    const activeTab = await getActiveTabURL();
    if (!activeTab?.url || activeTab.id == null) {
        bookmarksElement.innerHTML =
            '<div class="row">No active tab found.</div>';
        return;
    }

    const videoId = getVideoIdFromUrl(activeTab.url);
    if (!activeTab.url.includes("youtube.com/watch") || !videoId) {
        bookmarksElement.innerHTML =
            '<div class="row">Open a YouTube video to start bookmarking.</div>';
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
