import Phaser from 'phaser';
import { PALETTE, PALETTE_HEX, W } from '../const';
import { ensureCityBackground } from '../art/sprites';
import { applyVignette, spawnFireflies, spawnRain, type WeatherHandle } from '../art/effects';
import { addCoverBackground } from '../art/background';
import { CITY_TINTS, NIGHT_TINTS } from '../art/palette';
import { createButton } from './Button';
import { DialogueBox, DIALOGUE_PANEL_H, DIALOGUE_PANEL_X, DIALOGUE_PANEL_Y } from './DialogueBox';
import { goTo, fadeIn } from './transition';
import { State } from '../core/state';
import { saveRun } from '../core/save';
import { getCity, getSong } from '../game/content';
import { audio } from '../core/audio';
import { parseChordProgression } from '../core/musicTheory';
import { resolveNode, visibleChoices, applyChoice, advanceTarget } from '../game/dialogue';
import { evaluateCondition } from '../game/condition';
import { availabilityFlag } from '../game/scenePool';
import { arrangementFlag } from '../game/rhythm';
import type { CityDef, DialogueNode, LocationDef } from '../../content/schema';
import { addTextScrim, textStyle } from './textStyles';
import { addHelpButton } from './HelpButton';
import { addMenuButton } from './MenuButton';
import { nextUnplayedMinigame } from '../game/minigame';
import { memoryFor, returnFeedFlag } from '../game/memory';
import { buildFeed } from '../game/social';
import { showSocialFeed } from './SocialFeed';
import { makeRng } from '../core/rng';
import { WEATHER_EFFECTS, weatherAppliedFlag } from '../game/weather';
import { currentStopFor } from '../game/route';

// 'preshow-choices' (Addendum v2, Item 8a): the second minigame insertion point's resume/return
// phase — the preshow dialogue has already played, only the choice buttons remain. Mirrors
// 'locations' being the resume point after arrival's minigame slot.
export type CityPhase = 'arrival' | 'locations' | 'relationship' | 'preshow' | 'preshow-choices' | 'afterShow' | 'journal';
const VALID_PHASES: CityPhase[] = ['arrival', 'locations', 'relationship', 'preshow', 'preshow-choices', 'afterShow', 'journal'];
const LOCATIONS_TO_VISIT = 2;

// Per-location color grade over the shared city background, by location index. Every location
// in a city reuses the one painted backdrop; a tinted overlay + matching ambient-particle color
// is what makes "the fado house" and "the night market" read as different places at zero
// asset cost. Six entries so a sixth location per city is covered.
const LOCATION_GRADES: { color: number; alpha: number }[] = [
  { color: 0xe0a458, alpha: 0.14 }, // warm citrus — golden-hour interiors
  { color: 0x4a4a8a, alpha: 0.22 }, // indigo — dusk / neon-adjacent
  { color: 0x3e7c7b, alpha: 0.16 }, // teal — cool, calm spaces
  { color: 0xc4704f, alpha: 0.14 }, // terracotta — crowded, lively
  { color: 0x8a6fa3, alpha: 0.20 }, // lavender — quiet, late
  { color: 0x6b8a5a, alpha: 0.16 }, // moss — green, open air
];

export class CityScene extends Phaser.Scene {
  constructor() { super('City'); }

  private city!: CityDef;
  private phase: CityPhase = 'arrival';
  private dialogueBox!: DialogueBox;
  private pickerContainer: Phaser.GameObjects.Container | null = null;
  private locationsVisited = new Set<string>();
  private rain: WeatherHandle | null = null;
  private fireflies: WeatherHandle | null = null;
  private gradeOverlay: Phaser.GameObjects.Rectangle | null = null;
  private baseFireflyColor: number = PALETTE.cream;
  private relationshipsPlayed = new Set<string>();
  /** A resumed mid-dialogue position (see Progress.dialogueNodeId) for one of the linear-walk
   *  phases — consumed once by create()'s switch, at whichever phase it was saved for. */
  private resumeDialogueNodeId: string | null = null;
  /** Node ids walked since the last irreversible boundary (a choice application, or a fresh
   *  top-level entry point — arrival's/preshow's/journal's/afterShow's own start, a new
   *  location's scene, a new relationship-pool entry's scene) — see walk()'s own comment. Not
   *  persisted across a save/resume: "back" is a within-session convenience, not a save-schema
   *  concept. */
  private walkHistory: string[] = [];
  /** The onDone callback for the walk chain currently in progress — goBack() needs it to
   *  re-render a previous node through the exact same walk() path forward navigation uses. */
  private currentOnDone: (() => void) | null = null;
  private backButton: Phaser.GameObjects.Container | null = null;

