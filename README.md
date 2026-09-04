<div align="center">

<img src="assets/screen.jpg" alt="neuroSplit" width="760">

<p>
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white" alt="CSS3">
</p>
<p>
  <img src="https://img.shields.io/badge/Chrome_Extension-2EC866?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Chrome Extension">
  <img src="https://img.shields.io/badge/Manifest_V3-2EC866?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Manifest V3">
  <img src="https://img.shields.io/badge/License-MIT-2EC866?style=for-the-badge" alt="License: MIT">
</p>

</div>

# neuroSplit

**Feed long text to an LLM in pieces.** Paste a paper or a PDF dump into the
side panel, choose how many words go in each chunk, and copy them one after
another with a single button.

Some chat interfaces turn a big paste into a file attachment or won't accept a pdf file in input. neuroSplit keeps you in control: split the
text yourself and drop it in inline, piece by piece, in order.

<!-- ci metto uno screen magari -->

## Features

- **Side panel, not a popup** -> stays open beside any tab while you work.
- **Word-based chunking** -> set the words per chunk.
- **Copy & next** -> one button copies the current chunk and advances to the next.
- **Odometer + progress** -> always see which chunk you're on (`03 / 12`) and how far you've gone.
- **Jump anywhere** -> numbered strip to jump to any chunk; already-copied ones are marked.
- **Optional `[Part 3/12]` label** -> prefix each copy so the model knows the order.
- **Remembers your work** -> text, settings and position survive closing the panel.
- **Keyboard shortcuts** -> `→` / `←` to move, `Enter` (or `c`) to copy & next.
- **No tracking, no network, minimal permissions** -> see below.

## Install (load unpacked, for development)

1. Download or clone this repo.
2. Open `chrome://extensions` in Chrome (or any Chromium browser: Edge, Brave, Arc).
3. Turn on **Developer mode**.
4. Click **Load unpacked** and select the `neuroSplit/` folder.
5. Click the neuroSplit icon in the toolbar -> the side panel opens.

To pin it: click the puzzle-piece icon in the toolbar and pin neuroSplit.

## How to use

1. Paste your text into the box.
2. Set **words per chunk** (number box or slider).
3. Hit **Split into N chunks**.
4. Press **Copy & next** and paste into your chat. Repeat.
5. **New text** takes you back to start over.

## Project structure

```
neuroSplit/
├── manifest.json      Extension config (see fields below)
├── background.js      Service worker: opens the side panel on icon click
├── icons/             Toolbar/store icons (16, 48, 128 px)
└── src/
    ├── panel.html     Side-panel markup: two views: "input" and "run"
    ├── panel.css      Styles and design tokens
    └── panel.js       All behaviour: splitting, copying, state, rendering
```

It's plain HTML/CSS/JS with **no build step and no dependencies**: the files
run exactly as written.

### What each `manifest.json` field does

| Field | Why it's there |
|-------|----------------|
| `manifest_version: 3` | Uses Manifest V3, the current extension platform. |
| `permissions: ["sidePanel", "storage"]` | `sidePanel` renders our UI in the panel; `storage` remembers your text and settings. |
| *(no host permissions)* | The extension never reads the pages you visit. |
| `background.service_worker` | Points to `background.js`, which opens the panel on click. |
| `action` | The toolbar button. No popup -> clicking it opens the side panel. |
| `side_panel.default_path` | The page Chrome loads inside the panel (`src/panel.html`). |
| `icons` | Shown in the toolbar, the extensions page, and the store. |

## Coming soon...

- [ ] Split on sentence/paragraph boundaries near the target size (keep structure).
- [ ] Chunk by estimated **tokens** as well as words.
- [ ] Drag-and-drop.
- [ ] Chrome Web Store published version.

## License

MIT — see [LICENSE](LICENSE).

## Author

Created by Mattia Cocco.
