/** Options for getVideoMetadata. */
export interface MetadataOptions {
    /**
     * When true, makes an additional YouTube Data API v3 call to check
     * `contentDetails.contentRating.ytRating` and adds `isAgeRestricted` to the result.
     * Requires a YouTube Data API v3 key via `apiKey` or `YOUTUBE_API_KEY` env var.
     */
    includeAgeRestriction?: boolean;
    /**
     * YouTube Data API v3 key used when `includeAgeRestriction` is true.
     * Falls back to `process.env.YOUTUBE_API_KEY` when omitted.
     */
    apiKey?: string;
    /**
     * `https.Agent` (or array) for the oEmbed request. Array members tried in order on network failure.
     */
    httpsAgent?: object | object[];
    /**
     * `https.Agent` (or array) for the Data API request (`includeAgeRestriction`).
     * When omitted, goes direct.
     */
    dataApiHttpsAgent?: object | object[];
}

/** Options for getVideoTranscript. */
export interface TranscriptOptions {
    /**
     * BCP-47 language code to prefer (e.g. 'en', 'pt', 'es').
     * When omitted or null, the video's original language is detected automatically.
     */
    preferredLang?: string | null;
    /**
     * When false (default), throws `'VIDEO_IS_UNLISTED'` if the video is unlisted,
     * preventing unintended processing of content not meant for public distribution.
     * Set to `true` to allow processing unlisted videos.
     * Unlisted status is detected from the InnerTube player response — no API key needed.
     */
    allowUnlisted?: boolean;
    /**
     * When true, resolves the channel that owns the video and adds a `channel`
     * field (`{ id, name }`) to the result. Requires a YouTube Data API v3 key
     * via `apiKey` or the `YOUTUBE_API_KEY` environment variable.
     * Throws `'YOUTUBE_API_KEY_REQUIRED'` if neither is available.
     */
    includeChannel?: boolean;
    /**
     * YouTube Data API v3 key used when `includeChannel` is true.
     * Falls back to `process.env.YOUTUBE_API_KEY` when omitted.
     */
    apiKey?: string;
    /**
     * Optional logger callback following Pino-style (level, context, message).
     * When omitted, the library produces no output.
     */
    logger?: (level: 'debug' | 'info' | 'warn' | 'error', context: object, msg: string) => void;
    /**
     * Node.js `https.Agent` (or array of agents) for InnerTube requests (caption retrieval).
     * When an array is provided, agents are tried in order on network-level failures —
     * useful for proxy rotation or fallback. HTTP errors from YouTube are not retried.
     */
    httpsAgent?: object | object[];
    /**
     * Node.js `https.Agent` (or array of agents) for YouTube Data API v3 requests
     * (used when `includeChannel: true`). When omitted, Data API calls go direct.
     * Kept separate from `httpsAgent` so a residential proxy is never associated
     * with your API key. Supports arrays for fallback.
     */
    dataApiHttpsAgent?: object | object[];
}

/** Options for getChannelVideos. */
export interface ChannelVideosOptions {
    /** Maximum number of videos to return (1-50). Default: 10 */
    maxVideos?: number;
    /**
     * YouTube Data API v3 key. Falls back to process.env.YOUTUBE_API_KEY when omitted.
     * Throws 'YOUTUBE_API_KEY_REQUIRED' if neither is available.
     */
    apiKey?: string;
    /**
     * Optional logger callback following Pino-style (level, context, message).
     * When omitted, the library produces no output.
     */
    logger?: (level: 'debug' | 'info' | 'warn' | 'error', context: object, msg: string) => void;
}

export type ChannelIdentifierType = 'channelId' | 'handle' | 'username' | 'customUrl';

export interface ChannelIdentifier {
    type: ChannelIdentifierType;
    value: string;
}

