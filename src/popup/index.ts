import type { Bookmark } from "../core/bookmark";
import type { TranscriptSection } from "../core/transcript";
import { formatTime, getActiveTabURL, getVideoIdFromUrl } from "../utils";

const bookmarksElement = document.getElementById("bookmarks") as HTMLElement | null;
const transcriptElement = document.getElementById("transcript");
const transcriptContentElement = document.getElementById("transcript-content");
const copyTranscriptButton = document.getElementById("copy-transcript") as HTMLButtonElement | null;
const bookmarksTab = document.getElementById("bookmarks-tab") as HTMLButtonElement | null;
const transcriptTab = document.getElementById("transcript-tab") as HTMLButtonElement | null;
const bookmarksPanel = document.getElementById("bookmarks-panel");
const transcriptPanel = document.getElementById("transcript-panel");

const transcriptSearchBox = document.getElementById("transcript-search-box");
const transcriptSearchInput = document.getElementById("transcript-search") as HTMLInputElement | null;
const exportBookmarksButton = document.getElementById("export-bookmarks") as HTMLButtonElement | null;

let transcriptForCopy = "";
let allTranscriptSections: TranscriptSection[] = [];
let loadedBookmarks: Bookmark[] = [];
let activeTabId: number | null = null;
let activeVideoId: string = "";

