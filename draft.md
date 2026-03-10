# OSRP v1 — Open Spaced Repetition Protocol

**Status:** Draft
**Version:** 1.0.0-draft

---

## 1. Introduction

### 1.1 Purpose

OSRP (Open Spaced Repetition Protocol) defines a standard interface for exchanging spaced repetition data between content applications and SRS backends over HTTP.

The goal is to decouple **content discovery** from **retention management**. Any application where a user encounters information worth remembering — a reader app, a podcast player, a language tool — should be able to push that content to any compatible SRS server without custom integration work.

### 1.2 Roles

**Client** — An application that captures content and submits it for spaced repetition review. Clients are information providers. They construct cards (front/back pairs) and push them to a server. Clients do not schedule reviews or manage retention.

**Server** — An SRS backend that receives cards, organizes them into decks, schedules reviews, and manages the full retention lifecycle. The server owns the scheduling algorithm and review state.

### 1.3 Design Principles

- **JSON over HTTP/REST.** All communication uses JSON request and response bodies over standard HTTP methods.
- **Client pushes, server schedules.** Clients submit fully-formed cards. Servers decide when and how to present them for review.
- **Algorithm-agnostic.** The protocol does not mandate a scheduling algorithm. Servers may implement SM-2, FSRS, Leitner, or any other approach. Scheduling state is opaque to clients.
- **Source provenance.** Cards carry metadata about where they came from — which client, what URL, surrounding context — so users can trace content back to its origin.
- **Idempotent ingestion.** Clients assign a `client_ref` to each card for deduplication. Submitting the same `client_ref` twice does not create a duplicate card.

---

## 2. Transport

All requests and responses use `Content-Type: application/json`.

Servers MUST listen on HTTPS in production. HTTP MAY be used for local development.

The base URL for all endpoints is:

```
{server_url}/osrp/v1/
```

---

## 3. Authentication

Clients authenticate using Bearer tokens in the `Authorization` header:

```
Authorization: Bearer <token>
```

How tokens are issued, rotated, and revoked is left to the server implementation. Servers MAY use OAuth 2.0, API keys, or any other mechanism that produces Bearer tokens.

Unauthenticated requests MUST receive a `401 Unauthorized` response.

Requests with a valid token but insufficient permissions MUST receive a `403 Forbidden` response.

---

## 4. Core Data Models

### 4.1 Card

A card is the atomic unit of spaced repetition — a single item to be reviewed.

| Field | Type | Description |
|---|---|---|
| `id` | string | Server-assigned unique identifier. Read-only. |
| `deck_id` | string | ID of the deck this card belongs to. |
| `front` | string | The prompt or question. |
| `back` | string | The answer or information to recall. |
| `content_format` | string | Format of `front` and `back` fields. One of: `text`, `markdown`. Default `text`. |
| `client_ref` | string | Client-assigned identifier for deduplication. Unique per user. |
| `source` | object | Provenance metadata. See Source object below. |
| `tags` | string[] | User-defined tags for organization. |
| `scheduling` | object | Server-managed scheduling state. Read-only to clients. See Scheduling object below. |
| `suspended` | boolean | Whether the card is excluded from review. Default `false`. |
| `created_at` | string | ISO 8601 timestamp. Read-only. |
| `updated_at` | string | ISO 8601 timestamp. Read-only. |

#### Source Object

| Field | Type | Description |
|---|---|---|
| `client_id` | string | Identifier of the client application that created this card. |
| `url` | string \| null | URL of the source content, if applicable. |
| `title` | string \| null | Title of the source content. |
| `context` | string \| null | Surrounding text or additional context from the source. |

#### Scheduling Object

The scheduling object is server-managed and opaque to clients. Servers include it in card responses so that clients can display scheduling information, but clients MUST NOT modify it.

| Field | Type | Description |
|---|---|---|
| `state` | string | One of: `new`, `learning`, `review`, `relearning`. |
| `due_at` | string \| null | ISO 8601 timestamp of when the card is next due. `null` if not yet scheduled. |
| `stability` | number \| null | Server-specific measure of memory stability. Optional. |
| `difficulty` | number \| null | Server-specific measure of card difficulty. Optional. |
| `lapses` | integer | Number of times the card was forgotten (rated `again` after reaching `review` state). |
| `reps` | integer | Total number of reviews completed for this card. |

### 4.2 Deck

A deck is a named collection of cards.

