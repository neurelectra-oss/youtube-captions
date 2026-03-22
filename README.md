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
  getVideoContentDetails,
  getVideoTranscript,
  listCaptionTracks,
  getChannelVideos,
  searchVideos,
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

// Include channel info (requires YOUTUBE_API_KEY or options.apiKey)
const resultWithChannel = await getVideoTranscript(videoId, {
  preferredLang: 'en',
  includeChannel: true,
  // apiKey: 'AIza...',  // or set YOUTUBE_API_KEY env var
});
// { transcript, segments, language, kind, channel: { id: 'UCxxxxxx', name: 'Veritasium', handle: '@veritasium' } }

// List channel videos (requires YOUTUBE_API_KEY or options.apiKey)
const channelId = extractChannelIdentifier('https://www.youtube.com/@SomeChannel');
const videos = await getChannelVideos(channelId, { maxVideos: 20 });
// [{ videoId, url, title, description, thumbnailUrl, publishedAt }, ...]

// Check what caption tracks are available before downloading (no API key)
const tracks = await listCaptionTracks(videoId);
// [{ languageCode: 'en', name: 'English', kind: 'asr', isDefault: true }, ...]

// Batch content details — single API call for multiple videos (1 quota unit)
const details = await getVideoContentDetails(['id1', 'id2', 'id3']);
// [VideoContentDetails, VideoContentDetails, null, ...]  (null if not found)

// Search YouTube videos (requires YOUTUBE_API_KEY or options.apiKey)
const { results, nextPageToken } = await searchVideos('technology documentaries', {
  relevanceLanguage: 'es',
  videoCaption: 'closedCaption',
  videoDuration: 'long',
  maxResults: 10,
});
// results: [{ videoId, url, title, description, channelId, channelTitle, handle, thumbnailUrl, publishedAt }, ...]

// Fetch next page
const page2 = await searchVideos('technology documentaries', { pageToken: nextPageToken });

// Search with enriched results — eliminates separate getVideoContentDetails calls
const { results: enriched } = await searchVideos('science lectures', {
  includeContentDetails: true,
});
// Each result also has: durationSeconds, defaultAudioLanguage, isAgeRestricted, viewCount
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

Proxy usage is **opt-in per request type**. InnerTube/oEmbed calls (caption retrieval) and YouTube Data API v3 calls use separate agent options so you can proxy one without proxying the other. This prevents a residential proxy with bad reputation from being associated with your API key.

| Option | Applies to |
|--------|-----------|
| `httpsAgent` | InnerTube (transcripts) and oEmbed (metadata) |
| `dataApiHttpsAgent` | YouTube Data API v3 (channel info, search, channel videos) |

Both options accept a **single agent or an array of agents**. When an array is provided, agents are tried in sequence — the next agent is used only if the previous one fails with a network-level error (unreachable proxy, connection refused, timeout). HTTP errors returned by YouTube itself are not retried, since the proxy worked.

```bash
npm install https-proxy-agent
```

```js
import { HttpsProxyAgent } from 'https-proxy-agent';
import { getVideoTranscript, getVideoMetadata } from '@neurelectra/youtube-captions';

// Single agent — proxy only InnerTube (Data API calls go direct)
const httpsAgent = new HttpsProxyAgent(process.env.PROXY_URL);
const result = await getVideoTranscript(videoId, { preferredLang: 'en', httpsAgent });
const meta   = await getVideoMetadata(videoId, { httpsAgent });

// Array of agents — automatic fallback if the first proxy is unreachable
const httpsAgent = [
  new HttpsProxyAgent(process.env.PROXY_PRIMARY),
  new HttpsProxyAgent(process.env.PROXY_FALLBACK),
];
const result = await getVideoTranscript(videoId, { preferredLang: 'en', httpsAgent });

// Optionally proxy Data API calls too, with a separate (trusted) agent or array
const result2 = await getVideoTranscript(videoId, {
  preferredLang: 'en',
  includeChannel: true,
  httpsAgent,
  dataApiHttpsAgent: new HttpsProxyAgent(process.env.DATA_PROXY_URL),
});
```

Set `PROXY_URL` to the proxy endpoint provided by your residential proxy service:

```
PROXY_URL=http://username:password@p.webshare.io:80
```