  init(data: { cityId: string; phase?: string; dialogueNodeId?: string; locationsVisited?: string[]; relationshipsPlayed?: string[] }): void {
    this.city = getCity(data.cityId);
    // 'preshow-done' (mid-transition to Rhythm) and any unrecognized value fall back to
    // 'arrival' — the only truly unsafe resume points are ones with no matching phase handler.
    this.phase = data.phase && (VALID_PHASES as string[]).includes(data.phase) ? (data.phase as CityPhase) : 'arrival';
    // Validated against this city's real scene graph — a stale id (renamed/removed content since
    // the save was written) falls back to null exactly like an unrecognized phase falls back to
    // 'arrival' above, rather than resolveNode() throwing on it later.
    this.resumeDialogueNodeId = data.dialogueNodeId && this.city.scenes[data.dialogueNodeId] ? data.dialogueNodeId : null;
    // Restored from a save so an interruption between two locations (or two relationship-pool
    // entries) resumes the picker remembering what's already been played, instead of re-offering
    // it — filtered against this city's real ids the same way resumeDialogueNodeId is, in case
    // content was renamed/removed since the save was written. Harmless to restore regardless of
    // `this.phase`: each Set is only ever read by its own phase's own logic.
    const realLocationIds = new Set(this.city.locations.map((l) => l.id));
    const realRelationshipIds = new Set(this.city.relationshipScenePool.map((e) => e.id));
    this.locationsVisited = new Set((data.locationsVisited ?? []).filter((id) => realLocationIds.has(id)));
    this.relationshipsPlayed = new Set((data.relationshipsPlayed ?? []).filter((id) => realRelationshipIds.has(id)));
    this.gradeOverlay = null;
    this.walkHistory = [];
    this.currentOnDone = null;
    this.backButton = null;
  }

  /** Fade a location's color grade in (index >= 0) or out (index < 0). Fireflies are re-spawned
   *  in the grade's color so the particles agree with the tint; rain is left alone. */
  private setLocationGrade(index: number): void {
    const grade = index >= 0 ? LOCATION_GRADES[index % LOCATION_GRADES.length] : null;
    if (!this.gradeOverlay) {
      this.gradeOverlay = this.add.rectangle(0, 0, W, this.cameras.main.height, PALETTE.night, 1).setOrigin(0, 0).setAlpha(0).setDepth(2);
    }
    this.tweens.killTweensOf(this.gradeOverlay);
    if (grade) this.gradeOverlay.setFillStyle(grade.color, 1);
    this.tweens.add({ targets: this.gradeOverlay, alpha: grade ? grade.alpha : 0, duration: 450, ease: 'Sine.easeInOut' });
    if (this.fireflies) {
      this.fireflies.stop();
      this.fireflies = spawnFireflies(this, grade ? grade.color : this.baseFireflyColor);
    }
  }

  create(): void {
    fadeIn(this);
    const bgKey = ensureCityBackground(this, this.city.id, this.city.tint);
    const bg = addCoverBackground(this, bgKey);
    applyVignette(bg);
    const song = getSong(this.city.songId);
    audio.playAmbience(parseChordProgression(song.chordProgression), song.bpm * 0.5, song.waveform);
    const stop = currentStopFor(State.data.route, State.data.currentCityIndex, this.city.id);
    if (stop?.weather && /rain|drizzle/.test(stop.weather)) {
      this.rain = spawnRain(this, 0.3);
    } else {
      this.baseFireflyColor = NIGHT_TINTS.has(this.city.tint) ? CITY_TINTS[this.city.tint] : PALETTE.cream;
      this.fireflies = spawnFireflies(this, this.baseFireflyColor);
    }
    this.applyWeatherEffectIfDue(stop?.weather);

    addTextScrim(this, W / 2, 40, 420, 66);
    // h1's default gold measures 2.77:1 on this scrim (just under the 3:1 large-text floor) —
    // cream reliably clears it (5.28:1), see docs/contrast-audit.md.
    this.add.text(W / 2, 40, this.city.name, textStyle('h1', { fontSize: '26px', color: PALETTE_HEX.cream })).setOrigin(0.5).setDepth(50);
    addHelpButton(this, 'Read the story and tap to continue. Choices shape your stats and your relationships with the band — there\'s no wrong one.');
    // yOffset 76: stacked below the DialogueBox backlog toggle this scene always constructs
    // (same (20,20) spot otherwise — see MenuButton.ts's own comment).
    addMenuButton(this, 'City', 76);

    this.dialogueBox = new DialogueBox(this);

    State.setProgress({ screen: 'city', cityId: this.city.id, nodeId: this.phase });
    saveRun(State.data);

    switch (this.phase) {
      case 'arrival': this.startArrival(); break;
      case 'locations': this.startLocationPicker(); break;
      case 'relationship': this.startRelationship(); break;
      case 'preshow': this.startPreshow(); break;
      case 'preshow-choices': this.renderPreShowChoices(); break;
      case 'afterShow': this.walk(this.consumeResumeNode(this.city.afterShowSceneId), () => this.startJournal()); break;
      case 'journal': this.startJournal(); break;
    }

    // The dialogue box only un-ducks music on setVisible(false)/destroy(), neither of which
    // fires when a scene ends mid-dialogue-visible (e.g. journal's last line -> straight to
    // Hub) — without this, music stays stuck at half volume until some later dialogue happens
    // to close. Always restore on the way out, regardless of what state the box was left in.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.rain?.stop(); this.fireflies?.stop(); audio.duckMusic(false); });
  }

