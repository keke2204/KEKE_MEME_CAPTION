# Meme Caption Studio

A small full-stack meme caption generator built with React, Vite, TypeScript and Express.

## What it does

- Uploads a JPG, PNG or WEBP image.
- Uses a vision model to describe the visible scene.
- Retrieves related meme patterns from a local corpus.
- Generates three caption styles: Short, Relatable and Over-the-top.
- Renders the selected caption onto the image and lets you download it.

## Stack

- React + Vite + TypeScript
- Express + Multer
- OpenAI-compatible vision/chat API
- Local RAG-style retrieval with hashed text vectors
- Tailwind CSS

## Run locally

```bash
pnpm install
```

Copy `.env.example` to `.env` and add your API key:

```env
OPENAI_API_KEY=your_api_key_here
```

Then:

```bash
pnpm dev
```

Open `http://localhost:3000`.

Without an API key, the app still runs with a simple local fallback so the interface can be tested.

## Project structure

```text
client/       React frontend
server/       Express API, caption generation and retrieval
data/         Meme retrieval corpus
scripts/      Corpus utilities
```

## License

MIT
