import Phaser from 'phaser';
import { PALETTE, W } from '../const';
import { ensureCityBackground } from '../art/sprites';
import { applyVignette, spawnFireflies, spawnRain, type WeatherHandle } from '../art/effects';
import { addCoverBackground } from '../art/background';
import { CITY_TINTS, NIGHT_TINTS } from '../art/palette';
import { createButton } from './Button';
import { DialogueBox } from './DialogueBox';
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
import { textStyle } from './textStyles';
import { addHelpButton } from './HelpButton';
import { nextUnplayedMinigame } from '../game/minigame';
import { WEATHER_EFFECTS, weatherAppliedFlag } from '../game/weather';

export type CityPhase = 'arrival' | 'locations' | 'relationship' | 'preshow' | 'afterShow' | 'journal';
const VALID_PHASES: CityPhase[] = ['arrival', 'locations', 'relationship', 'preshow', 'afterShow', 'journal'];
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

  init(data: { cityId: string; phase?: string }): void {
    this.city = getCity(data.cityId);
    // 'preshow-done' (mid-transition to Rhythm) and any unrecognized value fall back to
    // 'arrival' — the only truly unsafe resume points are ones with no matching phase handler.
    this.phase = data.phase && (VALID_PHASES as string[]).includes(data.phase) ? (data.phase as CityPhase) : 'arrival';
    this.locationsVisited = new Set();
    this.relationshipsPlayed = new Set();
    this.gradeOverlay = null;
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
    const stop = State.data.route.find((s) => s.cityId === this.city.id);
    if (stop?.weather && /rain|drizzle/.test(stop.weather)) {
      this.rain = spawnRain(this, 0.3);
    } else {
      this.baseFireflyColor = NIGHT_TINTS.has(this.city.tint) ? CITY_TINTS[this.city.tint] : PALETTE.cream;
      this.fireflies = spawnFireflies(this, this.baseFireflyColor);
    }
    this.applyWeatherEffectIfDue(stop?.weather);

    this.add.text(W / 2, 40, this.city.name, textStyle('h1', { fontSize: '26px' })).setOrigin(0.5).setDepth(50);
    addHelpButton(this, 'Read the story and tap to continue. Choices shape your stats and your relationships with the band — there\'s no wrong one.');

    this.dialogueBox = new DialogueBox(this);

    State.setProgress({ screen: 'city', cityId: this.city.id, nodeId: this.phase });
    saveRun(State.data);

    switch (this.phase) {
      case 'arrival': this.walk(this.city.arrivalSceneId, () => this.startMinigameOrLocations()); break;
      case 'locations': this.startLocationPicker(); break;
      case 'relationship': this.startRelationship(); break;
      case 'preshow': this.startPreshow(); break;
      case 'afterShow': this.walk(this.city.afterShowSceneId, () => this.startJournal()); break;
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

  private walk(nodeId: string, onDone: () => void): void {
    const node: DialogueNode = resolveNode(this.city.scenes, nodeId);
    const filtered: DialogueNode = { ...node, choices: visibleChoices(node) };
    this.dialogueBox.show(
      filtered,
      () => {
        const next = advanceTarget(node);
        if (next) this.walk(next, onDone); else onDone();
      },
      (choice) => {
        const nextId = applyChoice(choice);
        this.walk(nextId, onDone);
      },
    );
  }

  /** At most one minigame per city per run — the first one not yet played this run (checked via
   *  a run-scoped flag, so it repeats gently on a later tour like the onboarding lines do, not
   *  never again). If there is one, it plays between arrival and the location picker and hands
   *  control straight back to 'locations' when done. If not, this is a no-op passthrough. */
  private startMinigameOrLocations(): void {
    const next = nextUnplayedMinigame(this.city.minigames, (flag) => State.hasFlag(flag));
    if (next) {
      goTo(this, 'MiniGame', { cityId: this.city.id, minigameId: next.id, returnPhase: 'locations' });
    } else {
      this.startLocationPicker();
    }
  }

  private startLocationPicker(): void {
    this.phase = 'locations';
    State.setProgress({ screen: 'city', cityId: this.city.id, nodeId: 'locations' });
    saveRun(State.data);
    this.renderLocationButtons();
  }

  private renderLocationButtons(): void {
    this.dialogueBox.setVisible(false);
    this.pickerContainer?.destroy();
    this.pickerContainer = this.add.container(0, 0).setDepth(80);
    const remaining = this.city.locations.filter((l) => !this.locationsVisited.has(l.id));
    const header = this.add.text(W / 2, 620, `Where to, before the show? (${LOCATIONS_TO_VISIT - this.locationsVisited.size} left)`,
      textStyle('body', { fontSize: '18px' })).setOrigin(0.5);
    this.pickerContainer.add(header);
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
    this.walk(loc.sceneId, () => {
      this.locationsVisited.add(loc.id);
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
    const available = pool.filter((e) => State.hasFlag(availabilityFlag(e.id)) && !this.relationshipsPlayed.has(e.id));
    const entry = available[0] ?? (this.relationshipsPlayed.size === 0 ? pool[0] : undefined);
    if (!entry) { this.startPreshow(); return; }
    this.relationshipsPlayed.add(entry.id);
    this.walk(entry.sceneId, () => this.playNextRelationshipScene());
  }

  private startPreshow(): void {
    this.phase = 'preshow';
    State.setProgress({ screen: 'city', cityId: this.city.id, nodeId: 'preshow' });
    saveRun(State.data);
    this.walk(this.city.preShowSceneId, () => this.renderPreShowChoices());
  }

  private renderPreShowChoices(): void {
    this.dialogueBox.setVisible(false);
    const ctx = { stats: State.data.stats, relationships: State.data.relationships, localLove: State.data.localLove, flags: State.data.flags };
    const options = this.city.preShowChoices.filter((c) => evaluateCondition(c.condition, ctx));
    const container = this.add.container(0, 0).setDepth(80);
    options.forEach((opt, i) => {
      const btn = createButton(this, W / 2 - 300, 960 + i * 82, 600, 66, opt.label, () => {
        State.applyStatDeltas(opt.effects);
        State.addFlag(arrangementFlag(opt.arrangementId));
        State.setProgress({ screen: 'city', cityId: this.city.id, nodeId: 'preshow-done' });
        saveRun(State.data);
        goTo(this, 'Rhythm', { cityId: this.city.id });
      }, { fontSize: '18px' });
      container.add(btn);
      container.add(this.add.text(W / 2 - 280, 960 + i * 82 + 68, opt.description, textStyle('small', { fontSize: '13px' })));
    });
  }

  private startJournal(): void {
    this.phase = 'journal';
    State.setProgress({ screen: 'city', cityId: this.city.id, nodeId: 'journal' });
    saveRun(State.data);
    this.walk(this.city.journalSceneId, () => this.finishCity());
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
    const stop = State.data.route.find((s) => s.cityId === this.city.id);
    if (stop) stop.visited = true;
    State.data.currentCityIndex += 1;
    State.setProgress({ screen: 'hub' });
    saveRun(State.data);
    goTo(this, 'Hub');
  }
}
