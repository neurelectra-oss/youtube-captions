# Feature Request: `searchVideos()` for @neurelectra/youtube-captions

## Context

The library already provides `getChannelVideos()` using the YouTube Data API v3 to list a channel's recent uploads. We need a similar function to **search YouTube** by query, with optional language and topic filters.

## Use Case

Rabbithole's admin crawling system allows administrators to discover new videos for language learning lesson generation. Admins define a search query (e.g. "technology documentaries in Spanish") and a target language. The system should search YouTube, return matching videos, and let the admin approve them for processing.

Currently there is no programmatic way to search YouTube through the library — only channel listing is supported.

## Proposed API

```ts
export interface SearchOptions {
    /** Maximum number of results to return (1-50). Default: 10 */
    maxResults?: number;
    /**
     * YouTube Data API v3 key. Falls back to process.env.YOUTUBE_API_KEY.
     * Throws 'YOUTUBE_API_KEY_REQUIRED' if neither is available.
     */
    apiKey?: string;
    /**
     * BCP-47 language code to filter results by relevance language (e.g. 'es', 'fr').
     * Maps to the `relevanceLanguage` parameter of the YouTube search API.
     */
    relevanceLanguage?: string;
    /**
     * ISO 3166-1 alpha-2 country code to restrict results to a region (e.g. 'ES', 'FR').
     * Maps to the `regionCode` parameter.
     */
    regionCode?: string;
    /**
     * Video duration filter: 'short' (<4min), 'medium' (4-20min), 'long' (>20min), 'any'.
     * Maps to the `videoDuration` parameter.
     */
    videoDuration?: 'any' | 'short' | 'medium' | 'long';
    /**
     * Sort order: 'relevance' (default), 'date', 'viewCount', 'rating'.
     * Maps to the `order` parameter.
     */
    order?: 'relevance' | 'date' | 'viewCount' | 'rating';
    /**
     * Optional topic ID from YouTube's Freebase topic taxonomy.
     * Example: '/m/02mjmr' = Education
     * Maps to the `topicId` parameter.
     */
    topicId?: string;
    /**
     * Filter by closed caption availability. Default: undefined (no filter).
     * 'closedCaption' = only videos with captions; 'none' = only without.
     * Maps to the `videoCaption` parameter.
     */
    videoCaption?: 'any' | 'closedCaption' | 'none';
    /** Pino-style logger callback */
    logger?: (level: 'debug' | 'info' | 'warn' | 'error', context: object, msg: string) => void;
}

export interface SearchResult {
    videoId: string;
    url: string;
    title: string;
    description: string;
    channelId: string;
    channelTitle: string;
    thumbnailUrl: string;
    publishedAt: string | null;
}

/**
 * Search YouTube videos using the Data API v3 search.list endpoint.
 * Requires a YouTube Data API v3 key.
 */
export function searchVideos(
    query: string,
    options?: SearchOptions
): Promise<SearchResult[]>;
```

## YouTube Data API Details

The implementation would call the [search.list](https://developers.google.com/youtube/v3/docs/search/list) endpoint:

```
GET https://www.googleapis.com/youtube/v3/search
  ?part=snippet
  &type=video
  &q={query}
  &maxResults={maxResults}
  &relevanceLanguage={relevanceLanguage}
  &regionCode={regionCode}
  &videoDuration={videoDuration}
  &order={order}
  &topicId={topicId}
  &videoCaption={videoCaption}
  &key={apiKey}
```

The response items have:
```json
{
  "id": { "videoId": "abc123" },
  "snippet": {
    "title": "...",
    "description": "...",
    "channelId": "UCxxx",
    "channelTitle": "...",
    "thumbnails": { "high": { "url": "..." } },
    "publishedAt": "2025-01-01T00:00:00Z"
  }
}
```

Map to `SearchResult` following the same pattern as `getChannelVideos` returns `ChannelVideo`.

## Quota Cost

Each `search.list` call costs **100 quota units** (vs 1 unit for most other endpoints). The default daily quota is 10,000 units. This is important for callers to know — the function doc should mention it.

## Suggested Language Filtering Approach

For language learning, the most useful combination is:
- `relevanceLanguage` — biases results toward videos relevant to speakers of that language
- `videoCaption=closedCaption` — ensures transcripts will be available for lesson generation
- `videoDuration=medium` or `long` — typical lesson-worthy video length

The library could also expose `relevanceLanguage` as a more intuitive `language` alias.

## Consistency with Existing API

The function should follow the same patterns as `getChannelVideos`:
- Same `apiKey` fallback to `process.env.YOUTUBE_API_KEY`
- Same `YOUTUBE_API_KEY_REQUIRED` error when no key is available
- Same logger injection pattern
- Return type follows the `ChannelVideo` structure (with added `channelId` and `channelTitle`)
