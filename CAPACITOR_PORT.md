# Wrapping Tour Life for Android (Capacitor) — runbook for whoever does the port

This game is a static Vite build (`npm run build` → `dist/`) with no native code, no server, and
no server-side APIs — everything it needs (IndexedDB, localStorage, Web Audio, canvas) is
available in an Android WebView. Wrapping it is a packaging job, not a rewrite. This doc is the
complete checklist; nothing here has been executed yet — no `capacitor.config.*` exists in this
repo, no Android project has been generated. Read `DESIGN.md`'s note on WebView traps near
"Known WebView traps to test for" before you start; it names the same things this doc expands on.

## 1. Install and initialize

```bash
npm install @capacitor/core @capacitor/cli
npx cap init "Tour Life" com.bennettaisolutions.tourlife --web-dir dist
npx cap add android
```

`--web-dir dist` matters — this repo's `vite.config.ts` already builds to `dist/` with
`base: './'` (relative asset paths), which is *required* for Capacitor's `file://`-scheme WebView
to resolve JS/CSS/asset URLs correctly. Don't change `base` back to `/` for this port; it would
break asset loading inside the wrapped app even though it works fine on the web.

## 2. The build+copy loop

Every time you rebuild the web app, Capacitor's native project needs to pick up the new `dist/`:

```bash
npm run build && npx cap copy android && npx cap sync android
```

`copy` moves `dist/` into the Android project's assets; `sync` also re-checks native
dependencies/plugins. Use `copy` alone for a pure content/JS change (fast); `sync` when you've
added or changed a Capacitor plugin.

## 3. Orientation lock

The game is portrait-only (720×1280 canvas, `Scale.FIT`) — there's no responsive landscape
layout, and one wasn't designed. Lock it in `android/app/src/main/AndroidManifest.xml`, on the
main `<activity>`:

```xml
<activity
    android:name=".MainActivity"
    android:screenOrientation="portrait"
    ...>
```

## 4. Safe-area / edge-to-edge

`index.html` already pads `#app` with `env(safe-area-inset-*)` on all four sides, and every touch
target in the game was measured and fixed against a 44 CSS-px floor at a 390px-wide viewport
(see `HANDOFF.md` §5.6/§14.5) — that work carries over as-is to a WebView, no port-specific CSS
needed. If a specific Android device/OS version doesn't honor `env(safe-area-inset-*)` inside a
WebView (older WebView builds have been inconsistent here), the fallback is the
`capacitor-community/safe-area` plugin, which exposes the real inset values as CSS variables via
a native bridge instead of relying on the WebView's own CSS environment support:

```bash
npm install @capacitor-community/safe-area
```

Don't add this preemptively — only if a real-device test (item 8, below) shows padding is wrong.

## 5. Storage

`src/core/save.ts` already does IndexedDB-first with a `localStorage` fallback. Both work
identically inside an Android WebView (Chrome-based WebViews have supported IndexedDB for years);
no changes needed. One real risk specific to a wrapped app: some OEM WebView configurations clear
app data more aggressively than a desktop browser profile does. Nothing to build for this now —
just don't be surprised if a QA report says "my save vanished after clearing storage" and it turns
out to be OS-level storage management, not a save-code bug.

## 6. Audio unlock

Web Audio in this game only starts on the first user gesture (`audio.unlock()`, called from a
pointerdown/keydown — see `src/core/audio.ts`). Android WebViews enforce the same
autoplay-restriction gesture requirement Chrome does on the web, so this already-existing unlock
path is exactly what a WebView needs — nothing new to build. The one thing to verify on a real
device (not assume): that the *very first* tap on the Title screen is what triggers it, since a
WebView's gesture detection can occasionally be stricter about what counts as a "real" tap than a
desktop browser's dev tools emulation.

## 7. Haptics

`src/ui/RhythmScene.ts` already calls `navigator.vibrate?.(ms)` on perfect hits (15ms) and misses
(30ms), gated by the "Haptics" toggle in Settings (`src/core/state.ts`'s `accessibility.haptics`,
defaulted on when the user agent matches `/Android/i`). `navigator.vibrate` works inside a
Capacitor WebView without any plugin — this is the same Web Vibration API, not a native bridge
call. A native `@capacitor/haptics` plugin (richer patterns, iOS support) is a nice-to-have for
later, not needed for launch; the current implementation is enough on its own for the explicit
Android target.

## 8. Signing and release checklist

1. `keytool -genkey -v -keystore tourlife-release.keystore -alias tourlife -keyalg RSA -keysize 2048 -validity 10000` — generate a release keystore. **Keep this file and its passwords somewhere durable and backed up** — a lost release keystore means you can never update the app again under the same package id.
2. Configure `android/app/build.gradle`'s `signingConfigs` to point at the keystore (Capacitor's docs have the exact block; don't hand-roll it).
3. `cd android && ./gradlew assembleRelease` (or `bundleRelease` for a Play Store `.aab`, which Google now requires for new apps).
4. **Content rating**: this build has zero mature content — no substance references, no violence, no gambling mechanics beyond a flavor-text "lucha libre" location and "buy a raffle ticket"-style minigames that are cosmetic only. The Part 3 "reality layer" (Wellbeing/Groundedness/Vices — see `HANDOFF.md` §7.1) is **not in this build**; it was deliberately deferred by the project owner and never implemented. Answer the Play Console's content-rating questionnaire honestly for what's actually shipped — everything, everywhere in the current game, is cozy/all-ages.
5. Play Console: create the app listing, upload the signed `.aab`, fill in the store listing (the `icons/icon-512.png` this pass generated is the same base art the PWA manifest uses — reuse it or commission a dedicated Play Store icon if the freelancer wants something bespoke), submit for review.

## 9. What NOT to do

- Don't re-architect anything in `src/` for this port. The game doesn't know or care that it's
  running in a WebView instead of a browser tab.
- Don't add a backend, an update-check API, or remote config — there isn't one today and none of
  the close-out plan's items need one.
- Don't touch `vite.config.ts`'s `base: './'` — see item 1.
- Don't skip a real-device pass before shipping. Everything in this repo's touch-target and
  accessibility work was verified via viewport emulation (`HANDOFF.md` §7.3 says this plainly) —
  never on physical Android hardware. A WebView on real hardware is the first genuinely
  first-party test this game will get; budget time for it to surface something emulation didn't.
