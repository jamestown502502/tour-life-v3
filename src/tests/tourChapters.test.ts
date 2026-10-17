// Narrative upgrades (2026-10-16): the intro's two choices, the end-of-Tour-1 and end-of-Tour-2
// chapters, and the profile that carries progress between visits. Both bugs these guard were
// found while building the chapters: finishing a tour wiped every meta field completeRun did not
// list by name (so a replay re-showed scenes already seen), and meta lived only inside the run
// save, which "Start a new tour" clears, so a reload forgot every tour you had finished.
import { describe, expect, it } from 'vitest';
import { completeRun, mergeMeta } from '../game/meta';
import { freshMeta, freshRun, freshAccessibility, type MetaProgress } from '../core/state';
import { BANDMATE_IDS } from '../../content/schema';
import {
  chapterFor, chapterOneBeats, chapterTwoBeats, directSale, openingHook, splitSheetNode, shotgunNode,
  SHOTGUN_LINES, SPLIT_AFTER, LICENSE_AFTER, DEAL_AFTER, TWO_TOUR_CODAS, twoTourTrajectory, splitFromFlags,
  tourOneSnapshot, SALE_PRICES,
} from '../../content/chapters';

const words = (s: string) => s.trim().split(/\s+/).length;

describe('completeRun keeps everything it does not change', () => {
  it('keeps seen scenes, the pinned lesson and the chapter records', () => {
    const meta: MetaProgress = { ...freshMeta(), seenSceneIds: ['a', 'b'], pinnedLesson: 'Read the deal.', chaptersSeen: [1], dealChoice: 'indie' };
    const next = completeRun(meta, { seed: 's', bandName: 'B', endingId: 'live_album', tags: [], completedAt: 1 });
    expect(next.completedRuns).toBe(1);
    expect(next.seenSceneIds).toEqual(['a', 'b']);
    expect(next.pinnedLesson).toBe('Read the deal.');
    expect(next.chaptersSeen).toEqual([1]);
    expect(next.dealChoice).toBe('indie');
  });
});

describe('mergeMeta: a reload never loses finished tours', () => {
  it('takes the side with more finished tours, and unions the scenes seen', () => {
    const fresh = freshMeta();
    const stored: MetaProgress = { ...freshMeta(), completedRuns: 2, seenSceneIds: ['x'], chaptersSeen: [1, 2] };
    const merged = mergeMeta({ ...fresh, seenSceneIds: ['y'] }, stored);
    expect(merged.completedRuns).toBe(2);
    expect(merged.chaptersSeen).toEqual([1, 2]);
    expect([...(merged.seenSceneIds ?? [])].sort()).toEqual(['x', 'y']);
  });
  it('keeps the current side on a tie, and tolerates a missing other side', () => {
    const cur: MetaProgress = { ...freshMeta(), completedRuns: 1, pinnedLesson: 'now' };
    expect(mergeMeta(cur, { ...freshMeta(), completedRuns: 1, pinnedLesson: 'old' }).pinnedLesson).toBe('now');
    expect(mergeMeta(cur, undefined)).toEqual(cur);
  });
});

describe('which chapter a finished tour earns', () => {
  it('first finish is chapter 1, second is chapter 2, later tours have none', () => {
    expect(chapterFor(1)).toBe(1);
    expect(chapterFor(2)).toBe(2);
    expect(chapterFor(0)).toBeNull();
    expect(chapterFor(3)).toBeNull();
  });
});