const icons = {
    play: `<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86a1 1 0 0 0-1.5.86z"/></svg>`,
    edit: `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`,
    delete: `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`,
    copy: `<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>`,
    check: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>`
};

const copyToClipboard = async (text: string): Promise<boolean> => {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        const fallback = document.createElement("textarea");
        fallback.value = text;
        fallback.style.position = "fixed";
        fallback.style.opacity = "0";
        document.body.appendChild(fallback);
        fallback.select();
        const success = document.execCommand("copy");
        fallback.remove();
        return success;
    }
};

const showPanel = (panel: "bookmarks" | "transcript"): void => {
    const isBookmarks = panel === "bookmarks";
    if (bookmarksPanel) bookmarksPanel.hidden = !isBookmarks;
    if (transcriptPanel) transcriptPanel.hidden = isBookmarks;
    bookmarksTab?.classList.toggle("ytb-tab--active", isBookmarks);
    transcriptTab?.classList.toggle("ytb-tab--active", !isBookmarks);
    bookmarksTab?.setAttribute("aria-selected", String(isBookmarks));
    transcriptTab?.setAttribute("aria-selected", String(!isBookmarks));
};

bookmarksTab?.addEventListener("click", () => showPanel("bookmarks"));
transcriptTab?.addEventListener("click", () => showPanel("transcript"));

const showTranscriptFallback = (message: string): void => {
    if (!transcriptContentElement || !transcriptElement) return;
    transcriptContentElement.innerHTML = "";
    if (transcriptSearchBox) transcriptSearchBox.hidden = true;
    const fallback = document.createElement("div");
    fallback.className = "ytb-transcript-fallback";
    fallback.textContent = message;
    transcriptContentElement.appendChild(fallback);
    const subtitle = transcriptElement.querySelector(".ytb-section-subtitle");
    if (subtitle) subtitle.textContent = "Captions are not available for this video.";
    if (copyTranscriptButton) copyTranscriptButton.disabled = true;
};

const renderTranscript = (sections: TranscriptSection[], filterQuery = ""): void => {
    if (!transcriptContentElement || !transcriptElement) return;
    allTranscriptSections = sections;
    if (transcriptSearchBox) transcriptSearchBox.hidden = false;

    const query = filterQuery.trim().toLowerCase();
    const filteredSections = query
        ? sections.filter((s) => s.text.toLowerCase().includes(query))
        : sections;

    transcriptContentElement.innerHTML = "";
    const subtitle = transcriptElement.querySelector(".ytb-section-subtitle");
    if (subtitle) {
        subtitle.textContent = query
            ? `${filteredSections.length} of ${sections.length} sections found`
            : `${sections.length} timestamped sections`;
    }

    transcriptForCopy = sections
        .map((section) => `[${formatTime(section.start)}]\n${section.text}`)
        .join("\n\n");

    if (filteredSections.length === 0) {
        const fallback = document.createElement("div");
        fallback.className = "ytb-transcript-fallback";
        fallback.textContent = `No transcript sections match "${filterQuery}".`;
        transcriptContentElement.appendChild(fallback);
        return;
    }

    filteredSections.forEach((section) => {
        const item = document.createElement("article");
        item.className = "ytb-transcript-section";

        const header = document.createElement("div");
        header.className = "ytb-transcript-section-header";

        const timeBtn = document.createElement("button");
        timeBtn.type = "button";
        timeBtn.className = "ytb-transcript-time";
        timeBtn.textContent = formatTime(section.start);
        timeBtn.title = "Jump to " + formatTime(section.start);
        timeBtn.setAttribute("aria-label", "Jump to " + formatTime(section.start));
        timeBtn.addEventListener("click", () => {
            if (activeTabId != null) {
                chrome.tabs.sendMessage(activeTabId, { type: "PLAY", time: section.start });
            }
        });

        const copySectionBtn = document.createElement("button");
        copySectionBtn.type = "button";
        copySectionBtn.className = "ytb-transcript-copy-btn";
        copySectionBtn.title = "Copy section";
        copySectionBtn.setAttribute("aria-label", "Copy section");
        copySectionBtn.innerHTML = `${icons.copy}<span>Copy</span>`;
        copySectionBtn.addEventListener("click", async () => {
            const sectionText = `[${formatTime(section.start)}] ${section.text}`;
            await copyToClipboard(sectionText);
            copySectionBtn.innerHTML = `${icons.check}<span>Copied</span>`;
            copySectionBtn.classList.add("ytb-copied");
            window.setTimeout(() => {
                copySectionBtn.innerHTML = `${icons.copy}<span>Copy</span>`;
                copySectionBtn.classList.remove("ytb-copied");
            }, 1400);
        });

        header.append(timeBtn, copySectionBtn);

        const text = document.createElement("p");
        text.className = "ytb-transcript-text";

        if (query) {
            const lowerText = section.text.toLowerCase();
            const idx = lowerText.indexOf(query);
            if (idx !== -1) {
                const before = section.text.slice(0, idx);
                const match = section.text.slice(idx, idx + query.length);
                const after = section.text.slice(idx + query.length);
                text.appendChild(document.createTextNode(before));
                const mark = document.createElement("mark");
                mark.className = "ytb-highlight";
                mark.textContent = match;
                text.appendChild(mark);
                text.appendChild(document.createTextNode(after));
            } else {
                text.textContent = section.text;
            }
        } else {
            text.textContent = section.text;
        }

        item.append(header, text);
        transcriptContentElement.appendChild(item);
    });

    if (copyTranscriptButton) copyTranscriptButton.disabled = false;
};

transcriptSearchInput?.addEventListener("input", (e) => {
    const query = (e.target as HTMLInputElement).value;
    renderTranscript(allTranscriptSections, query);
});

exportBookmarksButton?.addEventListener("click", async () => {
    if (!loadedBookmarks.length || !activeVideoId) {
        exportBookmarksButton.classList.add("ytb-btn-disabled");
        const originalText = exportBookmarksButton.innerHTML;
        exportBookmarksButton.innerHTML = `<span>No bookmarks</span>`;
        window.setTimeout(() => {
            exportBookmarksButton.innerHTML = originalText;
            exportBookmarksButton.classList.remove("ytb-btn-disabled");
        }, 1400);
        return;
    }

    const lines = loadedBookmarks.map((b) => {
        const timeStr = formatTime(b.time);
        const url = `https://youtu.be/${activeVideoId}?t=${b.time}`;
        const title = b.desc || b.title;
        return `- [${timeStr}](${url}) - ${title}`;
    });

    const exportText = `# YouTube Bookmarks (${activeVideoId})\n\n` + lines.join("\n");
    await copyToClipboard(exportText);

    const originalText = exportBookmarksButton.innerHTML;
    exportBookmarksButton.innerHTML = `${icons.check}<span>Copied</span>`;
    exportBookmarksButton.classList.add("ytb-copied");
    window.setTimeout(() => {
        exportBookmarksButton.innerHTML = originalText;
        exportBookmarksButton.classList.remove("ytb-copied");
    }, 1400);
});

const loadTranscript = (tabId: number): void => {
    chrome.runtime.sendMessage({ type: "GET_CAPTION_TRACKS", tabId }, (trackResponse) => {
        if (chrome.runtime.lastError || !trackResponse?.ok) {
            showTranscriptFallback("YouTube did not provide a caption track for this video. AI transcription is needed to create one from the audio.");
            return;
        }

        chrome.tabs.sendMessage(tabId, { type: "GET_TRANSCRIPT", tracks: trackResponse.tracks }, (res) => {
            if (chrome.runtime.lastError || !res?.ok || !Array.isArray(res.sections)) {
                showTranscriptFallback("YouTube did not provide a caption track for this video. AI transcription is needed to create one from the audio.");
                return;
            }
            renderTranscript(res.sections as TranscriptSection[]);
        });
    });
};

