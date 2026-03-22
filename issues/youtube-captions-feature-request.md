# Feature Request: Search Enhancements for youtube-captions

## Context

We use `@neurelectra/youtube-captions` as the YouTube integration layer for a language learning app. The main workflow is: user searches for a topic → we call `searchVideos` → fetch details per video to filter by duration/language/age-restriction → display results. This works well but has two pain points: **quota cost** (N+1 API calls per search) and **no pagination**.

---

## 1. Pagination support for `searchVideos`

**Problem:** `searchVideos` returns a flat array with no way to fetch the next page. Users want to see more results beyond the initial batch.

**Proposal:** Add `pageToken` to `SearchOptions` and return `nextPageToken` in the response.

```typescript
// SearchOptions addition
pageToken?: string;

// Return type change: SearchResult[] → SearchResponse
interface SearchResponse {
    results: SearchResult[];
    nextPageToken: string | null;
}
```

The YouTube `search.list` API already returns `nextPageToken` — this just exposes it.

**Breaking change note:** Return type changes from `SearchResult[]` to `SearchResponse`. Could be opt-in via a flag, or a new function like `searchVideosPaginated`, to avoid breaking existing consumers.

---

## 2. Batch `getVideoContentDetails`

**Problem:** After `searchVideos` returns 10-20 results, we call `getVideoContentDetails` once per video in parallel. That's 10-20 API calls (10-20 quota units) when the YouTube `videos.list` endpoint accepts up to 50 comma-separated IDs in a single call (1 quota unit).

**Proposal:** Accept an array of video IDs:

```typescript
function getVideoContentDetails(
    videoId: string | string[],
    options?: ContentDetailsOptions
): Promise<VideoContentDetails | VideoContentDetails[]>;
```

When passed an array, make a single `videos.list?part=contentDetails,snippet,status&id=id1,id2,...` call. Return results in the same order as the input array.

This alone would reduce our per-search quota cost from ~12 units to ~2 units (1 search + 1 batch details).

---

## 3. Enrich `SearchResult` with snippet/details fields

**Problem:** We fetch `getVideoContentDetails` for every search result just to read `durationSeconds`, `defaultAudioLanguage`, and `isAgeRestricted`. If these were on `SearchResult`, we wouldn't need the second call at all for basic filtering.

**Proposal:** Add an option to `searchVideos` that automatically enriches results with content details:

```typescript
// SearchOptions addition
includeContentDetails?: boolean;

// SearchResult additions (present when includeContentDetails is true)
interface SearchResult {
    // ... existing fields ...
    durationSeconds?: number;
    defaultAudioLanguage?: string | null;
    isAgeRestricted?: boolean;
    viewCount?: number;
}
```

When `includeContentDetails: true`, the library would internally do a batch `videos.list` call after the search and merge the fields. This is the ideal API for consumers — one call, fully enriched results.

---

## 4. Lightweight caption track listing

**Problem:** `getVideoTranscript` is the only way to see what caption tracks a video has (`availableTracks`), but it also downloads the full transcript text. Sometimes we just want to check if a video has captions in a specific language before committing to full processing.

**Proposal:**

```typescript
function listCaptionTracks(
    videoId: string,
    options?: { httpsAgent?: object | object[] }
): Promise<CaptionTrack[]>;
```

This would make the InnerTube call but return only `availableTracks` without fetching/joining segment text. No API key needed (same as `getVideoTranscript`).

---

## Priority

From our perspective:

1. **Batch `getVideoContentDetails`** — biggest immediate impact (quota savings)
2. **`pageToken` on `searchVideos`** — enables proper pagination
3. **Enriched `SearchResult`** — eliminates the details call entirely
4. **`listCaptionTracks`** — nice to have for pre-validation

Happy to help test or contribute PRs if useful.
