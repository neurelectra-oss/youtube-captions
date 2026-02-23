/**
 * YouTube channel video listing via YouTube Data API v3.
 *
 * @module channel
 */

import axios from 'axios';

const YT_DATA_API_BASE = 'https://www.googleapis.com/youtube/v3';
const YT_THUMBNAIL_BASE = 'https://img.youtube.com/vi';

/**
 * Get recent videos from a YouTube channel using YouTube Data API v3.
 *
 * @description
 * Resolves channel handles/usernames to channel IDs using the Data API, then
 * fetches recent videos ordered by publication date. Requires a YouTube Data
 * API v3 key (via options.apiKey or the YOUTUBE_API_KEY environment variable).
 *
 * @async
 * @function
 * @param {{type: 'channelId'|'handle'|'username'|'customUrl', value: string}} channelIdentifier - Channel identifier
 * @param {Object} [options]
 * @param {number} [options.maxVideos=10] - Maximum videos to return (1-50)
 * @param {string} [options.apiKey] - API key override; falls back to YOUTUBE_API_KEY env var
 * @param {Function} [options.logger] - Optional logger: (level, context, msg) => void
 * @returns {Promise<Array<{videoId: string, url: string, title: string, description: string, thumbnailUrl: string, publishedAt: string|null}>>}
 * @throws {Error} 'YOUTUBE_API_KEY_REQUIRED' if no API key is available
 * @throws {Error} If the channel is not found or the API request fails
 */
export async function getChannelVideos(channelIdentifier, options = {}) {
    const { maxVideos = 10, apiKey: optApiKey, logger } = options;
    const log = logger || null;
    const apiKey = optApiKey || process.env.YOUTUBE_API_KEY;

    if (!apiKey) {
        throw new Error('YOUTUBE_API_KEY_REQUIRED');
    }

    if (log) log('info', { channelIdentifier, maxVideos }, '[youtube-captions] Fetching channel videos');

    let channelId = null;
    if (channelIdentifier.type === 'channelId') {
        channelId = channelIdentifier.value;
    } else {
        const params = { part: 'id', key: apiKey };
        if (channelIdentifier.type === 'handle') {
            params.forHandle = channelIdentifier.value;
        } else if (channelIdentifier.type === 'username') {
            params.forUsername = channelIdentifier.value;
        } else {
            // customUrl - try as handle, closest Data API equivalent
            params.forHandle = channelIdentifier.value;
        }

        const channelResp = await axios.get(`${YT_DATA_API_BASE}/channels`, {
            params,
            timeout: 10000,
        });

        const items = channelResp.data?.items;
        if (!items || items.length === 0) {
            throw new Error('Channel not found');
        }
        channelId = items[0].id;
    }

    const searchResp = await axios.get(`${YT_DATA_API_BASE}/search`, {
        params: {
            part: 'id,snippet',
            channelId,
            type: 'video',
            order: 'date',
            maxResults: Math.min(maxVideos, 50),
            key: apiKey,
        },
        timeout: 10000,
    });

    const searchItems = searchResp.data?.items || [];

    return searchItems.map(item => ({
        videoId: item.id.videoId,
        url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
        title: item.snippet?.title || '',
        description: item.snippet?.description || '',
        thumbnailUrl:
            item.snippet?.thumbnails?.high?.url ||
            item.snippet?.thumbnails?.default?.url ||
            `${YT_THUMBNAIL_BASE}/${item.id.videoId}/hqdefault.jpg`,
        publishedAt: item.snippet?.publishedAt || null,
    }));
}
