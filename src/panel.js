// panel.js
// =============================================================================
// All of neuroSplit's behaviour lives here. Reading order top-to-bottom:
//   1. storage helper   — remember text + settings between opens
//   2. state            — the single source of truth
//   3. element refs      — grab the DOM nodes once
//   4. core logic        — split text, copy to clipboard
//   5. render functions  — paint state onto the screen
//   6. actions           — what buttons do
//   7. wiring + init     — hook up events and start
// No frameworks, no build step: this file runs exactly as written.
// =============================================================================


// ---- 1. Storage -------------------------------------------------------------
// Inside the extension we use chrome.storage.local. The same file also runs as
// a plain web page (the live demo), where chrome.storage doesn't exist, so we
// fall back to localStorage. Both are wrapped in one small async interface.
const store = {
  get(defaults) {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      return chrome.storage.local.get(defaults);
    }
    // localStorage fallback
    const out = {};
    for (const [key, fallback] of Object.entries(defaults)) {
      const raw = localStorage.getItem("chunkr:" + key);
      out[key] = raw === null ? fallback : JSON.parse(raw);
    }
    return Promise.resolve(out);
  },
  set(values) {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      return chrome.storage.local.set(values);
    }
    for (const [key, value] of Object.entries(values)) {
      localStorage.setItem("chunkr:" + key, JSON.stringify(value));
    }
    return Promise.resolve();
  },
};


// ---- 2. State ---------------------------------------------------------------
// Everything the UI needs to draw itself. Changing state, then calling the
// matching render(), is the only way the screen updates.
const state = {
  text: "",            // the raw pasted text
  wordsPerChunk: 250,  // chunk size the user picked
  addLabel: false,     // prefix copies with "[Part 3/12]" ?
  chunks: [],          // the text split into pieces (built on Split)
  index: 0,            // which chunk is currently showing (0-based)
  copied: new Set(),   // indices already copied, for the "sent" markers
};


// ---- 3. Element references --------------------------------------------------
const $ = (id) => document.getElementById(id);
const el = {
  body: document.body,
  // input view
  input: $("input"),
  wordCount: $("wordCount"),
  charCount: $("charCount"),
  sizeNumber: $("sizeNumber"),
  sizeRange: $("sizeRange"),
  splitBtn: $("splitBtn"),
  // settings
  settingsToggle: $("settingsToggle"),
  settings: $("settings"),
  labelToggle: $("labelToggle"),
  // run view
  counterCurrent: $("counterCurrent"),
  counterTotal: $("counterTotal"),
  progressFill: $("progressFill"),
  chunkText: $("chunkText"),
  copyBtn: $("copyBtn"),
  prevBtn: $("prevBtn"),
  nextBtn: $("nextBtn"),
  jumpStrip: $("jumpStrip"),
  resetBtn: $("resetBtn"),
  // misc
  toast: $("toast"),
};


// ---- 4. Core logic ----------------------------------------------------------

// Count words the same way we split: any run of whitespace separates words.
function countWords(text) {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

// The heart of v1: split on whitespace, then group N words per chunk.
// Because we group whole words, a chunk never cuts a word in half.
// Note: this collapses line breaks into single spaces. Preserving paragraph
// breaks (splitting on sentence/paragraph boundaries near the target size) is
// the planned v2 upgrade. (kept out of v1 to keep the logic obvious)
function splitIntoChunks(text, wordsPerChunk) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const size = Math.max(1, Math.floor(wordsPerChunk)); // guard against 0 / junk
  const chunks = [];
  for (let i = 0; i < words.length; i += size) {
    chunks.push(words.slice(i, i + size).join(" "));
  }
  return chunks;
}

// Pad numbers so the counter reads like an odometer: 03 / 12, not 3 / 12.
function pad(n, total) {
  const width = Math.max(2, String(total).length);
  return String(n).padStart(width, "0");
}

