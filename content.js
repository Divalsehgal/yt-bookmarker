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

    function showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;

        // Add to the body
        document.body.appendChild(toast);

        // Show for 3 seconds and then remove
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300); // Remove after fade-out
        }, 3000);

        // Basic styling for the toast (can be customized)
        const style = document.createElement('style');
        style.textContent = `
  .toast {
    position: fixed;
    bottom: 20px;
    right: 20px;
    left: auto; /* Remove any left positioning */
    background-color: #333;
    color: white;
    padding: 10px 20px;
    border-radius: 5px;
    font-size: 14px;
    opacity: 1;
    transition: opacity 0.3s ease-out;
}
    `;
        document.head.appendChild(style);
    }


    const addNewBookmarkEventHandler = async () => {
        console.log('Add bookmark handler triggered'); // Debugging line

        const currentTime = youtubePlayer.currentTime;
        const newBookmark = {
            time: currentTime,
            desc: "Bookmark at " + getTime(currentTime),
        };

        // Fetch current bookmarks and add the new one
        currentVideoBookmarks = await fetchBookmarks();

        chrome.storage.sync.set({
            [currentVideo]: JSON.stringify(
                [...currentVideoBookmarks, newBookmark].sort((a, b) => a.time - b.time)
            ),
        });

        // Show success toast after saving the bookmark
        showToast('Bookmark saved at ' + getTime(currentTime));
    };



    const newVideoLoaded = async () => {
        if (document.querySelector(".ytb-my-bookmark-btn")) return;

        const bookmarkBtn = document.createElement("button");
        const bookmarkImage = document.createElement("img");

        bookmarkBtn.className = "ytb-my-bookmark-btn";
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

const getTime = (seconds) => {
    const date = new Date(0);
    date.setSeconds(seconds);

    // Format time as HH:mm:ss
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const secondsFormatted = String(date.getUTCSeconds()).padStart(2, '0');

    return `${hours}:${minutes}:${secondsFormatted}`;
};

