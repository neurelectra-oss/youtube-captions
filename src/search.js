/**
 * YouTube video search via YouTube Data API v3.
 *
 * @module search
 */

import axios from 'axios';

const YT_DATA_API_BASE = 'https://www.googleapis.com/youtube/v3';
const YT_THUMBNAIL_BASE = 'https://img.youtube.com/vi';

/**
 * Returns true when an axios error is a network-level failure (proxy unreachable,
 * connection refused, timeout) rather than an HTTP response from the target server.
 *
 * @param {Error} err
 * @returns {boolean}
 */
function isNetworkError(err) {
    if (err.response) return false;
    const networkCodes = ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNABORTED', 'EPIPE'];
    return !err.code || networkCodes.includes(err.code);
}

/**
 * Normalize an httpsAgent option to an array.
 *
 * @param {object|object[]|undefined} agentOrArray
 * @returns {Array<object|undefined>}
 */
function normalizeAgents(agentOrArray) {
    if (!agentOrArray) return [undefined];
    return Array.isArray(agentOrArray) ? agentOrArray : [agentOrArray];
}

/**
 * Perform a GET request trying each agent in sequence.
 * Moves to the next agent only on network-level failures.
 *
 * @param {string} url
 * @param {object} config - axios config (without httpsAgent)
 * @param {Array<object|undefined>} agents
 * @param {Function|null} log
 */
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
 * Search YouTube videos using the Data API v3 search.list endpoint.
 *
 * @description
 * Calls the YouTube Data API v3 search.list endpoint with type=video.
 * Requires a YouTube Data API v3 key (via options.apiKey or the
 * YOUTUBE_API_KEY environment variable).
 *
 * **Quota cost**: Each call costs 100 quota units (vs 1 unit for most other
 * endpoints). The default daily quota is 10,000 units — roughly 100 searches
 * per day. Plan usage accordingly.
 *
 * @async
 * @function
 * @param {string} query - Search query string
 * @param {Object} [options]
 * @param {number} [options.maxResults=10] - Maximum results to return (1-50)
 * @param {string} [options.apiKey] - API key override; falls back to YOUTUBE_API_KEY env var
 * @param {string} [options.relevanceLanguage] - BCP-47 language code to bias results (e.g. 'es', 'fr')
 * @param {string} [options.regionCode] - ISO 3166-1 alpha-2 country code to restrict results (e.g. 'ES', 'FR')
 * @param {'any'|'short'|'medium'|'long'} [options.videoDuration] - Duration filter: short (<4min), medium (4-20min), long (>20min)
 * @param {'relevance'|'date'|'viewCount'|'rating'} [options.order='relevance'] - Sort order
 * @param {string} [options.topicId] - YouTube Freebase topic ID (e.g. '/m/02mjmr' for Education)
 * @param {'any'|'closedCaption'|'none'} [options.videoCaption] - Filter by caption availability
 * @param {'none'|'moderate'|'strict'} [options.safeSearch='moderate'] - Safe-search level. Use 'strict' to exclude age-restricted and adult content from results.
 * @param {Function} [options.logger] - Optional logger: (level, context, msg) => void
 * @param {object|object[]} [options.dataApiHttpsAgent] - https.Agent (or array of agents) for Data API requests. Tried in order on network failure. When omitted, requests go direct.
 * @returns {Promise<Array<{videoId: string, url: string, title: string, description: string, channelId: string, channelTitle: string, handle: string|null, thumbnailUrl: string, publishedAt: string|null}>>}
 * @throws {Error} 'YOUTUBE_API_KEY_REQUIRED' if no API key is available
 * @throws {Error} If the search request fails
 */
export async function searchVideos(query, options = {}) {
    const {
        maxResults = 10,
        apiKey: optApiKey,
        relevanceLanguage,
        regionCode,
        videoDuration,
        order,
        topicId,
        videoCaption,
        safeSearch,
        logger,
        dataApiHttpsAgent,
    } = options;

    const log = logger || null;
    const apiKey = optApiKey || process.env.YOUTUBE_API_KEY;
    const dataApiAgents = normalizeAgents(dataApiHttpsAgent);

    if (!apiKey) {
        throw new Error('YOUTUBE_API_KEY_REQUIRED');
    }

    if (log) log('info', { query, maxResults, dataApiProxyCount: dataApiAgents.filter(Boolean).length }, '[youtube-captions] Searching videos via Data API');

    const params = {
        part: 'snippet',
        type: 'video',
        q: query,
        maxResults: Math.min(maxResults, 50),
        key: apiKey,
    };

    if (relevanceLanguage) params.relevanceLanguage = relevanceLanguage;
    if (regionCode)        params.regionCode = regionCode;
    if (videoDuration)     params.videoDuration = videoDuration;
    if (order)             params.order = order;
    if (topicId)           params.topicId = topicId;
    if (videoCaption)      params.videoCaption = videoCaption;
    if (safeSearch)        params.safeSearch = safeSearch;

    const response = await axiosGetWithAgentFallback(
        `${YT_DATA_API_BASE}/search`,
        { params, timeout: 10000 },
        dataApiAgents, log,
    );

    const items = response.data?.items || [];

    if (log) log('debug', { query, count: items.length }, '[youtube-captions] Search results received');

    // Batch-resolve channel handles in a single channels.list call (1 quota unit).
    const uniqueChannelIds = [...new Set(items.map(item => item.snippet?.channelId).filter(Boolean))];
    const handleMap = {};
    if (uniqueChannelIds.length > 0) {
        const channelResp = await axiosGetWithAgentFallback(
            `${YT_DATA_API_BASE}/channels`,
            { params: { part: 'snippet', id: uniqueChannelIds.join(','), key: apiKey }, timeout: 10000 },
            dataApiAgents, log,
        );
        for (const ch of (channelResp.data?.items || [])) {
            handleMap[ch.id] = ch.snippet?.customUrl || null;
        }
    }

    return items.map(item => {
        const channelId = item.snippet?.channelId || '';
        return {
            videoId: item.id.videoId,
            url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
            title: item.snippet?.title || '',
            description: item.snippet?.description || '',
            channelId,
            channelTitle: item.snippet?.channelTitle || '',
            handle: handleMap[channelId] ?? null,
            thumbnailUrl:
                item.snippet?.thumbnails?.high?.url ||
                item.snippet?.thumbnails?.default?.url ||
                `${YT_THUMBNAIL_BASE}/${item.id.videoId}/hqdefault.jpg`,
            publishedAt: item.snippet?.publishedAt || null,
        };
    });
}
