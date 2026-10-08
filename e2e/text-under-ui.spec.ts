// Round 3 (2026-10-02). The exchange minigame's hint line rendered UNDERNEATH its third window
// button — reported live as a line of text hidden behind "Market stall". The contrast suite
// (text-legibility.spec.ts) could never catch that class: it measures what is BEHIND each label,
// and a label behind a button measures the button, fails nothing, and stays invisible.
//
// This sweep measures world-space geometry instead: every visible Text object on a screen against
// every button, every other text, the screen bounds, and a minimum size. It runs the audit over
// EVERY minigame in every city at its playing state (the exchange bug existed in exactly two of
// thirty — a sweep is the only way this class stays fixed) plus the main scenes.
import { test, expect } from './fixtures';
import { bootGame, skipFirstTimeOnboarding, waitForActiveScene } from './helpers';

// Same audit used interactively to find the exchange bug. Buttons are createButton containers
// (identified by their 'labelText' data key); bounds come from world transforms, so nesting in
// contentLayer or a card container does not fool it.
const AUDIT = `window.__audit = function(scene){
  const texts=[], buttons=[];
  const world=(o)=>{ const m=o.getWorldTransformMatrix(); const w=(o.displayWidth??o.width)||0, h=(o.displayHeight??o.height)||0; return {x:m.tx-(o.originX??0)*w, y:m.ty-(o.originY??0)*h, w, h}; };
  const visible=(o)=>{ let p=o; while(p){ if(p.visible===false||p.alpha===0) return false; p=p.parentContainer; } return true; };
  const walk=(list,inButton)=>{ list.forEach(o=>{
    if(!o.visible) return;
    if(o.type==='Container'){ const lbl=o.getData&&o.getData('labelText'); if(lbl){ const img=o.list.find(c=>c.type==='Image'); if(img&&visible(o)) buttons.push({r:world(img), c:o}); walk(o.list,o); } else walk(o.list,inButton); }
    else if(o.type==='Text'&&o.text&&o.text.trim()&&visible(o)) texts.push({t:o.text.slice(0,48).replace(/\\n/g,' / '), r:world(o), size:parseInt(o.style.fontSize)||0, btn:inButton||null, o});
  });};
  walk(scene.children.list,null);
  const inter=(a,b)=>{ const x=Math.max(a.x,b.x), y=Math.max(a.y,b.y), x2=Math.min(a.x+a.w,b.x+b.w), y2=Math.min(a.y+a.h,b.y+b.h); return x2>x&&y2>y?(x2-x)*(y2-y):0; };
  const flags=[];
  texts.forEach(t=>{ if(!t.btn) buttons.forEach(b=>{ const ov=inter(t.r,b.r); if(ov> t.r.w*t.r.h*0.15) flags.push('text-under-button: "'+t.t+'" y='+Math.round(t.r.y)); }); });
  for(let i=0;i<texts.length;i++) for(let j=i+1;j<texts.length;j++){ const a=texts[i],b=texts[j]; if(a.btn&&a.btn===b.btn) continue; const ov=inter(a.r,b.r); const min=Math.min(a.r.w*a.r.h,b.r.w*b.r.h); if(min>0&&ov>min*0.25) flags.push('text-overlap: "'+a.t+'" + "'+b.t+'"'); }
  texts.forEach(t=>{ if(t.size>0&&t.size<13&&t.t.length>3) flags.push('tiny-text '+t.size+'px: "'+t.t+'"'); if(t.r.x<-2||t.r.y<-2||t.r.x+t.r.w>722||t.r.y+t.r.h>1282) flags.push('off-screen: "'+t.t+'"'); });
  return flags;
};`;

test('no text sits under a button, overlaps other text, or runs off-screen — every minigame, every city', async ({ page }) => {
  test.setTimeout(240_000); // 30 minigames x ~1.5s each, plus boot, on a loaded runner
  await skipFirstTimeOnboarding(page);
  await bootGame(page);
  await waitForActiveScene(page, 'Title', 20000);
  const failures: string[] = await page.evaluate(async (auditSrc) => {
    // eslint-disable-next-line no-eval
    eval(auditSrc);
    const g: any = (window as any).__game;
    const S: any = (window as any).__state;
    S.newRun('text-under-ui');
    S.data.band.name = 'The Sweep';
    const { CITIES } = await import('/src/game/content.ts');
    const out: string[] = [];
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    g.scene.getScenes(true).forEach((s: any) => { if (s.scene.key !== 'Transition') g.scene.stop(s.scene.key); });
    await wait(200);
    for (const city of CITIES) {
      for (const mg of (city.minigames ?? [])) {
        g.scene.stop('MiniGame');
        await wait(120);
        g.scene.start('MiniGame', { cityId: city.id, minigameId: mg.id, returnPhase: 'locations' });
        await wait(450);
        const m = g.scene.getScene('MiniGame');
        m.cameras.main.resetFX();
        (window as any).__audit(m).forEach((f: string) => out.push(`${city.id}/${mg.id} intro ${f}`));
        m.beginGame();
        await wait(650);
        (window as any).__audit(m).forEach((f: string) => out.push(`${city.id}/${mg.id} play ${f}`));
      }
    }
    g.scene.stop('MiniGame');
    return out;
  }, AUDIT);
  expect(failures, failures.join('\n')).toEqual([]);
});
