# VibeScent

Describe an outfit and an occasion, or add a photo, and get a shortlist of fragrance samples that
fit the look. Built for the Qloo Agentic Hackathon.

**Live demo:** https://vibescent.slate-app.online

## How it works

1. Gemini reads your description or photo and proposes cultural touchstones for the look.
2. Qloo confirms those as real entities and returns aesthetic tags you can review and remove.
3. Gemini turns the tags and your limits into a scent brief, using a controlled vocabulary.
4. The Fragologist catalog filters and ranks real fragrances against that brief.

Budget, gender preference and "nothing too sweet" style limits always win over taste signals. Gemini
4 Argon leads and a chain of Flash models catches rate limits, so one model failing does not stop you.

## Run it locally

Requires Node 22.12 or newer, plus Qloo, Vertex AI and Fragologist catalog credentials.

```sh
npm ci
cp .env.example .env   # fill in the values
node --env-file=.env --import tsx server/index.ts &
npx vite --host 127.0.0.1
```

`npm run check` runs formatting, tests, types and the production build.

## Limits

Only about 50 fragrances carry vibe tags so far, so that signal rarely contributes. Wearing profiles
are estimated and cover about 55% of the catalog. Qloo cues can miss the mood of a look, which is why
each one can be removed. Qloo shows cultural association, not what will suit you.

## License

[MIT](LICENSE)