// Copy text to the clipboard. The modern API works inside the side panel on a
// click; the textarea path is a fallback for any context that blocks it.
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { /* ignore */ }
    document.body.removeChild(ta);
    return ok;
  }
}

// Build exactly what lands on the clipboard for a given chunk (optional label).
function textForCopy(index) {
  const chunk = state.chunks[index];
  if (state.addLabel) {
    return `[Part ${index + 1}/${state.chunks.length}]\n\n${chunk}`;
  }
  return chunk;
}


// ---- 5. Render --------------------------------------------------------------

// Input view: live counts + the Split button's dynamic label/enabled-ness.
function renderInput() {
  const words = countWords(state.text);
  el.wordCount.textContent = words.toLocaleString();
  el.charCount.textContent = `${state.text.length.toLocaleString()} characters`;

  if (words === 0) {
    el.splitBtn.disabled = true;
    el.splitBtn.textContent = "Paste text to split";
    return;
  }
  const pieces = Math.ceil(words / Math.max(1, state.wordsPerChunk));
  el.splitBtn.disabled = false;
  el.splitBtn.textContent =
    pieces === 1 ? "Split into 1 chunk" : `Split into ${pieces} chunks`;
}

// Run view: counter, progress, current chunk, nav, and the jump strip.
function renderRun() {
  const total = state.chunks.length;
  const human = state.index + 1; // 1-based for display

  // counter (with a tiny pop when the number changes)
  el.counterCurrent.textContent = pad(human, total);
  el.counterTotal.textContent = pad(total, total);
  el.counterCurrent.classList.remove("tick");
  void el.counterCurrent.offsetWidth; // restart the CSS animation
  el.counterCurrent.classList.add("tick");

  // progress bar reflects how far you've stepped through
  el.progressFill.style.width = `${(human / total) * 100}%`;

  // the chunk itself
  el.chunkText.textContent = state.chunks[state.index];

  // primary button label: it names exactly what will happen
  const onLast = state.index === total - 1;
  el.copyBtn.textContent = onLast ? "Copy last chunk" : "Copy & next";

  // nav availability
  el.prevBtn.disabled = state.index === 0;
  el.nextBtn.disabled = onLast;

  renderJumpStrip();
}

// The numbered pills you can click to jump anywhere.
function renderJumpStrip() {
  el.jumpStrip.innerHTML = "";
  state.chunks.forEach((_, i) => {
    const pill = document.createElement("button");
    pill.type = "button";
    pill.className = "jump__pill";
    pill.textContent = i + 1;
    if (i === state.index) pill.classList.add("is-active");
    if (state.copied.has(i)) pill.classList.add("is-copied");
    pill.addEventListener("click", () => goTo(i));
    el.jumpStrip.appendChild(pill);
  });
  // keep the active pill in view when it moves
  el.jumpStrip.children[state.index]?.scrollIntoView({
    inline: "center", block: "nearest",
  });
}

