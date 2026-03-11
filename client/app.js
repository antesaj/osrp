import { OSRPClient } from "./osrp.js";
import { sampleDocument } from "./sample-content.js";

// ── state ──────────────────────────────────────────────────────────

let pdfDoc = null;
let currentScale = 1.5;
let highlights = []; // { id, text, page, pushedAt }
let osrpClient = null;
let deckId = null;
let docTitle = "";

// ── DOM refs ───────────────────────────────────────────────────────

const fileInput = document.getElementById("file-input");
const openBtn = document.getElementById("open-btn");
const sampleBtn = document.getElementById("sample-btn");
const zoomInBtn = document.getElementById("zoom-in");
const zoomOutBtn = document.getElementById("zoom-out");
const pageInfo = document.getElementById("page-info");
const viewer = document.getElementById("viewer");
const highlightsList = document.getElementById("highlights-list");
const serverUrlInput = document.getElementById("server-url");
const tokenInput = document.getElementById("token");
const deckSelect = document.getElementById("deck-select");
const connectBtn = document.getElementById("connect-btn");

// ── sample document rendering ──────────────────────────────────────

function renderSampleDocument() {
  pdfDoc = null;
  docTitle = sampleDocument.title;
  viewer.innerHTML = "";

  const pages = sampleDocument.pages;
  pageInfo.textContent = `${pages.length} page${pages.length > 1 ? "s" : ""}`;

  pages.forEach((page, index) => {
    const container = document.createElement("div");
    container.className = "page-container doc-page";
    container.dataset.page = index + 1;

    const content = document.createElement("div");
    content.className = "doc-content";

    if (index === 0) {
      const docHeader = document.createElement("div");
      docHeader.className = "doc-header";
      docHeader.innerHTML = `<span class="doc-badge">SAMPLE DOCUMENT</span>`;
      content.appendChild(docHeader);
    }

    const h = document.createElement("h2");
    h.textContent = page.heading;
    content.appendChild(h);

    for (const para of page.paragraphs) {
      const p = document.createElement("p");
      p.textContent = para;
      content.appendChild(p);
    }

    const footer = document.createElement("div");
    footer.className = "doc-footer";
    footer.textContent = `${index + 1} / ${pages.length}`;
    content.appendChild(footer);

    container.appendChild(content);
    viewer.appendChild(container);
  });
}

// ── PDF loading ────────────────────────────────────────────────────

openBtn.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  docTitle = file.name;
  const arrayBuffer = await file.arrayBuffer();
  const typedArray = new Uint8Array(arrayBuffer);

  pdfDoc = await pdfjsLib.getDocument({ data: typedArray }).promise;
  pageInfo.textContent = `${pdfDoc.numPages} page${pdfDoc.numPages > 1 ? "s" : ""}`;

  renderAllPdfPages();
});

async function renderAllPdfPages() {
  viewer.innerHTML = "";

  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const viewport = page.getViewport({ scale: currentScale });

    const container = document.createElement("div");
    container.className = "page-container";
    container.dataset.page = i;
    container.style.width = `${viewport.width}px`;
    container.style.height = `${viewport.height}px`;

    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    await page.render({ canvasContext: ctx, viewport }).promise;

    const textLayerDiv = document.createElement("div");
    textLayerDiv.className = "text-layer";

    const textContent = await page.getTextContent();
    for (const item of textContent.items) {
      const span = document.createElement("span");
      const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
      span.textContent = item.str;
      span.style.left = `${tx[4]}px`;
      span.style.top = `${tx[5] - item.height * currentScale}px`;
      span.style.fontSize = `${item.height * currentScale}px`;
      span.style.fontFamily = item.fontName || "sans-serif";
      textLayerDiv.appendChild(span);
    }

    container.appendChild(canvas);
    container.appendChild(textLayerDiv);
    viewer.appendChild(container);
  }
}

// ── zoom (PDF only) ────────────────────────────────────────────────

zoomInBtn.addEventListener("click", () => {
  if (!pdfDoc) return;
  currentScale = Math.min(currentScale + 0.25, 4);
  renderAllPdfPages();
});

zoomOutBtn.addEventListener("click", () => {
  if (!pdfDoc) return;
  currentScale = Math.max(currentScale - 0.25, 0.5);
  renderAllPdfPages();
});

// ── text selection → highlight ─────────────────────────────────────

document.addEventListener("mouseup", () => {
  const selection = window.getSelection();
  const text = selection?.toString().trim();
  if (!text) return;

  // Ignore selections inside sidebar / toolbar / modals
  const anchorNode = selection.anchorNode;
  if (anchorNode?.parentElement?.closest?.("#sidebar, #toolbar, .modal-overlay")) return;

  const pageContainer = anchorNode?.parentElement?.closest?.(".page-container");
  const page = pageContainer ? parseInt(pageContainer.dataset.page, 10) : null;

  addHighlight(text, page);
  selection.removeAllRanges();
});

