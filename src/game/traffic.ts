// Outros navios: fundeados (giram com vento e corrente) e um navio saindo pelo canal.
// Eles não desviam: quem manobra é o comandante.
import { D2R, KN } from '../sim/ship';
import * as W from '../world/santos';
import type { Game } from './game';

export interface Other {
  name: string; kind: 'anchored' | 'outbound' | 'inbound';
  L: number; B: number; color: number;
  x: number; y: number; psi: number; u: number;   // u = velocidade no fundo, m/s
  active: boolean;
  ax: number; ay: number; scope: number;          // fundeados: ferro e amarra
  s: number; spawnAt: number;                     // em movimento: posição ao longo do canal
  warned: boolean; near: boolean;
  rate: number;                                   // guinada, rad/s (fundeados girando)
  offset: number; yieldUntil: number;             // navio lento à frente: posição lateral e até quando dá passagem
  /** Navio do berço: atracado, largando (4 min) ou já a caminho. */
  phase: 'berthed' | 'unberthing' | 'underway' | 'gone';
  departAt: number; asked: boolean;
}
const wrap = (a: number) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const OUT_OFFSET = -55;   // o navio que sai mantém o boreste dele, que é o bombordo de quem entra

function anchored(name: string, ax: number, ay: number, L: number, B: number, scope: number, color: number): Other {
  return { name, kind: 'anchored', L, B, color, x: ax, y: ay, psi: 0, u: 0, active: true, ax, ay, scope, s: 0, spawnAt: 0, warned: false, near: false, rate: 0, offset: 0, yieldUntil: 0, phase: 'gone', departAt: 0, asked: false };
}
export const UNBERTH_TIME = 240;          // segundos para largar e abrir do cais
export const DEPART_DEFAULT = 30 * 60;    // sem ninguém pedir, o navio do berço só larga aos 30 min
export const DEPART_ON_REQUEST = 6 * 60;
export const DREDGE_KN = 2;               // a draga sobe o canal a 2 nós
export const YIELD_TIME = 8 * 60;         // pedindo passagem, ela sai do canal dragado e quase para por 8 min  // pedindo pelo rádio, larga em 6 min