| Field | Type | Description |
|---|---|---|
| `id` | string | Server-assigned unique identifier. Read-only. |
| `name` | string | Display name of the deck. |
| `description` | string | Optional description. |
| `new_cards_per_day` | integer | Maximum number of new cards to introduce per day. Server default if omitted. |
| `card_count` | integer | Total number of cards in the deck. Read-only. |
| `due_count` | integer | Number of cards currently due for review. Read-only. |
| `created_at` | string | ISO 8601 timestamp. Read-only. |
| `updated_at` | string | ISO 8601 timestamp. Read-only. |

### 4.3 Review

A review records a single rating event for a card.

| Field | Type | Description |
|---|---|---|
| `id` | string | Server-assigned unique identifier. Read-only. |
| `card_id` | string | ID of the card that was reviewed. |
| `session_id` | string \| null | ID of the review session this belongs to, if any. |
| `rating` | string | One of: `again`, `hard`, `good`, `easy`. See Rating Scale below. |
| `duration_ms` | integer \| null | Time in milliseconds the user spent on this review. Optional. |
| `created_at` | string | ISO 8601 timestamp. Read-only. |

### 4.4 ReviewSession

A review session groups a sequence of reviews into a single study session.

| Field | Type | Description |
|---|---|---|
| `id` | string | Server-assigned unique identifier. Read-only. |
| `deck_id` | string \| null | Deck being reviewed, or `null` for cross-deck sessions. |
| `status` | string | One of: `active`, `completed`. |
| `cards_reviewed` | integer | Number of cards reviewed in this session. Read-only. |
| `started_at` | string | ISO 8601 timestamp. Read-only. |
| `ended_at` | string \| null | ISO 8601 timestamp. `null` while `active`. Read-only. |

---

## 5. Review Rating Scale

OSRP uses a 4-point rating scale. The server maps these ratings to its internal scheduling algorithm.

| Rating | Meaning | User intent |
|---|---|---|
| `again` | Complete failure to recall. | "I didn't know this." |
| `hard` | Recalled with significant difficulty. | "I got it but it was a struggle." |
| `good` | Recalled with acceptable effort. | "I knew this." |
| `easy` | Recalled instantly with no effort. | "This was trivial." |

### Algorithm Mapping Reference

The protocol does not mandate a specific algorithm, but for reference:

| OSRP Rating | SM-2 Quality | FSRS Rating | Leitner Action |
|---|---|---|---|
| `again` | 0–1 | Again (1) | Move to Box 1 |
| `hard` | 2–3 | Hard (2) | Stay in current box |
| `good` | 4 | Good (3) | Advance one box |
| `easy` | 5 | Easy (4) | Advance two boxes |

---

## 6. API Endpoints

All endpoints are relative to the base URL `{server_url}/osrp/v1/`.

### 6.1 Server Discovery

#### `GET /osrp/v1/`

Returns server metadata and capabilities.

**Response `200 OK`:**

```json
{
  "protocol": "osrp",
  "version": "1.0.0",
  "server": {
    "name": "Example SRS",
    "version": "2.4.1"
  },
  "scheduling_algorithm": "fsrs",
  "capabilities": ["batch_create", "review_sessions"]
}
```

| Field | Type | Description |
|---|---|---|
| `protocol` | string | Always `"osrp"`. |
| `version` | string | Protocol version the server implements. |
| `server.name` | string | Human-readable server name. |
| `server.version` | string | Server software version. |
| `scheduling_algorithm` | string | Identifier for the scheduling algorithm in use. Informational only. |
| `capabilities` | string[] | Optional list of supported optional features. |

---

### 6.2 Cards

#### `POST /osrp/v1/cards`

Create a new card.

**Request:**

```json
{
  "deck_id": "dk_abc123",
  "front": "What is spaced repetition?",
  "back": "A learning technique that reviews material at increasing intervals to exploit the spacing effect.",
  "client_ref": "reader-app:highlight:9f3a2b",
  "source": {
    "client_id": "com.example.reader",
    "url": "https://example.com/article/spaced-repetition",
    "title": "Introduction to Spaced Repetition",
    "context": "...the spacing effect, first identified by Ebbinghaus in 1885, demonstrates that..."
  },
  "tags": ["learning", "psychology"]
}
```

**Response `201 Created`:**

Returns the full Card object with server-assigned `id`, `scheduling`, and timestamps.

**Deduplication:** If a card with the same `client_ref` already exists for this user, the server MUST return `409 Conflict` with the existing card in the `details` field.

---

#### `POST /osrp/v1/cards/batch`

Create multiple cards in a single request.

**Request:**