  /** Item 5b: the seed-picked weather (previously just a particle effect + flavor text) now
   *  applies a small one-time stat delta, flag-gated so re-entering the scene (e.g. a save
   *  resume landing back on 'arrival') never double-applies it. */
  private applyWeatherEffectIfDue(weather: string | undefined): void {
    if (!weather) return;
    const flag = weatherAppliedFlag(this.city.id);
    if (State.hasFlag(flag)) return;
    State.addFlag(flag);
    const effects = WEATHER_EFFECTS[weather];
    if (effects) State.applyStatDeltas(effects);
    saveRun(State.data);
  }

  /** this.resumeDialogueNodeId, when present, applies to exactly ONE of the linear-walk phases
   *  (arrival/preshow/afterShow/journal) — whichever it was saved under (Progress.dialogueNodeId
   *  is written fresh on every walk() call under the CURRENT phase, so it can't point into the
   *  wrong graph). Consumed (cleared) on first read so a later phase in this same scene lifetime
   *  — reached through normal forward play, not a resume — starts from its own real entry node
   *  instead of accidentally reusing a stale id left over from an earlier phase's resume. */
  private consumeResumeNode(fallback: string): string {
    const node = this.resumeDialogueNodeId ?? fallback;
    this.resumeDialogueNodeId = null;
    return node;
  }

  /** `isBack`: true only when goBack() is re-rendering an already-visited node — skips the
   *  history push (the node is already in the stack) so going back doesn't grow it. */
  /** Arrival, with the return leg's social feed in front of it when this is a second night.
   *
   *  The feed is shown ONCE per return, before the night's dialogue, and only when the tour
   *  actually remembers playing here — a resumed save that already got past it, or a first visit,
   *  goes straight to the arrival scene exactly as before. */
  private startArrival(): void {
    const memory = memoryFor(this.city.id);
    const isReturn = !!memory && !State.data.flags.includes(returnFeedFlag(this.city.id));
    const toArrival = () => this.walk(this.consumeResumeNode(this.city.arrivalSceneId), () => this.startMinigameOrLocations());
    if (!isReturn) { toArrival(); return; }

    // Seeded off the run seed AND the city, so a replayed seed produces this town's exact feed,
    // and two cities in one run never draw the same posts.
    const rng = makeRng(`${State.data.seed}:social:${this.city.id}`);
    State.addFlag(returnFeedFlag(this.city.id));
    saveRun(State.data);
    showSocialFeed(this, this.city.name, buildFeed(memory!, this.city.name, rng), toArrival);
  }

