# AutoLyrics — API Contract

> **Single source of truth.** The frontend and backend MUST both match this exactly.
> FastAPI, served locally at **`http://127.0.0.1:8756`**. Local-first — nothing leaves the machine.

---

## Endpoints

### `GET /api/meta`

Capabilities and option lists for the UI to render selects, chips, and feature gates.

```jsonc
{
  "styles":     [ { "key": "string", "label": "string" } ],   // genre chips
  "languages":  [ { "code": "string", "label": "string", "iso3": "string" } ],
  "modelSizes": ["large-v3", "large-v3-turbo", "medium", "small"],
  "modes":      [ { "key": "string", "label": "string", "kind": "song" | "speech" } ],
  "formats":    ["lrc", "srt", "vtt", "ass", "json"],
  "engines":    ["whisper"],
  "gpu":        true,        // boolean — GPU available
  "demucs":     true,        // boolean — vocal separation available
  "aligner":    true,        // boolean — forced aligner available
  "version":    "string"
}
```

> `modes[].kind` groups the two top-level flows: `"song"` = lyrics recognition / forced-align (`auto`, `biasing`, `align`); `"speech"` = **Video → Subtitles** (`speech`). `large-v3-turbo` is the fast distilled model — the auto-recommended pick on a no-GPU machine (e.g. Intel Core Ultra).

---

### `POST /api/jobs`

Create a recognition / alignment / transcription job. **`multipart/form-data`** with two fields:

| Field | Type | Description |
|---|---|---|
| `audio` | file | Audio (mp3 / wav / flac / m4a / aac / ogg / opus) **or video** (mp4 / mkv / mov / webm / m4v). Video is decoded by PyAV/ffmpeg; the audio track is extracted automatically. The field name stays `audio` for both. |
| `params` | string | A JSON string — schema below. |

**`params` JSON:**

```jsonc
{
  "mode": "auto" | "biasing" | "align" | "speech",
  "referenceLyrics": "string",   // multiline; line breaks are meaningful (song modes)
  "referenceContent": "string",  // freeform hint text (biasing)
  "styleKeys": ["pop", "ballad"],// from /api/meta styles
  "language": "string | null",   // whisper code, or null = auto-detect
  "modelSize": "large-v3 | large-v3-turbo | medium | small",
  "separate": true,              // run Demucs vocal separation first (song modes); send false for speech
  "device": "auto" | "cuda" | "cpu",
  "engine": "whisper",
  "task": "string | null"        // speech mode: faster-whisper task; null == "transcribe".
                                  // forward hook for a future local translate module — v1 is transcription only.
}
```

**Response:**

```jsonc
{ "jobId": "string" }
```

> UI note: `mode: "align"` is the **Forced-Align** path (full lyrics → near-perfect). `mode: "biasing"` feeds `referenceContent` + `styleKeys` into the recognizer. `mode: "auto"` is pure transcription.
>
> **`mode: "speech"` (Video → Subtitles):** plain speech transcription in the original language — **no** lyric biasing, and **no** vocal separation by default (send `"separate": false`). Reference/style fields are ignored. Returns the same `Result` shape with `modeUsed: "speech"`. Pair with `subtitle: true` on export to get clean, wrapped SRT/WebVTT captions. On a no-GPU machine the recommended `modelSize` is `large-v3-turbo` (fast); `large-v3` is unusably slow on CPU.

---

### `GET /api/jobs/{id}`

Poll job status. `result` is present only when `status === "done"`; `error` only on `"error"`.

```jsonc
{
  "status":  "queued" | "running" | "done" | "error",
  "stage":   "string",      // human-readable stage label
  "pct":     0,             // number 0..100
  "message": "string",
  "result":  { /* Result */ },  // present when status === "done"
  "error":   "string"           // present when status === "error"
}
```

---

### `GET /api/jobs/{id}/export?fmt=…&level=…&subtitle=…`

Download the **original** (unedited) result as a file.

| Query | Values |
|---|---|
| `fmt` | `lrc` \| `srt` \| `vtt` \| `ass` \| `json` |
| `level` | `line` \| `word` |
| `subtitle` | `true` \| `false` (default `false`) |

Returns a file download.

> `vtt` is **WebVTT** (`HH:MM:SS.mmm`, dot — not the SRT comma). `subtitle=true` applies video-caption shaping to `srt` / `vtt`: over-long / over-long-duration / over-CPS segments are split at natural boundaries (punctuation or word gaps) and wrapped to ≤2 balanced lines (Latin ~42 chars/line, CJK ~18). `subtitle=false` (default) keeps lyric output byte-for-byte and is the only mode that matters for `lrc` / `ass` / `json`.

---

### `POST /api/export`

Export an **edited** result. JSON body; returns a formatted text file download.

```jsonc
{
  "result":   { /* Result */ },
  "fmt":      "lrc" | "srt" | "vtt" | "ass" | "json",
  "level":    "line" | "word",
  "subtitle": false   // apply video-caption shaping to srt/vtt (see GET export note)
}
```

> UI note: use this after any in-editor edit; use `GET /api/jobs/{id}/export` only for an untouched result. For the **Video → Subtitles** flow, set `fmt: "srt"` or `"vtt"` with `subtitle: true`.

---

## `Result` shape

```jsonc
{
  "language": "string",
  "modeUsed": "auto" | "biasing" | "align" | "speech",
  "segments": [
    {
      "id":    0,
      "start": 0.0,   // seconds
      "end":   0.0,   // seconds
      "text":  "string",
      "words": [
        {
          "start": 0.0,   // seconds
          "end":   0.0,   // seconds
          "word":  "string",
          "prob":  0.0    // 0..1 confidence — drives the amber low-confidence mark
        }
      ]
    }
  ],
  "meta": {
    "modelSize":   "string",
    "separated":   false,    // whether Demucs ran
    "durationSec": 0.0,
    "engine":      "string"
  }
}
```

---

## Frontend contract notes

- **Confidence:** `words[].prob` drives the hollow-amber low-confidence treatment in the Editor (pulses once as the playhead passes).
- **Capability gating:** disable the Demucs toggle when `meta.demucs === false`; disable Forced-Align mode when `meta.aligner === false`; show GPU options per `meta.gpu`.
- **Library metadata:** display `result.meta.modelSize` + `result.meta.engine` + `modeUsed` per run — a local-first trust signal.
- **Export routing:** edited result → `POST /api/export`; untouched result → `GET /api/jobs/{id}/export`.
- **Timecodes:** all `start`/`end` are seconds (float). UI renders mono `mm:ss.mmm`; ±10 ms nudge = ±0.01 s.
