/**
 * Headed campaign pilot (local QA only, never shipped).
 *
 * Injected into the running dev build with `?debug=1`:
 *   const src = await (await fetch('/.tmp/campaign-pilot.js')).text(); (0, eval)(src);
 *
 * The pilot only dispatches ordinary keyboard events, so the game never learns it is
 * being driven by a script. It reads `__deflect.getWorld()` to aim and to route.
 *
 * Movement uses a BFS over a coarse grid of the arena floor instead of a straight line:
 * the tutorial arena is four separate plates joined by bridges, and a body whose centre
 * leaves every plate falls into the void. Walking at the target in a straight line walked
 * into the gaps; BFS crosses on the bridges.
 *
 * Objectives, in order: the open party exit, the port sweep once the assault quota is
 * met, then live threats.
 */
(() => {
  const D = window.__deflect;
  if (!D) throw new Error('campaign pilot needs ?debug=1');

  const CELL = 34;
  const held = new Set();
  const send = (code, down) => {
    if (down === held.has(code)) return;
    down ? held.add(code) : held.delete(code);
    window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, key: code, bubbles: true }));
  };
  const releaseAll = () => { for (const c of [...held]) send(c, false); };
  const tap = (code, ms = 70) => { send(code, true); setTimeout(() => send(code, false), ms); };
  const now = () => performance.now();

  window.__pilotLog = [];
  const log = (s) => {
    window.__pilotLog.push(`${Math.round(now() / 1000)}s ${s}`);
    if (window.__pilotLog.length > 160) window.__pilotLog.shift();
    console.log('[PILOT]', s);
  };

  let timer = null;
  let lastPhase = '', lastHp = 9, stepKey = '', stepSince = 0, stuckSkips = 0;
  let lastSwing = 0, lastDash = 0, lastSkill = 0, lastHeavy = 0, lastCycle = 0, lastLock = 0;
  let lUntil = 0, guardUntil = 0;
  let nudge = null, lastNudge = 0;        // short steps that land facing on the target
  let portHpKey = '', portHpSince = 0, portLaneIdx = 0, portLanePoint = null;
  let field = null;            // cached floor description for the current arena
  let route = null;            // cached BFS route
  let routeAt = 0, routeGoalKey = '';

  window.__pilotStop = () => {
    if (timer) clearInterval(timer);
    timer = null;
    window.__pilotTimer = null;
    releaseAll();
  };

  window.__pilotStart = () => {
    window.__pilotStop();
    timer = setInterval(tick, 50);
    window.__pilotTimer = timer;
    log('pilot started');
    return 'campaign pilot running';
  };

  window.__pilotState = () => {
    const w = D.getWorld();
    const p = w && w.players[0];
    const ov = document.querySelector('#overlay');
    const boss = w && w.worms ? w.worms.filter((x) => x.active && x.bossKind >= 0) : [];
    return {
      phase: w && w.campaignPhase,
      kills: w && w.gauntletKills,
      need: w && w.campaignKillsToClear,
      ports: w && `${w.portsClosed}/${w.portTotal}`,
      exit: w && w.campaignExitReady,
      hp: p && p.hp,
      alive: p && p.alive,
      boss: boss.map((b) => ({ kind: b.bossKind, hp: Math.round(b.hp), fly: b.flyPhase })),
      tutorial: w && w.tutorial ? (w.tutorial.done ? 'done' : (w.tutorial.current && w.tutorial.current.action)) : null,
      overlay: ov && !ov.hidden
        ? `${document.getElementById('overlay-title')?.textContent} // ${document.getElementById('overlay-sub')?.textContent}`
        : null,
      stuckSkips,
      log: window.__pilotLog.slice(-10),
    };
  };

  /** Floor description for the arena, built once per world. */
  function describeFloor(arena) {
    const rooms = (arena && arena.rooms) || [];
    const decks = (arena && arena.bridges) || [];
    const chasms = (arena && arena.traverse && arena.traverse.chasms) || [];
    const voids = (arena && arena.voids) || [];
    // Only a traversal arena cuts holes in its floor. QUARANTINE draws themed room plates
    // but has no voids and no chasms, so its whole bounded rect is walkable and treating
    // the seams between the plates as gaps froze the pilot in place.
    // A traversal arena names its walkable floor: `islands` over open void, tutorial room
    // plates, and the bridge decks that join them. Everything else is a drop, so a pilot
    // that treats the arena rect as floor walks into the void on every approach.
    const islands = (arena && arena.islands) || [];
    const hasHoles = chasms.length > 0 || voids.length > 0 || islands.length > 0;
    const plates = hasHoles ? [...islands, ...rooms, ...decks] : [];
    const reject = [...chasms, ...voids];
    const inRect = (r, x, y) => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h;
    const walkable = (x, y) => {
      if (x < b.left || x > b.right || y < b.top || y > b.bottom) return false;
      if (plates.length) {
        let on = false;
        for (const r of plates) if (inRect(r, x, y)) { on = true; break; }
        if (!on) return false;
        for (const r of reject) if (inRect(r, x, y)) return false;
        return true;
      }
      for (const r of reject) if (inRect(r, x, y)) return false;
      return true;
    };
    const b = (arena && arena.bounds) || { left: 0, top: 0, right: 2000, bottom: 1100 };
    return {
      rooms, decks, chasms, voids, plates, walkable,
      minX: b.left, minY: b.top,
      cols: Math.max(1, Math.ceil((b.right - b.left) / CELL)),
      rows: Math.max(1, Math.ceil((b.bottom - b.top) / CELL)),
    };
  }

  /** BFS over walkable cells; returns a list of world-space waypoints toward the goal. */
  function plan(f, fromX, fromY, toX, toY) {
    const { cols, rows, walkable, minX, minY } = f;
    const cellX = (x) => Math.max(0, Math.min(cols - 1, Math.round((x - minX) / CELL)));
    const cellY = (y) => Math.max(0, Math.min(rows - 1, Math.round((y - minY) / CELL)));
    const idx = (cx, cy) => cy * cols + cx;
    const centre = (i) => ({ x: minX + (i % cols) * CELL, y: minY + Math.floor(i / cols) * CELL });
    const start = idx(cellX(fromX), cellY(fromY));
    let goal = idx(cellX(toX), cellY(toY));
    if (!walkable(centre(goal).x, centre(goal).y)) {
      // Snap the goal to the nearest walkable cell so a port inside cover still routes.
      let best = -1, bestD = Infinity;
      for (let i = 0; i < cols * rows; i++) {
        const c = centre(i);
        if (!walkable(c.x, c.y)) continue;
        const d = (c.x - toX) ** 2 + (c.y - toY) ** 2;
        if (d < bestD) { bestD = d; best = i; }
      }
      if (best < 0) return null;
      goal = best;
    }
    const prev = new Int32Array(cols * rows).fill(-2);
    const queue = new Int32Array(cols * rows);
    let head = 0, tail = 0;
    prev[start] = -1;
    queue[tail++] = start;
    while (head < tail) {
      const cur = queue[head++];
      if (cur === goal) break;
      const cx = cur % cols, cy = Math.floor(cur / cols);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const ni = idx(nx, ny);
        if (prev[ni] !== -2) continue;
        const c = centre(ni);
        if (!walkable(c.x, c.y)) continue;
        prev[ni] = cur;
        queue[tail++] = ni;
      }
    }
    if (prev[goal] === -2) return null;
    const path = [];
    for (let cur = goal; cur >= 0; cur = prev[cur]) path.push(centre(cur));
    path.reverse();
    return path;
  }

  function tick() {
    const w = D.getWorld();
    if (!w) { releaseAll(); return; }
    const p = w.players[0];
    if (!p) { releaseAll(); return; }

    const arena = w.arena;
    if (!field || field.arenaId !== (arena && arena.id)) {
      field = describeFloor(arena);
      field.arenaId = arena && arena.id;
      route = null;
    }
    const f = field;

    if (w.campaignPhase !== lastPhase) {
      log(`phase ${lastPhase || '-'}->${w.campaignPhase} kills ${w.gauntletKills}/${w.campaignKillsToClear} ports ${w.portsClosed}/${w.portTotal}`);
      lastPhase = w.campaignPhase;
    }
    if (p.hp < lastHp) log(`hp ${lastHp}->${p.hp} killer ${p.killerKind}`);
    lastHp = p.hp;

    const tutorial = w.tutorial && !w.tutorial.done ? w.tutorial.current : null;
    const overlay = document.querySelector('#overlay');
    if (overlay && !overlay.hidden) { releaseAll(); return; }
    if (!p.alive) return;

    if (tutorial) {
      const id = tutorial.id || tutorial.action;
      if (id !== stepKey) { stepKey = id; stepSince = now(); }
      else if (now() - stepSince > 30000) {
        log(`stuck tutorial ${tutorial.action} -> skip`);
        w.skipTutorial();
        stuckSkips++;
        stepKey = '';
      }
      if (tutorial.action === 'power' && lUntil < now()) { send('KeyL', true); lUntil = now() + 460; }
      else if (tutorial.action === 'skill' && now() - lastSkill > 700) { tap('KeyL', 90); lastSkill = now(); }
    }

    const assaultLive = w.campaignPhase === 'assault';
    const portals = assaultLive ? w.props.filter((b) => b && b.active && b.portal && !b.portalExit && b.hp > 0) : [];
    const exit = assaultLive ? w.props.find((b) => b && b.active && b.portalExit) : null;

    let best = null, bestD = Infinity;
    for (const arr of [w.worms, w.viruses, w.sentries, w.errors]) {
      if (!arr) continue;
      for (const o of arr) {
        if (!o || o.x === undefined || o.y === undefined) continue;
        if (o.hp !== undefined && o.hp <= 0) continue;
        if (!o.active) continue;
        const d = Math.hypot(o.x - p.x, o.y - p.y);
        if (d < bestD) { bestD = d; best = o; }
      }
    }

    const quotaMet = w.gauntletKills >= w.campaignKillsToClear;
    let tx = null, ty = null, aim = best, standoff = 240;

    if (exit) {
      tx = exit.x + exit.w / 2; ty = exit.y + exit.h / 2;
      aim = best && bestD < 240 ? best : null;
      standoff = aim ? 200 : 0;
    } else if (portals.length) {
      let pb = portals[0], pd = Infinity;
      for (const b of portals) {
        const d = Math.hypot(b.x + b.w / 2 - p.x, b.y + b.h / 2 - p.y);
        if (d < pd) { pd = d; pb = b; }
      }
      const pcx = pb.x + pb.w / 2, pcy = pb.y + pb.h / 2;
      aim = { x: pcx, y: pcy, port: true }; bestD = pd; standoff = 0;
      // A port only closes from a clear lane. When its hp stops moving, walk to the next
      // lane around it instead of standing in cover, the way a player repositions.
      const hpKey = `${Math.round(pcx)},${pb.hp}`;
      if (hpKey !== portHpKey) {
        portHpKey = hpKey;
        portHpSince = now();
        portLanePoint = null;
        portLaneIdx = 0;
      }
      // Swap lanes only when this one has stopped landing damage, so a working lane is kept.
      if (!portLanePoint || now() - portHpSince > 12000) {
        if (portLanePoint) { portLaneIdx++; portHpSince = now(); }
        const lanes = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]];
        for (let k = 0; k < 8; k++) {
          const [ox, oy] = lanes[(portLaneIdx + k) % 8];
          const lx = pcx + ox * 170, ly = pcy + oy * 170;
          if (f.walkable(lx, ly)) { portLanePoint = { x: lx, y: ly }; break; }
        }
        if (portLanePoint) log(`port lane ${Math.round(portLanePoint.x)},${Math.round(portLanePoint.y)} (hp ${pb.hp})`);
      }
      if (portLanePoint) { tx = portLanePoint.x; ty = portLanePoint.y; }
      else { tx = pcx; ty = pcy; }
    } else if (!portals.length && best && bestD < 760) {
      tx = best.x; ty = best.y;
    } else if (portals.length) {
      let pb = portals[0], pd = Infinity;
      for (const b of portals) {
        const d = Math.hypot(b.x + b.w / 2 - p.x, b.y + b.h / 2 - p.y);
        if (d < pd) { pd = d; pb = b; }
      }
      tx = pb.x + pb.w / 2; ty = pb.y + pb.h / 2;
      aim = { x: tx, y: ty, port: true }; bestD = pd; standoff = 0;
    } else if (f.rooms.length) {
      let br = null, bd = Infinity;
      for (const r of f.rooms) {
        const d = Math.hypot(r.x + r.w / 2 - p.x, r.y + r.h / 2 - p.y);
        if (d < bd) { bd = d; br = r; }
      }
      tx = br.x + br.w / 2; ty = br.y + br.h / 2; aim = null;
    }
    if (tutorial && tutorial.action === 'reflect') {
      let bd = Infinity;
      for (const b of w.projectiles || []) {
        if (!b || !b.active) continue;
        const d = Math.hypot(b.x - p.x, b.y - p.y);
        if (d < bd) { bd = d; aim = b; tx = b.x; ty = b.y; }
      }
    }

    // Guard the front 180 when a shot is about to arrive.
    let incoming = false;
    for (const b of w.projectiles || []) {
      if (!b || !b.active) continue;
      const dxb = b.x - p.x, dyb = b.y - p.y;
      const d = Math.hypot(dxb, dyb);
      if (d > 190) continue;
      if ((b.vx || 0) * dxb + (b.vy || 0) * dyb < 0) continue;
      const fx = Math.cos(p.facing), fy = Math.sin(p.facing);
      if (dxb * fx + dyb * fy > -0.15 * d) { incoming = true; break; }
    }
    if (incoming) { send('KeyJ', true); guardUntil = now() + 200; }
    else if (guardUntil && now() > guardUntil) { send('KeyJ', false); guardUntil = 0; }

    // Route along the plates.
    let dx = 0, dy = 0;
    if (tx !== null) {
      const goalKey = `${Math.round(tx / 60)},${Math.round(ty / 60)}`;
      if (!route || now() - routeAt > 500 || goalKey !== routeGoalKey) {
        route = plan(f, p.x, p.y, tx, ty);
        routeAt = now();
        routeGoalKey = goalKey;
      }
      if (route && route.length > 1) {
        // Aim at the very next cell. Skipping ahead cut plate corners and walked the body
        // off the lip into the void; one cell at a replan every few frames does not.
        let i = 1;
        while (i < route.length - 1 && Math.hypot(route[i].x - p.x, route[i].y - p.y) < CELL * 0.6) i++;
        const wp = route[i];
        let ax = wp.x - p.x, ay = wp.y - p.y;
        const d = Math.hypot(ax, ay) || 1;
        // Close to the goal, go straight at it so facing lands on the port or exit.
        const gd = Math.hypot(tx - p.x, ty - p.y);
        if (gd < 150 && standoff === 0) { ax = tx - p.x; ay = ty - p.y; }
        const ad = Math.hypot(ax, ay) || 1;
        dx = ax / ad; dy = ay / ad;
        if (standoff > 0 && gd <= standoff + 60 && gd >= standoff - 80) { dx = -(ty - p.y) / gd; dy = (tx - p.x) / gd; }
        else if (standoff > 0 && gd < standoff) { dx = -(tx - p.x) / gd; dy = -(ty - p.y) / gd; }
      } else {
        let ax = tx - p.x, ay = ty - p.y;
        const d = Math.hypot(ax, ay) || 1;
        dx = ax / d; dy = ay / d;
      }
      if (p.hp <= 2 && aim && !aim.port && bestD < 340 && standoff > 0) { dx = -dx; dy = -dy; }
    }

    // Never step toward a line that leaves the floor: sample the path ahead and fall back
    // to the next route cell (or stand still) when the direct line crosses a gap.
    const lineOk = (ddx, ddy) => {
      for (let s = 18; s <= 72; s += 18) if (!f.walkable(p.x + ddx * s, p.y + ddy * s)) return false;
      return true;
    };
    if ((dx || dy) && !lineOk(dx, dy)) {
      if (route && route.length > 1) {
        const wp2 = route[1];
        const ax = wp2.x - p.x, ay = wp2.y - p.y;
        const d2 = Math.hypot(ax, ay) || 1;
        if (lineOk(ax / d2, ay / d2)) { dx = ax / d2; dy = ay / d2; }
        else { dx = 0; dy = 0; }
      } else { dx = 0; dy = 0; }
    }

    // Facing comes from movement only. A body pinned against cover or a ledge edge keeps its
    // old facing and fires past the target forever, so take a short step at the target: that
    // is exactly the input a player uses to turn without walking away.
    if (!dx && !dy && aim) {
      const ax3 = aim.x - p.x, ay3 = aim.y - p.y;
      if (Math.hypot(ax3, ay3) > 12) {
        if (!nudge && now() - lastNudge > 180) { nudge = { x: ax3, y: ay3, until: now() + 120 }; lastNudge = now(); }
      }
    }
    if (nudge) {
      if (now() > nudge.until) nudge = null;
      else {
        const nd = Math.hypot(nudge.x, nudge.y) || 1;
        const sdx = nudge.x / nd, sdy = nudge.y / nd;
        if (lineOk(sdx, sdy)) { dx = sdx; dy = sdy; }
      }
    }

    send('KeyW', dy < -0.35);
    send('KeyS', dy > 0.35);
    send('KeyA', dx < -0.35);
    send('KeyD', dx > 0.35);

    if (aim && !aim.port && !p.lockActive && now() - lastLock > 1200) { tap('KeyQ'); lastLock = now(); }
    if (aim && !aim.port && now() - lastCycle > 4200) { tap('KeyR'); lastCycle = now(); }
    send('KeyK', !!aim || !!tutorial);
    if (!incoming && now() - lastSwing > 430) { tap('KeyJ'); lastSwing = now(); }
    if (now() - lastDash > 2400 && (dx || dy)) { tap('ShiftLeft'); lastDash = now(); }
    if (lUntil && now() > lUntil) { send('KeyL', false); lUntil = 0; }
    if (!lUntil && !tutorial && now() - lastHeavy > 12000 && aim && !aim.port && bestD > 430) { send('KeyL', true); lUntil = now() + 700; lastHeavy = now(); }
    else if (!lUntil && !tutorial && now() - lastSkill > 5200) { tap('KeyL', 90); lastSkill = now(); }
  }

  window.__pilotStart();
})();
