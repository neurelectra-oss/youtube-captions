/**
 * Integration tests for getChannelVideos.
 *
 * Requires a YouTube Data API v3 key in the YOUTUBE_API_KEY environment variable.
 * All tests are skipped when the key is absent so `npm test` stays green without it.
 *
 * Run with key:
 *   YOUTUBE_API_KEY=your_key npm run test:channel
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getChannelVideos } from '../src/channel.js';
import { extractChannelIdentifier } from '../src/extractors.js';

const API_KEY = process.env.YOUTUBE_API_KEY;

// Rick Astley — stable public channel with many videos
const RICK_HANDLE_URL = 'https://www.youtube.com/@RickAstleyYT';
const RICK_CHANNEL_ID = 'UCuAXFkgsw1L7xaCfnd5JJOw';

// Returns true and marks the test skipped when no API key is set.
// Callers must `return` immediately after to stop the test body.
function skipIfNoKey(t) {
    if (!API_KEY) {
        t.skip('YOUTUBE_API_KEY not set');
        return true;
    }
    return false;
}

test('fetches videos by channelId identifier', async (t) => {
    if (skipIfNoKey(t)) return;
    const identifier = { type: 'channelId', value: RICK_CHANNEL_ID };
    const videos = await getChannelVideos(identifier, { apiKey: API_KEY, maxVideos: 5 });

    assert.ok(Array.isArray(videos), 'should return an array');
    assert.ok(videos.length > 0, 'should return at least one video');
    assert.ok(videos.length <= 5, 'should respect maxVideos');
    t.diagnostic(`returned ${videos.length} videos`);
});

test('fetches videos by handle identifier', async (t) => {
    if (skipIfNoKey(t)) return;
    const identifier = extractChannelIdentifier(RICK_HANDLE_URL);
    assert.ok(identifier, 'extractChannelIdentifier should parse the URL');

    const videos = await getChannelVideos(identifier, { apiKey: API_KEY, maxVideos: 3 });

    assert.ok(Array.isArray(videos), 'should return an array');
    assert.ok(videos.length > 0, 'should return at least one video');
    t.diagnostic(`handle type resolved to ${videos.length} videos`);
});

test('each video has the expected shape', async (t) => {
    if (skipIfNoKey(t)) return;
    const identifier = { type: 'channelId', value: RICK_CHANNEL_ID };
    const videos = await getChannelVideos(identifier, { apiKey: API_KEY, maxVideos: 5 });

    for (const video of videos) {
        assert.ok(typeof video.videoId === 'string' && video.videoId.length === 11,
            `videoId should be an 11-char string, got: ${video.videoId}`);
        assert.ok(video.url.startsWith('https://www.youtube.com/watch?v='),
            `url should be a youtube watch URL, got: ${video.url}`);
        assert.ok(typeof video.title === 'string',
            'title should be a string');
        assert.ok(typeof video.description === 'string',
            'description should be a string');
        assert.ok(typeof video.thumbnailUrl === 'string' && video.thumbnailUrl.startsWith('https://'),
            `thumbnailUrl should be an https URL, got: ${video.thumbnailUrl}`);
        assert.ok(video.publishedAt === null || typeof video.publishedAt === 'string',
            `publishedAt should be string or null, got: ${typeof video.publishedAt}`);
    }
});

test('videos are ordered most-recent first', async (t) => {
    if (skipIfNoKey(t)) return;
    const identifier = { type: 'channelId', value: RICK_CHANNEL_ID };
    const videos = await getChannelVideos(identifier, { apiKey: API_KEY, maxVideos: 5 });

    const dates = videos
        .map(v => v.publishedAt)
        .filter(Boolean)
        .map(d => new Date(d).getTime());

    for (let i = 1; i < dates.length; i++) {
        assert.ok(dates[i] <= dates[i - 1],
            `videos not ordered by date: index ${i - 1} (${dates[i - 1]}) < index ${i} (${dates[i]})`);
    }
});

test('maxVideos default is 10', async (t) => {
    if (skipIfNoKey(t)) return;
    const identifier = { type: 'channelId', value: RICK_CHANNEL_ID };
    const videos = await getChannelVideos(identifier, { apiKey: API_KEY });

    assert.ok(videos.length <= 10, `expected <= 10 videos, got ${videos.length}`);
});

test('throws YOUTUBE_API_KEY_REQUIRED when no key is provided', async () => {
    const identifier = { type: 'channelId', value: RICK_CHANNEL_ID };
    const originalKey = process.env.YOUTUBE_API_KEY;
    delete process.env.YOUTUBE_API_KEY;

    try {
        await assert.rejects(
            () => getChannelVideos(identifier),
            (err) => {
                assert.equal(err.message, 'YOUTUBE_API_KEY_REQUIRED');
                return true;
            }
        );
    } finally {
        if (originalKey) process.env.YOUTUBE_API_KEY = originalKey;
    }
});
