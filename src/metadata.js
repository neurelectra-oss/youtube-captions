/**
 * YouTube video metadata via oEmbed API.
 *
 * @module metadata
 */

import axios from 'axios';

const YT_OEMBED_BASE = 'https://www.youtube.com/oembed';
const YT_THUMBNAIL_BASE = 'https://img.youtube.com/vi';
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Get video metadata via YouTube oEmbed API.
 *
 * @description
 * Uses the public oEmbed endpoint which requires no API key.
 * The thumbnail URL is constructed from the known YouTube thumbnail CDN pattern.
 *
 * @async
 * @function
 * @param {string} videoId - YouTube video ID
 * @param {Object} [options]
 * @param {object} [options.httpsAgent] - Optional https.Agent (e.g. from https-proxy-agent)
 * @returns {Promise<{title: string, authorName: string, thumbnailUrl: string, videoId: string, videoUrl: string}>}
 * @throws {Error} If the video is not found or the oEmbed request fails
 */
export async function getVideoMetadata(videoId, options = {}) {
    const { httpsAgent } = options;
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const oembedUrl = `${YT_OEMBED_BASE}?url=${encodeURIComponent(videoUrl)}&format=json`;

    const response = await axios.get(oembedUrl, {
        timeout: 10000,
        headers: { 'User-Agent': BROWSER_UA },
        ...(httpsAgent && { httpsAgent }),
    });
    const data = response.data;

    return {
        title: data.title || '',
        authorName: data.author_name || '',
        thumbnailUrl: `${YT_THUMBNAIL_BASE}/${videoId}/maxresdefault.jpg`,
        videoId,
        videoUrl,
    };
}