copyTranscriptButton?.addEventListener("click", async () => {
    if (!transcriptForCopy) return;
    await copyToClipboard(transcriptForCopy);
    const originalContent = copyTranscriptButton.innerHTML;
    copyTranscriptButton.innerHTML = `${icons.check}<span>Copied</span>`;
    window.setTimeout(() => {
        copyTranscriptButton.innerHTML = originalContent;
    }, 1400);
});

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

    const bookmarkCard = document.createElement("div");
    bookmarkCard.id = "bookmark-" + bookmark.id;
    bookmarkCard.className = "ytb-bookmark-card";
    bookmarkCard.setAttribute("data-id", bookmark.id);
    bookmarkCard.setAttribute("data-time", String(bookmark.time));

    // Top Content row
    const mainRow = document.createElement("div");
    mainRow.className = "ytb-bookmark-main";

    // Left info (timestamp + title)
    const contentCol = document.createElement("div");
    contentCol.className = "ytb-bookmark-content";

    const metaRow = document.createElement("div");
    metaRow.className = "ytb-bookmark-meta";

    const timestampBtn = document.createElement("button");
    timestampBtn.type = "button";
    timestampBtn.textContent = formatTime(bookmark.time);
    timestampBtn.className = "ytb-bookmark-time-btn";
    timestampBtn.title = "Play from " + formatTime(bookmark.time);
    timestampBtn.setAttribute("aria-label", "Play from " + formatTime(bookmark.time));
    timestampBtn.addEventListener("click", (e) => onPlay(e, tabId));
    metaRow.appendChild(timestampBtn);

    if (bookmark.source === "hot-moment") {
        const hotBadge = document.createElement("span");
        hotBadge.className = "ytb-hot-badge";
        hotBadge.textContent = bookmark.score
            ? `Hot Moment ${Math.round(bookmark.score * 100)}%`
            : "Hot Moment";
        metaRow.appendChild(hotBadge);
    }

    const titleElement = document.createElement("div");
    titleElement.textContent = bookmark.desc || bookmark.title;
    titleElement.className = "ytb-bookmark-title";
    titleElement.title = bookmark.desc || bookmark.title;

    contentCol.append(metaRow, titleElement);

    // Right action controls group
    const actionsGroup = document.createElement("div");
    actionsGroup.className = "ytb-bookmark-actions";

    // Play action button
    const playBtn = document.createElement("button");
    playBtn.className = "ytb-action-btn ytb-action-btn--play";
    playBtn.type = "button";
    playBtn.title = "Play";
    playBtn.setAttribute("aria-label", "Play video from timestamp");
    playBtn.innerHTML = icons.play;
    playBtn.addEventListener("click", (e) => onPlay(e, tabId));

    // Edit action button
    const editBtn = document.createElement("button");
    editBtn.className = "ytb-action-btn ytb-action-btn--edit";
    editBtn.type = "button";
    editBtn.title = "Edit title";
    editBtn.setAttribute("aria-label", "Edit bookmark title");
    editBtn.innerHTML = icons.edit;
    editBtn.addEventListener("click", () =>
        onEdit(bookmark, titleElement, context)
    );

    // Delete action button
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "ytb-action-btn ytb-action-btn--delete";
    deleteBtn.type = "button";
    deleteBtn.title = "Delete bookmark";
    deleteBtn.setAttribute("aria-label", "Delete bookmark");
    deleteBtn.innerHTML = icons.delete;
    deleteBtn.addEventListener("click", (e) => onDelete(e, videoId, tabId));

    actionsGroup.append(playBtn, editBtn, deleteBtn);

    mainRow.append(contentCol, actionsGroup);
    bookmarkCard.appendChild(mainRow);
    container.appendChild(bookmarkCard);
};