export function makeTraffic(leaves = true): Other[] {
  return [
    anchored('Serra Azul', -2380, -3420, 150, 23, 95, 0x2d4a6b),
    anchored('Ponta Negra', -1820, -3470, 120, 19, 90, 0x6b2d2d),
    anchored('Rio Itapanhaú', -2120, -3900, 135, 21, 90, 0x2f5a3a),
    // ocupa o nosso berço, aproado para o mar
    { name: 'Cabo Frio', kind: 'outbound', L: 180, B: 28, color: 0x1f1f1f, x: 0, y: 0, psi: 0, u: 0, active: true,
      ax: 0, ay: 0, scope: 0, s: W.QUAY_S, spawnAt: 0, warned: false, near: false, rate: 0, offset: 0, yieldUntil: 0,
      phase: 'berthed', departAt: leaves ? DEPART_DEFAULT : Infinity, asked: false },
    // draga lenta subindo o canal à nossa frente, pelo lado de boreste
    ...(leaves ? [{ name: 'Itaoca', kind: 'inbound' as const, L: 70, B: 14, color: 0x7a5a1e, x: 0, y: 0, psi: 0, u: DREDGE_KN * KN, active: true,
      ax: 0, ay: 0, scope: 0, s: W.S_MOUTH + 200, spawnAt: 0, warned: false, near: false, rate: 0, offset: 45, yieldUntil: 0,
      phase: 'underway' as const, departAt: 0, asked: false }] : []),
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
      // um navio de 10 mil toneladas na amarra gira devagar: no máximo 3 graus por minuto
      const step = first ? 0 : Math.max(-0.0009 * dt, Math.min(0.0009 * dt, wrap(head - o.psi) * 0.02 * dt));
      o.rate = dt > 0 ? step / dt : 0;
      o.psi = first ? head : o.psi + step;
      const r = o.scope + o.L / 2;
      o.x = o.ax - Math.sin(o.psi) * r; o.y = o.ay - Math.cos(o.psi) * r;
      continue;
    }
    if (o.phase === 'gone') continue;
    if (o.kind === 'inbound') {
      // cala pouco: dando passagem ela sai do canal dragado, para a margem de boreste
      // e só volta para o canal quando o navio que passava já está longe
      const ahead = W.nearest(g.s.x, g.s.y).s - o.s;
      if (g.time < o.yieldUntil + 1 && ahead > -500 && ahead < 350) o.yieldUntil = Math.max(o.yieldUntil, g.time + 5);
      const yielding = g.time < o.yieldUntil, wantOff = yielding ? 135 : 45;
      o.u = (yielding ? 0.3 : DREDGE_KN) * KN;
      o.offset += Math.max(-0.6 * dt, Math.min(0.6 * dt, wantOff - o.offset));
      o.s += o.u * dt;
      if (o.s > W.CHANNEL_LENGTH - 250) { o.active = false; o.phase = 'gone'; continue; }
      [o.x, o.y] = W.pointAt(o.s, o.offset);
      const [ax, ay] = W.pointAt(o.s + 120, o.offset), wantH = Math.atan2(ax - o.x, ay - o.y);
      o.psi = o.psi === 0 ? wantH : o.psi + Math.max(-0.01 * dt, Math.min(0.01 * dt, wrap(wantH - o.psi)));
      continue;
    }
    // na manobra a contrabordo o "cais" de destino é um navio; o navio do berço continua no Cais de Santos
    const Q = g.sts ? W.QUAYS[0] : W.QUAY, lane = 200 + OUT_OFFSET * Q.side, home = Q.fender + o.B / 2;
    if (o.phase === 'berthed' || o.phase === 'unberthing') {
      if (o.phase === 'berthed' && g.time >= o.departAt) {
        o.phase = 'unberthing';
        g.say(`N/M ${o.name}`, 'Santos VTS, largando do cais. Saio pelo canal em 4 minutos.', 'info');
      }
      // abre do cais de lado e avança um pouco; depois segue pelo lado dele do canal
      const p = o.phase === 'unberthing' ? Math.min(1, (g.time - o.departAt) / UNBERTH_TIME) : 0, e = p * p * (3 - 2 * p);
      const a = -60 * e, bq = home + (lane - home) * e;
      o.x = Q.cx + Q.tx * a + Q.nx * bq; o.y = Q.cy + Q.ty * a + Q.ny * bq;
      o.psi = Math.atan2(-Q.tx, -Q.ty); o.u = p > 0 && p < 1 ? 0.4 : 0; o.s = Q.s + a;
      if (p >= 1) {
        o.phase = 'underway';
        g.say('Santos VTS', `Atenção, Maré Mansa: N/M ${o.name}, ${o.L} m, saindo pelo canal. Cruzamento bombordo com bombordo: mantenha-se a boreste do eixo. O berço está livre.`, 'warn');
      }
      continue;
    }
    o.u = (W.nearest(o.x, o.y).s > W.S_MOUTH || o.s > W.S_MOUTH ? 6 : 8) * KN;
    o.s -= o.u * dt;
    if (o.s < 300) { o.active = false; o.phase = 'gone'; continue; }
    [o.x, o.y] = W.pointAt(o.s, OUT_OFFSET);
    const [tx, ty] = W.pointAt(Math.max(0, o.s - 160), OUT_OFFSET);
    const want = Math.atan2(tx - o.x, ty - o.y);
    o.psi = o.psi + Math.max(-0.012 * dt, Math.min(0.012 * dt, wrap(want - o.psi)));
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

/** O navio que ocupa o berço, se ainda não saiu do caminho. */
export const berthShip = (g: Game) => g.traffic.find(o => o.kind === 'outbound');
export const berthBusy = (g: Game) => { const o = berthShip(g); return !!o && (o.phase === 'berthed' || o.phase === 'unberthing'); };

/** Navio lento à frente, no mesmo sentido. */
export const slowAhead = (g: Game) => g.traffic.find(o => o.kind === 'inbound' && o.active);

/**
 * Interação hidrodinâmica ao passar perto de outro navio. De través os cascos se sugam;
 * com o outro pela proa a nossa proa é empurrada para fora, e com ele pela popa, puxada para dentro.
 * Devolve força lateral (N, + boreste) e momento (N·m, + proa a boreste).
 */
export function interaction(p: { L: number; B: number; T: number }, s: { x: number; y: number; psi: number; stw: number }, o: Other, shallow = 0): { Y: number; N: number } {
  const dx = o.x - s.x, dy = o.y - s.y, sin = Math.sin(s.psi), cos = Math.cos(s.psi);
  const ahead = dx * sin + dy * cos, side = dx * cos - dy * sin;          // posição do outro no nosso referencial
  const gap = Math.abs(side) - (p.B + o.B) / 2, Lm = (p.L + o.L) / 2, xi = ahead / Lm;
  if (gap > 4 * p.B || Math.abs(xi) > 1.4) return { Y: 0, N: 0 };
  let rel = Math.abs(wrap(o.psi - s.psi)); const opposite = rel > Math.PI / 2;
  const U = Math.abs(s.stw) + (opposite ? o.u : -Math.min(o.u, Math.abs(s.stw)) * 0.5); // cruzando soma; ultrapassando, quase só a nossa
  const q = 0.5 * 1025 * p.L * p.T * U * U * Math.exp(-Math.max(gap, 0) / (1.2 * p.B)) * (1 + 2 * shallow);
  const env = Math.exp(-1.5 * xi * xi), sg = Math.sign(side) || 1;
  void rel;
  return { Y: sg * 0.04 * q * Math.cos(Math.PI * xi) * env, N: -sg * 0.012 * q * p.L * Math.sin(Math.PI * xi) * env };
}
