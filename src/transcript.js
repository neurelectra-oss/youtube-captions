/**
 * YouTube transcript extraction via InnerTube API.
 *
 * @module transcript
 */

import axios from 'axios';

const INNERTUBE_URL = 'https://www.youtube.com/youtubei/v1/player';
const YT_DATA_API_BASE = 'https://www.googleapis.com/youtube/v3';
// YouTube's public InnerTube API key (embedded in the YouTube web app itself)
const INNERTUBE_API_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * InnerTube client configurations to try in order.
 *
 * IOS and ANDROID are preferred because they do not require the poToken
 * (proof-of-origin token) that the WEB client now demands.
 * WEB is kept as a last resort.
 *
 * clientNameHeader: numeric ID sent in the X-YouTube-Client-Name header.
 * extraContext: additional fields merged into the client context object.
 * userAgent: the User-Agent header to send with the InnerTube request.
 *
 * Client versions can be overridden via environment variables when YouTube
 * requires a version bump without a full library release:
 *   YT_IOS_CLIENT_VERSION, YT_IOS_USER_AGENT
 *   YT_ANDROID_CLIENT_VERSION, YT_ANDROID_USER_AGENT
 *   YT_WEB_CLIENT_VERSION
 */
const IOS_VERSION     = process.env.YT_IOS_CLIENT_VERSION     || '21.09.3';
const ANDROID_VERSION = process.env.YT_ANDROID_CLIENT_VERSION || '21.09.3';
const WEB_VERSION     = process.env.YT_WEB_CLIENT_VERSION     || '2.20260306.01.00';

const INNERTUBE_CLIENTS = [
    {
        clientName: 'IOS',
        clientVersion: IOS_VERSION,
        clientNameHeader: '5',
        extraContext: { deviceModel: 'iPhone16,2' },
        userAgent: process.env.YT_IOS_USER_AGENT
            || `com.google.ios.youtube/${IOS_VERSION} (iPhone16,2; U; CPU iOS 18_3 like Mac OS X)`,
    },
    {
        clientName: 'ANDROID',
        clientVersion: ANDROID_VERSION,
        clientNameHeader: '3',
        extraContext: { androidSdkVersion: 35 },
        userAgent: process.env.YT_ANDROID_USER_AGENT
            || `com.google.android.youtube/${ANDROID_VERSION} (Linux; U; Android 15) gzip`,
    },
    {
        clientName: 'WEB',
        clientVersion: WEB_VERSION,
        clientNameHeader: '1',
        extraContext: {},
        userAgent: BROWSER_UA,
    },
];

/**
 * Decode common HTML entities in a string.
 *
 * @function
 * @param {string} text - Text possibly containing HTML entities
 * @returns {string} Decoded text
 */
function decodeHtmlEntities(text) {
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#x([0-9A-Fa-f]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
        .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
}

/**
 * Fetch and parse a YouTube timedtext caption URL into a transcript with segments.
 *
 * @description
 * Forces `fmt=json3` on the timedtext URL to get a consistent JSON response
 * regardless of which InnerTube client provided the URL.
 * Falls back to XML parsing if the response is not valid JSON3.
 *
 * JSON3 format: `{ events: [{ tStartMs, dDurationMs, segs: [{ utf8: "..." }] }] }`
 * XML format:   `<text start="..." dur="...">content</text>`
 *
 * @async
 * @function
 * @param {string} trackUrl - Full timedtext URL from the caption track object
 * @param {Function|null} [log] - Optional logger: (level, context, msg) => void
 * @param {object} [httpsAgent] - Optional https.Agent (e.g. a proxy agent)
 * @returns {Promise<{transcript: string, segments: Array<{text: string, startMs: number, durationMs: number}>}>}
 * @throws {Error} If the caption fetch fails
 */
