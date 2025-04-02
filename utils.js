export async function getActiveTabURL() {
    const tabs = await chrome.tabs.query({
        currentWindow: true,
        active: true
    });

    return tabs[0];
}


export const getTime = (seconds) => {
    const date = new Date(0);
    date.setSeconds(seconds);

    // Format time as HH:mm:ss
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const secondsFormatted = String(date.getUTCSeconds()).padStart(2, '0');

    return `${hours}:${minutes}:${secondsFormatted}`;
};


export function showToast(message) {
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
            right: 20px;  /* Position the toast at the bottom right */
            background-color: #333;
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            font-size: 14px;
            opacity: 1;
            transition: opacity 0.3s ease-out;
            z-index: 9999;  /* Ensure the toast is on top */
        }
    `;
    document.head.appendChild(style);
}