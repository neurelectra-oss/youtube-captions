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
 * Returns true when an axios error is a network-level failure (proxy unreachable,
 * connection refused, timeout) rather than an HTTP response from the target server.
 * Only network errors warrant retrying with a different proxy agent.
 *
 * @param {Error} err
 * @returns {boolean}
 */
function isNetworkError(err) {
    if (err.response) return false; // got an HTTP response — proxy worked, YouTube rejected
    const networkCodes = ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNABORTED', 'EPIPE'];
    return !err.code || networkCodes.includes(err.code);
}

/**
 * Normalize an httpsAgent option to an array.
 * A missing/undefined value becomes [undefined] so callers always iterate at least once
 * (the undefined entry means "no proxy").
 *
 * @param {object|object[]|undefined} agentOrArray
 * @returns {Array<object|undefined>}
 */
function normalizeAgents(agentOrArray) {
    if (!agentOrArray) return [undefined];
    return Array.isArray(agentOrArray) ? agentOrArray : [agentOrArray];
}

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
 * Perform a GET request trying each agent in sequence.
 * Moves to the next agent only on network-level failures (proxy unreachable, timeout, etc.).
 * HTTP errors from the target server (4xx/5xx) are thrown immediately without retrying.
 *
 * @async
 * @param {string} url
 * @param {object} config - axios config (without httpsAgent)
 * @param {Array<object|undefined>} agents - normalized agent array from normalizeAgents()
 * @param {Function|null} log
 * @returns {Promise<import('axios').AxiosResponse>}
 */
async function axiosGetWithAgentFallback(url, config, agents, log) {
    let lastErr;
    for (let i = 0; i < agents.length; i++) {
        const agent = agents[i];
        try {
            const response = await axios.get(url, { ...config, ...(agent && { httpsAgent: agent }) });
            return {
                response,
                agentInfo: { agentIndex: agent ? i : null, fallbacksAttempted: i },
            };
        } catch (err) {
            if (isNetworkError(err) && i < agents.length - 1) {
                if (log) log('warn', { url, err: err.message }, '[youtube-captions] Proxy network error, trying next agent');
                lastErr = err;
                continue;
            }
            throw err;
        }
    }
    throw lastErr;
}

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
 * @param {Array<object|undefined>} [agents] - Normalized agent array from normalizeAgents()
 * @returns {Promise<{transcript: string, segments: Array<{text: string, startMs: number, durationMs: number}>}>}
 * @throws {Error} If the caption fetch fails
 */