```json
{
  "cards": [
    {
      "deck_id": "dk_abc123",
      "front": "Question 1",
      "back": "Answer 1",
      "client_ref": "ref-001"
    },
    {
      "deck_id": "dk_abc123",
      "front": "Question 2",
      "back": "Answer 2",
      "client_ref": "ref-002"
    }
  ]
}
```

**Response `200 OK`:**

```json
{
  "created": [ { /* Card object */ }, { /* Card object */ } ],
  "duplicates": [],
  "errors": []
}
```

| Field | Type | Description |
|---|---|---|
| `created` | Card[] | Successfully created cards. |
| `duplicates` | object[] | Cards skipped due to `client_ref` conflict. Each entry contains `client_ref` and the existing `card`. |
| `errors` | object[] | Cards that failed for other reasons. Each entry contains `client_ref` and `error`. |

The server processes each card independently. Partial success is expected — some cards may be created while others are duplicates or errors. The server MUST NOT treat the batch as an atomic transaction.

---

#### `GET /osrp/v1/cards/{card_id}`

Retrieve a single card by ID.

**Response `200 OK`:** Full Card object.

**Response `404 Not Found`:** Card does not exist or does not belong to the authenticated user.

---

#### `PATCH /osrp/v1/cards/{card_id}`

Update a card. Only include fields to change.

Clients MAY update: `front`, `back`, `deck_id`, `tags`, `suspended`.

Clients MUST NOT update: `id`, `client_ref`, `source`, `scheduling`, `created_at`, `updated_at`.

**Request:**

```json
{
  "front": "Updated question text",
  "tags": ["learning", "psychology", "memory"]
}
```

**Response `200 OK`:** Full updated Card object.

---

#### `DELETE /osrp/v1/cards/{card_id}`

Delete a card permanently.

**Response `204 No Content`.**

---

#### `GET /osrp/v1/cards`

List cards with optional filters.

**Query Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `deck_id` | string | Filter by deck. |
| `client_ref` | string | Filter by client-assigned reference. Returns at most one card. |
| `state` | string | Filter by scheduling state: `new`, `learning`, `review`, `relearning`. |
| `suspended` | boolean | Filter by suspended status. |
| `tag` | string | Filter by tag. May be repeated for AND logic. |
| `cursor` | string | Pagination cursor from a previous response. |
| `limit` | integer | Maximum number of results. Default 50, maximum 200. |

**Response `200 OK`:**

```json
{
  "data": [ { /* Card */ }, { /* Card */ } ],
  "cursor": "eyJpZCI6ImNkXzk4NyJ9",
  "has_more": true
}
```

---

### 6.3 Decks

#### `POST /osrp/v1/decks`

Create a new deck.

**Request:**

```json
{
  "name": "Spanish Vocabulary",
  "description": "Words from my reading sessions",
  "new_cards_per_day": 20
}
```

**Response `201 Created`:** Full Deck object.

---

#### `GET /osrp/v1/decks`

List all decks.

**Query Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `cursor` | string | Pagination cursor. |
| `limit` | integer | Maximum results. Default 50, maximum 200. |

**Response `200 OK`:**

```json
{
  "data": [ { /* Deck */ }, { /* Deck */ } ],
  "cursor": null,
  "has_more": false
}
```

---

#### `GET /osrp/v1/decks/{deck_id}`

Retrieve a single deck.

**Response `200 OK`:** Full Deck object.

---

#### `PATCH /osrp/v1/decks/{deck_id}`

Update a deck. Only include fields to change.

Clients MAY update: `name`, `description`, `new_cards_per_day`.

**Response `200 OK`:** Full updated Deck object.

---

#### `DELETE /osrp/v1/decks/{deck_id}`

Delete a deck. The server MUST decide how to handle cards in the deleted deck (move to a default deck, delete them, etc.) and document this behavior.

**Response `204 No Content`.**

---

### 6.4 Due Cards

#### `GET /osrp/v1/cards/due`

Get cards that are due for review.

**Query Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `deck_id` | string | Filter by deck. If omitted, returns due cards across all decks. |
| `limit` | integer | Maximum number of cards to return. Default 20, maximum 100. |

**Response `200 OK`:**

```json
{
  "data": [ { /* Card */ }, { /* Card */ } ],
  "total_due": 42
}
```

| Field | Type | Description |
|---|---|---|
| `data` | Card[] | Cards due for review, ordered by the server's scheduling algorithm. |
| `total_due` | integer | Total number of cards currently due (may exceed `limit`). |

---

