import Phaser from 'phaser';
import { PALETTE, W } from '../const';
import { ensureCityBackground } from '../art/sprites';
import { applyVignette, spawnFireflies, spawnRain, type WeatherHandle } from '../art/effects';
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

export type CityPhase = 'arrival' | 'locations' | 'relationship' | 'preshow' | 'afterShow' | 'journal';
const VALID_PHASES: CityPhase[] = ['arrival', 'locations', 'relationship', 'preshow', 'afterShow', 'journal'];
const LOCATIONS_TO_VISIT = 2;

export class CityScene extends Phaser.Scene {
  constructor() { super('City'); }

  private city!: CityDef;
  private phase: CityPhase = 'arrival';
  private dialogueBox!: DialogueBox;
  private pickerContainer: Phaser.GameObjects.Container | null = null;
  private locationsVisited = new Set<string>();
  private rain: WeatherHandle | null = null;
  private fireflies: WeatherHandle | null = null;

  init(data: { cityId: string; phase?: string }): void {
    this.city = getCity(data.cityId);
    // 'preshow-done' (mid-transition to Rhythm) and any unrecognized value fall back to
    // 'arrival' — the only truly unsafe resume points are ones with no matching phase handler.
    this.phase = data.phase && (VALID_PHASES as string[]).includes(data.phase) ? (data.phase as CityPhase) : 'arrival';
    this.locationsVisited = new Set();
  }

  create(): void {
    fadeIn(this);
    const bgKey = ensureCityBackground(this, this.city.id, this.city.tint);
    const bg = this.add.image(0, 0, bgKey).setOrigin(0, 0);
    applyVignette(bg);
    const song = getSong(this.city.songId);
    audio.playAmbience(parseChordProgression(song.chordProgression), song.bpm * 0.5, song.waveform);
    const stop = State.data.route.find((s) => s.cityId === this.city.id);
    if (stop?.weather && /rain|drizzle/.test(stop.weather)) {
      this.rain = spawnRain(this, 0.3);
    } else {
      const fireflyColor = NIGHT_TINTS.has(this.city.tint) ? CITY_TINTS[this.city.tint] : PALETTE.cream;
      this.fireflies = spawnFireflies(this, fireflyColor);
    }

    this.add.text(W / 2, 40, this.city.name, textStyle('h1', { fontSize: '26px' })).setOrigin(0.5).setDepth(50);

    this.dialogueBox = new DialogueBox(this);

    State.setProgress({ screen: 'city', cityId: this.city.id, nodeId: this.phase });
    saveRun(State.data);

    switch (this.phase) {
      case 'arrival': this.walk(this.city.arrivalSceneId, () => this.startLocationPicker()); break;
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
    remaining.forEach((loc, i) => {
      const btn = createButton(this, W / 2 - 300 + (i % 2) * 310, 660 + Math.floor(i / 2) * 60, 290, 50, loc.name, () => this.visitLocation(loc), { fontSize: '16px' });
      this.pickerContainer!.add(btn);
    });
  }

  private visitLocation(loc: LocationDef): void {
    this.pickerContainer?.destroy();
    this.pickerContainer = null;
    this.walk(loc.sceneId, () => {
      this.locationsVisited.add(loc.id);
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
    const pool = this.city.relationshipScenePool;
    const available = pool.filter((e) => State.hasFlag(availabilityFlag(e.id)));
    const entry = available[0] ?? pool[0];
    this.walk(entry.sceneId, () => this.startPreshow());
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
      const btn = createButton(this, W / 2 - 300, 960 + i * 70, 600, 60, opt.label, () => {
        State.applyStatDeltas(opt.effects);
        State.addFlag(arrangementFlag(opt.arrangementId));
        State.setProgress({ screen: 'city', cityId: this.city.id, nodeId: 'preshow-done' });
        saveRun(State.data);
        goTo(this, 'Rhythm', { cityId: this.city.id });
      }, { fontSize: '18px' });
      container.add(btn);
      container.add(this.add.text(W / 2 - 280, 960 + i * 70 + 62, opt.description, textStyle('small', { fontSize: '13px' })));
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
