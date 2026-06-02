import type { HeatMapChapter, Peak } from "../core/analyzer";
import { extractHeatMapPeaks, normalizeChapterLayout } from "../core/analyzer";
import { formatTime } from "../utils";

(() => {
  let youtubePlayer: HTMLVideoElement | null = null;
  let observedPlayer: HTMLVideoElement | null = null;
  let currentVideoId = "";
  let extractedVideoId = "";
  let autoExtractionAttempts = 0;
  let autoExtractionTimer: number | null = null;
  let observedHeatMap: HTMLElement | null = null;
  let heatMapObserver: MutationObserver | null = null;

  const MAX_AUTO_EXTRACTION_ATTEMPTS = 30;

  const icons = {
    bookmark: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 3.75A2.25 2.25 0 0 1 9.25 1.5h5.5A2.25 2.25 0 0 1 17 3.75v17.1a.65.65 0 0 1-1.02.53L12 18.6l-3.98 2.78A.65.65 0 0 1 7 20.85V3.75Zm2.25-.75a.75.75 0 0 0-.75.75v15.66l3.5-2.45 3.5 2.45V3.75a.75.75 0 0 0-.75-.75h-5.5Z"/>
      </svg>`
  };

  function showToast(message: string): void {
    const previousToast = document.querySelector(".ytb-toast");
    previousToast?.remove();

    const toast = document.createElement("div");
    toast.className = "ytb-toast";
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add("ytb-toast--leaving");
      setTimeout(() => toast.remove(), 250);
    }, 3200);
  }

  const sendMessage = <T>(message: unknown): Promise<T | null> =>
    new Promise((resolve) => {
      try {
        if (!chrome.runtime?.id) {
          resolve(null);
          return;
        }

        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            console.debug("YT Bookmarker:", chrome.runtime.lastError.message);
            resolve(null);
            return;
          }

          resolve(response as T);
        });
      } catch {
        resolve(null);
      }
    });

  const getVideoDetails = () => ({
    title:
      (document.querySelector("h1.title") as HTMLElement | null)?.innerText ||
      document.title.replace(" - YouTube", ""),
    channel:
      (document.querySelector("#owner-name a, .ytd-channel-name a") as HTMLElement | null)
        ?.innerText || ""
  });

  const saveManualBookmark = async (): Promise<void> => {
    if (!youtubePlayer || !currentVideoId) return;

    const time = Math.floor(youtubePlayer.currentTime);
    const response = await sendMessage<{ ok: boolean }>({
      type: "ADD_BOOKMARK",
      payload: {
        videoId: currentVideoId,
        time,
        ...getVideoDetails(),
        desc: `Saved at ${formatTime(time)}`
      }
    });

    showToast(response?.ok ? `Bookmark saved at ${formatTime(time)}` : "Could not save bookmark");
  };

  const getHeatMapPeaks = (): Peak[] => {
    if (!youtubePlayer || !Number.isFinite(youtubePlayer.duration)) return [];

    const container = document.querySelector(".ytp-heat-map-container") as HTMLElement | null;
    if (!container) return [];

    const areas = Array.from(container.querySelectorAll<HTMLElement>(".ytp-heat-map-chapter"));
    const searchAreas: HTMLElement[] = areas.length ? areas : [container];
    const containerRect = container.getBoundingClientRect();
    const layouts = searchAreas.map((area) => {
      const areaRect = area.getBoundingClientRect();
      return {
        left: areaRect.width
          ? areaRect.left - containerRect.left
          : Number.parseFloat(area.style.left) || 0,
        width: areaRect.width || Number.parseFloat(area.style.width) || 0
      };
    });
    const ratios = normalizeChapterLayout(layouts, containerRect.width);

    const chapters = searchAreas.flatMap<HeatMapChapter>((area, index) => {
      const path =
        area.querySelector<SVGPathElement>("path.ytp-modern-heat-map") ||
        Array.from(area.querySelectorAll<SVGPathElement>("path.ytp-heat-map-path"))
          .find((candidate) => Boolean(candidate.getAttribute("d")));
      const svg = path?.closest("svg");
      const pathData = path?.getAttribute("d");

      if (!svg || !pathData) return [];

      const viewBox = svg.getAttribute("viewBox")?.trim().split(/\s+/).map(Number);
      const svgWidth = svg.viewBox.baseVal.width || viewBox?.[2] || 1000;
      const svgHeight = svg.viewBox.baseVal.height || viewBox?.[3] || 100;
      const ratio = ratios[index] || { leftRatio: 0, widthRatio: 1 };

      return [{
        pathData,
        svgWidth,
        svgHeight,
        leftRatio: ratio.leftRatio,
        widthRatio: ratio.widthRatio
      }];
    });

    return extractHeatMapPeaks(chapters, youtubePlayer.duration);
  };

  const extractHighlights = async (automatic = false): Promise<boolean> => {
    if (!youtubePlayer || !currentVideoId) return false;

    const moments = getHeatMapPeaks();
    if (!moments.length) {
      if (!automatic) showToast("Hot Moments are not available for this video yet");
      return false;
    }

    const response = await sendMessage<{ ok: boolean; added: number }>({
      type: "ADD_HOT_MOMENTS",
      payload: {
        videoId: currentVideoId,
        ...getVideoDetails(),
        moments: moments.map(({ time, score }) => ({
          time: Math.floor(time),
          score
        }))
      }
    });

    if (!response?.ok) {
      if (!automatic) showToast("Could not save Hot Moments");
      return false;
    } else if (!response.added) {
      if (!automatic) showToast("Hot Moments are already saved");
    } else {
      showToast(
        automatic
          ? `${response.added} Hot Moments saved automatically`
          : `${response.added} Hot Moments saved`
      );
    }

    return true;
  };

  const queueAutomaticExtraction = (delay = 450): void => {
    if (
      !currentVideoId ||
      currentVideoId === extractedVideoId ||
      autoExtractionAttempts >= MAX_AUTO_EXTRACTION_ATTEMPTS ||
      autoExtractionTimer !== null
    ) {
      return;
    }

    autoExtractionTimer = window.setTimeout(async () => {
      autoExtractionTimer = null;
      const videoId = currentVideoId;
      const extracted = await extractHighlights(true);

      if (videoId !== currentVideoId) return;
      if (extracted) {
        extractedVideoId = videoId;
        return;
      }

      autoExtractionAttempts += 1;
      if (autoExtractionAttempts < MAX_AUTO_EXTRACTION_ATTEMPTS) {
        queueAutomaticExtraction(1000);
      }
    }, delay);
  };

  const observeHeatMap = (): void => {
    const container = document.querySelector(".ytp-heat-map-container") as HTMLElement | null;
    if (!container || container === observedHeatMap) return;

    heatMapObserver?.disconnect();
    observedHeatMap = container;
    heatMapObserver = new MutationObserver(() => {
      autoExtractionAttempts = 0;
      queueAutomaticExtraction(150);
    });
    heatMapObserver.observe(container, {
      attributes: true,
      attributeFilter: ["d"],
      childList: true,
      subtree: true
    });
    queueAutomaticExtraction(150);
  };

  const observePlayer = (): void => {
    if (!youtubePlayer || youtubePlayer === observedPlayer) return;

    observedPlayer = youtubePlayer;
    ["loadedmetadata", "loadeddata", "durationchange", "canplay"].forEach((event) => {
      youtubePlayer!.addEventListener(event, () => queueAutomaticExtraction(250));
    });
  };

  const createAction = (
    label: string,
    icon: string,
    onClick: () => void
  ): HTMLButtonElement => {
    const button = document.createElement("button");
    button.className = "ytb-player-action";
    button.type = "button";
    button.title = label;
    button.setAttribute("aria-label", label);
    button.innerHTML = icon;
    button.addEventListener("click", onClick);
    return button;
  };

  const injectButtons = (): void => {
    if (document.querySelector(".ytb-player-actions")) return;

    const leftControls = document.querySelector(".ytp-left-controls");
    youtubePlayer = document.querySelector(".video-stream");
    if (!leftControls || !youtubePlayer) return;

    const wrapper = document.createElement("div");
    wrapper.className = "ytb-player-actions";
    wrapper.appendChild(createAction("Save bookmark", icons.bookmark, saveManualBookmark));
    leftControls.appendChild(wrapper);
  };

  const syncVideo = (): void => {
    const videoId = new URL(location.href).searchParams.get("v");
    if (!videoId) return;

    if (videoId !== currentVideoId) {
      currentVideoId = videoId;
      extractedVideoId = "";
      autoExtractionAttempts = 0;
      if (autoExtractionTimer !== null) {
        clearTimeout(autoExtractionTimer);
        autoExtractionTimer = null;
      }
    }

    injectButtons();
    youtubePlayer = document.querySelector(".video-stream");
    observePlayer();
    observeHeatMap();
    queueAutomaticExtraction();
  };

  new MutationObserver(syncVideo).observe(document.body, {
    childList: true,
    subtree: true
  });
  syncVideo();

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "NEW") {
      currentVideoId = message.videoId;
      extractedVideoId = "";
      autoExtractionAttempts = 0;
      injectButtons();
      observeHeatMap();
      queueAutomaticExtraction();
    } else if (message.type === "PLAY" && youtubePlayer) {
      youtubePlayer.currentTime = Number(message.time) || 0;
      void youtubePlayer.play();
    } else if (message.type === "SHOW_TOAST" && message.message) {
      showToast(message.message);
    }
  });
})();