### 6.5 Reviews

#### `POST /osrp/v1/reviews`

Submit a single review.

**Request:**

```json
{
  "card_id": "cd_xyz789",
  "rating": "good",
  "session_id": "rs_session1",
  "duration_ms": 4500
}
```

**Response `201 Created`:**

```json
{
  "review": { /* Review object */ },
  "card": { /* Updated Card object with new scheduling state */ }
}
```

The response includes the updated card so the client can see the next due date and updated scheduling state without an additional request.

---

#### `POST /osrp/v1/reviews/batch`

Submit multiple reviews in a single request.

**Request:**

```json
{
  "reviews": [
    { "card_id": "cd_001", "rating": "good", "session_id": "rs_session1", "duration_ms": 3200 },
    { "card_id": "cd_002", "rating": "again", "session_id": "rs_session1", "duration_ms": 8100 },
    { "card_id": "cd_003", "rating": "easy", "session_id": "rs_session1", "duration_ms": 1500 }
  ]
}
```

**Response `200 OK`:**

```json
{
  "results": [
    { "review": { /* Review */ }, "card": { /* Updated Card */ } },
    { "review": { /* Review */ }, "card": { /* Updated Card */ } },
    { "review": { /* Review */ }, "card": { /* Updated Card */ } }
  ],
  "errors": []
}
```

The server MUST process reviews in the order they appear in the array, since each review may change the scheduling state that affects subsequent reviews of the same card. The server MUST NOT treat the batch as an atomic transaction — partial success is expected. Each result in the `results` array corresponds to the review at the same index in the request.

---

#### `GET /osrp/v1/reviews`

Get review history.

**Query Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `card_id` | string | Filter reviews for a specific card. |
| `session_id` | string | Filter reviews for a specific session. |
| `since` | string | ISO 8601 timestamp. Only return reviews created at or after this time. |
| `until` | string | ISO 8601 timestamp. Only return reviews created before this time. |
| `cursor` | string | Pagination cursor. |
| `limit` | integer | Maximum results. Default 50, maximum 200. |

**Response `200 OK`:**

```json
{
  "data": [ { /* Review */ }, { /* Review */ } ],
  "cursor": "eyJpZCI6InJ2XzEyMyJ9",
  "has_more": true
}
```

---

### 6.6 Review Sessions

#### `POST /osrp/v1/sessions`

Start a new review session.

**Request:**

```json
{
  "deck_id": "dk_abc123"
}
```

`deck_id` is optional. Omit for a cross-deck session.

**Response `201 Created`:** Full ReviewSession object with `status: "active"`.

---

#### `GET /osrp/v1/sessions/{session_id}`

Get a review session by ID.

**Response `200 OK`:** Full ReviewSession object.

---

#### `POST /osrp/v1/sessions/{session_id}/end`

End an active review session.

**Response `200 OK`:** Full ReviewSession object with `status: "completed"` and `ended_at` set.

**Response `409 Conflict`:** Session is already completed.

---

#### `GET /osrp/v1/sessions`

List review sessions.

**Query Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `status` | string | Filter by `active` or `completed`. |
| `deck_id` | string | Filter by deck. |
| `cursor` | string | Pagination cursor. |
| `limit` | integer | Maximum results. Default 50, maximum 200. |

**Response `200 OK`:**

```json
{
  "data": [ { /* ReviewSession */ }, { /* ReviewSession */ } ],
  "cursor": null,
  "has_more": false
}
```

---

## 7. Error Format

All error responses use a consistent format:

```json
{
  "error": {
    "code": "card_not_found",
    "message": "No card exists with ID cd_xyz789.",
    "status": 404,
    "details": null,
    "request_id": "req_a1b2c3d4"
  }
}
```

| Field | Type | Description |
|---|---|---|
| `code` | string | Machine-readable error code. |
| `message` | string | Human-readable description. |
| `status` | integer | HTTP status code (mirrored in the response status and body for convenience). |
| `details` | object \| null | Additional structured data. Context-dependent. |
| `request_id` | string | Unique identifier for this request, useful for debugging and support. |

### Standard Error Codes

| Code | Status | Description |
|---|---|---|
| `bad_request` | 400 | Malformed JSON or missing required fields. |
| `unauthorized` | 401 | Missing or invalid authentication token. |
| `forbidden` | 403 | Valid token but insufficient permissions. |
| `not_found` | 404 | Requested resource does not exist. |
| `conflict` | 409 | Resource already exists (e.g., duplicate `client_ref`). |
| `unprocessable_entity` | 422 | Valid JSON but semantically invalid (e.g., unknown `deck_id`). |
| `rate_limited` | 429 | Too many requests. Response includes `Retry-After` header. |
| `internal_error` | 500 | Unexpected server error. |

