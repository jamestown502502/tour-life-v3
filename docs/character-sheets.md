# Character sheets — canonical identity blocks

**Purpose:** 16 portraits (4 bandmates × 4 moods) have to read as the *same four people* across
every mood, and later across any new expressions a future city might need. Text-to-image alone
cannot do that — ask for "Mira, worried" twice and you get two different women. The strategy is:

1. Generate ONE canonical base portrait per bandmate from the identity block below.
2. Derive every other mood **image-to-image** from that base
   (`generate_sprite.mjs --reference <base>.raw.png`), reusing the identity block *verbatim* and
   changing only the mood sentence.
3. `verify` every output — a failed chroma-key is a shipped bug in this portfolio's history.

**Reuse these blocks exactly as written.** Paraphrasing them is how identity drifts. If a
bandmate's look ever needs to change, change it here first, then regenerate all four moods for
that character from a new base — never patch a single mood in isolation.

The visual facts below are not invented: they're lifted from the code-drawn portraits in
`src/art/sprites.ts` (`BANDMATE_BASE` clothing colors, the `SKIN` and `HAIR` maps, the
per-bandmate hair shapes in `drawHairBack`/`drawHairFront`, and the signature accessory in
`drawAccessory`) plus the character definitions in `content/bands.ts`. Keeping them aligned
means the code-drawn fallback and the painted asset are recognizably the same character.

---

## Shared style block (prepend to every generation)

```
Soft gouache cozy storybook character portrait, head and shoulders, centered, facing the
viewer. Painterly gouache texture, soft rounded shapes, no harsh black outlines, warm even
lighting, muted warm palette. Isolated on a plain flat uniform vivid pure green chroma-key
background (#00FF00), with no scenery, no props, no cast shadow, and no green tint on the
character. No text, no border, no frame.
```

> **The green background is load-bearing — do not change it to gray/white/neutral.** The first
> pass used "plain flat uniform light gray", which is chromatically adjacent to two things that
> are *part of the subject*: the whites of the eyes, and Rowan's pale sky-blue shirt. `colorkey`
> ate both. Every portrait shipped with see-through eyes, and all four Rowan portraits had large
> holes punched through the shirt. Pure green is far from every skin tone, hair color, eye white,
> and all four shirt colors, so nothing on the character can be mistaken for background.

## Mood sentences

| Mood | Sentence |
|---|---|
| `happy` | Expression: warm open smile, relaxed eyebrows, bright eyes. |
| `worried` | Expression: faint frown, eyebrows raised and drawn together, eyes looking slightly away, anxious. |
| `tense` | Expression: jaw set, eyebrows lowered and knitted, mouth a flat line, guarded. |
| `inspired` | Expression: eyes wide and lit up, slight open-mouthed smile, eyebrows raised, struck by an idea. |

---

## Mira — lead vocals

> Mira, the band's lead singer: a young woman with light warm-toned skin, long dark brown wavy
> hair falling past her shoulders, wearing a terracotta-orange top, and a small round gold
> pendant on a thin chain.

- Clothing color: terracotta `#C4704F` · Skin: `#EAD9BD` · Hair: dark brown `#3A2418`
- Signature accessory: **gold pendant necklace**
- Wants recognition, fears selling out.

## Theo — drums

> Theo, the band's drummer: a young man with medium tan skin, shaggy medium-brown hair with a
> fringe falling over his forehead, wearing a deep teal shirt, with a wooden drumstick tucked
> behind one ear.

- Clothing color: teal `#3E7C7B` · Skin: `#C48A5F` · Hair: medium brown `#6B4A2F`
- Signature accessory: **drumstick behind the ear**
- Wants rest, fears burning out again.

## Jun — guitar / production

> Jun, the band's guitarist and producer: a young person with deep brown skin and a short
> cropped black undercut hairstyle, wearing a warm golden-yellow shirt, with a guitar pick
> hanging on a cord around their neck.

- Clothing color: gold `#D9A441` · Skin: `#8A5A3C` · Hair: black `#1C1C1C`
- Signature accessory: **guitar pick on a cord**
- Wants sonic experimentation, fears creative stagnation.

## Rowan — bass

> Rowan, the band's bassist: a young person with light tan skin and auburn red hair worn in a
> single braid over one shoulder, wearing a pale sky-blue shirt, with a wide fabric bass strap
> across the chest.

- Clothing color: sky `#8FB7C9` · Skin: `#E0B48A` · Hair: auburn `#8A3A2A`
- Signature accessory: **bass strap across the chest**
- Wants to be seen, fears being replaceable.

---

## Generation recipe

```bash
export GEMINI_API_KEY=$(powershell -NoProfile -Command \
  "[Environment]::GetEnvironmentVariable('GEMINI_API_KEY','User')" | tr -d '\r')

SCRIPT=C:/Users/Jbthi/.claude/skills/user/game-image-generator/scripts/generate_sprite.mjs
OUT=C:/Users/Jbthi/Claude\ Cowork/tour-life-v3/public/assets/img

# 1. base (happy) — text-to-image
node "$SCRIPT" --prompt "<shared style> <identity block> <happy mood>" \
  --filename "$OUT/portrait_mira_happy.png" --resolution 1K --chroma-key --output-size 280x280

# 2. other moods — image-to-image from the base's .raw.png (pre-chroma-key, full detail)
node "$SCRIPT" --reference "$OUT/portrait_mira_happy.raw.png" \
  --prompt "Keep this exact character, identical face, hair, clothing and accessory. <shared style> <identity block> <mood>" \
  --filename "$OUT/portrait_mira_worried.png" --resolution 1K --chroma-key --output-size 280x280

# 3. ALWAYS verify
node "$SCRIPT" verify "$OUT/portrait_mira_worried.png"
```

Notes learned while doing this the first time:
- `generate_sprite.mjs` reads **`GEMINI_API_KEY` from the environment** — it has no `--api-key`
  flag (unlike `generate_image.py`, which has both). Export it.
- Reference the **`.raw.png`**, not the keyed `.png`: the raw file still has the flat background
  and full resolution, which gives the model more to match against.
- `--output-size 280x280` matches the code-drawn portrait canvas exactly, so `DialogueBox`'s
  existing 0.5 display scale and the circular `ensurePortraitFrame` need no changes.
