import { browserCursorAt, getArena } from '../src/game/arenas';
import { SIM_DT } from '../src/game/config';
import { World } from '../src/game/world';
const names = ['P1','P2','P3','P4','P5','P6','P7','P8'];
const inputs = new Array(8).fill(null);
const arena = getArena(13);
const world = new World('match', names, 0, arena);
const out = {x:0,y:0};
for (let i=0;i<60*12;i++) {
  world.step(SIM_DT, inputs);
  browserCursorAt(arena.browser!, world.browserPage, world.browserT, out);
  if (Math.abs(out.x-world.browserCursorX)>0.01 || Math.abs(out.y-world.browserCursorY)>0.01) {
    console.log('mismatch', i, 't', world.browserT.toFixed(4), 'phase', world.browserPhase, 'page', world.browserPage,
      'derived', out.x.toFixed(3), out.y.toFixed(3), 'world', world.browserCursorX.toFixed(3), world.browserCursorY.toFixed(3));
    break;
  }
}