describe('the intro', () => {
  it('opens on a flash-forward the first time, and on the last ending after that', () => {
    expect(openingHook(freshMeta())).toMatch(/Four weeks from now/);
    const back: MetaProgress = { ...freshMeta(), completedRuns: 1, runHistory: [{ seed: 's', bandName: 'B', endingId: 'quiet_ending', tags: [], completedAt: 1 }] };
    expect(openingHook(back)).toMatch(/Quiet Ending/);
  });
  it('the split sheet offers three choices that each set a flag, with a lesson after each', () => {
    for (const returning of [false, true]) {
      const node = splitSheetNode(returning);
      expect(node.speaker).toBe('theo');
      expect(node.choices).toHaveLength(3);
      for (const c of node.choices!) {
        expect(c.flags?.[0]).toMatch(/^split_(equal|writers|skipped)$/);
        expect(SPLIT_AFTER[c.flags![0]]).toBeTruthy();
      }
      expect(words(node.text)).toBeLessThanOrEqual(40);
    }
  });
  it('shotgun offers every bandmate, and each has a first-drive line', () => {
    const node = shotgunNode();
    expect(node.choices!.map((c) => c.flags![0]).sort()).toEqual(BANDMATE_IDS.map((id) => `shotgun_${id}`).sort());
    for (const id of BANDMATE_IDS) expect(SHOTGUN_LINES[id]).toBeTruthy();
  });
  it('reads the split back from the run flags', () => {
    expect(splitFromFlags(['split_writers'])).toBe('writers');
    expect(splitFromFlags([])).toBeNull();
  });
});

describe('end of Tour 1: The Credits Roll', () => {
  const run = () => {
    const r = freshRun('t1', freshMeta(), freshAccessibility());
    r.route = [{ cityId: 'lisbon', visited: true }, { cityId: 'tokyo', visited: true }];
    return r;
  };
  it('pays off the split sheet: an argument to settle only when it was skipped', () => {
    const signed = run(); signed.flags = ['split_equal'];
    const skipped = run(); skipped.flags = ['split_skipped'];
    const askFor = (beats: ReturnType<typeof chapterOneBeats>) => beats.filter((b) => b.choices?.some((c) => c.id.startsWith('settle_')));
    expect(askFor(chapterOneBeats(signed))).toHaveLength(0);
    expect(askFor(chapterOneBeats(skipped))).toHaveLength(1);
  });
  it("has Rowan's royalty moment with the real U.S. split, and Mira's license choice", () => {
    const beats = chapterOneBeats(run());
    expect(beats.some((b) => b.speaker === 'rowan' && /featured artist/i.test(b.text))).toBe(true);
    expect(beats.some((b) => /45%/.test(b.text) && /5%/.test(b.text) && /register/i.test(b.text))).toBe(true);
    const license = beats.find((b) => b.speaker === 'mira' && b.choices?.length === 3)!;
    for (const c of license.choices!) expect(LICENSE_AFTER[c.id]).toBeTruthy();
  });
  it('mentions Inês only when the tour went through Lisbon', () => {
    const viaLisbon = chapterOneBeats(run()).map((b) => b.text).join(' ');
    const r = run(); r.route = [{ cityId: 'tokyo', visited: true }];
    expect(viaLisbon).toMatch(/Inês/);
    expect(chapterOneBeats(r).map((b) => b.text).join(' ')).not.toMatch(/Inês/);
  });
  it('ends on the envelope that opens Tour 2', () => {
    const beats = chapterOneBeats(run());
    expect(beats[beats.length - 1].text).toMatch(/envelope/i);
  });
  it('snapshots what Tour 2 needs to remember', () => {
    const r = run(); r.flags = ['split_writers']; r.relationships = { mira: 60, theo: 10, jun: 40, rowan: 40 };
    const snap = tourOneSnapshot(r, 'live_album');
    expect(snap.split).toBe('writers');
    expect(snap.tiers).toEqual({ mira: 'fulfilled', theo: 'denied', jun: 'unresolved', rowan: 'unresolved' });
    expect(snap.endingId).toBe('live_album');
  });
});