export interface VideoMetadata {
    videoId: string;
    videoUrl: string;
    title: string;
    authorName: string;
    thumbnailUrl: string;
    /**
     * Present only when `includeAgeRestriction: true` was passed.
     * True if YouTube has flagged the video as age-restricted (18+).
     */
    isAgeRestricted?: boolean;
    /**
     * BCP-47 code of the video's original audio language (e.g. 'en', 'pt').
     * Null if not set by uploader. Present only when `includeAgeRestriction: true`.
     */
    defaultAudioLanguage?: string | null;
    /**
     * BCP-47 code of the video's metadata language (title, description).
     * Null if not set. Present only when `includeAgeRestriction: true`.
     */
    defaultLanguage?: string | null;
    /** Proxy/agent usage info for the oEmbed request. */
    agentInfo: AgentInfo;
}

/** Options for getVideoContentDetails. */
export interface ContentDetailsOptions {
    /**
     * YouTube Data API v3 key. Falls back to process.env.YOUTUBE_API_KEY.
     * Throws 'YOUTUBE_API_KEY_REQUIRED' if neither is available.
     */
    apiKey?: string;
    /**
     * Optional logger callback following Pino-style (level, context, message).
     */
    logger?: (level: 'debug' | 'info' | 'warn' | 'error', context: object, msg: string) => void;
    /**
     * `https.Agent` (or array) for the Data API request. When omitted, goes direct.
     */
    dataApiHttpsAgent?: object | object[];
}

export interface VideoContentDetails {
    videoId: string;
    /** ISO 8601 duration string (e.g. 'PT4M13S'). */
    duration: string;
    /** Total duration in seconds. */
    durationSeconds: number;
    /** Video quality. */
    definition: 'hd' | 'sd';
    /** True if the video has closed captions. */
    hasCaption: boolean;
    /** True if the content is licensed. */
    licensedContent: boolean;
    /** 'rectangular' for standard videos, '360' for 360° videos. */
    projection: string;
    /** True if YouTube has flagged the video as age-restricted (18+). */
    isAgeRestricted: boolean;
    /** 'public', 'unlisted', or 'private'. */
    privacyStatus: 'public' | 'unlisted' | 'private';
    /** True if the video can be embedded on external sites. */
    embeddable: boolean;
    /** True if YouTube has designated this video as made for kids (COPPA). */
    madeForKids: boolean;
    /** BCP-47 code of the video's original audio language (e.g. 'en', 'pt'). Null if not set by uploader. */
    defaultAudioLanguage: string | null;
    /** BCP-47 code of the video's metadata language (title, description). Null if not set. */
    defaultLanguage: string | null;
}

/** Proxy/agent usage info for observability. */
export interface AgentInfo {
    /** Index in the agents array that succeeded, or null if no proxy was used (direct connection). */
    agentIndex: number | null;
    /** Number of agents that failed with network errors before the successful one. */
    fallbacksAttempted: number;
}

export interface TranscriptSegment {
    text: string;
    /** Start time of this segment in milliseconds from the beginning of the video. */
    startMs: number;
    /** Duration of this segment in milliseconds. 0 when timing data is unavailable. */
    durationMs: number;
}

/** A single caption track available for a video. */
export interface CaptionTrack {
    /** BCP-47 language code (e.g. 'en', 'fr', 'pt'). */
    languageCode: string;
    /** Human-readable display name as provided by YouTube (e.g. 'English', 'French'). */
    name: string;
    /** 'asr' for auto-generated captions (always the original audio language); 'standard' for manual. */
    kind: 'standard' | 'asr';
    /** True for the track YouTube identifies as the video's default (original language). */
    isDefault: boolean;
}

export interface TranscriptChannel {
    /** YouTube channel ID (e.g. 'UCxxxxxx'). */
    id: string;
    /** Channel display name as returned by the YouTube Data API. */
    name: string;
    /** Channel handle (e.g. '@veritasium'). Null if the channel has no handle. */
    handle: string | null;
}

