/** Options for getVideoTranscript. */
export interface TranscriptOptions {
    /**
     * BCP-47 language code to prefer (e.g. 'en', 'pt', 'es').
     * When omitted or null, falls back to English then the first available track.
     */
    preferredLang?: string | null;
    /**
     * Optional logger callback following Pino-style (level, context, message).
     * When omitted, the library produces no output.
     */
    logger?: (level: 'debug' | 'info' | 'warn' | 'error', context: object, msg: string) => void;
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

export interface TranscriptResult {
    transcript: string;
    /** Individual caption segments with per-segment timing metadata. */
    segments: TranscriptSegment[];
    language: string;
    /** 'standard' for manual captions, 'asr' for auto-generated */
    kind: string;
}

export interface ChannelVideo {
    videoId: string;
    url: string;
    title: string;
    description: string;
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
export function getVideoMetadata(videoId: string): Promise<VideoMetadata>;

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
