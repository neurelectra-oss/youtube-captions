/**
 * YouTube video content details via YouTube Data API v3.
 *
 * @module content
 */

import axios from 'axios';

const YT_DATA_API_BASE = 'https://www.googleapis.com/youtube/v3';

function isNetworkError(err) {
    if (err.response) return false;
    const networkCodes = ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNABORTED', 'EPIPE'];
    return !err.code || networkCodes.includes(err.code);
}

function normalizeAgents(agentOrArray) {
    if (!agentOrArray) return [undefined];
    return Array.isArray(agentOrArray) ? agentOrArray : [agentOrArray];
}

async function axiosGetWithAgentFallback(url, config, agents, log) {
    let lastErr;
    for (const agent of agents) {
        try {
            return await axios.get(url, { ...config, ...(agent && { httpsAgent: agent }) });
        } catch (err) {
            if (isNetworkError(err) && agent !== agents[agents.length - 1]) {
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
 * Parse an ISO 8601 duration string (e.g. 'PT4M13S') into total seconds.
 *
 * @param {string} iso - ISO 8601 duration string
 * @returns {number} Total duration in seconds
 */
function parseIsoDuration(iso) {
    if (!iso) return 0;
    const match = iso.match(/P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    const days = parseInt(match[1] || '0', 10);
    const hours = parseInt(match[2] || '0', 10);
    const minutes = parseInt(match[3] || '0', 10);
    const seconds = parseInt(match[4] || '0', 10);
    return days * 86400 + hours * 3600 + minutes * 60 + seconds;
}

/**
 * Get full content details for a YouTube video via the YouTube Data API v3.
 *
 * @description
 * Fetches `contentDetails` and `status` parts from the `videos.list` endpoint.
 * Returns structured information about duration, quality, captions, age restriction,
 * privacy, and audience targeting. Requires a YouTube Data API v3 key.
 *
 * @async
 * @function
 * @param {string} videoId - YouTube video ID
 * @param {Object} [options]
 * @param {string} [options.apiKey] - YouTube Data API v3 key. Falls back to process.env.YOUTUBE_API_KEY. Throws 'YOUTUBE_API_KEY_REQUIRED' if neither is set.
 * @param {Function} [options.logger] - Optional logger: (level, context, msg) => void
 * @param {object|object[]} [options.dataApiHttpsAgent] - https.Agent (or array) for the Data API request. When omitted, goes direct.
 * @returns {Promise<{videoId: string, duration: string, durationSeconds: number, definition: 'hd'|'sd', hasCaption: boolean, licensedContent: boolean, projection: string, isAgeRestricted: boolean, privacyStatus: string, embeddable: boolean, madeForKids: boolean}>}
 * @throws {Error} 'YOUTUBE_API_KEY_REQUIRED' if no API key is available
 * @throws {Error} 'VIDEO_NOT_FOUND' if the video ID is not found in the Data API
 */
export async function getVideoContentDetails(videoId, options = {}) {
    const { apiKey: optApiKey, logger, dataApiHttpsAgent } = options;
    const log = logger || null;
    const apiKey = optApiKey || process.env.YOUTUBE_API_KEY;
    const dataApiAgents = normalizeAgents(dataApiHttpsAgent);

    if (!apiKey) throw new Error('YOUTUBE_API_KEY_REQUIRED');

    if (log) log('info', { videoId }, '[youtube-captions] Fetching video content details via Data API');

    const response = await axiosGetWithAgentFallback(
        `${YT_DATA_API_BASE}/videos`,
        { params: { part: 'contentDetails,status', id: videoId, key: apiKey }, timeout: 10000 },
        dataApiAgents, log,
    );

    const item = response.data?.items?.[0];
    if (!item) throw new Error('VIDEO_NOT_FOUND');

    const cd = item.contentDetails || {};
    const status = item.status || {};

    return {
        videoId,
        /** ISO 8601 duration string (e.g. 'PT4M13S'). */
        duration: cd.duration || '',
        /** Total duration in seconds. */
        durationSeconds: parseIsoDuration(cd.duration),
        /** Video quality: 'hd' or 'sd'. */
        definition: cd.definition || 'sd',
        /** True if the video has closed captions. */
        hasCaption: cd.caption === 'true',
        /** True if the content is licensed. */
        licensedContent: cd.licensedContent === true,
        /** Projection type: 'rectangular' (standard) or '360'. */
        projection: cd.projection || 'rectangular',
        /** True if YouTube has flagged the video as age-restricted (18+). */
        isAgeRestricted: cd.contentRating?.ytRating === 'ytAgeRestricted',
        /** Privacy status: 'public', 'unlisted', or 'private'. */
        privacyStatus: status.privacyStatus || 'public',
        /** True if the video can be embedded on external sites. */
        embeddable: status.embeddable === true,
        /** True if YouTube has designated this video as made for kids (COPPA). */
        madeForKids: status.madeForKids === true,
    };
}
