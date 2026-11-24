// Outros navios: fundeados (giram com vento e corrente) e um navio saindo pelo canal.
// Eles não desviam: quem manobra é o comandante.
import { D2R, KN } from '../sim/ship';
import * as W from '../world/santos';
import type { Game } from './game';

export interface Other {
  name: string; kind: 'anchored' | 'outbound';
  L: number; B: number; color: number;
  x: number; y: number; psi: number; u: number;   // u = velocidade no fundo, m/s
  active: boolean;
  ax: number; ay: number; scope: number;          // fundeados: ferro e amarra
  s: number; spawnAt: number;                     // em movimento: posição ao longo do canal
  warned: boolean; near: boolean;
}
const wrap = (a: number) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const OUT_OFFSET = -55;   // o navio que sai mantém o boreste dele, que é o bombordo de quem entra

function anchored(name: string, ax: number, ay: number, L: number, B: number, scope: number, color: number): Other {
  return { name, kind: 'anchored', L, B, color, x: ax, y: ay, psi: 0, u: 0, active: true, ax, ay, scope, s: 0, spawnAt: 0, warned: false, near: false };
}
export function makeTraffic(): Other[] {
  return [
    anchored('Serra Azul', -2380, -3420, 150, 23, 95, 0x2d4a6b),
    anchored('Ponta Negra', -1820, -3470, 120, 19, 90, 0x6b2d2d),
    anchored('Rio Itapanhaú', -2120, -3900, 135, 21, 90, 0x2f5a3a),
    { name: 'Cabo Frio', kind: 'outbound', L: 180, B: 28, color: 0x1f1f1f, x: 0, y: 0, psi: 0, u: 6 * KN, active: false,
      ax: 0, ay: 0, scope: 0, s: W.CHANNEL_LENGTH - 250, spawnAt: 180, warned: false, near: false },
  ];
}
/** Raio que um fundeado varre em volta do ferro. */
export const swingRadius = (o: Other) => o.scope + o.L;

export function updateTraffic(g: Game, dt: number) {
  for (const o of g.traffic) {
    if (o.kind === 'anchored') {
      // aproa a soma do vento com a corrente e fica a jusante do ferro
      const [ce, cn] = g.env.current(o.ax, o.ay);
      const wx = -Math.sin(g.env.windFrom) * g.env.windSpeed * 0.035, wy = -Math.cos(g.env.windFrom) * g.env.windSpeed * 0.035;
      const dx = ce + wx, dy = cn + wy, to = Math.atan2(dx, dy);        // para onde o navio é levado
      const first = o.psi === 0 && o.x === o.ax;
      const head = to + Math.PI;                                        // proa contra a resultante
      o.psi = first ? head : o.psi + Math.max(-0.004 * dt, Math.min(0.004 * dt, wrap(head - o.psi)));
      const r = o.scope + o.L / 2;
      o.x = o.ax - Math.sin(o.psi) * r; o.y = o.ay - Math.cos(o.psi) * r;
      continue;
    }
    if (!o.active) {
      if (g.time < o.spawnAt || o.s < 300) continue;
      o.active = true;
      g.say('Santos VTS', `Atenção, Maré Mansa: N/M ${o.name}, ${o.L} m, largou e está saindo pelo canal. Cruzamento bombordo com bombordo: mantenha-se a boreste do eixo.`, 'warn');
    }
    o.u = (W.nearest(o.x, o.y).s > W.S_MOUTH || o.s > W.S_MOUTH ? 6 : 8) * KN;
    o.s -= o.u * dt;
    if (o.s < 300) { o.active = false; continue; }
    [o.x, o.y] = W.pointAt(o.s, OUT_OFFSET);
    const [tx, ty] = W.pointAt(Math.max(0, o.s - 160), OUT_OFFSET);
    const want = Math.atan2(tx - o.x, ty - o.y);
    o.psi = o.psi === 0 ? want : o.psi + Math.max(-0.012 * dt, Math.min(0.012 * dt, wrap(want - o.psi)));
  }
}

/** Distância do ponto ao casco do outro navio (0 se está dentro). */
export function hullDistance(o: Other, px: number, py: number) {
  const dx = px - o.x, dy = py - o.y, sin = Math.sin(o.psi), cos = Math.cos(o.psi);
  const f = Math.abs(dx * sin + dy * cos) - o.L / 2, r = Math.abs(dx * cos - dy * sin) - o.B / 2;
  return Math.hypot(Math.max(f, 0), Math.max(r, 0));
}
export const bearingText = (g: Game, o: Other) => {
  const rel = wrap(Math.atan2(o.x - g.s.x, o.y - g.s.y) - g.s.psi) / D2R;
  return Math.abs(rel) < 15 ? 'pela proa' : Math.abs(rel) > 150 ? 'pela popa' : `${Math.abs(rel) < 80 ? 'pela bochecha' : Math.abs(rel) < 110 ? 'pelo través' : 'pela alheta'} de ${rel > 0 ? 'boreste' : 'bombordo'}`;
};