async function fetchCaptionXml(trackUrl, log, agents) {
    const url = new URL(trackUrl);
    url.searchParams.set('fmt', 'json3');

    if (log) log('debug', { url: url.toString() }, '[youtube-captions] Fetching caption track');

    const { response } = await axiosGetWithAgentFallback(
        url.toString(),
        { headers: { 'User-Agent': BROWSER_UA }, timeout: 15000 },
        agents, log,
    );
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
 * @param {boolean} [options.allowUnlisted=false] - When false (default), throws 'VIDEO_IS_UNLISTED' if the video is unlisted. Set to true to process unlisted videos.
 * @param {boolean} [options.includeChannel=false] - When true, resolves channel id and name via the YouTube Data API v3 and includes a `channel` field in the result.
 * @param {string} [options.apiKey] - YouTube Data API v3 key used when includeChannel is true. Falls back to process.env.YOUTUBE_API_KEY. Throws 'YOUTUBE_API_KEY_REQUIRED' if neither is set.
 * @param {Function} [options.logger] - Optional logger: (level, context, msg) => void
 * @param {object} [options.httpsAgent] - Optional https.Agent (e.g. from https-proxy-agent)
 * @returns {Promise<{transcript: string, segments: Array<{text: string, startMs: number, durationMs: number}>, language: string, kind: string, channel?: {id: string, name: string}}>}
 * @throws {Error} If captions are unavailable or all InnerTube clients fail
 */
/**
 * Fetch InnerTube player data for a video, trying each proxy agent and client config.
 * Returns raw caption tracks, default track index, and unlisted status.
 *
 * @async
 * @param {string} videoId
 * @param {Array<object|undefined>} agents - normalized agent array
 * @param {Function|null} log
 * @returns {Promise<{captionTracks: Array, defaultTrackIndex: number, isUnlisted: boolean}>}
 * @throws {Error} If all attempts fail
 */
/**
 * Playability statuses that indicate an IP-level rejection (bot check, geo-block, etc.).
 * These are retryable at the agent level because a different proxy IP may succeed.
 * Trying additional InnerTube clients on the same IP is pointless — the rejection is
 * IP-based, not client-based.
 */
const IP_RETRYABLE_STATUSES = new Set(['LOGIN_REQUIRED', 'ERROR', 'UNPLAYABLE']);

async function fetchInnerTubePlayerData(videoId, agents, log) {
    let captionTracks = null;
    let defaultTrackIndex = 0;
    let isUnlisted = false;
    let successAgentIndex = null;
    let fallbacksAttempted = 0;
    let lastError = new Error('No captions available for this video');

    outer:
    for (let ai = 0; ai < agents.length; ai++) {
        const agent = agents[ai];
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
                        ...(agent && { httpsAgent: agent }),
                    }
                );

                const renderer = response.data?.captions?.playerCaptionsTracklistRenderer;
                const tracks = renderer?.captionTracks;

                if (tracks && tracks.length > 0) {
                    captionTracks = tracks;
                    isUnlisted = response.data?.videoDetails?.isUnlisted === true;
                    successAgentIndex = agent ? ai : null;
                    const explicitDefault = renderer?.defaultCaptionsTrackIndex;
                    defaultTrackIndex = typeof explicitDefault === 'number' ? explicitDefault : -1;
                    if (log) log('debug', {
                        videoId,
                        client: client.clientName,
                        agentIndex: ai,
                        defaultTrackIndex,
                        isUnlisted,
                        tracks: tracks.map(t => ({ lang: t.languageCode, kind: t.kind })),
                    }, '[youtube-captions] Available caption tracks');
                    break outer;
                }

                const status = response.data?.playabilityStatus?.status;
                const reason = response.data?.playabilityStatus?.reason || '';
                if (status === 'LOGIN_REQUIRED') {
                    lastError = new Error(`Video requires sign-in: ${reason}`);
                } else if (status === 'ERROR' || status === 'UNPLAYABLE') {
                    lastError = new Error(`Video unavailable: ${reason}`);
                } else {
                    lastError = new Error('No captions available for this video');
                }

                // IP-level rejections (bot check, sign-in challenge) won't resolve by
                // trying different InnerTube clients on the same proxy IP. Skip remaining
                // clients and advance to the next agent immediately.
                if (IP_RETRYABLE_STATUSES.has(status) && ai < agents.length - 1) {
                    if (log) log('warn', { videoId, client: client.clientName, agentIndex: ai, status, reason },
                        '[youtube-captions] IP-level rejection, skipping remaining clients and trying next agent');
                    fallbacksAttempted++;
                    break;
                }

                if (log) log('warn', { videoId, client: client.clientName, agentIndex: ai, status, reason },
                    '[youtube-captions] No caption tracks returned, trying next client');
            } catch (err) {
                lastError = err;
                if (isNetworkError(err) && ai < agents.length - 1) {
                    fallbacksAttempted++;
                    if (log) log('warn', { videoId, client: client.clientName, agentIndex: ai, err: err.message },
                        '[youtube-captions] Proxy network error, trying next agent');
                    break;
                }
                if (log) log('warn', { videoId, client: client.clientName, agentIndex: ai, err: err.message },
                    '[youtube-captions] InnerTube client failed, trying next');
            }
        }
    }

    if (!captionTracks) throw lastError;
    return {
        captionTracks, defaultTrackIndex, isUnlisted,
        agentInfo: { agentIndex: successAgentIndex, fallbacksAttempted },
    };
}

/**
 * Format raw InnerTube caption tracks into the public CaptionTrack shape.
 *
 * @param {Array} rawTracks - Raw caption tracks from InnerTube
 * @param {number} defaultTrackIndex
 * @returns {Array<{languageCode: string, name: string, kind: 'standard'|'asr', isDefault: boolean}>}
 */