---

## 8. Pagination

All list endpoints use cursor-based pagination.

**Request:** Pass `cursor` and `limit` as query parameters.

**Response:** Each paginated response includes:

| Field | Type | Description |
|---|---|---|
| `data` | array | The results for this page. |
| `cursor` | string \| null | Opaque cursor for the next page. `null` if no more results. |
| `has_more` | boolean | `true` if more results are available beyond this page. |

To fetch the next page, pass the returned `cursor` value as the `cursor` query parameter in the next request. Cursors are opaque strings — clients MUST NOT parse or construct them.

---

## 9. Versioning

The protocol version is embedded in the URL path:

```
/osrp/v1/cards
/osrp/v1/decks
```

Breaking changes require a new version (`v2`, `v3`, etc.). Non-breaking additions (new optional fields, new endpoints) may be introduced within a version.

Servers SHOULD support at least one prior version during a deprecation period and communicate deprecation via a `Deprecation` response header.

---

## 10. Minimum Viable Client Flow

A client can integrate with OSRP using just 4 endpoints:

### Step 1: Discover the server

```
GET /osrp/v1/
```

Verify the server supports OSRP and check the protocol version.

### Step 2: Create a deck (or use an existing one)

```
POST /osrp/v1/decks
{ "name": "Highlights from Reader App" }
```

Or list existing decks with `GET /osrp/v1/decks` and pick one.

### Step 3: Push cards

```
POST /osrp/v1/cards
{
  "deck_id": "dk_abc123",
  "front": "What is the spacing effect?",
  "back": "The finding that information is better retained when study sessions are spaced out over time.",
  "client_ref": "reader:highlight:abc123",
  "source": {
    "client_id": "com.example.reader",
    "url": "https://example.com/article"
  }
}
```

The client's job is done. The server handles scheduling from here.

### Step 4 (optional): Check card status

```
GET /osrp/v1/cards/{card_id}
```

If the client wants to show the user when a card is next due or how many reviews it has had.

---

## 11. Future Considerations

The following features are **out of scope for v1** but may be addressed in future versions:

- **Media attachments.** Support for images, audio, and video on card faces. v1 is text/Markdown only.
- **Card templates.** Server-defined templates (e.g., cloze deletion, type-the-answer) that clients can populate with fields rather than constructing front/back directly.
- **Real-time sync.** WebSocket or SSE-based push for syncing card state changes across multiple clients in real time.
- **Webhooks.** Server-to-client callbacks for events like "card due" or "review streak reached."
- **Import/export.** Bulk data exchange formats for migration between servers (Anki `.apkg` compatibility, etc.).
- **Collaborative decks.** Shared decks with multiple contributors and permissions.
- **Statistics API.** Endpoints for retention curves, review heatmaps, and forecasting.

---

## Appendix A: Endpoint Summary

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/osrp/v1/` | Server discovery |
| `POST` | `/osrp/v1/cards` | Create a card |
| `POST` | `/osrp/v1/cards/batch` | Create multiple cards |
| `GET` | `/osrp/v1/cards` | List cards |
| `GET` | `/osrp/v1/cards/{card_id}` | Get a card |
| `PATCH` | `/osrp/v1/cards/{card_id}` | Update a card |
| `DELETE` | `/osrp/v1/cards/{card_id}` | Delete a card |
| `GET` | `/osrp/v1/cards/due` | Get due cards |
| `POST` | `/osrp/v1/decks` | Create a deck |
| `GET` | `/osrp/v1/decks` | List decks |
| `GET` | `/osrp/v1/decks/{deck_id}` | Get a deck |
| `PATCH` | `/osrp/v1/decks/{deck_id}` | Update a deck |
| `DELETE` | `/osrp/v1/decks/{deck_id}` | Delete a deck |
| `POST` | `/osrp/v1/reviews` | Submit a review |
| `POST` | `/osrp/v1/reviews/batch` | Submit multiple reviews |
| `GET` | `/osrp/v1/reviews` | Review history |
| `POST` | `/osrp/v1/sessions` | Start a session |
| `GET` | `/osrp/v1/sessions/{session_id}` | Get a session |
| `POST` | `/osrp/v1/sessions/{session_id}/end` | End a session |
| `GET` | `/osrp/v1/sessions` | List sessions |
