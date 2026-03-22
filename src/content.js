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
 * Map a single videos.list item into a VideoContentDetails object.
 *
 * @param {object} item - A single item from the YouTube videos.list response
 * @returns {object} VideoContentDetails
 */
function mapItemToContentDetails(item) {
    const cd = item.contentDetails || {};
    const status = item.status || {};
    const snippet = item.snippet || {};

    return {
        videoId: item.id,
        duration: cd.duration || '',
        durationSeconds: parseIsoDuration(cd.duration),
        definition: cd.definition || 'sd',
        hasCaption: cd.caption === 'true',
        licensedContent: cd.licensedContent === true,
        projection: cd.projection || 'rectangular',
        isAgeRestricted: cd.contentRating?.ytRating === 'ytAgeRestricted',
        privacyStatus: status.privacyStatus || 'public',
        embeddable: status.embeddable === true,
        madeForKids: status.madeForKids === true,
        defaultAudioLanguage: snippet.defaultAudioLanguage || null,
        defaultLanguage: snippet.defaultLanguage || null,
    };
}

/**
 * Get full content details for one or more YouTube videos via the YouTube Data API v3.
 *
 * @description
 * Fetches `contentDetails`, `status`, and `snippet` parts from the `videos.list` endpoint.
 * When a single video ID is passed, returns a single `VideoContentDetails` object.
 * When an array of video IDs is passed (up to 50), makes a single batched API call
 * (1 quota unit) and returns an array in the same order as the input.
 *
 * @async
 * @function
 * @param {string|string[]} videoId - Single video ID or array of IDs (max 50)
 * @param {Object} [options]
 * @param {string} [options.apiKey] - YouTube Data API v3 key. Falls back to process.env.YOUTUBE_API_KEY.
 * @param {Function} [options.logger] - Optional logger: (level, context, msg) => void
 * @param {object|object[]} [options.dataApiHttpsAgent] - https.Agent (or array) for the Data API request.
 * @returns {Promise<VideoContentDetails|VideoContentDetails[]>} Single object when string input, array when array input.
 * @throws {Error} 'YOUTUBE_API_KEY_REQUIRED' if no API key is available
 * @throws {Error} 'VIDEO_NOT_FOUND' if a single video ID is not found
 */
export async function getVideoContentDetails(videoId, options = {}) {
    const { apiKey: optApiKey, logger, dataApiHttpsAgent } = options;
    const log = logger || null;
    const apiKey = optApiKey || process.env.YOUTUBE_API_KEY;
    const dataApiAgents = normalizeAgents(dataApiHttpsAgent);

    if (!apiKey) throw new Error('YOUTUBE_API_KEY_REQUIRED');

    const isBatch = Array.isArray(videoId);
    const ids = isBatch ? videoId : [videoId];

    if (log) log('info', { videoIds: ids, count: ids.length }, '[youtube-captions] Fetching video content details via Data API');

    const { response } = await axiosGetWithAgentFallback(
        `${YT_DATA_API_BASE}/videos`,
        { params: { part: 'contentDetails,status,snippet', id: ids.join(','), key: apiKey }, timeout: 10000 },
        dataApiAgents, log,
    );

    const items = response.data?.items || [];

    if (isBatch) {
        // Build a map for O(1) lookup, then return results in input order.
        const itemMap = {};
        for (const item of items) {
            itemMap[item.id] = mapItemToContentDetails(item);
        }
        return ids.map(id => itemMap[id] || null);
    }

    // Single ID
    if (items.length === 0) throw new Error('VIDEO_NOT_FOUND');
    return mapItemToContentDetails(items[0]);
}
