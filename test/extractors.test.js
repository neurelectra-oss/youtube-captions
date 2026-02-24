import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractVideoId, extractChannelIdentifier } from '../src/extractors.js';

// --- extractVideoId ---

test('extracts ID from youtu.be short URL', () => {
    assert.equal(extractVideoId('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
});

test('extracts ID from youtube.com/watch?v=', () => {
    assert.equal(extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
});

test('extracts ID from /shorts/ URL', () => {
    assert.equal(extractVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
});

test('extracts ID from /embed/ URL', () => {
    assert.equal(extractVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
});

test('accepts bare 11-char video ID', () => {
    assert.equal(extractVideoId('dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
});

test('returns null for non-YouTube URL', () => {
    assert.equal(extractVideoId('https://vimeo.com/123456'), null);
});

test('returns null for empty string', () => {
    assert.equal(extractVideoId(''), null);
});

test('returns null for non-video YouTube URL', () => {
    assert.equal(extractVideoId('https://www.youtube.com/@SomeChannel'), null);
});

// --- extractChannelIdentifier ---

test('extracts handle from @handle URL', () => {
    assert.deepEqual(
        extractChannelIdentifier('https://www.youtube.com/@RickAstleyYT'),
        { type: 'handle', value: 'RickAstleyYT' }
    );
});

test('extracts channelId from /channel/UC... URL', () => {
    assert.deepEqual(
        extractChannelIdentifier('https://www.youtube.com/channel/UCuAXFkgsw1L7xaCfnd5JJOw'),
        { type: 'channelId', value: 'UCuAXFkgsw1L7xaCfnd5JJOw' }
    );
});

test('extracts username from /user/ URL', () => {
    assert.deepEqual(
        extractChannelIdentifier('https://www.youtube.com/user/RickAstleyVEVO'),
        { type: 'username', value: 'RickAstleyVEVO' }
    );
});

test('extracts customUrl from /c/ URL', () => {
    assert.deepEqual(
        extractChannelIdentifier('https://www.youtube.com/c/RickAstley'),
        { type: 'customUrl', value: 'RickAstley' }
    );
});

test('returns null for non-channel URL', () => {
    assert.equal(extractChannelIdentifier('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), null);
});

test('returns null for empty string', () => {
    assert.equal(extractChannelIdentifier(''), null);
});
