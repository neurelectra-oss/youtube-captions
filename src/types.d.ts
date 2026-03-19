/** Options for getVideoMetadata. */
export interface MetadataOptions {
    /**
     * Optional Node.js https.Agent to use for the request (e.g. from the
     * `https-proxy-agent` package). When omitted, the default agent is used.
     * Use this to route requests through a residential proxy when calling from
     * a datacenter environment where YouTube blocks anonymous traffic.
     */
    httpsAgent?: object;
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
     * Optional Node.js https.Agent to use for all requests (e.g. from the
     * `https-proxy-agent` package). When omitted, the default agent is used.
     * Use this to route requests through a residential proxy when calling from
     * a datacenter environment where YouTube blocks anonymous traffic.
     */
    httpsAgent?: object;
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
}

export interface ChannelVideo {
    videoId: string;
    url: string;
    title: string;
    description: string;
    thumbnailUrl: string;
    publishedAt: string | null;
}

/** Options for searchVideos. */
export interface SearchOptions {
    /** Maximum number of results to return (1-50). Default: 10 */
    maxResults?: number;
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
     * Optional logger callback following Pino-style (level, context, message).
     * When omitted, the library produces no output.
     */
    logger?: (level: 'debug' | 'info' | 'warn' | 'error', context: object, msg: string) => void;
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
 */
export function getVideoMetadata(videoId: string, options?: MetadataOptions): Promise<VideoMetadata>;

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
 * Search YouTube videos using the Data API v3 search.list endpoint.
 * Requires a YouTube Data API v3 key.
 * NOTE: Each call costs 100 quota units (default daily quota: 10,000 units ≈ 100 searches/day).
 */
export function searchVideos(query: string, options?: SearchOptions): Promise<SearchResult[]>;