The library adds no proxy dependencies of its own. When `httpsAgent` is omitted, behaviour is identical to a direct request.

### Agent observability

`getVideoTranscript` and `getVideoMetadata` include an `agentInfo` field in their response for monitoring proxy health and fallback frequency:

```js
interface AgentInfo {
  agentIndex: number | null;  // index in the array that succeeded, null if direct (no proxy)
  fallbacksAttempted: number; // how many agents failed with network errors before success
}
```

```js
const result = await getVideoTranscript(videoId, { httpsAgent: [agent1, agent2] });
console.log(result.agentInfo);
// { agentIndex: 1, fallbacksAttempted: 1 }  — first proxy failed, second succeeded
// { agentIndex: 0, fallbacksAttempted: 0 }  — first proxy worked immediately
// { agentIndex: null, fallbacksAttempted: 0 } — no proxy (httpsAgent omitted or undefined)
```

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

Extracts the 11-character video ID from any YouTube URL (`youtu.be`, `/watch?v=`, `/shorts/`, `/embed/`, `/live/`). Also accepts a bare 11-char ID. Returns `null` if not a recognizable YouTube video URL.

### `extractChannelIdentifier(url: string): ChannelIdentifier | null`

Returns `{ type: 'handle' | 'channelId' | 'username' | 'customUrl', value: string }` or `null`.

### `getVideoMetadata(videoId, options?): Promise<VideoMetadata>`

Fetches title, author name, and thumbnail URL via the public oEmbed endpoint. No API key required.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `includeAgeRestriction` | `boolean` | `false` | When `true`, makes an additional Data API call and adds `isAgeRestricted` to the result. Requires a YouTube Data API v3 key. |
| `apiKey` | `string` | `process.env.YOUTUBE_API_KEY` | Used only when `includeAgeRestriction: true`. Throws `'YOUTUBE_API_KEY_REQUIRED'` if neither is set. |
| `httpsAgent` | `object \| object[]` | — | `https.Agent` (or array) for the oEmbed request |
| `dataApiHttpsAgent` | `object \| object[]` | — | `https.Agent` (or array) for the Data API request. When omitted, goes direct. |

Returns `{ title, authorName, thumbnailUrl, videoId, videoUrl, agentInfo, isAgeRestricted?, defaultAudioLanguage?, defaultLanguage? }`.

When `includeAgeRestriction: true`, the Data API call also fetches `snippet` (same request, no extra cost) and adds `defaultAudioLanguage` (BCP-47 code of the original audio language) and `defaultLanguage` (metadata language). Both are `null` if not set by the uploader.

---

### `getVideoContentDetails(videoId, options?): Promise<VideoContentDetails | (VideoContentDetails | null)[]>`

Fetches full content details from the YouTube Data API v3 `videos.list` endpoint (`contentDetails` + `status` + `snippet` parts). **Requires a YouTube Data API v3 key.**

Accepts a single video ID (returns one object) or an array of IDs up to 50 (returns an array in input order, with `null` for IDs not found). Array mode makes a **single batched API call** (1 quota unit), compared to N calls when fetching individually.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | `string` | `process.env.YOUTUBE_API_KEY` | YouTube Data API v3 key. Throws `'YOUTUBE_API_KEY_REQUIRED'` if neither is set. |
| `logger` | `Function` | — | Pino-style `(level, context, msg)` callback |
| `dataApiHttpsAgent` | `object \| object[]` | — | `https.Agent` (or array) for the Data API request. When omitted, goes direct. |

Returns `VideoContentDetails`:

| Field | Type | Description |
|-------|------|-------------|
| `videoId` | `string` | The video ID |
| `duration` | `string` | ISO 8601 duration (e.g. `'PT4M13S'`) |
| `durationSeconds` | `number` | Total duration in seconds |
| `definition` | `'hd' \| 'sd'` | Video quality |
| `hasCaption` | `boolean` | True if the video has closed captions |
| `licensedContent` | `boolean` | True if the content is licensed |
| `projection` | `string` | `'rectangular'` for standard, `'360'` for 360° videos |
| `isAgeRestricted` | `boolean` | True if YouTube has flagged the video as 18+ |
| `privacyStatus` | `'public' \| 'unlisted' \| 'private'` | Video visibility |
| `embeddable` | `boolean` | True if the video can be embedded on external sites |
| `madeForKids` | `boolean` | True if YouTube designated this video as made for kids (COPPA) |
| `defaultAudioLanguage` | `string \| null` | BCP-47 code of the video's original audio language (e.g. `'en'`). Null if not set by uploader. |
| `defaultLanguage` | `string \| null` | BCP-47 code of the video's metadata language (title, description). Null if not set. |

