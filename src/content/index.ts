// src/content/index.ts
(() => {
  let youtubeLeftControls: HTMLElement | null;
  let youtubePlayer: HTMLVideoElement | null;
  let currentVideo: string = "";

  const getTime = (seconds: number): string => {
    const date = new Date(0);
    date.setSeconds(seconds);
    const padStartSafe = (input: string | number, targetLength = 2, padString = "0") => {
      const s = String(input);
      if (typeof (s as any).padStart === "function") return (s as any).padStart(targetLength, padString);
      if (s.length >= targetLength) return s;
      return padString.repeat(targetLength - s.length) + s;
    };

    const h = padStartSafe(date.getUTCHours(), 2);
    const m = padStartSafe(date.getUTCMinutes(), 2);
    const s = padStartSafe(date.getUTCSeconds(), 2);
    return `${h}:${m}:${s}`;
  };

  function showToast(message: string): void {
    const div = document.createElement("div");
    div.className = "toast";
    div.textContent = message;
    document.body.appendChild(div);

    setTimeout(() => {
      div.style.opacity = "0";
      setTimeout(() => div.remove(), 300);
    }, 3000);

    if (!document.getElementById("ytb-toast-style")) {
      const style = document.createElement("style");
      style.id = "ytb-toast-style";
      style.textContent = `
      .toast {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background-color: #333;
        color: white;
        padding: 10px 20px;
        border-radius: 6px;
        font-size: 14px;
        opacity: 1;
        transition: opacity .3s ease-out;
        z-index: 999999;
      }`;
      document.head.appendChild(style);
    }
  }

  const addNewBookmarkEventHandler = async (): Promise<void> => {
    if (!youtubePlayer || !currentVideo) return;

    const currentTime = Math.floor(youtubePlayer.currentTime);

    const title =
      (document.querySelector("h1.title") as HTMLElement)?.innerText ||
      document.title ||
      "Untitled";

    const channel =
      (document.querySelector("#owner-name a, .ytd-channel-name a") as HTMLElement)
        ?.innerText || "";

    const desc = "Bookmark at " + getTime(currentTime);

    try {
      if (!chrome.runtime?.id) return;

      chrome.runtime.sendMessage(
        {
          type: "ADD_BOOKMARK",
          payload: {
            videoId: currentVideo,
            time: currentTime,
            title,
            channel,
            desc
          }
        },
        (res) => {
          if (chrome.runtime.lastError) {
            console.warn("ADD_BOOKMARK error:", chrome.runtime.lastError);
            return;
          }
          if (res?.ok) showToast("Bookmark saved at " + getTime(currentTime));
        }
      );
    } catch (e) {
      console.warn("Context invalid:", e);
    }
  };

  const newVideoLoaded = (): void => {
    if (document.querySelector(".ytb-my-bookmark-btn")) return;

    const btn = document.createElement("button");
    const img = document.createElement("img");

    btn.className = "ytb-my-bookmark-btn";
    img.src = chrome.runtime.getURL("assets/bookmark.png");
    img.title = "Bookmark current timestamp";
    img.style.pointerEvents = "auto";

    btn.appendChild(img);

    youtubeLeftControls = document.querySelector(".ytp-left-controls");
    youtubePlayer = document.querySelector(".video-stream");

    if (youtubeLeftControls && youtubePlayer) {
      youtubeLeftControls.appendChild(btn);
      btn.addEventListener("click", addNewBookmarkEventHandler);
    }
  };

  chrome.runtime.onMessage.addListener(
    (
      obj: { type: string; videoId?: string; message?: string; time?: number; value?: number },
      _sender,
      _resp
    ) => {
      if (obj.type === "NEW" && obj.videoId) {
        currentVideo = obj.videoId;
        newVideoLoaded();
      }

      if (obj.type === "PLAY" && youtubePlayer) {
        const t = Number(obj.time ?? obj.value);
        if (!Number.isNaN(t)) {
          youtubePlayer.currentTime = t;
          youtubePlayer.play();
        }
      }

      if (obj.type === "SHOW_TOAST" && obj.message?.trim()) {
        showToast(obj.message);
      }
    }
  );

  const initOnFirstLoad = () => {
    try {
      const url = new URL(location.href);
      if (url.hostname.includes("youtube.com") && url.pathname === "/watch") {
        const v = url.searchParams.get("v");
        if (v) {
          currentVideo = v;
          newVideoLoaded();
        }
      }
    } catch { }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initOnFirstLoad);
  } else {
    initOnFirstLoad();
  }
})();