export interface TranscriptResult {
    transcript: string;
    /** Individual caption segments with per-segment timing metadata. */
    segments: TranscriptSegment[];
    /** All caption tracks available for this video. */
    availableTracks: CaptionTrack[];
    /** BCP-47 code of the track that was fetched. */
    language: string;
    /** 'standard' for manual captions, 'asr' for auto-generated */
    kind: 'standard' | 'asr';
    /**
     * Channel that owns the video. Only present when `includeChannel: true` was
     * passed in options and the Data API returned a result.
     */
    channel?: TranscriptChannel;
    /** Proxy/agent usage info for the InnerTube request. */
    agentInfo: AgentInfo;
}

export interface ChannelVideo {
    videoId: string;
    url: string;
    title: string;
    description: string;
    thumbnailUrl: string;
    publishedAt: string | null;
}

/** Options for listCaptionTracks. */
export interface ListCaptionTracksOptions {
    /**
     * Optional logger callback following Pino-style (level, context, message).
     */
    logger?: (level: 'debug' | 'info' | 'warn' | 'error', context: object, msg: string) => void;
    /**
     * `https.Agent` (or array) for the InnerTube request.
     */
    httpsAgent?: object | object[];
}

/** Options for searchVideos. */
export interface SearchOptions {
    /** Maximum number of results to return (1-50). Default: 10 */
    maxResults?: number;
    /**
     * Page token from a previous `SearchResponse.nextPageToken` to fetch the next page.
     */
    pageToken?: string;
    /**
     * When true, enriches each result with `durationSeconds`, `defaultAudioLanguage`,
     * `isAgeRestricted`, and `viewCount` via a batch `videos.list` call (1 extra quota unit).
     */
    includeContentDetails?: boolean;
    /**
     * YouTube Data API v3 key. Falls back to process.env.YOUTUBE_API_KEY.
     * Throws 'YOUTUBE_API_KEY_REQUIRED' if neither is available.
     */
    apiKey?: string;
    /**
     * BCP-47 language code to bias results toward speakers of that language (e.g. 'es', 'fr').
     * Maps to the `relevanceLanguage` parameter of the YouTube search API.
     */
    relevanceLanguage?: string;
    /**
     * ISO 3166-1 alpha-2 country code to restrict results to a region (e.g. 'ES', 'FR').
     * Maps to the `regionCode` parameter.
     */
    regionCode?: string;
    /**
     * Duration filter: 'short' (<4 min), 'medium' (4–20 min), 'long' (>20 min), 'any'.
     * Maps to the `videoDuration` parameter.
     */
    videoDuration?: 'any' | 'short' | 'medium' | 'long';
    /**
     * Sort order. Default: 'relevance'.
     * Maps to the `order` parameter.
     */
    order?: 'relevance' | 'date' | 'viewCount' | 'rating';
    /**
     * YouTube Freebase topic ID to filter by topic (e.g. '/m/02mjmr' for Education).
     * Maps to the `topicId` parameter.
     */
    topicId?: string;
    /**
     * Filter by closed caption availability.
     * 'closedCaption' = only videos with captions; 'none' = only without; 'any' = no filter.
     * Maps to the `videoCaption` parameter.
     */
    videoCaption?: 'any' | 'closedCaption' | 'none';
    /**
     * Safe-search level for filtering restricted content.
     * - `'strict'`   — exclude age-restricted and adult content from results.
     * - `'moderate'` — YouTube default; filters content restricted in the viewer's locale.
     * - `'none'`     — return all results including 18+ content.
     *
     * Note: `'strict'` is highly effective but not guaranteed against brand-new videos
     * not yet reviewed by YouTube's safety systems.
     */
    safeSearch?: 'none' | 'moderate' | 'strict';
    /**
     * Optional logger callback following Pino-style (level, context, message).
     * When omitted, the library produces no output.
     */
    logger?: (level: 'debug' | 'info' | 'warn' | 'error', context: object, msg: string) => void;
    /**
     * Node.js `https.Agent` (or array of agents) for YouTube Data API v3 requests.
     * When omitted, Data API calls go direct. Supports arrays for fallback — agents
     * are tried in order on network-level failures.
     */
    dataApiHttpsAgent?: object | object[];
}

