/**
 * YouTube URL parsing utilities.
 *
 * @module extractors
 */

/**
 * Extract YouTube video ID from various URL formats.
 *
 * @function
 * @param {string} url - YouTube URL in any supported format
 * @returns {string|null} Video ID (11-char string) or null if not found
 *
 * @example
 * extractVideoId('https://youtu.be/dQw4w9WgXcQ') // 'dQw4w9WgXcQ'
 * extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ') // 'dQw4w9WgXcQ'
 * extractVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ') // 'dQw4w9WgXcQ'
 * extractVideoId('https://www.youtube.com/live/dQw4w9WgXcQ') // 'dQw4w9WgXcQ'
 */
export function extractVideoId(url) {
    if (!url) return null;
    try {
        const parsed = new URL(url.trim());
        const host = parsed.hostname.replace(/^www\./, '').replace(/^m\./, '');

        if (host === 'youtu.be') {
            return parsed.pathname.slice(1).split(/[?&#]/)[0] || null;
        }
        if (host === 'youtube.com') {
            if (parsed.pathname.startsWith('/watch')) {
                return parsed.searchParams.get('v');
            }
            const pathMatch = parsed.pathname.match(/\/(embed|shorts|v|live)\/([A-Za-z0-9_-]{11})/);
            if (pathMatch) return pathMatch[2];
        }
        return null;
    } catch {
        // Bare 11-char ID passed directly
        const match = url.trim().match(/^[A-Za-z0-9_-]{11}$/);
        return match ? url.trim() : null;
    }
}

/**
 * Extract channel identifier from a YouTube channel URL.
 *
 * @function
 * @param {string} url - YouTube channel URL
 * @returns {{type: 'channelId'|'handle'|'username'|'customUrl', value: string}|null}
 *
 * @example
 * extractChannelIdentifier('https://www.youtube.com/@PastorJohn') // { type: 'handle', value: 'PastorJohn' }
 * extractChannelIdentifier('https://www.youtube.com/channel/UC...') // { type: 'channelId', value: 'UC...' }
 */
export function extractChannelIdentifier(url) {
    if (!url) return null;
    try {
        const parsed = new URL(url.trim());
        const pathname = parsed.pathname;

        const handleMatch = pathname.match(/^\/@([^/]+)/);
        if (handleMatch) return { type: 'handle', value: handleMatch[1] };

        const channelMatch = pathname.match(/^\/channel\/([A-Za-z0-9_-]+)/);
        if (channelMatch) return { type: 'channelId', value: channelMatch[1] };

        const userMatch = pathname.match(/^\/user\/([^/]+)/);
        if (userMatch) return { type: 'username', value: userMatch[1] };

        const cMatch = pathname.match(/^\/c\/([^/]+)/);
        if (cMatch) return { type: 'customUrl', value: cMatch[1] };

        return null;
    } catch {
        return null;
    }
}
