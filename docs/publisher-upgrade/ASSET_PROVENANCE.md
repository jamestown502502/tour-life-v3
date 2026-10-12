# Tour Life: asset provenance register

Started 2026-10-12 (publisher polish). One row per asset family. **AI status** is stated plainly
because publishers ask (Steam's content survey covers player-facing AI art, music and text) and
several target publishers exclude generative AI. Funding plan: every row marked
"replace when funded" is commissioned from human artists/musicians, with contracts and credit.

| Asset family | Where | Count | Source | AI status | Plan |
|---|---|---|---|---|---|
| Key-art banner | `public/brand/banner-960.webp`, `banner-1600.webp`, `og-image.jpg` | 1 image, 3 exports | Supplied by BAIS 2026-10-12 ("Tour Life: Rhythm Band World Stage") | AI-generated (supplied) | Replace when funded (title/key art, blueprint TL-04) |
| Wordmark (logo) | `public/brand/wordmark.webp` | 1 | Cut out of the banner: rembg u2net + isnet masks, OpenCV GrabCut seeded from them, edge clean-up. Alpha checked: corners transparent, 1.8% soft edge | AI-generated (derived) | Replace with a human-drawn logo when funded |
| Margin backdrop | `public/brand/backdrop.webp` | 1 | Banner downscaled to 64x32, blurred and darkened at build time | AI-generated (derived, unreadable at that size) | Regenerate from human key art |
| App icons, favicon | `public/icons/*`, `public/brand/favicon-48.png` | 4 | Supplied BAIS app icon ("Tour Life: Rhythm Roadtrip", 2026-10-10), cropped inside its rounded corners | AI-generated (supplied) | Replace when funded |
| Painted backgrounds, portraits, crowd | `public/assets/img/*.webp` | 92 | Gemini image pipeline (see HANDOFF.md) | AI-generated | Replace when funded (blueprint TL-04 slice first) |
| Backing tracks + title theme | `public/audio/*.mp3` | 9 | Lyria via the game-music-generator skill | AI-generated | Replace with commissioned recordings/stems when funded |
| Spotlight Bridge motifs | `src/core/audio.ts` | code | Web Audio synthesis written in code (publisher polish 2026-10-12) | Not AI-generated media; **prototype** sound | Replace with recorded bandmate stems when funded |
| UI, buttons, transitions, effects | `src/art/*`, `src/ui/*` | code | Code-drawn (Phaser Graphics) | Not AI-generated media | Keep |
| Fonts | `public/fonts/` | 2 | Baloo 2, Nunito (SIL Open Font License) | Not AI | Keep |
| Story, dialogue, lessons | `content/*` | text | Written with Claude assistance, reviewed by BAIS | AI-assisted text | Human narrative pass when funded |
