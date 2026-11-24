// Ferro e amarra. Um quartel de amarra = 27,5 m.
export const SHACKLE = 27.5;

export interface Anchor {
  state: 'stowed' | 'down' | 'heaving' | 'lost';
  ax: number; ay: number;   // onde o ferro unhou
  paid: number;             // amarra fora, m
  target: number;           // amarra a largar, m
  tension: number;          // N
  dragging: boolean;
  stalled: boolean;         // virando, mas a amarra está tesa demais para o molinete
}
export const makeAnchor = (): Anchor => ({ state: 'stowed', ax: 0, ay: 0, paid: 0, target: 0, tension: 0, dragging: false, stalled: false });

const HOLD_MAX = 350e3, K = 60e3, C = 400e3, PAY_RATE = 1.5, WINDLASS = 120e3;
/** Velocidade do molinete virando, m/s. Mais rápido que o real para não deixar o jogo parado. */
export const HEAVE_RATE = 0.6;

export function letGo(a: Anchor, bx: number, by: number, shackles: number, depth: number) {
  a.state = 'down'; a.ax = bx; a.ay = by; a.paid = depth + 2; a.target = Math.max(shackles * SHACKLE, depth + 5);
  a.tension = 0; a.dragging = false;
}

/** Força (mundo) que a amarra faz no escovém. bvx/bvy = velocidade da proa no fundo. */
export function anchorForce(a: Anchor, bx: number, by: number, bvx: number, bvy: number, depth: number, dt: number): [number, number] {
  a.tension = 0; a.dragging = false; a.stalled = false;
  if (a.state !== 'down' && a.state !== 'heaving') return [0, 0];
  const dx = a.ax - bx, dy = a.ay - by;
  const d = Math.hypot(dx, dy) || 1e-6;
  const ux = dx / d, uy = dy / d;
  const out = -(bvx * ux + bvy * uy); // > 0: proa se afastando do ferro
  let reach = Math.sqrt(Math.max(a.paid * a.paid - depth * depth, 0));

  if (a.state === 'down' && a.paid < a.target) {
    // amarra correndo: rápido se o navio a estica, devagar (pelo peso) se está parado em cima
    const pulling = d > reach * 0.9;
    a.paid = Math.min(a.target, a.paid + (pulling ? PAY_RATE : PAY_RATE / 3) * dt);
    if (!pulling) return [0, 0];
    a.tension = 20e3; // só o freio do molinete segura
    return [ux * a.tension, uy * a.tension];
  }
  if (a.state === 'heaving') {
    const stretch = d - reach;
    if (stretch * K < WINDLASS) a.paid -= HEAVE_RATE * dt; else a.stalled = true;
    if (a.paid <= depth + 3) { a.state = 'stowed'; a.paid = 0; return [0, 0]; }
    reach = Math.sqrt(Math.max(a.paid * a.paid - depth * depth, 0));
  }
  const e = d - reach;
  if (e <= 0) return [0, 0];
  let t = K * e + C * Math.max(out, 0);
  const scope = a.paid / Math.max(depth, 1);
  const hold = HOLD_MAX * Math.max(0.08, Math.min(1, (scope - 1.5) / 3.5));
  if (t > hold) {
    // ferro garrando: arrasta pelo fundo atrás do navio
    a.dragging = true;
    t = hold * 0.7;
    const allowed = t / K;
    if (e > allowed) { a.ax -= ux * (e - allowed); a.ay -= uy * (e - allowed); }
  }
  a.tension = t;
  return [ux * t, uy * t];
}