function addHighlight(text, page) {
  const id = `hl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const highlight = { id, text, page, pushedAt: null };
  highlights.push(highlight);
  renderHighlightCard(highlight);
}

function renderHighlightCard(highlight) {
  const card = document.createElement("div");
  card.className = "highlight-card";
  card.id = `highlight-${highlight.id}`;

  const pageLabel = highlight.page ? `Page ${highlight.page}` : "Unknown page";

  card.innerHTML = `
    <div class="highlight-text">${escapeHtml(highlight.text)}</div>
    <div class="highlight-page">${pageLabel}</div>
    <div class="highlight-actions">
      <button class="push-btn" data-id="${highlight.id}">Push to SRS</button>
      <button class="remove-btn" data-id="${highlight.id}">Remove</button>
    </div>
  `;

  card.querySelector(".push-btn").addEventListener("click", () => openPushModal(highlight));
  card.querySelector(".remove-btn").addEventListener("click", () => removeHighlight(highlight.id));

  highlightsList.appendChild(card);
}

function removeHighlight(id) {
  highlights = highlights.filter((h) => h.id !== id);
  document.getElementById(`highlight-${id}`)?.remove();
}

// ── push-to-SRS modal ──────────────────────────────────────────────

function openPushModal(highlight) {
  if (highlight.pushedAt) return;

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  overlay.innerHTML = `
    <div class="modal">
      <h3>Create Card</h3>
      <label for="modal-front">Front (question / cue)</label>
      <textarea id="modal-front">${escapeHtml(highlight.text)}</textarea>
      <label for="modal-back">Back (answer / note)</label>
      <textarea id="modal-back"></textarea>
      <label for="modal-tags">Tags (comma-separated)</label>
      <input type="text" id="modal-tags" placeholder="pdf, chapter-1" />
      <div class="modal-actions">
        <button class="cancel-btn">Cancel</button>
        <button class="primary submit-btn">Push Card</button>
      </div>
    </div>
  `;

  overlay.querySelector(".cancel-btn").addEventListener("click", () => overlay.remove());
  overlay.querySelector(".submit-btn").addEventListener("click", async () => {
    const front = overlay.querySelector("#modal-front").value.trim();
    const back = overlay.querySelector("#modal-back").value.trim();
    const tagsRaw = overlay.querySelector("#modal-tags").value.trim();
    const tags = tagsRaw ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean) : [];

    if (!front) return;

    await pushCard(highlight, front, back, tags);
    overlay.remove();
  });

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });

  document.body.appendChild(overlay);
}

async function pushCard(highlight, front, back, tags) {
  if (!osrpClient || !deckId) {
    alert("Connect to an OSRP server and select a deck first (see sidebar settings).");
    return;
  }

  const clientRef = `${CLIENT_ID_PREFIX}:${highlight.id}`;

  try {
    await osrpClient.createCard({
      deckId,
      front,
      back: back || "(no answer provided)",
      clientRef,
      sourceUrl: null,
      title: docTitle || null,
      context: highlight.text.slice(0, 200),
      tags,
    });

    highlight.pushedAt = new Date().toISOString();
    markAsPushed(highlight.id);
  } catch (err) {
    if (err.status === 409) {
      highlight.pushedAt = "duplicate";
      markAsPushed(highlight.id);
    } else {
      alert(`Failed to push card: ${err.message}`);
    }
  }
}

const CLIENT_ID_PREFIX = "osrp-pdf-reader";

function markAsPushed(id) {
  const btn = document.querySelector(`#highlight-${id} .push-btn`);
  if (btn) {
    btn.textContent = "Pushed";
    btn.classList.add("pushed");
  }
}

// ── OSRP connection ────────────────────────────────────────────────

connectBtn.addEventListener("click", async () => {
  const serverUrl = serverUrlInput.value.trim();
  const token = tokenInput.value.trim();

  if (!serverUrl || !token) {
    alert("Enter a server URL and token.");
    return;
  }

  osrpClient = new OSRPClient(serverUrl, token);

  try {
    const info = await osrpClient.discover();
    if (info.protocol !== "osrp") {
      alert("Server did not return a valid OSRP discovery response.");
      osrpClient = null;
      return;
    }

    const res = await osrpClient.listDecks();
    deckSelect.innerHTML = '<option value="">-- select deck --</option>';
    for (const deck of res.data) {
      const opt = document.createElement("option");
      opt.value = deck.id;
      opt.textContent = deck.name;
      deckSelect.appendChild(opt);
    }

    connectBtn.textContent = "Connected";
  } catch (err) {
    alert(`Connection failed: ${err.message}`);
    osrpClient = null;
  }
});

deckSelect.addEventListener("change", () => {
  deckId = deckSelect.value || null;
});

// ── helpers ────────────────────────────────────────────────────────

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ── load sample on click + auto-load on startup ────────────────────

sampleBtn.addEventListener("click", () => renderSampleDocument());

// Auto-load sample document so the app isn't empty on first visit
renderSampleDocument();