  private walk(nodeId: string, onDone: () => void, isBack = false): void {
    this.currentOnDone = onDone;
    if (!isBack) this.walkHistory.push(nodeId);
    this.updateBackButton();
    // Fixes a real "text repeats" report: only the PHASE ('arrival'/'preshow'/etc.) used to be
    // persisted, not the specific node within it — an interruption (tab close, crash, refresh)
    // anywhere inside a long dialogue walk resumed the player at that phase's very FIRST line,
    // making them re-read (and re-choose through) everything they'd already seen. Saving the
    // exact node on every step lets a resume land back exactly where they left off instead.
    // setProgress REPLACES the whole object (not a merge) — locationsVisited/relationshipsPlayed
    // must be carried forward here too, or a walk() call inside the locations/relationship phase
    // (visitLocation's own location-scene walk, playNextRelationshipScene's entry walk) would
    // immediately clobber the picker-progress just persisted right before it. Harmless to include
    // during arrival/preshow/afterShow/journal — both Sets are simply empty there.
    State.setProgress({
      screen: 'city', cityId: this.city.id, nodeId: this.phase, dialogueNodeId: nodeId,
      locationsVisited: [...this.locationsVisited], relationshipsPlayed: [...this.relationshipsPlayed],
    });
    saveRun(State.data);
    const node: DialogueNode = resolveNode(this.city.scenes, nodeId);
    const filtered: DialogueNode = { ...node, choices: visibleChoices(node) };
    this.dialogueBox.show(
      filtered,
      () => {
        const next = advanceTarget(node);
        if (next) this.walk(next, onDone); else onDone();
      },
      (choice) => {
        // A choice's effects (stats/relationships/flags) are applied immediately and are NOT
        // reversible in general (State.applyStatDeltas clamps — subtracting the same delta back
        // wouldn't undo a clamped change correctly) — history is cleared here so "back" can never
        // cross this boundary. This is the entire safety argument for the feature: since a plain
        // (non-choice) DialogueNode never carries its own effects (only DialogueChoice does, per
        // content/schema.ts), every node "back" can ever re-show is guaranteed effect-free —
        // there is nothing to undo, for any city's content, without a per-node audit.
        this.walkHistory = [];
        const nextId = applyChoice(choice);
        this.walk(nextId, onDone);
      },
    );
  }

  /** Re-renders the previous node in the current walk chain, without re-triggering any effects
   *  (there are none to re-trigger — see walk()'s own comment) and without pushing a new history
   *  entry. Only ever reachable while updateBackButton() has shown the button, i.e. only when
   *  there's genuinely somewhere to go back to. */
  private goBack(): void {
    if (this.walkHistory.length < 2 || !this.currentOnDone) return;
    this.walkHistory.pop();
    const prevId = this.walkHistory[this.walkHistory.length - 1];
    this.walk(prevId, this.currentOnDone, true);
  }

  /** Shows/hides the "‹" back button based on whether walkHistory has anywhere to go — rather
   *  than a toast for an attempted-but-blocked back tap, the button simply isn't there once
   *  there's nothing reversible left (a choice was just made, or this is a walk chain's first
   *  node), which is the more common pattern for this kind of affordance and needed no new toast
   *  system. Mirrors DialogueBox's own chevron position (bottom-right of the panel) at
   *  bottom-left, so it reads as part of the same panel without colliding with anything. */
  private updateBackButton(): void {
    const canGoBack = this.walkHistory.length > 1;
    if (canGoBack && !this.backButton) {
      this.backButton = createButton(
        this, DIALOGUE_PANEL_X + 6, DIALOGUE_PANEL_Y + DIALOGUE_PANEL_H - 58, 56, 56, '‹',
        () => this.goBack(), { fillColor: PALETTE.plum, fontSize: '28px' },
      );
      this.backButton.setDepth(110);
    } else if (!canGoBack && this.backButton) {
      this.backButton.destroy();
      this.backButton = null;
    }
  }

  /** Addendum v2, Item 8a: up to TWO minigames per city per run (was one), at two insertion
   *  points — after arrival and before the preshow choices. `nextUnplayedMinigame` already finds
   *  the first not-yet-played entry regardless of which call site asks, so a second call here
   *  naturally reaches a city's second authored minigame once the first is flagged played; the
   *  played-flag also prevents ever repeating the same one twice in a run. Shared by both
   *  insertion points below — `returnPhase` is where MiniGameScene.finish() sends the player
   *  back to, `fallback` is what runs immediately if there's nothing left to play. */
  private tryMinigame(returnPhase: CityPhase, fallback: () => void): void {
    const next = nextUnplayedMinigame(this.city.minigames, (flag) => State.hasFlag(flag));
    if (next) {
      // Addendum v2, Item 9b: VN -> minigame uses 'card', the minigame's own diegetic intro
      // line doubling as the transition's line so it reads as the story turning a page into the
      // minigame, not a generic loading screen.
      goTo(this, 'MiniGame', { cityId: this.city.id, minigameId: next.id, returnPhase });
    } else {
      fallback();
    }
  }

  private startMinigameOrLocations(): void {
    this.tryMinigame('locations', () => this.startLocationPicker());
  }

