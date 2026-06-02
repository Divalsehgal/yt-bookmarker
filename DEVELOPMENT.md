# YT Bookmarker: Implementation Guide

## Overview

YT Bookmarker is a Manifest V3 Chrome extension written in TypeScript and bundled with esbuild. It has three runtime surfaces:

1. The content script injects actions into the YouTube player.
2. The background service worker handles storage operations.
3. The popup lists bookmarks for the active YouTube video.

## Project Layout

| Path | Purpose |
| --- | --- |
| `manifest.json` | Extension metadata, permissions, scripts, and icons |
| `src/content/index.ts` | YouTube player integration and heat-map extraction |
| `src/background/index.ts` | Message router and persistence coordination |
| `src/popup/index.ts` | Popup rendering and bookmark interactions |
| `src/core/bookmark.ts` | Bookmark data model and factory |
| `src/core/storage.ts` | `chrome.storage.local` CRUD helpers |
| `src/core/analyzer.ts` | SVG path parsing, peak ranking, and clustering |
| `styles.css` | Popup styles plus isolated YouTube player controls |

## Bookmark Flow

When the player bookmark action is clicked, the content script reads the video ID, current playback time, title, and channel. It sends an `ADD_BOOKMARK` message to the service worker, which creates a bookmark and stores it under `video:<youtube-video-id>`.

## Hot Moments Flow

YouTube exposes replay popularity on many videos as an SVG path with the class `.ytp-modern-heat-map`. The content script:

1. Finds the heat-map container and SVG path.
2. Parses the SVG path into points.
3. Converts each point's horizontal location into a video timestamp.
4. Converts vertical height into an engagement score.
5. Keeps local peaks, clusters nearby results, and selects up to five moments.
6. Watches player metadata and delayed heat-map SVG mutations so extraction runs automatically.
7. Retries for a bounded period while YouTube finishes rendering the player.
8. Sends the selected moments in one `ADD_HOT_MOMENTS` message.
9. Stores new moments while ignoring timestamps already saved within five seconds.

Heat maps are controlled by YouTube and are not available for every video. The extension shows a friendly message when extraction is unavailable.

The extractor does not depend on the progress bar being visible. For the usual single-chapter SVG, it maps the SVG directly across the full video. For multi-chapter videos, it uses rendered geometry when available and YouTube's inline `left` and `width` styles as a fallback.

## Build And Verify

```bash
yarn typecheck
yarn test
yarn build
```

For a manual browser check:

1. Load the folder as an unpacked extension.
2. Open a YouTube video with a most-replayed graph.
3. Confirm the injected bookmark icon is aligned with native controls.
4. Confirm Hot Moments appear automatically, then save a normal bookmark.
5. Open the popup and confirm play, edit, delete, badges, and summary counts.
6. Reload the video and confirm duplicate Hot Moments are not added.

## Extension Icon

The Chrome toolbar icon uses transparent outer corners so the red tile fills the available icon area without a white frame. The source artwork is processed into `16`, `32`, `48`, and `128` pixel PNG variants:

```bash
python scripts/process_extension_icon.py SOURCE_IMAGE assets
```

## Notes For Publishing

Before Chrome Web Store submission, prepare final store screenshots, a privacy policy explaining local-only storage, and production-sized icon variants. The extension currently requests `storage`, `tabs`, and YouTube host access only.
