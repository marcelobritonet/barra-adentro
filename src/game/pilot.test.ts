import { describe, expect, it } from 'vitest';
import { D2R, KN } from '../sim/ship';
import * as W from '../world/santos';
import { Game } from './game';
import { PilotGrade } from './pilot';

/** Comandante obediente: executa exatamente o que o prático manda. */
function voyage(grade: PilotGrade) {
  const g = new Game();
  g.trust = 0; g.start('entrada'); g.callVTS(); g.callPilot(grade);
  g.warp = 8;
  let maxOff = 0, orders = 0, moorAt = 0;
  for (let i = 0; i < 12000 && g.status === 'running'; i++) {
    const s = g.s, n = W.nearest(s.x, s.y);
    if (g.pilot.state === 'aboard') { g.setRudderDeg(g.pilot.helm); g.setTelegraph(g.pilot.tel); if (g.pilot.ready && !g.mooring) { g.moor(); moorAt = g.time; } }
    else { // esperando o prático: segue o eixo devagar
      const [x, y] = W.pointAt(n.s + 300); let e = Math.atan2(x - s.x, y - s.y) - s.psi; while (e > Math.PI) e -= 2 * Math.PI; while (e < -Math.PI) e += 2 * Math.PI;
      g.setRudderDeg(Math.round(Math.max(-20, Math.min(20, e / D2R * 1.5 - s.r / D2R * 50)) / 5) * 5); g.setTelegraph(6);
    }
    if (n.s < W.QUAY_S - 850) maxOff = Math.max(maxOff, n.d); // só no canal, antes de abrir para o berço
    g.update(0.1);
  }
  orders = g.msgs.filter(m => m.level === 'pilot').length;
  const r = g.result;
  console.log(grade, '→', r?.title ?? g.status, '|', (g.time / 60).toFixed(0), 'min | fora do eixo máx', maxOff.toFixed(0), 'm | sog', (g.sog / KN).toFixed(1),
    '| berço', JSON.stringify(Object.fromEntries(Object.entries(g.berth()).map(([k, v]) => [k, +v.toFixed(0)]))), '| total', r?.total, '| confiança', g.trust, '| espias aos', (moorAt / 60).toFixed(0), 'min');
  console.log(g.msgs.slice(-14).map(m => `${(m.t / 60).toFixed(1)} ${m.who}: ${m.text}`).join('\n'));
  return { g, maxOff, orders };
}

describe('prático', () => {
  it('sênior leva o navio obediente até atracar', () => {
    const { g, maxOff } = voyage('senior');
    expect(g.result?.ok).toBe(true);
    expect(maxOff).toBeLessThan(90);
  });
  it('padrão também chega, com mais desvio', () => {
    const { g } = voyage('padrao');
    expect(g.result?.ok).toBe(true);
  });
});
