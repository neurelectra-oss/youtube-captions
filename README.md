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

// Get the full transcript with per-segment timing (no API key)
const result = await getVideoTranscript(videoId, { preferredLang: 'en' });
// {
//   transcript: '...full text...',
//   segments: [{ text: '...', startMs: 1360, durationMs: 1680 }, ...],
//   language: 'en',
//   kind: 'standard'
// }

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

### Proxy / datacenter environments

YouTube blocks anonymous requests from datacenter IPs (GCP, AWS, etc.) with a bot-detection error. To work around this, pass an `httpsAgent` from the [`https-proxy-agent`](https://www.npmjs.com/package/https-proxy-agent) package (or any compatible Node.js `https.Agent`) to route requests through a residential proxy.

```bash
npm install https-proxy-agent
```

```js
import { HttpsProxyAgent } from 'https-proxy-agent';
import { getVideoTranscript, getVideoMetadata } from '@neurelectra/youtube-captions';

// Create once at startup; undefined when PROXY_URL is not set (no proxy used)
const httpsAgent = process.env.PROXY_URL
  ? new HttpsProxyAgent(process.env.PROXY_URL)
  : undefined;

const result = await getVideoTranscript(videoId, { preferredLang: 'en', httpsAgent });
const meta   = await getVideoMetadata(videoId, { httpsAgent });
```

Set `PROXY_URL` to the proxy endpoint provided by your residential proxy service:

```
PROXY_URL=http://username:password@p.webshare.io:80
```

The library adds no proxy dependencies of its own. When `httpsAgent` is omitted, behaviour is identical to a direct request.

### Keeping InnerTube client versions current

YouTube periodically requires updated client version strings. Rather than waiting for a library release, you can override the built-in defaults via environment variables:

| Variable | Default | Description |
|---|---|---|
| `YT_IOS_CLIENT_VERSION` | `21.09.3` | iOS YouTube app version |
| `YT_IOS_USER_AGENT` | auto-built from version | Full iOS User-Agent string |
| `YT_ANDROID_CLIENT_VERSION` | `21.09.3` | Android YouTube app version |
| `YT_ANDROID_USER_AGENT` | auto-built from version | Full Android User-Agent string |
| `YT_WEB_CLIENT_VERSION` | `2.20260306.01.00` | YouTube web client version |

Setting only the version variables is usually enough — the User-Agent strings are auto-built from them. Override the full User-Agent only if the device/OS suffix also needs to change.

```
YT_IOS_CLIENT_VERSION=21.12.1
YT_ANDROID_CLIENT_VERSION=21.12.1
YT_WEB_CLIENT_VERSION=2.20260401.00.00
```

## API

### `extractVideoId(url: string): string | null`

Extracts the 11-character video ID from any YouTube URL (`youtu.be`, `/watch?v=`, `/shorts/`, `/embed/`). Also accepts a bare 11-char ID. Returns `null` if not a recognizable YouTube video URL.

### `extractChannelIdentifier(url: string): ChannelIdentifier | null`

Returns `{ type: 'handle' | 'channelId' | 'username' | 'customUrl', value: string }` or `null`.

### `getVideoMetadata(videoId, options?): Promise<VideoMetadata>`

Fetches title, author name, and thumbnail URL via the public oEmbed endpoint. No API key required.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `httpsAgent` | `object` | — | Node.js `https.Agent` for proxy support |

Returns `{ title, authorName, thumbnailUrl, videoId, videoUrl }`.

### `getVideoTranscript(videoId, options?): Promise<TranscriptResult>`

Fetches the full text transcript via YouTube's InnerTube API. Tries iOS → Android → WEB client configs in order. **No API key required.**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `preferredLang` | `string \| null` | `null` | BCP-47 language code (e.g. `'en'`, `'pt'`) |
| `logger` | `Function` | — | Pino-style `(level, context, msg)` callback |
| `httpsAgent` | `object` | — | Node.js `https.Agent` for proxy support |

Returns `{ transcript, segments, language, kind }`:

| Field | Type | Description |
|-------|------|-------------|
| `transcript` | `string` | Full text joined into a single string |
| `segments` | `TranscriptSegment[]` | Per-segment timing: `{ text, startMs, durationMs }` |
| `language` | `string` | BCP-47 code of the selected track |
| `kind` | `'standard' \| 'asr'` | `'standard'` for manual captions, `'asr'` for auto-generated |

Caption track selection priority: manual preferred-lang → ASR preferred-lang → manual English → ASR English → first available.

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
git tag v0.2.0 && git push origin v0.2.0
```

## License

MIT
