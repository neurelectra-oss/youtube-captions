# Feature Request: Include Timestamp Metadata in `getVideoTranscript`

## Description of the Problem

Currently, the `getVideoTranscript` function successfully extracts the caption data from YouTube, but it strips out all timing information (`startMs` and `durationMs`) and returns only a single, combined string of raw text. 

For applications that need to synchronize captions with video playback (such as interactive video players, language learning tools, or custom caption overlays), having access to the individual caption segments and their precise timing is strictly necessary. Without this timing data, developers are forced to either write custom parsers or attempt to guess the timings using average speaking rates, which results in inaccurate synchronization.

## Proposed Solution

Instead of exclusively returning the raw combined string, the library should provide an option (or update the default behavior) to return an array of caption objects that includes the start time, duration, and text for each identified segment.

### Current Output:
```javascript
{
  transcript: "We're no strangers to love You know the rules and so do I...",
  language: "en",
  kind: "standard"
}
```

### Proposed Output:
```javascript
{
  transcript: "We're no strangers to love You know the rules and so do I...", // Can keep for backwards compatibility
  segments: [
    {
      text: "We're no strangers to love",
      startMs: 18000,
      durationMs: 4000
    },
    {
      text: "You know the rules and so do I",
      startMs: 22000,
      durationMs: 5000
    }
    // ...
  ],
  language: "en",
  kind: "standard"
}
```

## Where the Fix Needs to Happen

The modification needs to be made primarily within `src/transcript.js` in the `fetchCaptionXml` function. 

Currently, the library iterates over `data.events`, extracts the `utf8` string values, and joins them into a single string. The fix would involve also extracting the `tStartMs` and `dDurationMs` properties from the JSON3 format (or parsing the equivalent attributes if processing the raw XML fallback) and returning the structured array of objects alongside or instead of the concatenated string.
