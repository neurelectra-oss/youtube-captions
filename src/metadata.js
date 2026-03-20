/**
 * YouTube video metadata via oEmbed API.
 *
 * @module metadata
 */

import axios from 'axios';

const YT_OEMBED_BASE = 'https://www.youtube.com/oembed';
const YT_THUMBNAIL_BASE = 'https://img.youtube.com/vi';
const YT_DATA_API_BASE = 'https://www.googleapis.com/youtube/v3';
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

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
 * Get video metadata via YouTube oEmbed API, with optional age-restriction check via Data API v3.
 *
 * @description
 * Uses the public oEmbed endpoint which requires no API key.
 * When `includeAgeRestriction: true` is passed, an additional call is made to the
 * YouTube Data API v3 `videos.list?part=contentDetails` endpoint to determine whether
 * the video is age-restricted. That call requires a YouTube Data API v3 key via
 * `options.apiKey` or the `YOUTUBE_API_KEY` environment variable.
 *
 * @async
 * @function
 * @param {string} videoId - YouTube video ID
 * @param {Object} [options]
 * @param {boolean} [options.includeAgeRestriction=false] - When true, fetches contentDetails from the Data API and adds `isAgeRestricted` to the result. Requires a YouTube Data API v3 key.
 * @param {string} [options.apiKey] - YouTube Data API v3 key. Falls back to process.env.YOUTUBE_API_KEY. Throws 'YOUTUBE_API_KEY_REQUIRED' if neither is set.
 * @param {object|object[]} [options.httpsAgent] - https.Agent (or array) for the oEmbed request. Array members tried in order on network failure.
 * @param {object|object[]} [options.dataApiHttpsAgent] - https.Agent (or array) for the Data API request. When omitted, goes direct.
 * @returns {Promise<{title: string, authorName: string, thumbnailUrl: string, videoId: string, videoUrl: string, isAgeRestricted?: boolean}>}
 * @throws {Error} If the video is not found or the oEmbed request fails
 * @throws {Error} 'YOUTUBE_API_KEY_REQUIRED' if includeAgeRestriction is true and no API key is available
 */
export async function getVideoMetadata(videoId, options = {}) {
    const { includeAgeRestriction = false, apiKey: optApiKey, httpsAgent, dataApiHttpsAgent } = options;
    const agents = normalizeAgents(httpsAgent);
    const dataApiAgents = normalizeAgents(dataApiHttpsAgent);

    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const oembedUrl = `${YT_OEMBED_BASE}?url=${encodeURIComponent(videoUrl)}&format=json`;

    const response = await axiosGetWithAgentFallback(
        oembedUrl,
        { timeout: 10000, headers: { 'User-Agent': BROWSER_UA } },
        agents, null,
    );
    const data = response.data;

    const result = {
        title: data.title || '',
        authorName: data.author_name || '',
        thumbnailUrl: `${YT_THUMBNAIL_BASE}/${videoId}/maxresdefault.jpg`,
        videoId,
        videoUrl,
    };

    if (includeAgeRestriction) {
        const apiKey = optApiKey || process.env.YOUTUBE_API_KEY;
        if (!apiKey) throw new Error('YOUTUBE_API_KEY_REQUIRED');

        const contentResp = await axiosGetWithAgentFallback(
            `${YT_DATA_API_BASE}/videos`,
            { params: { part: 'contentDetails', id: videoId, key: apiKey }, timeout: 10000 },
            dataApiAgents, null,
        );
        const contentRating = contentResp.data?.items?.[0]?.contentDetails?.contentRating;
        result.isAgeRestricted = contentRating?.ytRating === 'ytAgeRestricted';
    }

    return result;
}
