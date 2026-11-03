# FactSnap

Paste a claim, a link, or a screenshot — get an evidence-backed fact-check in seconds, in the same language as the message.

FactSnap is built for the place misinformation actually travels: family and community chats. Someone forwards a voice of panic, a “share before it’s deleted” note, or a screenshot. The app pulls the checkable claims out of that message, searches fact-checkers and news, and hands back a short reply you can paste into the group.

The interface is English. The check itself follows the language of the input, so an Indonesian forward gets an Indonesian answer.

## How AI is used

The model is not asked to “know” whether something is true. It has two jobs, and search sits between them.

1. **Read.** DeepSeek V4.1 Flash (multimodal) extracts two to four specific, checkable claims and flags clickbait, emotional pressure, anonymous sourcing, and urgency to forward. A screenshot is sent as an image, so the model reads the chat bubble directly. A link is opened first; the page text is the submission, not the evidence.
2. **Search.** Exa retrieves page highlights. The first query is limited to fact-check and news domains: Snopes, PolitiFact, Reuters, AFP Fact Check, Full Fact, FactCheck.org, TurnBackHoax, CekFakta, AP, BBC, Kompas, and Tempo. If that pass is thin, a second open-web query runs.
3. **Judge.** A fresh model call sees only those excerpts. It labels each claim Supported, False, Misleading, or Unverified. Citations are chosen by source number. Any URL the model did not actually receive is dropped, and a confident verdict with no citation is downgraded to Unverified.
4. **Reply.** One more call writes a short group-chat reply in the input language. Links that are not in the cited set are stripped. If that call fails, the app still returns a plain-text fallback.

The browser streams each step (claims found, searching, verdicts) as newline-delimited JSON, so a long check stays visible and does not sit behind a single silent request.

## Stack

- Next.js App Router, React, TypeScript
- [DeepSeek V4.1 Flash on Fireworks](https://fireworks.ai/models/deepseek-ai/deepseek-v4p1-flash) via the [OpenAI-compatible chat completions API](https://docs.fireworks.ai/tools-sdks/openai-compatibility) (`https://api.fireworks.ai/inference/v1`, model `accounts/fireworks/models/deepseek-v4p1-flash`). Screenshots use `image_url` content parts; base64 data URLs are supported under 10MB per Fireworks request.
- [Exa JavaScript SDK](https://exa.ai/docs/sdks/javascript-sdk) `search` with `contents.highlights`, plus `getContents` for submitted links. Domain filters use `includeDomains`.

## Run locally

```bash
npm install
cp .env.example .env.local
# fill in FIREWORKS_API_KEY and EXA_API_KEY
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Use a sample chip, then **Check this**. **Play sample result** replays a saved check of a real TurnBackHoax article and does not call the APIs — useful for a demo if a key is missing.

```bash
npm test
npm run build
```

## Environment variables

| Name | Required | Purpose |
| --- | --- | --- |
| `FIREWORKS_API_KEY` | yes | Fireworks inference key. The API returns a clear error when it is missing. |
| `EXA_API_KEY` | yes | Exa search key. Same behavior when it is missing. |
| `FIREWORKS_MODEL` | no | Defaults to `accounts/fireworks/models/deepseek-v4p1-flash`. |
| `FIREWORKS_REASONING_EFFORT` | no | `none` (default), `low`, `high`, or `max`. `none` keeps checks fast and cheap. Use `low` if verdicts feel too shallow. If Fireworks rejects `none`, set `low`. |
| `EXA_SEARCH_TYPE` | no | `auto` (default) or `lite`. `lite` is cheaper and serves cached pages only. |
| `FACTSNAP_RATE_LIMIT` | no | Checks per IP per hour on one server instance. Default 12, maximum 60. |

Never commit `.env.local`. `.env.example` lists the names only.

## Deploy on Vercel

Hobby plan is enough.

- **Framework preset:** Next.js
- **Root directory:** repository root
- **Build command:** `next build` (the default)
- **Install command:** `npm install`
- **Node.js:** 20 or newer (developed on Node 22)
- **Environment variables:** `FIREWORKS_API_KEY` and `EXA_API_KEY` for Production and Preview. Add the optional variables only if you want to override the defaults.

`app/api/check/route.ts` sets `export const maxDuration = 300`. On the Hobby plan the platform maximum is 300 seconds (the current default is already 300). Do not set a higher value. The route runs on the Node.js runtime and streams newline-delimited JSON; it does not use the Edge runtime. Streaming time counts toward `maxDuration`.

After the first deploy, open the production URL, run **Play sample result** to confirm the UI, then run **Check this** on the “Pesan berantai” or “5G hoax” sample to confirm both keys.

Also set spend limits in the Fireworks and Exa dashboards. The app caps usage, and a dashboard limit is the backstop.

## Cost controls

Per check, worst case:

- 4 claims
- 2 Exa searches per claim (fact-check domains, then the open web only if fewer than 3 sources came back)
- 6 model calls (extract, up to 4 verdicts, 1 reply). A claim with no sources skips the verdict call.
- Text input capped at 8,000 characters
- Screenshots resized in the browser and rejected above ~3.8MB of data-URL text, under both the Vercel ~4.5MB request body limit and the Fireworks 10MB base64 limit
- 12 checks per IP per hour

The rate limit lives in process memory. On Vercel each instance has its own counter, so it is a bill brake, not a global quota.

## Tests

`npm test` mocks Fireworks and Exa. It covers:

- text, URL, and screenshot inputs through the pipeline
- fact-check domains on the first search, including TurnBackHoax and CekFakta
- citations limited to sources that were actually retrieved
- a missing API key
- input limits, private URLs, and the per-IP rate limit

No test calls the live APIs. With keys in `.env.local`, the sample inputs on the home page are the live smoke test.

## Demo path

1. Land on the page and point at the forwarded cooking-oil message.
2. Click **Play sample result** to show claims, red flags, a score, cited TurnBackHoax, and **Copy reply** without waiting on the network.
3. Click **Pesan berantai** or **5G hoax**, then **Check this**, and let the status line move from extracting to searching to judging.
4. Copy the reply. It is meant to be pasted back into the chat, in the language of the original message.

## Limitations

- A verdict is only as good as the pages Exa returned. Thin or off-topic excerpts become Unverified on purpose.
- The model can mis-split a message into claims. The cap is four claims so a rambling forward cannot fan out into a large search bill.
- Screenshot reading depends on the image being legible after it is scaled to 1400px and saved as JPEG.
- The rate limit does not survive a new serverless instance, and it is not shared across regions.
- FactSnap is a demo to slow down a forward. It is not a newsroom, and it should not be the only check for anything that matters.
