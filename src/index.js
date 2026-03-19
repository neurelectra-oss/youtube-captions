/**
 * @neurelectra/youtube-captions
 *
 * YouTube video ID extraction, transcript fetching via InnerTube API (no API key
 * required), and channel video listing via YouTube Data API v3.
 *
 * @module @neurelectra/youtube-captions
 */

export { extractVideoId, extractChannelIdentifier } from './extractors.js';
export { getVideoMetadata } from './metadata.js';
export { getVideoTranscript } from './transcript.js';
export { getChannelVideos } from './channel.js';
export { searchVideos } from './search.js';
