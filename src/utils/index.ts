// ----------------------
// Get the active tab
// ----------------------
export const getActiveTabURL = async (): Promise<chrome.tabs.Tab | null> => {
    return new Promise((resolve) => {
        try {
            chrome.tabs.query({ currentWindow: true, active: true }, (tabs) => {
                resolve(tabs?.[0] ?? null);
            });
        } catch (err) {
            console.warn("getActiveTabURL error:", err);
            resolve(null);
        }
    });
};

// ----------------------
// Extract ?v= from YouTube URL
// ----------------------
export function getVideoIdFromUrl(url: string): string | null {
    try {
        const parsed = new URL(url);
        return parsed.searchParams.get("v");
    } catch (err) {
        console.warn("getVideoIdFromUrl error:", err, "URL:", url);
        return null;
    }
}

// ----------------------
// Format seconds → mm:ss or HH:mm:ss
// ----------------------
export function formatTime(timeInSeconds: number): string {
    const totalSeconds = Math.floor(Number(timeInSeconds) || 0);

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    function padNumber(n: number, width = 2): string {
        const s = String(Math.floor(n));
        if (s.length >= width) return s;
        return '0'.repeat(Math.max(0, width - s.length)) + s;
    }

    const mm = padNumber(minutes, 2);
    const ss = padNumber(seconds, 2);

    // If more than 1 hour → HH:MM:SS

    if (hours > 0) {
        const hh = padNumber(hours, 2);
        return `${hh}:${mm}:${ss}`;
    }

    // Else → MM:SS
    return `${mm}:${ss}`;
}
