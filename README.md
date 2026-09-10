# KEKE_MEME_CAPTION

A zero-key meme caption studio built with React, Vite and TypeScript.

## No API key required

The GitHub Pages version runs entirely in the browser. It does **not** require `OPENAI_API_KEY`, Gemini, or another paid AI credential.

The live demo uses a local, deterministic caption engine based on the uploaded image's browser-readable metadata (filename and dimensions). The meme rendering and download also happen in the browser, so the uploaded image is not sent to an app server.

> Note: this zero-key mode is intentionally offline/local-first. It does not provide cloud vision-model understanding. If you later want true AI vision, you can add a provider key and re-enable the Express API in `server/`.

## Live demo

https://keke2204.github.io/KEKE_MEME_CAPTION/

## Run locally

```bash
npm install
npm run dev
```

For the static GitHub Pages build:

```bash
npm run build
```

The build output is `dist/public`.

## Stack

- React + Vite + TypeScript
- Browser Canvas for meme rendering
- Local caption generation with no API key
- Express server retained for optional future AI-provider mode
- GitHub Actions + GitHub Pages deployment

## License

MIT
