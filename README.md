# @neurelectra/youtube-captions

YouTube transcript extraction via InnerTube API and channel video listing via YouTube Data API v3.

**No API key required for transcripts.** Only channel listing requires a YouTube Data API v3 key.

## Install

```bash
npm install @neurelectra/youtube-captions
```

Requires Node.js 18+. Published to GitHub Packages under the `@neurelectra` scope.

## Usage

```js
import {
  extractVideoId,
  extractChannelIdentifier,
  getVideoMetadata,
  getVideoTranscript,
  getChannelVideos,
} from '@neurelectra/youtube-captions';

// Extract video ID from any URL format
const videoId = extractVideoId('https://youtu.be/dQw4w9WgXcQ'); // 'dQw4w9WgXcQ'

// Get video title, author, thumbnail (no API key)
const meta = await getVideoMetadata(videoId);
// { title, authorName, thumbnailUrl, videoId, videoUrl }

// Get the full transcript (no API key)
const result = await getVideoTranscript(videoId, { preferredLang: 'en' });
// { transcript: '...full text...', language: 'en', kind: 'standard' }

// List channel videos (requires YOUTUBE_API_KEY or options.apiKey)
const channelId = extractChannelIdentifier('https://www.youtube.com/@SomeChannel');
const videos = await getChannelVideos(channelId, { maxVideos: 20 });
// [{ videoId, url, title, description, thumbnailUrl, publishedAt }, ...]
```

### Logger injection

All async functions accept an optional `logger` callback following Pino's call style:

```js
import pino from 'pino';
const log = pino();

const result = await getVideoTranscript(videoId, {
  logger: (level, ctx, msg) => log[level](ctx, msg),
});
```

## API

### `extractVideoId(url: string): string | null`

Extracts the 11-character video ID from any YouTube URL (`youtu.be`, `/watch?v=`, `/shorts/`, `/embed/`). Also accepts a bare 11-char ID. Returns `null` if not a recognizable YouTube video URL.

### `extractChannelIdentifier(url: string): ChannelIdentifier | null`

Returns `{ type: 'handle' | 'channelId' | 'username' | 'customUrl', value: string }` or `null`.

### `getVideoMetadata(videoId: string): Promise<VideoMetadata>`

Fetches title, author name, and thumbnail URL via the public oEmbed endpoint. No API key required.

### `getVideoTranscript(videoId, options?): Promise<TranscriptResult>`

Fetches the full text transcript via YouTube's InnerTube API. Tries iOS -> Android -> WEB client configs in order. **No API key required.**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `preferredLang` | `string \| null` | `null` | BCP-47 language code (e.g. `'en'`, `'pt'`) |
| `logger` | `Function` | — | Pino-style `(level, context, msg)` callback |

Returns `{ transcript: string, language: string, kind: 'standard' | 'asr' }`.

### `getChannelVideos(channelIdentifier, options?): Promise<ChannelVideo[]>`

Fetches recent videos from a YouTube channel using the Data API v3.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxVideos` | `number` | `10` | Maximum results (1-50) |
| `apiKey` | `string` | `process.env.YOUTUBE_API_KEY` | YouTube Data API v3 key |
| `logger` | `Function` | — | Pino-style `(level, context, msg)` callback |

Throws `Error('YOUTUBE_API_KEY_REQUIRED')` if no key is available.

## Publishing

Push a version tag to trigger the GitHub Actions publish workflow:

```bash
git tag v0.1.0 && git push origin v0.1.0
```

## License

MIT