async function fetchCaptionXml(trackUrl, log, httpsAgent) {
    const url = new URL(trackUrl);
    url.searchParams.set('fmt', 'json3');

    if (log) log('debug', { url: url.toString() }, '[youtube-captions] Fetching caption track');

    const response = await axios.get(url.toString(), {
        headers: { 'User-Agent': BROWSER_UA },
        timeout: 15000,
        ...(httpsAgent && { httpsAgent }),
    });
    const data = response.data;

    // JSON3 format: { events: [{ tStartMs, dDurationMs, segs: [{ utf8: '...' }] }] }
    if (data && typeof data === 'object' && Array.isArray(data.events)) {
        const segments = [];
        for (const event of data.events) {
            if (!event.segs) continue;
            const text = event.segs
                .map(s => s.utf8 || '')
                .join('')
                .replace(/\n/g, ' ')
                .trim();
            if (text) {
                segments.push({
                    text,
                    startMs: event.tStartMs ?? 0,
                    durationMs: event.dDurationMs ?? 0,
                });
            }
        }
        return { transcript: segments.map(s => s.text).join(' '), segments };
    }

    // XML fallback: <text start="..." dur="...">content</text>
    // start and dur are in seconds (float); convert to milliseconds.
    if (typeof data === 'string') {
        const segments = [];
        const regex = /<text([^>]*)>([\s\S]*?)<\/text>/g;
        let match;
        while ((match = regex.exec(data)) !== null) {
            const attrs = match[1];
            const raw = match[2].replace(/<[^>]+>/g, '');
            const text = decodeHtmlEntities(raw).trim();
            if (text) {
                const startMatch = attrs.match(/start="([^"]+)"/);
                const durMatch = attrs.match(/dur="([^"]+)"/);
                segments.push({
                    text,
                    startMs: startMatch ? Math.round(parseFloat(startMatch[1]) * 1000) : 0,
                    durationMs: durMatch ? Math.round(parseFloat(durMatch[1]) * 1000) : 0,
                });
            }
        }
        return { transcript: segments.map(s => s.text).join(' '), segments };
    }

    return { transcript: '', segments: [] };
}

/**
 * Fetch the full transcript for a YouTube video via YouTube's InnerTube API.
 *
 * @description
 * Uses YouTube's internal InnerTube API endpoint - the same one the YouTube
 * player itself uses. No API key required. Tries iOS -> Android -> WEB client
 * configurations in order to maximise compatibility across video types.
 *
 * Caption track selection priority:
 * When preferredLang is set:
 * 1. Manual track in preferred language
 * 2. Auto-generated (ASR) track in preferred language
 * 3. Video's original language (see below)
 *
 * When preferredLang is omitted (detect original language):
 * 1. YouTube's defaultCaptionsTrackIndex from the InnerTube response
 * 2. Auto-generated (ASR) track — always in the original audio language
 * 3. First available track
 *
 * @async
 * @function
 * @param {string} videoId - YouTube video ID
 * @param {Object} [options]
 * @param {string|null} [options.preferredLang=null] - BCP-47 language code (e.g. 'en', 'pt'). When omitted, the video's original language is detected automatically.
 * @param {boolean} [options.includeChannel=false] - When true, resolves channel id and name via the YouTube Data API v3 and includes a `channel` field in the result.
 * @param {string} [options.apiKey] - YouTube Data API v3 key used when includeChannel is true. Falls back to process.env.YOUTUBE_API_KEY. Throws 'YOUTUBE_API_KEY_REQUIRED' if neither is set.
 * @param {Function} [options.logger] - Optional logger: (level, context, msg) => void
 * @param {object} [options.httpsAgent] - Optional https.Agent (e.g. from https-proxy-agent)
 * @returns {Promise<{transcript: string, segments: Array<{text: string, startMs: number, durationMs: number}>, language: string, kind: string, channel?: {id: string, name: string}}>}
 * @throws {Error} If captions are unavailable or all InnerTube clients fail
 */