// The little confirmation bubble.
let toastTimer;
function showToast(message) {
  el.toast.textContent = message;
  el.toast.classList.add("is-show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove("is-show"), 1400);
}


// ---- 6. Actions -------------------------------------------------------------

// Persist the bits worth remembering, so reopening the panel restores your work.
function save() {
  store.set({
    text: state.text,
    wordsPerChunk: state.wordsPerChunk,
    addLabel: state.addLabel,
    index: state.index,
    copied: [...state.copied],
  });
}

// Split -> switch to the run view.
function doSplit() {
  state.chunks = splitIntoChunks(state.text, state.wordsPerChunk);
  if (state.chunks.length === 0) return;
  state.index = 0;
  state.copied = new Set();
  el.body.dataset.view = "run";
  renderRun();
  save();
}

// Move to a specific chunk.
function goTo(i) {
  state.index = Math.min(Math.max(0, i), state.chunks.length - 1);
  renderRun();
  save();
}

// Copy the current chunk, flash confirmation, then advance if there's more.
async function copyAndNext() {
  const ok = await copyText(textForCopy(state.index));
  if (!ok) { showToast("Couldn't reach the clipboard"); return; }

  state.copied.add(state.index);
  showToast(`Copied chunk ${state.index + 1}`);

  // brief green "copied" flash on the button
  el.copyBtn.classList.add("is-copied");
  const wasLabel = el.copyBtn.textContent;
  el.copyBtn.textContent = "Copied";
  setTimeout(() => {
    el.copyBtn.classList.remove("is-copied");
    // advance to the next chunk if we're not already at the end
    if (state.index < state.chunks.length - 1) {
      state.index += 1;
      renderRun();
    } else {
      el.copyBtn.textContent = wasLabel;
      renderJumpStrip(); // refresh the "sent" marker on the last pill
    }
    save();
  }, 320);
}

// Back to the input view (text and settings are kept).
function reset() {
  el.body.dataset.view = "input";
  renderInput();
}

// Keep the number box and slider showing the same value.
function setSize(value) {
  const n = Math.max(1, Math.min(2000, Math.floor(Number(value) || 1)));
  state.wordsPerChunk = n;
  el.sizeNumber.value = n;
  // slider only spans 25–1000; clamp its thumb without limiting the number box
  el.sizeRange.value = Math.max(25, Math.min(1000, n));
  renderInput();
  save();
}


// ---- 7. Wiring + init -------------------------------------------------------
function wireEvents() {
  // typing / pasting text
  el.input.addEventListener("input", () => {
    state.text = el.input.value;
    renderInput();
    save();
  });

  // chunk size — number box and slider stay in sync
  el.sizeNumber.addEventListener("input", (e) => setSize(e.target.value));
  el.sizeRange.addEventListener("input", (e) => setSize(e.target.value));

  // split
  el.splitBtn.addEventListener("click", doSplit);

  // run-view controls
  el.copyBtn.addEventListener("click", copyAndNext);
  el.prevBtn.addEventListener("click", () => goTo(state.index - 1));
  el.nextBtn.addEventListener("click", () => goTo(state.index + 1));
  el.resetBtn.addEventListener("click", reset);

  // settings drawer
  el.settingsToggle.addEventListener("click", () => {
    const open = el.settings.hasAttribute("hidden");
    el.settings.toggleAttribute("hidden", !open);
    el.settingsToggle.setAttribute("aria-expanded", String(open));
  });
  el.labelToggle.addEventListener("change", (e) => {
    state.addLabel = e.target.checked;
    save();
  });

  // keyboard shortcuts while stepping through chunks (ignored when typing):
  //   → / Space  next        ← previous        Enter / c  copy & next
  document.addEventListener("keydown", (e) => {
    if (el.body.dataset.view !== "run") return;
    const typing = ["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName);
    if (typing) return;

    if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); goTo(state.index + 1); }
    else if (e.key === "ArrowLeft")              { e.preventDefault(); goTo(state.index - 1); }
    else if (e.key === "Enter" || e.key === "c") { e.preventDefault(); copyAndNext(); }
  });
}

async function init() {
  // restore saved text + settings (with sensible defaults)
  const saved = await store.get({
    text: "",
    wordsPerChunk: 250,
    addLabel: false,
    index: 0,
    copied: [],
  });

  state.text = saved.text;
  state.wordsPerChunk = saved.wordsPerChunk;
  state.addLabel = saved.addLabel;

  // reflect restored values in the controls
  el.input.value = state.text;
  el.labelToggle.checked = state.addLabel;
  setSize(state.wordsPerChunk);

  // if there was text last time, rebuild the chunks and reopen where you left off
  if (state.text.trim()) {
    state.chunks = splitIntoChunks(state.text, state.wordsPerChunk);
    state.index = Math.min(saved.index, Math.max(0, state.chunks.length - 1));
    state.copied = new Set(saved.copied);
  }

  wireEvents();
  renderInput();
}

init();
