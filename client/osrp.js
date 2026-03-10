/**
 * OSRP v1 Client — Minimal protocol client for the Open Spaced Repetition Protocol.
 *
 * Implements the "Minimum Viable Client Flow" from the spec:
 *   1. Server discovery
 *   2. Create / list decks
 *   3. Push cards with source provenance
 */

const CLIENT_ID = "osrp-pdf-reader";

export class OSRPClient {
  /**
   * @param {string} serverUrl - Base URL of the OSRP server (e.g. "https://srs.example.com")
   * @param {string} token     - Bearer token for authentication
   */
  constructor(serverUrl, token) {
    this.baseUrl = serverUrl.replace(/\/+$/, "") + "/osrp/v1";
    this.token = token;
  }

  // ── helpers ────────────────────────────────────────────────────────

  async _request(method, path, body) {
    const url = `${this.baseUrl}${path}`;
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.token}`,
    };

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 204) return null;

    const json = await res.json();

    if (!res.ok) {
      const err = new Error(json.error?.message ?? `HTTP ${res.status}`);
      err.status = res.status;
      err.code = json.error?.code;
      err.details = json.error?.details;
      throw err;
    }

    return json;
  }

  // ── server discovery ───────────────────────────────────────────────

  /** GET /osrp/v1/ */
  async discover() {
    return this._request("GET", "/");
  }

  // ── decks ──────────────────────────────────────────────────────────

  /** GET /osrp/v1/decks */
  async listDecks() {
    return this._request("GET", "/decks");
  }

  /** POST /osrp/v1/decks */
  async createDeck(name, description = "") {
    return this._request("POST", "/decks", { name, description });
  }

  // ── cards ──────────────────────────────────────────────────────────

  /**
   * POST /osrp/v1/cards
   *
   * Pushes a single card derived from a PDF highlight.
   *
   * @param {object} opts
   * @param {string} opts.deckId
   * @param {string} opts.front       - The highlighted text (prompt)
   * @param {string} opts.back        - User-supplied answer / note
   * @param {string} opts.clientRef   - Deterministic dedup key
   * @param {string} [opts.sourceUrl] - URL / path of the PDF
   * @param {string} [opts.title]     - Title of the PDF document
   * @param {string} [opts.context]   - Surrounding text for provenance
   * @param {string[]} [opts.tags]
   */
  async createCard({
    deckId,
    front,
    back,
    clientRef,
    sourceUrl = null,
    title = null,
    context = null,
    tags = [],
  }) {
    return this._request("POST", "/cards", {
      deck_id: deckId,
      front,
      back,
      content_format: "text",
      client_ref: clientRef,
      source: {
        client_id: CLIENT_ID,
        url: sourceUrl,
        title,
        context,
      },
      tags,
    });
  }

  /** POST /osrp/v1/cards/batch */
  async createCardsBatch(cards) {
    return this._request("POST", "/cards/batch", { cards });
  }

  /** GET /osrp/v1/cards/:id */
  async getCard(cardId) {
    return this._request("GET", `/cards/${encodeURIComponent(cardId)}`);
  }

  /** GET /osrp/v1/cards */
  async listCards(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this._request("GET", `/cards${qs ? "?" + qs : ""}`);
  }
}