Throws `Error('VIDEO_NOT_FOUND')` if the video ID is not found in the Data API.

### `getVideoTranscript(videoId, options?): Promise<TranscriptResult>`

Fetches the full text transcript via YouTube's InnerTube API. Tries iOS → Android → WEB client configs in order. **No API key required.**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `preferredLang` | `string \| null` | `null` | BCP-47 language code (e.g. `'en'`, `'pt'`). When omitted, the video's original language is detected automatically. |
| `allowUnlisted` | `boolean` | `false` | When `false` (default), throws `'VIDEO_IS_UNLISTED'` if the video is unlisted. Set to `true` to allow processing unlisted videos. Detection uses the InnerTube response — no API key required. |
| `includeChannel` | `boolean` | `false` | When `true`, resolves the channel that owns the video and adds a `channel` field to the result. Requires a YouTube Data API v3 key (see below). |
| `apiKey` | `string` | `process.env.YOUTUBE_API_KEY` | YouTube Data API v3 key, used only when `includeChannel: true`. Falls back to the `YOUTUBE_API_KEY` environment variable. Throws `'YOUTUBE_API_KEY_REQUIRED'` if neither is set. |
| `logger` | `Function` | — | Pino-style `(level, context, msg)` callback |
| `httpsAgent` | `object \| object[]` | — | `https.Agent` (or array) for InnerTube requests. Array members are tried in order on network failure. |
| `dataApiHttpsAgent` | `object \| object[]` | — | `https.Agent` (or array) for Data API requests (`includeChannel`). When omitted, Data API calls go direct. |

Returns `{ transcript, segments, availableTracks, language, kind, agentInfo, channel? }`:

| Field | Type | Description |
|-------|------|-------------|
| `transcript` | `string` | Full text joined into a single string |
| `segments` | `TranscriptSegment[]` | Per-segment timing: `{ text, startMs, durationMs }` |
| `availableTracks` | `CaptionTrack[]` | All tracks available for the video (see below) |
| `language` | `string` | BCP-47 code of the track that was fetched |
| `kind` | `'standard' \| 'asr'` | `'standard'` for manual captions, `'asr'` for auto-generated |
| `agentInfo` | `AgentInfo` | Proxy/agent usage info (see below) |
| `channel` | `{ id: string, name: string, handle: string \| null }` | Present only when `includeChannel: true`. Channel ID, display name, and handle (e.g. `'@veritasium'`). Handle is `null` if the channel has none. |

Each `CaptionTrack` in `availableTracks`:

| Field | Type | Description |
|-------|------|-------------|
| `languageCode` | `string` | BCP-47 code (e.g. `'en'`, `'fr'`) |
| `name` | `string` | Human-readable name as provided by YouTube (e.g. `'English'`) |
| `kind` | `'standard' \| 'asr'` | `'asr'` tracks are auto-generated and always in the original audio language |
| `isDefault` | `boolean` | `true` for the track YouTube identifies as the video's original language |

When `preferredLang` is omitted, the video's original language is detected automatically using YouTube's `defaultCaptionsTrackIndex` from the InnerTube response, falling back to the ASR (auto-generated) track — which is always produced for the original audio language — then the first available track. When `preferredLang` is set: manual preferred-lang → ASR preferred-lang → original language fallback.

### `listCaptionTracks(videoId, options?): Promise<CaptionTrack[]>`

Lists available caption tracks for a video without downloading transcript text. Makes the same InnerTube API call as `getVideoTranscript` but returns only the track list. **No API key required.** Useful for checking language availability before committing to a full transcript download.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `logger` | `Function` | — | Pino-style `(level, context, msg)` callback |
| `httpsAgent` | `object \| object[]` | — | `https.Agent` (or array) for the InnerTube request |

Returns `CaptionTrack[]` (same shape as `TranscriptResult.availableTracks`).