function formatCaptionTracks(rawTracks, defaultTrackIndex) {
    return rawTracks.map((t, i) => ({
        languageCode: t.languageCode,
        name: t.name?.simpleText || t.name?.runs?.[0]?.text || t.languageCode,
        kind: t.kind === 'asr' ? 'asr' : 'standard',
        isDefault: defaultTrackIndex >= 0 && i === defaultTrackIndex,
    }));
}

/**
 * List available caption tracks for a YouTube video without downloading transcript text.
 *
 * @description
 * Makes the same InnerTube API call as `getVideoTranscript` but returns only the
 * available caption tracks. Useful for checking language availability before
 * committing to a full transcript download. No API key required.
 *
 * @async
 * @function
 * @param {string} videoId - YouTube video ID
 * @param {Object} [options]
 * @param {Function} [options.logger] - Optional logger: (level, context, msg) => void
 * @param {object|object[]} [options.httpsAgent] - https.Agent (or array) for the InnerTube request
 * @returns {Promise<Array<{languageCode: string, name: string, kind: 'standard'|'asr', isDefault: boolean}>>}
 * @throws {Error} If captions are unavailable or all InnerTube clients fail
 */
export async function listCaptionTracks(videoId, options = {}) {
    const { logger, httpsAgent } = options;
    const log = logger || null;
    const agents = normalizeAgents(httpsAgent);

    if (log) log('info', { videoId }, '[youtube-captions] Listing caption tracks via InnerTube');

    const { captionTracks, defaultTrackIndex } = await fetchInnerTubePlayerData(videoId, agents, log);
    return formatCaptionTracks(captionTracks, defaultTrackIndex);
}

export async function getVideoTranscript(videoId, options = {}) {
    const { preferredLang = null, allowUnlisted = false, includeChannel = false, apiKey: optApiKey, logger, httpsAgent, dataApiHttpsAgent } = options;
    const log = logger || null;
    const agents = normalizeAgents(httpsAgent);
    const dataApiAgents = normalizeAgents(dataApiHttpsAgent);

    if (log) log('info', { videoId, preferredLang, proxyCount: agents.filter(Boolean).length, dataApiProxyCount: dataApiAgents.filter(Boolean).length }, '[youtube-captions] Fetching transcript via InnerTube');

    const { captionTracks, defaultTrackIndex, isUnlisted, agentInfo } = await fetchInnerTubePlayerData(videoId, agents, log);

    if (isUnlisted && !allowUnlisted) {
        throw new Error('VIDEO_IS_UNLISTED');
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
    const { transcript, segments } = await fetchCaptionXml(track.baseUrl, log, agents);
    if (!transcript.trim()) {
        throw new Error('Caption track returned empty content');
    }

    const availableTracks = formatCaptionTracks(captionTracks, defaultTrackIndex);

    const result = {
        transcript,
        segments,
        availableTracks,
        language: track.languageCode,
        kind: track.kind || 'standard',
        agentInfo,
    };

    if (includeChannel) {
        const apiKey = optApiKey || process.env.YOUTUBE_API_KEY;
        if (!apiKey) throw new Error('YOUTUBE_API_KEY_REQUIRED');

        if (log) log('debug', { videoId }, '[youtube-captions] Fetching channel info via Data API');

        const { response: videoResp } = await axiosGetWithAgentFallback(
            `${YT_DATA_API_BASE}/videos`,
            { params: { part: 'snippet', id: videoId, key: apiKey }, timeout: 10000 },
            dataApiAgents, log,
        );
        const snippet = videoResp.data?.items?.[0]?.snippet;
        if (snippet) {
            const channelId = snippet.channelId;
            const { response: channelResp } = await axiosGetWithAgentFallback(
                `${YT_DATA_API_BASE}/channels`,
                { params: { part: 'snippet', id: channelId, key: apiKey }, timeout: 10000 },
                dataApiAgents, log,
            );
            const channelSnippet = channelResp.data?.items?.[0]?.snippet;
            result.channel = {
                id: channelId,
                name: snippet.channelTitle,
                handle: channelSnippet?.customUrl || null,
            };
        }
    }

    return result;
}