const appendSection = (
    container: HTMLElement,
    title: string,
    bookmarks: Bookmark[],
    context: PopupContext,
    variant: "bookmarks" | "hot-moments"
): void => {
    const section = document.createElement("section");
    section.className = `ytb-section ytb-section--${variant}`;

    if (variant === "hot-moments" && bookmarks.length > 0) {
        const heading = document.createElement("div");
        heading.className = "ytb-section-heading";
        const titleElement = document.createElement("h2");
        titleElement.className = "ytb-section-title";
        titleElement.textContent = title;
        const countBadge = document.createElement("span");
        countBadge.className = "ytb-section-count";
        countBadge.textContent = String(bookmarks.length);
        heading.append(titleElement, countBadge);
        section.appendChild(heading);
    }

    const list = document.createElement("div");
    list.className = "ytb-section-list";

    if (bookmarks.length) {
        bookmarks
            .slice()
            .sort((a, b) => a.time - b.time)
            .forEach((bookmark) => addNewBookmark(list, bookmark, context));
    } else if (variant === "bookmarks") {
        const emptyState = document.createElement("div");
        emptyState.className = "ytb-empty-state";
        emptyState.innerHTML = `
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="ytb-empty-icon" aria-hidden="true">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
            </svg>
            <p class="ytb-empty-title">No bookmarks yet</p>
            <p class="ytb-empty-desc">Click the bookmark icon in the video player or press <kbd>Alt+B</kbd> to save a timestamp.</p>
        `;
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

    loadedBookmarks = currentBookmarks;
    bookmarksElement.innerHTML = "";
    const hotMoments = currentBookmarks.filter(
        (bookmark) => bookmark.source === "hot-moment"
    );
    const savedBookmarks = currentBookmarks.filter(
        (bookmark) => bookmark.source !== "hot-moment"
    );

    const context = { videoId, tabId };
    appendSection(
        bookmarksElement,
        "Saved Bookmarks",
        savedBookmarks,
        context,
        "bookmarks"
    );

    if (hotMoments.length > 0) {
        appendSection(
            bookmarksElement,
            "Hot Moments",
            hotMoments,
            context,
            "hot-moments"
        );
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
    inputField.select();

    const originalText = bookmark.desc || bookmark.title;

    const saveEdit = (): void => {
        const newTitle = inputField.value.trim();
        if (!newTitle || newTitle === originalText) {
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
                if (chrome.runtime.lastError || !res?.ok) {
                    bookmarkTitleElement.textContent = originalText;
                    return;
                }

                bookmarkTitleElement.textContent = newTitle;
                bookmark.desc = newTitle;

                chrome.tabs.sendMessage(
                    tabId,
                    {
                        type: "SHOW_TOAST",
                        message: "Bookmark updated"
                    },
                    () => {
                        if (chrome.runtime.lastError) {
                            // Ignored lastError on closed tab
                        }
                    }
                );
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
    const bookmarkElement = target?.closest(".ytb-bookmark-card") as HTMLElement | null;
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
                // Ignore tab error
            }
        }
    );
};

const onDelete = (e: Event, videoId: string, tabId: number): void => {
    const target = e.target as HTMLElement | null;
    const bookmarkElement = target?.closest(".ytb-bookmark-card") as HTMLElement | null;
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
            if (chrome.runtime.lastError || !res?.ok) {
                return;
            }

            viewBookmarks(res.bookmarks || [], videoId, tabId);

            chrome.tabs.sendMessage(
                tabId,
                {
                    type: "SHOW_TOAST",
                    message: "Bookmark deleted"
                },
                () => {
                    if (chrome.runtime.lastError) {
                        // Ignore tab error
                    }
                }
            );
        }
    );
};

document.addEventListener("DOMContentLoaded", async () => {
    if (!bookmarksElement) return;

    const activeTab = await getActiveTabURL();
    if (!activeTab?.url || activeTab.id == null) {
        bookmarksElement.innerHTML = '<div class="ytb-empty-state"><p class="ytb-empty-title">No active tab found</p></div>';
        showTranscriptFallback("Open a YouTube video to load its transcript.");
        return;
    }

    activeTabId = activeTab.id;
    const videoId = getVideoIdFromUrl(activeTab.url);
    if (!activeTab.url.includes("youtube.com/watch") || !videoId) {
        bookmarksElement.innerHTML = '<div class="ytb-empty-state"><p class="ytb-empty-title">Open YouTube</p><p class="ytb-empty-desc">Open any YouTube video to start bookmarking timestamps.</p></div>';
        showTranscriptFallback("Open a YouTube video to load its transcript.");
        return;
    }

    activeVideoId = videoId;
    loadTranscript(activeTab.id);

    chrome.runtime.sendMessage(
        {
            type: "GET_BOOKMARKS_FOR_VIDEO",
            videoId
        },
        (res) => {
            if (chrome.runtime.lastError || !res?.ok) {
                viewBookmarks([], videoId, activeTab.id!);
                return;
            }

            viewBookmarks(res.bookmarks || [], videoId, activeTab.id!);
        }
    );
});
