/**
 * Campaign auto-runner (local QA only, never shipped).
 *
 * Keeps a headed campaign session moving through its own menus: takes NEXT ARENA between
 * levels, RETRY after a failed run, and starts the next run from the save-slot stage when
 * a campaign completes. It only clicks the buttons a player would click.
 *
 * Inject after the pilot:
 *   const src = await (await fetch('/.tmp/campaign-auto.js')).text(); (0, eval)(src);
 */
(() => {
  const PROGRAMS = ['PROBE', 'WEDGE', 'FISHER', 'SWEEP', 'TOXIC', 'KABOOM'];
  const auto = window.__auto = {
    runIndex: 0, retries: 0, completes: 0, log: [], lastAction: '', lastAt: 0, targetRuns: 4,
  };
  if (window.__autoTimer) clearInterval(window.__autoTimer);

  const log = (s) => {
    auto.log.push(`${Math.round(performance.now() / 1000)}s ${s}`);
    if (auto.log.length > 140) auto.log.shift();
    console.log('[AUTO]', s);
  };
  const stage = () => ([...document.querySelectorAll('.menu-stage')].filter((m) => !m.hidden).map((m) => m.id)[0] || null);
  const click = (el, why) => {
    if (!el) return false;
    log(why);
    el.click();
    return true;
  };

  window.__autoTimer = setInterval(() => {
    if (auto.completes >= auto.targetRuns && window.__deflect.getScreen() === 'title') {
      log(`all ${auto.targetRuns} runs complete; auto-runner idle`);
      clearInterval(window.__autoTimer);
      window.__autoTimer = null;
      return;
    }
    const screen = window.__deflect.getScreen();
    const ov = document.querySelector('#overlay');
    if (ov && !ov.hidden) {
      const title = document.getElementById('overlay-title')?.textContent || '';
      const sub = document.getElementById('overlay-sub')?.textContent || '';
      const kicker = document.getElementById('overlay-kicker')?.textContent || '';
      const k = `${title}|${sub}`;
      if (auto.lastAction === k) return;
      const btns = [...ov.querySelectorAll('button')];
      const next = btns.find((b) => /NEXT/i.test(b.textContent));
      if (next) { auto.lastAction = k; setTimeout(() => click(next, `clear "${title}" -> NEXT ARENA`), 900); return; }
      if (/LOST|BROKEN/i.test(`${title} ${kicker}`)) {
        const retry = btns.find((b) => /RETRY/i.test(b.textContent));
        if (retry) { auto.retries++; auto.lastAction = k; setTimeout(() => click(retry, `failed "${sub.slice(0, 70)}" -> RETRY ${auto.retries}`), 900); }
        return;
      }
      const slots = btns.find((b) => /SLOTS/i.test(b.textContent));
      if (slots) {
        auto.completes++;
        auto.lastAction = k;
        log(`CAMPAIGN COMPLETE #${auto.completes} // ${sub.slice(0, 100)}`);
        setTimeout(() => click(slots, '-> STORY SLOTS'), 900);
      }
      return;
    }
    if (screen !== 'title' || performance.now() - auto.lastAt < 1200) return;
    const st = stage();
    if (st === 'menu-story') {
      const slots = [...document.querySelectorAll('#story-slots button')];
      const fresh = slots.find((b) => /start a new game/i.test(b.getAttribute('aria-label') || ''));
      if (fresh) { auto.lastAt = performance.now(); auto.lastAction = ''; click(fresh, 'new run'); return; }
      // Every slot is finished: clear the last one so another run can start.
      try {
        const raw = JSON.parse(localStorage.getItem('deflect.story.saves') || '[]');
        raw[2] = null;
        localStorage.setItem('deflect.story.saves', JSON.stringify(raw));
        log('wiped slot 3 for a fresh run');
      } catch { log('could not wipe slot 3'); }
      auto.lastAt = performance.now();
      document.getElementById('btn-story-back')?.click();
      setTimeout(() => document.getElementById('btn-solo-campaign')?.click(), 400);
      return;
    }
    if (st === 'menu-story-bots') {
      auto.lastAt = performance.now();
      click([...document.querySelectorAll('#campaign-bots button')].find((b) => b.textContent.trim() === '3 BOTS'), '3 bot companions');
      return;
    }
    if (st === 'menu-solo-program') {
      const want = PROGRAMS[auto.runIndex % PROGRAMS.length];
      auto.runIndex++;
      auto.lastAt = performance.now();
      click([...document.querySelectorAll('#program-picker button')].find((b) => b.textContent.includes(want)), `run ${auto.runIndex} program ${want}`);
      return;
    }
  }, 500);

  log('auto-runner armed');
})();
