This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Database setup

Finalized inspections are stored in Supabase (Postgres + Storage). To run this locally:

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local` and fill in your project's URL and keys (Project Settings -> API).
3. In the Supabase dashboard, open SQL Editor -> New query, paste the contents of
   `supabase/migrations/0001_init.sql`, and run it. This creates the `inspections` and
   `defects` tables, the trigger that makes `ai_*` columns immutable, and Row Level Security.
4. Create a public Storage bucket named `inspection-images` (Storage -> New bucket, toggle
   "Public bucket" on). Product photos are uploaded there on Finalize.

Everything before Finalize (uploads, scanning, review edits) stays in local browser state —
only Finalize writes to the database.

## Vision model setup (Ollama)

Product photos are analyzed by a real local vision model through [Ollama](https://ollama.com) —
nothing is sent to an external API.

1. [Install Ollama](https://ollama.com/download) and make sure it's running (`ollama serve`,
   or just launch the app).
2. Pull a vision-capable model: `ollama pull moondream` (small, ~1.7GB) or
   `ollama pull llava:7b` (larger, more capable).
3. If you pulled a model other than `moondream`, set `OLLAMA_MODEL` in `.env.local`
   (see `.env.example`) to match.

The app talks to Ollama only from the server (`app/api/analyze`, `lib/ollama.ts`) — the
model name and host are never sent to the browser. If Ollama isn't running or the request
times out, the scan cleanly becomes "Failed" / "Needs Manual Review" rather than crashing.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
