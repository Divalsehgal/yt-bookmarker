import { getActiveTabURL } from "./utils.js";

const addNewBookmark = (bookmarks, bookmark) => {
    const bookmarkTitleElement = document.createElement("div");
    const timestampElement = document.createElement("div");
    const controlsElement = document.createElement("div");
    const newBookmarkElement = document.createElement("div");

    // Format the timestamp for display (converts seconds to MM:SS format)
    const formattedTime = formatTime(bookmark.time);

    bookmarkTitleElement.textContent = bookmark.desc;
    bookmarkTitleElement.className = "ytb-bookmark-title";

    // Create and style the timestamp display
    timestampElement.textContent = formattedTime;
    timestampElement.className = "ytb-bookmark-timestamp";

    controlsElement.className = "ytb-bookmark-controls";

    // Add "Edit" button to each bookmark
    const editButton = document.createElement("button");
    editButton.textContent = "Edit";
    editButton.className = "ytb-edit-btn";
    editButton.addEventListener("click", () => onEdit(bookmark, bookmarkTitleElement));

    controlsElement.appendChild(editButton);
    setBookmarkAttributes("play", onPlay, controlsElement);
    setBookmarkAttributes("delete", onDelete, controlsElement);

    newBookmarkElement.id = "bookmark-" + bookmark.time;
    newBookmarkElement.className = "ytb-bookmark";
    newBookmarkElement.setAttribute("timestamp", bookmark.time);

    newBookmarkElement.appendChild(timestampElement);
    newBookmarkElement.appendChild(bookmarkTitleElement);
    newBookmarkElement.appendChild(controlsElement);
    bookmarks.appendChild(newBookmarkElement);
};

// Format seconds into MM:SS format
const formatTime = (timeInSeconds) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const viewBookmarks = (currentBookmarks = []) => {
    const bookmarksElement = document.getElementById("bookmarks");
    bookmarksElement.innerHTML = "";

    if (currentBookmarks.length > 0) {
        for (const element of currentBookmarks) {
            const bookmark = element;
            addNewBookmark(bookmarksElement, bookmark);
        }
    } else {
        bookmarksElement.innerHTML = '<i class="row">No bookmarks to show</i>';
    }
};

const onEdit = (bookmark, bookmarkTitleElement) => {
    // Create an input field with the current title as its value
    const inputField = document.createElement("input");
    inputField.type = "text";
    inputField.value = bookmark.desc;
    inputField.className = "ytb-edit-input";

    // Replace the title with the input field
    bookmarkTitleElement.innerHTML = "";
    bookmarkTitleElement.appendChild(inputField);

    // Focus on the input field for immediate editing
    inputField.focus();

    const saveEdit = async () => {
        const newTitle = inputField.value.trim();
        if (newTitle !== "") {
            bookmark.desc = newTitle; // Update the bookmark object
            await updateBookmarkInStorage(bookmark); // Update the storage
            bookmarkTitleElement.textContent = newTitle; // Update the UI
        } else {
            // If empty, revert to original text
            bookmarkTitleElement.textContent = bookmark.desc;
        }
    };

    // Save when user presses Enter
    inputField.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            saveEdit();
        } else if (event.key === "Escape") {
            // Cancel edit if Escape is pressed
            bookmarkTitleElement.textContent = bookmark.desc;
        }
    });

    // Also save when focus is lost
    inputField.addEventListener("blur", saveEdit);
};

const updateBookmarkInStorage = async (updatedBookmark) => {
    const activeTab = await getActiveTabURL();
    const queryParameters = activeTab.url.split("?")[1];
    const urlParameters = new URLSearchParams(queryParameters);
    const currentVideo = urlParameters.get("v");

    return new Promise((resolve) => {
        chrome.storage.sync.get([currentVideo], (data) => {
            let currentVideoBookmarks = data[currentVideo] ? JSON.parse(data[currentVideo]) : [];

            // Find and update the specific bookmark
            const bookmarkIndex = currentVideoBookmarks.findIndex(b => b.time === updatedBookmark.time);
            if (bookmarkIndex > -1) {
                currentVideoBookmarks[bookmarkIndex] = updatedBookmark;
                chrome.storage.sync.set({
                    [currentVideo]: JSON.stringify(currentVideoBookmarks),
                }, resolve);
            } else {
                resolve();
            }
        });
    });
};

const onPlay = async e => {
    const bookmarkTime = e.target.parentNode.parentNode.getAttribute("timestamp");
    const activeTab = await getActiveTabURL();

    chrome.tabs.sendMessage(activeTab.id, {
        type: "PLAY",
        value: bookmarkTime,
    });
};

const onDelete = async e => {
    const activeTab = await getActiveTabURL();
    const bookmarkTime = e.target.parentNode.parentNode.getAttribute("timestamp");
    const bookmarkElementToDelete = document.getElementById(
        "bookmark-" + bookmarkTime
    );

    bookmarkElementToDelete.parentNode.removeChild(bookmarkElementToDelete);

    chrome.tabs.sendMessage(activeTab.id, {
        type: "DELETE",
        value: bookmarkTime,
    }, viewBookmarks);
};

const setBookmarkAttributes = (src, eventListener, controlParentElement) => {
    const controlElement = document.createElement("img");

    controlElement.src = "assets/" + src + ".png";
    controlElement.title = src;
    controlElement.addEventListener("click", eventListener);
    controlParentElement.appendChild(controlElement);
};

document.addEventListener("DOMContentLoaded", async () => {
    const activeTab = await getActiveTabURL();
    const queryParameters = activeTab.url.split("?")[1];
    const urlParameters = new URLSearchParams(queryParameters);

    const currentVideo = urlParameters.get("v");

    if (activeTab.url.includes("youtube.com/watch") && currentVideo) {
        chrome.storage.sync.get([currentVideo], (data) => {
            const currentVideoBookmarks = data[currentVideo] ? JSON.parse(data[currentVideo]) : [];

            viewBookmarks(currentVideoBookmarks);
        });
    } else {
        const container = document.getElementsByClassName("container")[0];

        container.innerHTML = '<div class="title">This is not a youtube video page.</div>';
    }
});