export interface SearchResult {
    videoId: string;
    url: string;
    title: string;
    description: string;
    channelId: string;
    channelTitle: string;
    /** Channel handle (e.g. '@veritasium'). Null if the channel has no handle. */
    handle: string | null;
    thumbnailUrl: string;
    publishedAt: string | null;
    /** Total duration in seconds. Present only when `includeContentDetails: true`. */
    durationSeconds?: number;
    /** BCP-47 code of the video's original audio language. Present only when `includeContentDetails: true`. */
    defaultAudioLanguage?: string | null;
    /** True if age-restricted. Present only when `includeContentDetails: true`. */
    isAgeRestricted?: boolean;
    /** Total view count. Present only when `includeContentDetails: true`. Null if unavailable. */
    viewCount?: number | null;
}

export interface SearchResponse {
    /** Search results for the current page. */
    results: SearchResult[];
    /** Token to pass as `pageToken` to fetch the next page. Null when there are no more pages. */
    nextPageToken: string | null;
}

/**
 * Extract a YouTube video ID from various URL formats.
 * Supports youtu.be, youtube.com/watch, /shorts, /embed, /v, and bare 11-char IDs.
 * @returns 11-character video ID, or null if not extractable.
 */
export function extractVideoId(url: string): string | null;

/**
 * Extract the channel identifier from a YouTube channel URL.
 * Supports /@handle, /channel/ID, /user/name, and /c/customUrl formats.
 * @returns Channel identifier object, or null if URL is not a recognized channel URL.
 */
export function extractChannelIdentifier(url: string): ChannelIdentifier | null;

/**
 * Get video metadata via the YouTube oEmbed API. No API key required.
 * Pass `includeAgeRestriction: true` to also fetch age-restriction status (requires API key).
 */
export function getVideoMetadata(videoId: string, options?: MetadataOptions): Promise<VideoMetadata>;

/**
 * Get full content details for one or more YouTube videos via the YouTube Data API v3.
 * When passed a single string, returns a single `VideoContentDetails`.
 * When passed an array of strings (up to 50), makes a single batched API call (1 quota unit)
 * and returns an array in input order (null for IDs not found).
 * Requires a YouTube Data API v3 key.
 */
export function getVideoContentDetails(videoId: string, options?: ContentDetailsOptions): Promise<VideoContentDetails>;
export function getVideoContentDetails(videoId: string[], options?: ContentDetailsOptions): Promise<(VideoContentDetails | null)[]>;

/**
 * Fetch the full transcript for a YouTube video via YouTube's InnerTube API.
 * No API key required. Tries iOS -> Android -> WEB client configs in order.
 */
export function getVideoTranscript(videoId: string, options?: TranscriptOptions): Promise<TranscriptResult>;

/**
 * Get recent videos from a YouTube channel using the YouTube Data API v3.
 * Requires a YouTube Data API v3 key.
 */
export function getChannelVideos(channelIdentifier: ChannelIdentifier, options?: ChannelVideosOptions): Promise<ChannelVideo[]>;

/**
 * List available caption tracks for a video without downloading transcript text.
 * No API key required. Uses the same InnerTube API as `getVideoTranscript`.
 */
export function listCaptionTracks(videoId: string, options?: ListCaptionTracksOptions): Promise<CaptionTrack[]>;

/**
 * Search YouTube videos using the Data API v3 search.list endpoint.
 * Returns `{ results, nextPageToken }` for pagination support.
 * Requires a YouTube Data API v3 key.
 * NOTE: Each search call costs 100 quota units (default daily quota: 10,000 units ≈ 100 searches/day).
 */
export function searchVideos(query: string, options?: SearchOptions): Promise<SearchResponse>;
