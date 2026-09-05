# Xlive React Reels

A Vite + React conversion of the supplied Xlive PHP reels interface.

## Features
- Full-screen vertical reels viewer
- Mouse wheel, touch swipe and keyboard navigation
- Previous/next preloading
- Mute/unmute
- Fit / Fill / Auto video sizing
- Playback speed control
- Fullscreen
- Share link using Web Share API with clipboard fallback
- Download button can be enabled per reel
- Global progress bar and click-to-seek
- Double-click/tap seek flash
- Long-press 2x playback boost
- Login screen with 4-digit PIN
- Live page with a configurable live-data endpoint
- Uses the original logo/control artwork from the supplied ZIP

## Run
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
npm run preview
```

## Data
Edit `public/data/videos.json` to manage reels. Each item can contain:
`title`, `image`, `video`, `post`, `download`, and optional `isLive`.

For a live JSON source, set `VITE_LIVE_API_URL` in `.env.local`.
The live adapter expects either an array or `{ "models": [...] }`.