export async function getVideoTranscript(videoId, options = {}) {
    const { preferredLang = null, includeChannel = false, apiKey: optApiKey, logger, httpsAgent } = options;
    const log = logger || null;

    if (log) log('info', { videoId, preferredLang }, '[youtube-captions] Fetching transcript via InnerTube');

    let captionTracks = null;
    let defaultTrackIndex = 0;
    let lastError = new Error('No captions available for this video');

    for (const client of INNERTUBE_CLIENTS) {
        try {
            const response = await axios.post(
                `${INNERTUBE_URL}?key=${INNERTUBE_API_KEY}&prettyPrint=false`,
                {
                    context: {
                        client: {
                            clientName: client.clientName,
                            clientVersion: client.clientVersion,
                            hl: 'en',
                            gl: 'US',
                            ...client.extraContext,
                        },
                    },
                    videoId,
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'User-Agent': client.userAgent,
                        'X-YouTube-Client-Name': client.clientNameHeader,
                        'X-YouTube-Client-Version': client.clientVersion,
                    },
                    timeout: 15000,
                    ...(httpsAgent && { httpsAgent }),
                }
            );

            const renderer = response.data?.captions?.playerCaptionsTracklistRenderer;
            const tracks = renderer?.captionTracks;

            if (tracks && tracks.length > 0) {
                captionTracks = tracks;
                // Only use defaultCaptionsTrackIndex when YouTube explicitly provides it.
                // When absent (undefined), we cannot assume index 0 is the original language —
                // it may be a manual translation (e.g. English on an Italian video).
                const explicitDefault = renderer?.defaultCaptionsTrackIndex;
                defaultTrackIndex = typeof explicitDefault === 'number' ? explicitDefault : -1;
                if (log) log('debug', {
                    videoId,
                    client: client.clientName,
                    defaultTrackIndex,
                    tracks: tracks.map(t => ({ lang: t.languageCode, kind: t.kind })),
                }, '[youtube-captions] Available caption tracks');
                break;
            }

            // Surface a more specific error from playability status when captions are absent
            const status = response.data?.playabilityStatus?.status;
            const reason = response.data?.playabilityStatus?.reason || '';
            if (status === 'LOGIN_REQUIRED') {
                lastError = new Error(`Video requires sign-in: ${reason}`);
            } else if (status === 'ERROR' || status === 'UNPLAYABLE') {
                lastError = new Error(`Video unavailable: ${reason}`);
            } else {
                lastError = new Error('No captions available for this video');
            }

            if (log) log('warn', { videoId, client: client.clientName, status, reason },
                '[youtube-captions] No caption tracks returned, trying next client');
        } catch (err) {
            lastError = err;
            if (log) log('warn', { videoId, client: client.clientName, err: err.message },
                '[youtube-captions] InnerTube client failed, trying next');
        }
    }

    if (!captionTracks) {
        throw lastError;
    }

    let track = null;
    if (preferredLang) {
        track = captionTracks.find(t => t.languageCode === preferredLang && t.kind !== 'asr');
        if (!track) track = captionTracks.find(t => t.languageCode === preferredLang);
    }
    if (!track) {
        // No preferred language (or preferred not found) — detect the original language.
        // Use YouTube's own defaultCaptionsTrackIndex first; it reflects the video's
        // original language independent of the viewer's locale.
        // Fall back to the ASR track (auto-generated speech recognition is always
        // produced for the original audio language), then the first available track.
        // When YouTube explicitly provided a defaultCaptionsTrackIndex, trust it.
        // When it was absent (-1), prefer the ASR track — auto-generated captions
        // are always produced for the original audio language, making them a reliable
        // signal even when no explicit default is set (e.g. videos with only translated
        // manual tracks plus one ASR track for the spoken language).
        if (defaultTrackIndex >= 0) {
            track = captionTracks[defaultTrackIndex];
        }
        if (!track) {
            track = captionTracks.find(t => t.kind === 'asr') || captionTracks[0];
        }
    }

    if (log) log('info', { videoId, selectedLang: track.languageCode, kind: track.kind || 'standard' },
        '[youtube-captions] Selected caption track');

    // The baseUrl from InnerTube is a fully-qualified timedtext URL;
    // fetchCaptionXml forces fmt=json3 for consistent parsing.
    const { transcript, segments } = await fetchCaptionXml(track.baseUrl, log, httpsAgent);
    if (!transcript.trim()) {
        throw new Error('Caption track returned empty content');
    }

    const availableTracks = captionTracks.map((t, i) => ({
        languageCode: t.languageCode,
        // InnerTube clients return name in two formats:
        // WEB: { simpleText: 'English' }  iOS/Android: { runs: [{ text: 'English' }] }
        name: t.name?.simpleText || t.name?.runs?.[0]?.text || t.languageCode,
        kind: t.kind === 'asr' ? 'asr' : 'standard',
        isDefault: defaultTrackIndex >= 0 && i === defaultTrackIndex,
    }));

    const result = {
        transcript,
        segments,
        availableTracks,
        language: track.languageCode,
        kind: track.kind || 'standard',
    };

    if (includeChannel) {
        const apiKey = optApiKey || process.env.YOUTUBE_API_KEY;
        if (!apiKey) throw new Error('YOUTUBE_API_KEY_REQUIRED');

        if (log) log('debug', { videoId }, '[youtube-captions] Fetching channel info via Data API');

        const videoResp = await axios.get(`${YT_DATA_API_BASE}/videos`, {
            params: { part: 'snippet', id: videoId, key: apiKey },
            timeout: 10000,
            ...(httpsAgent && { httpsAgent }),
        });
        const snippet = videoResp.data?.items?.[0]?.snippet;
        if (snippet) {
            result.channel = { id: snippet.channelId, name: snippet.channelTitle };
        }
    }

    return result;
}