### `getChannelVideos(channelIdentifier, options?): Promise<ChannelVideo[]>`

Fetches recent videos from a YouTube channel using the Data API v3.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxVideos` | `number` | `10` | Maximum results (1-50) |
| `apiKey` | `string` | `process.env.YOUTUBE_API_KEY` | YouTube Data API v3 key |
| `logger` | `Function` | — | Pino-style `(level, context, msg)` callback |

Throws `Error('YOUTUBE_API_KEY_REQUIRED')` if no key is available.

### `searchVideos(query, options?): Promise<SearchResponse>`

Searches YouTube videos using the Data API v3 `search.list` endpoint. Returns `{ results, nextPageToken }` for pagination.

> **Quota cost**: Each search call costs **100 quota units**. `includeContentDetails` adds **1 unit**. The default daily quota is 10,000 units (~100 searches/day).

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxResults` | `number` | `10` | Maximum results (1–50) |
| `pageToken` | `string` | — | Token from a previous `SearchResponse.nextPageToken` to fetch the next page |
| `includeContentDetails` | `boolean` | `false` | When `true`, enriches each result with `durationSeconds`, `defaultAudioLanguage`, `isAgeRestricted`, and `viewCount` via a batch `videos.list` call (1 extra quota unit) |
| `apiKey` | `string` | `process.env.YOUTUBE_API_KEY` | YouTube Data API v3 key. Throws `'YOUTUBE_API_KEY_REQUIRED'` if neither is set. |
| `relevanceLanguage` | `string` | — | BCP-47 code to bias results toward speakers of that language (e.g. `'es'`, `'fr'`) |
| `regionCode` | `string` | — | ISO 3166-1 alpha-2 country code to restrict results (e.g. `'ES'`, `'US'`) |
| `videoDuration` | `'any' \| 'short' \| 'medium' \| 'long'` | — | `short` <4 min, `medium` 4–20 min, `long` >20 min |
| `order` | `'relevance' \| 'date' \| 'viewCount' \| 'rating'` | `'relevance'` | Sort order |
| `topicId` | `string` | — | YouTube Freebase topic ID (e.g. `'/m/02mjmr'` for Education) |
| `videoCaption` | `'any' \| 'closedCaption' \| 'none'` | — | Filter by caption availability |
| `safeSearch` | `'none' \| 'moderate' \| 'strict'` | `'moderate'` | Safe-search level. Use `'strict'` to exclude age-restricted and adult content. `'none'` returns all results including 18+. |
| `logger` | `Function` | — | Pino-style `(level, context, msg)` callback |
| `dataApiHttpsAgent` | `object \| object[]` | — | `https.Agent` (or array) for all Data API requests. Array members tried in order on network failure. When omitted, requests go direct. |

Returns `SearchResponse`:

| Field | Type | Description |
|-------|------|-------------|
| `results` | `SearchResult[]` | Search results for the current page |
| `nextPageToken` | `string \| null` | Pass as `pageToken` to fetch the next page. Null when no more pages. |

Each `SearchResult`:

| Field | Type | Description |
|-------|------|-------------|
| `videoId` | `string` | 11-character video ID |
| `url` | `string` | Full YouTube watch URL |
| `title` | `string` | Video title |
| `description` | `string` | Snippet description |
| `channelId` | `string` | Channel ID |
| `channelTitle` | `string` | Channel display name |
| `handle` | `string \| null` | Channel handle (e.g. `'@veritasium'`). Null if the channel has none. |
| `thumbnailUrl` | `string` | High-resolution thumbnail URL |
| `publishedAt` | `string \| null` | ISO 8601 publish date |
| `durationSeconds` | `number` | *(only with `includeContentDetails`)* Total duration in seconds |
| `defaultAudioLanguage` | `string \| null` | *(only with `includeContentDetails`)* BCP-47 audio language code |
| `isAgeRestricted` | `boolean` | *(only with `includeContentDetails`)* True if age-restricted |
| `viewCount` | `number \| null` | *(only with `includeContentDetails`)* Total view count |

## Publishing

Push a version tag to trigger the GitHub Actions publish workflow:

```bash
git tag v0.2.0 && git push origin v0.2.0
```

## License

MIT