  private startMinigameOrPreshowChoices(): void {
    this.tryMinigame('preshow-choices', () => this.renderPreShowChoices());
  }

  private startLocationPicker(): void {
    this.phase = 'locations';
    State.setProgress({ screen: 'city', cityId: this.city.id, nodeId: 'locations' });
    saveRun(State.data);
    this.renderLocationButtons();
  }

  private renderLocationButtons(): void {
    this.dialogueBox.setVisible(false);
    // Leaving the dialogue walk entirely for picker UI — nothing left to "go back" into.
    this.walkHistory = [];
    this.updateBackButton();
    this.pickerContainer?.destroy();
    this.pickerContainer = this.add.container(0, 0).setDepth(80);
    const remaining = this.city.locations.filter((l) => !this.locationsVisited.has(l.id));
    const scrim = addTextScrim(this, W / 2, 620, W - 60, 56);
    const header = this.add.text(W / 2, 620, `Where to, before the show? (${LOCATIONS_TO_VISIT - this.locationsVisited.size} left)`,
      textStyle('body', { fontSize: '18px' })).setOrigin(0.5);
    this.pickerContainer.add([scrim, header]);
    // 70/78 (not the original 50/60): matches BandCreator's genre-grid fix — a raw button needs
    // to clear ~65px including Button.ts's own pad before it reaches a real 44 CSS-px target at
    // the measured 390px scale. With up to 6 locations (3 rows), the grid's bottom edge still
    // clears SAFE_BOTTOM_Y comfortably from its y=660 start.
    remaining.forEach((loc, i) => {
      const btn = createButton(this, W / 2 - 300 + (i % 2) * 310, 660 + Math.floor(i / 2) * 78, 290, 70, loc.name, () => this.visitLocation(loc), { fontSize: '16px' });
      this.pickerContainer!.add(btn);
    });
  }

  private visitLocation(loc: LocationDef): void {
    this.pickerContainer?.destroy();
    this.pickerContainer = null;
    this.setLocationGrade(this.city.locations.indexOf(loc));
    // A new top-level walk chain starts here — reset so "back" can't reach into whichever
    // location (or the arrival dialogue) came before this one.
    this.walkHistory = [];
    this.walk(loc.sceneId, () => {
      this.locationsVisited.add(loc.id);
      // Persisted immediately, before rendering the next picker — an interruption right here
      // (between two locations) is exactly the gap the old code left unprotected.
      State.setProgress({ screen: 'city', cityId: this.city.id, nodeId: 'locations', locationsVisited: [...this.locationsVisited] });
      saveRun(State.data);
      this.setLocationGrade(-1);
      if (this.locationsVisited.size >= LOCATIONS_TO_VISIT || this.locationsVisited.size >= this.city.locations.length) {
        this.startRelationship();
      } else {
        this.renderLocationButtons();
      }
    });
  }

  private startRelationship(): void {
    this.phase = 'relationship';
    State.setProgress({ screen: 'city', cityId: this.city.id, nodeId: 'relationship' });
    saveRun(State.data);
    this.playNextRelationshipScene();
  }

  /** Plays every relationship-pool entry this run drew as available for this city (item 5:
   *  scenePool.drawScenePoolFlags now draws SCENES_PER_CITY, up from 1, so a run sees 2
   *  relationship beats per city instead of 1) in seed-shuffled order, one after another, then
   *  moves on to preshow. Falls back to the pool's first entry if somehow nothing was flagged
   *  available (a legacy-save/empty-draw edge case) — exactly the old single-scene behavior,
   *  just never repeated on the second call. */
  private playNextRelationshipScene(): void {
    const pool = this.city.relationshipScenePool;
    // The arc gate (RelationshipScenePoolEntry.minRelationship) is applied HERE rather than at
    // pool-draw time: standing with a bandmate moves across a run, so a later beat becomes
    // eligible partway through, and an ungated opening beat is always there as the fallback.
    const available = pool.filter((e) => State.hasFlag(availabilityFlag(e.id))
      && !this.relationshipsPlayed.has(e.id)
      && (e.minRelationship === undefined || (State.data.relationships[e.bandmate] ?? 0) >= e.minRelationship));
    const entry = available[0] ?? (this.relationshipsPlayed.size === 0 ? pool[0] : undefined);
    if (!entry) { this.startPreshow(); return; }
    this.relationshipsPlayed.add(entry.id);
    // Persisted immediately, before walking the entry's own dialogue — the SAME dialogueNodeId
    // mechanism already covers an interruption mid-way through this specific entry's own scene
    // graph; this covers the gap between two entries that dialogueNodeId alone couldn't (walk()
    // saves nodeId:'relationship' + whichever node id, but not WHICH pool entries are already
    // spent, so a resume mid-entry-N+1 without this would replay entry N from the picker's own
    // "still available" list, even though it had already finished).
    State.setProgress({ screen: 'city', cityId: this.city.id, nodeId: 'relationship', relationshipsPlayed: [...this.relationshipsPlayed] });
    saveRun(State.data);
    // A new top-level walk chain per entry — "back" shouldn't reach into whichever
    // relationship-pool entry (or location) came before this one.
    this.walkHistory = [];
    this.walk(entry.sceneId, () => this.playNextRelationshipScene());
  }

