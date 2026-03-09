/**
 * Integration tests for getVideoTranscript.
 *
 * These tests make real network calls to YouTube's InnerTube API.
 * No API key is required.
 *
 * Set PROXY_URL to route requests through a residential proxy (required when
 * running from a datacenter environment):
 *   PROXY_URL=http://user:pass@p.webshare.io:80 npm run test:integration
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { getVideoTranscript } from '../src/transcript.js';

const RICKROLL_ID = 'dQw4w9WgXcQ'; // "Never Gonna Give You Up" — public, has EN captions

const httpsAgent = process.env.PROXY_URL
    ? new HttpsProxyAgent(process.env.PROXY_URL)
    : undefined;

const transcriptOptions = httpsAgent ? { httpsAgent } : {};

test('returns transcript string for a known video', async (t) => {
    t.diagnostic(`Fetching transcript for ${RICKROLL_ID} ${httpsAgent ? '(via proxy)' : '(direct)'}...`);
    const result = await getVideoTranscript(RICKROLL_ID, transcriptOptions);

    assert.ok(typeof result.transcript === 'string', 'transcript should be a string');
    assert.ok(result.transcript.length > 0, 'transcript should not be empty');
    t.diagnostic(`transcript length: ${result.transcript.length} chars`);
});

test('returns segments array with timing data', async (t) => {
    const result = await getVideoTranscript(RICKROLL_ID, transcriptOptions);

    assert.ok(Array.isArray(result.segments), 'segments should be an array');
    assert.ok(result.segments.length > 0, 'segments should not be empty');

    t.diagnostic(`segment count: ${result.segments.length}`);
    t.diagnostic(`first segment: ${JSON.stringify(result.segments[0])}`);

    for (const seg of result.segments) {
        assert.ok(typeof seg.text === 'string' && seg.text.length > 0,
            `segment.text should be a non-empty string, got: ${JSON.stringify(seg.text)}`);
        assert.ok(typeof seg.startMs === 'number',
            `segment.startMs should be a number, got: ${typeof seg.startMs}`);
        assert.ok(typeof seg.durationMs === 'number',
            `segment.durationMs should be a number, got: ${typeof seg.durationMs}`);
        assert.ok(seg.startMs >= 0,
            `segment.startMs should be non-negative, got: ${seg.startMs}`);
    }
});

test('segments are ordered by startMs (ascending)', async () => {
    const result = await getVideoTranscript(RICKROLL_ID, transcriptOptions);

    for (let i = 1; i < result.segments.length; i++) {
        assert.ok(
            result.segments[i].startMs >= result.segments[i - 1].startMs,
            `segments out of order at index ${i}: ${result.segments[i - 1].startMs} > ${result.segments[i].startMs}`
        );
    }
});

test('transcript equals segments joined by spaces', async () => {
    const result = await getVideoTranscript(RICKROLL_ID, transcriptOptions);

    const joined = result.segments.map(s => s.text).join(' ');
    assert.equal(result.transcript, joined);
});

test('returns language and kind fields', async () => {
    const result = await getVideoTranscript(RICKROLL_ID, transcriptOptions);

    assert.ok(typeof result.language === 'string' && result.language.length > 0,
        'language should be a non-empty string');
    assert.ok(result.kind === 'standard' || result.kind === 'asr',
        `kind should be 'standard' or 'asr', got: ${result.kind}`);
});

test('preferredLang option selects the requested language when available', async (t) => {
    const result = await getVideoTranscript(RICKROLL_ID, { ...transcriptOptions, preferredLang: 'en' });
    assert.equal(result.language, 'en');
    t.diagnostic(`kind: ${result.kind}`);
});
