(() => {
    let youtubeLeftControls, youtubePlayer;
    let currentVideo = "";
    let currentVideoBookmarks = [];

    const fetchBookmarks = () => {
        return new Promise((resolve) => {
            chrome.storage.sync.get([currentVideo], (obj) => {
                resolve(obj[currentVideo] ? JSON.parse(obj[currentVideo]) : []);
            });
        });
    };

    const addNewBookmarkEventHandler = async () => {
        const currentTime = youtubePlayer.currentTime;
        const newBookmark = {
            time: currentTime,
            desc: "Bookmark at " + getTime(currentTime),
        };

        currentVideoBookmarks = await fetchBookmarks();

        chrome.storage.sync.set({
            [currentVideo]: JSON.stringify([...currentVideoBookmarks, newBookmark].sort((a, b) => a.time - b.time))
        });
    };

    const newVideoLoaded = async () => {
        if (document.querySelector(".my-bookmark-btn")) return;

        const bookmarkBtn = document.createElement("button");
        const bookmarkImage = document.createElement("img");

        bookmarkBtn.className = "my-bookmark-btn";
        bookmarkImage.src = chrome.runtime.getURL("assets/bookmark.png");
        bookmarkImage.title = "Click to bookmark current timestamp";
        bookmarkImage.style.pointerEvents = "cursor";
        bookmarkBtn.appendChild(bookmarkImage);
        youtubeLeftControls = document.querySelector(".ytp-left-controls");
        youtubePlayer = document.querySelector(".video-stream");

        if (youtubeLeftControls) {
            youtubeLeftControls.appendChild(bookmarkBtn);
            bookmarkBtn.addEventListener("click", addNewBookmarkEventHandler);
        }
    };

    chrome.runtime.onMessage.addListener((obj, sender, response) => {
        const { type, value, videoId } = obj;

        if (type === "NEW") {
            currentVideo = videoId;
            newVideoLoaded();
        } else if (type === "PLAY") {
            youtubePlayer.currentTime = value;
        } else if (type === "DELETE") {
            currentVideoBookmarks = currentVideoBookmarks.filter((b) => b.time != value);
            chrome.storage.sync.set({ [currentVideo]: JSON.stringify(currentVideoBookmarks) });

            response(currentVideoBookmarks);
        }
    });

    newVideoLoaded();
})();

const getTime = t => {
    const date = new Date(0);
    date.setSeconds(t);

    return date.toISOString().slice(11, 19);
};