  private startPreshow(): void {
    this.phase = 'preshow';
    State.setProgress({ screen: 'city', cityId: this.city.id, nodeId: 'preshow' });
    saveRun(State.data);
    this.walkHistory = [];
    this.walk(this.consumeResumeNode(this.city.preShowSceneId), () => this.startMinigameOrPreshowChoices());
  }

  private renderPreShowChoices(): void {
    this.dialogueBox.setVisible(false);
    // Leaving the dialogue walk entirely for the choice buttons — nothing left to "go back" into.
    this.walkHistory = [];
    this.updateBackButton();
    const ctx = { stats: State.data.stats, relationships: State.data.relationships, localLove: State.data.localLove, flags: State.data.flags };
    const options = this.city.preShowChoices.filter((c) => evaluateCondition(c.condition, ctx));
    const container = this.add.container(0, 0).setDepth(80);
    options.forEach((opt, i) => {
      const btn = createButton(this, W / 2 - 300, 960 + i * 82, 600, 66, opt.label, () => {
        State.applyStatDeltas(opt.effects);
        State.addFlag(arrangementFlag(opt.arrangementId));
        State.setProgress({ screen: 'city', cityId: this.city.id, nodeId: 'preshow-done' });
        saveRun(State.data);
        // Stabilization revert: this used to build an arc-aware "On stage — <city>" line for the
        // 'lights' themed cover. With themed transitions off there is nothing to display it on,
        // so the line (and routeArcRole's only use here) goes with it rather than being computed
        // and thrown away. RoutePlanScene/HubScene still surface the same arc roles.
        goTo(this, 'Rhythm', { cityId: this.city.id });
      }, { fontSize: '18px' });
      container.add(btn);
      // These sit directly on the painted city background, same as the location-picker header
      // above — bumped from 13px to 16px (it carries real meaning: what pressing this choice
      // actually does) and given the same scrim treatment as everything else over painted art.
      // small's default sky measures 2.90:1 on this scrim, under even the loosest 3:1 floor and
      // well under this normal-weight text's actual 4.5:1 — cream clears both.
      const descScrim = addTextScrim(this, W / 2, 960 + i * 82 + 76, 600, 34);
      const desc = this.add.text(W / 2 - 280, 960 + i * 82 + 68, opt.description, textStyle('small', { fontSize: '16px', color: PALETTE_HEX.cream }));
      container.add([descScrim, desc]);
    });
  }

  private startJournal(): void {
    this.phase = 'journal';
    State.setProgress({ screen: 'city', cityId: this.city.id, nodeId: 'journal' });
    saveRun(State.data);
    this.walkHistory = [];
    this.walk(this.consumeResumeNode(this.city.journalSceneId), () => this.finishCity());
  }

  private finishCity(): void {
    State.addItem({
      id: `${this.city.id}_gift`, name: this.city.collaborator.gift,
      description: `From ${this.city.collaborator.npcName} in ${this.city.name}`, cityId: this.city.id,
    });
    if (State.hasFlag('found_cassette') && !State.hasLogged('cassette_collected')) {
      State.addItem({ id: 'cassette', name: 'Warped cassette tape', description: 'From a night market stranger, origin unknown.' });
      State.appendLog('cassette_collected');
    }
    // By index, not by id — the return leg books one city twice (see currentStopFor).
    const stop = currentStopFor(State.data.route, State.data.currentCityIndex, this.city.id);
    if (stop) stop.visited = true;
    State.data.currentCityIndex += 1;
    State.setProgress({ screen: 'hub' });
    saveRun(State.data);
    // Addendum v2, Item 9b: city -> hub travel uses 'drive', mirroring hub -> city.
    goTo(this, 'Hub');
  }
}
