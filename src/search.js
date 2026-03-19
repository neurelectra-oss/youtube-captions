/**
 * YouTube video search via YouTube Data API v3.
 *
 * @module search
 */

import axios from 'axios';

const YT_DATA_API_BASE = 'https://www.googleapis.com/youtube/v3';
const YT_THUMBNAIL_BASE = 'https://img.youtube.com/vi';

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
 * @param {Function} [options.logger] - Optional logger: (level, context, msg) => void
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
        logger,
    } = options;

    const log = logger || null;
    const apiKey = optApiKey || process.env.YOUTUBE_API_KEY;

    if (!apiKey) {
        throw new Error('YOUTUBE_API_KEY_REQUIRED');
    }

    if (log) log('info', { query, maxResults }, '[youtube-captions] Searching videos via Data API');

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

    const response = await axios.get(`${YT_DATA_API_BASE}/search`, {
        params,
        timeout: 10000,
    });

    const items = response.data?.items || [];

    if (log) log('debug', { query, count: items.length }, '[youtube-captions] Search results received');

    // Batch-resolve channel handles in a single channels.list call (1 quota unit).
    const uniqueChannelIds = [...new Set(items.map(item => item.snippet?.channelId).filter(Boolean))];
    const handleMap = {};
    if (uniqueChannelIds.length > 0) {
        const channelResp = await axios.get(`${YT_DATA_API_BASE}/channels`, {
            params: { part: 'snippet', id: uniqueChannelIds.join(','), key: apiKey },
            timeout: 10000,
        });
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
