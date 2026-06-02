# YT Bookmarker

A Chrome extension for saving YouTube timestamps and extracting replay-based Hot Moments from videos that expose YouTube's heat map.

## Features

- Save the current timestamp from the YouTube player.
- Automatically extract up to five Hot Moments after YouTube's replay heat map loads.
- Jump directly to a saved moment from the extension popup.
- Edit descriptions and delete bookmarks.
- Avoid duplicate Hot Moments when extraction is run more than once.
- Keep bookmarks locally in `chrome.storage.local`.

## Development

```bash
yarn install
yarn typecheck
yarn build
```

Load the repository folder from `chrome://extensions` using **Load unpacked**. After rebuilding, press the extension card's reload button and refresh an open YouTube video.

## Built ZIP Download

A built extension ZIP is generated automatically on every push via GitHub Actions. After a push, open the repository's **Actions** tab, select the latest run, and download the `yt-bookmarker-build` artifact.

## How To Use

1. Open a YouTube watch page.
2. Use the bookmark icon in the player to save the current timestamp.
3. Hot Moments are saved automatically when a replay heat map is available.
4. Open the extension popup to play, edit, or delete saved moments.

See [DEVELOPMENT.md](./DEVELOPMENT.md) for the architecture and implementation guide.
For a blog-ready walkthrough, open [docs/YT-Bookmarker-Blog-Guide.docx](./docs/YT-Bookmarker-Blog-Guide.docx).