describe('end of Tour 2: Own the Room', () => {
  const run = (love = 40) => {
    const r = freshRun('t2', freshMeta(), freshAccessibility());
    r.localLove = { lisbon: love, berlin: love };
    return r;
  };
  it('the direct sale shows its working, and the middle price earns most', () => {
    const [low, mid, high] = SALE_PRICES.map((p) => directSale(p, 40));
    for (const s of [low, mid, high]) {
      expect(s.gross).toBe(s.buyers * s.price);
      expect(s.fees + s.net).toBe(s.gross);
      expect(s.fees).toBeGreaterThan(0);
    }
    expect(mid.net).toBeGreaterThan(low.net);
    expect(mid.net).toBeGreaterThan(high.net);
    expect(low.buyers).toBeGreaterThan(high.buyers);
  });
  it('a warmer tour sells to more people', () => {
    expect(directSale(12, 90).buyers).toBeGreaterThan(directSale(12, 10).buyers);
  });
  it('offers the deal three ways, each with a lesson', () => {
    const deal = chapterTwoBeats(run(), freshMeta()).find((b) => b.choices?.some((c) => c.id === 'deal_sign'))!;
    expect(deal.choices!.map((c) => c.id).sort()).toEqual(['deal_indie', 'deal_license', 'deal_sign']);
    for (const c of deal.choices!) expect(DEAL_AFTER[c.id]).toBeTruthy();
  });
  it('closes on every bandmate looking back over both tours', () => {
    const meta: MetaProgress = { ...freshMeta(), completedRuns: 2, tourOne: { split: 'equal', tiers: { mira: 'denied', theo: 'fulfilled', jun: 'unresolved', rowan: 'unresolved' }, endingId: 'quiet_ending' } };
    const r = run(); r.relationships = { mira: 70, theo: 10, jun: 40, rowan: 80 };
    const beats = chapterTwoBeats(r, meta);
    const coda = (id: string) => beats.find((b) => b.id === `coda_${id}`)!.text;
    expect(coda('mira')).toBe(TWO_TOUR_CODAS.mira.rose);
    expect(coda('theo')).toBe(TWO_TOUR_CODAS.theo.fell);
    expect(coda('jun')).toBe(TWO_TOUR_CODAS.jun.heldLow);
    expect(coda('rowan')).toBe(TWO_TOUR_CODAS.rowan.rose);
  });
  it('a save from before Tour 1 was remembered still gets a full chapter', () => {
    const beats = chapterTwoBeats(run(), { ...freshMeta(), completedRuns: 2 });
    for (const id of BANDMATE_IDS) expect(beats.some((b) => b.id === `coda_${id}` && b.speaker === id)).toBe(true);
  });
});

describe('the new writing stays within the house limits', () => {
  it('every two-tour line is 40 words or fewer, and Jun always finishes the album', () => {
    expect(twoTourTrajectory('denied', 'fulfilled')).toBe('rose');
    expect(twoTourTrajectory('fulfilled', 'unresolved')).toBe('fell');
    expect(twoTourTrajectory('fulfilled', 'fulfilled')).toBe('heldHigh');
    expect(twoTourTrajectory('denied', 'denied')).toBe('heldLow');
    for (const id of BANDMATE_IDS) {
      for (const [k, line] of Object.entries(TWO_TOUR_CODAS[id])) {
        expect(words(line), `${id}.${k}`).toBeLessThanOrEqual(40);
      }
    }
    for (const line of Object.values(TWO_TOUR_CODAS.jun)) expect(line).toMatch(/finish/i);
  });
  it('every chapter beat and lesson line is 45 words or fewer', () => {
    const r = freshRun('w', freshMeta(), freshAccessibility());
    r.flags = ['split_skipped'];
    r.route = [{ cityId: 'lisbon', visited: true }];
    const all = [
      ...chapterOneBeats(r), ...chapterTwoBeats(r, freshMeta()),
    ].map((b) => b.text).concat(Object.values(SPLIT_AFTER), Object.values(LICENSE_AFTER), Object.values(DEAL_AFTER), Object.values(SHOTGUN_LINES));
    for (const t of all) expect(words(t), t).toBeLessThanOrEqual(45);
  });
});
