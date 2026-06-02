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

## Method 2: Automating releases with GitHub Actions

If you want your workflow to automatically build the extension, create a GitHub release, and attach the ZIP whenever you push a version tag like `v1.0.0`, use the `softprops/action-gh-release` action.

Create `.github/workflows/release.yml` with these steps:

```yaml
name: Release extension ZIP

on:
  push:
    tags:
      - "v*.*.*"

jobs:
  release:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install dependencies
        run: npm install

      - name: Build extension
        run: npm run build

      - name: Package extension ZIP
        run: |
          zip -r yt-bookmarker.zip manifest.json dist popup assets styles.css

      - name: Create GitHub release and upload ZIP
        uses: softprops/action-gh-release@v1
        with:
          files: yt-bookmarker.zip
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Now when you push a tag such as `git tag v1.0.0 && git push origin v1.0.0`, GitHub will build the extension and attach `yt-bookmarker.zip` to the release automatically.

## How To Use

1. Open a YouTube watch page.
2. Use the bookmark icon in the player to save the current timestamp.
3. Hot Moments are saved automatically when a replay heat map is available.
4. Open the extension popup to play, edit, or delete saved moments.

See [DEVELOPMENT.md](./DEVELOPMENT.md) for the architecture and implementation guide.
For a blog-ready walkthrough, open [docs/YT-Bookmarker-Blog-Guide.docx](./docs/YT-Bookmarker-Blog-Guide.docx).
