// Física do navio: 3 graus de liberdade (avanço, deriva, guinada).
// Convenções: x = leste, y = norte (m). psi = rumo, rad, horário a partir do norte.
// u = avanço, v = deriva para boreste, r = guinada para boreste (rad/s).
// u e v são velocidades NO FUNDO, no referencial do navio.

export const KN = 0.514444;
export const D2R = Math.PI / 180;
const RHO = 1025;
const RHO_AIR = 1.225;

export const TELEGRAPH = [-0.8, -0.55, -0.35, -0.2, 0, 0.2, 0.4, 0.7, 1.0];
export const TELEGRAPH_LABELS = [
  'TODA FORÇA RÉ', 'MEIA FORÇA RÉ', 'DEVAGAR RÉ', 'MUITO DEVAGAR RÉ', 'PARA',
  'MUITO DEVAGAR', 'DEVAGAR', 'MEIA FORÇA', 'TODA FORÇA',
];
export const TELEGRAPH_STOP = 4;

export interface ShipParams {
  name: string;
  L: number; B: number; T: number; Cb: number;
  mass: number; mx: number; my: number; Iz: number;
  kx: number;        // resistência ao avanço, N/(m/s)^2
  Tb: number;        // empuxo a ponto fixo, N
  U0: number;        // velocidade de serviço, m/s
  Yv: number; Yr: number; Yvv: number; Nv: number; Nr: number; Nrr: number;
  AR: number; rudderCL: number; rudderMax: number; rudderRate: number;
  wash: number;      // velocidade do jato do hélice no leme a ponto fixo, m/s
  nUp: number; nDown: number; revDelay: number; rpmMax: number;
  nUpHigh: number;   // acima de meia força a carga sobe devagar (programa de carga)
  ackDelay: number;  // tempo para a praça de máquinas cumprir o telégrafo, s
  helmDelay: number; // tempo para o timoneiro cumprir a ordem, s
  airStarts: number; // partidas guardadas nas garrafas de ar
  airRefill: number; // partidas repostas por segundo pelos compressores
  propWalk: number;
  AF: number; AL: number; xWind: number;
  thrusterMax: number; // empuxo do impelidor lateral de proa, N
}

export interface ShipState {
  x: number; y: number; psi: number;
  u: number; v: number; r: number;
  n: number;            // rotação real, -1..1
  telegraph: number;    // índice da ordem dada
  telAck: number;       // ordem que a máquina já está cumprindo
  ackTimer: number;
  helmAck: number;      // ordem de leme que o timoneiro já está cumprindo, rad
  helmTimer: number;
  air: number;          // partidas de ar disponíveis
  noAir: boolean;       // tentou partir sem ar
  starts: number;       // partidas dadas
  wearEngine: number;   // soma das variações de rotação (0→1 = 1)
  wearRudder: number;   // graus percorridos pelo leme
  thrusterOrder: number; // impelidor de proa, -1 (bombordo) a +1 (boreste)
  thruster: number;      // empuxo real, -1..1
  thrusterEff: number;   // quanto rende agora, 0..1 (cai com o seguimento)
  bankSide: number;      // margem sentida: -1 toda a bombordo, +1 toda a boreste
  bankForce: number;     // sucção lateral da margem, N (+ boreste)
  revTimer: number;
  rudder: number;       // ângulo real, rad
  rudderOrder: number;  // ordem, rad
  // leituras (preenchidas a cada passo)
  stw: number; sway: number; depth: number; squat: number; ukc: number;
  relWindDir: number; relWindSpeed: number;
  curE: number; curN: number;
}

export interface Env {
  depth(x: number, y: number): number;            // m; <= 0 é terra
  current(x: number, y: number): [number, number]; // leste, norte, m/s
  windFrom: number;   // rad, de onde sopra
  windSpeed: number;  // m/s
}

export interface BodyForce { X: number; Y: number; N: number }

export type ShipClass = 'coaster' | 'handy';
/** Classes de navio. O costeiro é o de partida; o graneleiro é mais valioso, mais pesado e cala mais. */
export const SHIPS: Record<ShipClass, {
  label: string; L: number; B: number; D: number; Tmin: number; Tmax: number; Cb: number;
  Tb: number; U0: number; kx: number; nUp: number; nDown: number; nUpHigh: number; revDelay: number; rudderRate: number;
  capacity: number; price: number; blurb: string;
}> = {
  coaster: { label: 'Costeiro de 90 m', L: 90, B: 14, D: 8, Tmin: 3.6, Tmax: 5.2, Cb: 0.72, Tb: 180e3, U0: 11 * KN, kx: 4470,
    nUp: 0.015, nDown: 0.03, nUpHigh: 0.005, revDelay: 15, rudderRate: 1.8, capacity: 2900, price: 0,
    blurb: '4.800 t carregado. Leve, raso e barato: o navio de quem está começando.' },
  handy: { label: 'Graneleiro de 130 m', L: 130, B: 20, D: 11, Tmin: 4.6, Tmax: 7.4, Cb: 0.76, Tb: 330e3, U0: 12 * KN, kx: 6050,
    nUp: 0.011, nDown: 0.022, nUpHigh: 0.004, revDelay: 18, rudderRate: 1.7, capacity: 11000, price: 150000,
    blurb: '15.000 t carregado e 7,4 m de calado. Frete 2,6× maior; o triplo da massa para parar e girar.' },
};

/** Parâmetros de um navio. load: 0 = em lastro, 1 = carregado. */
export function makeShipParams(cls: ShipClass = 'coaster', load = 1): ShipParams {
  const c = SHIPS[cls], { L, B, Cb } = c;
  const T = c.Tmin + (c.Tmax - c.Tmin) * load;
  const mass = L * B * T * Cb * RHO;
  return {
    name: 'N/M Maré Mansa',
    L, B, T, Cb, mass,
    mx: 0.05 * mass, my: 0.85 * mass,
    Iz: mass * (0.25 * L) ** 2 * 2.6,
    kx: c.kx * (T / c.Tmax) ** 0.7,
    Tb: c.Tb, U0: c.U0,
    Yv: -0.33, Yr: 0.087, Yvv: -0.9, Nv: -0.111, Nr: -0.058, Nrr: -0.028,
    AR: (L * T) / 60, rudderCL: 1.5, rudderMax: 35 * D2R, rudderRate: c.rudderRate * D2R, // navio velho: uma bomba só na máquina do leme
    wash: 6.0,
    nUp: c.nUp, nDown: c.nDown, revDelay: c.revDelay, rpmMax: 180,
    nUpHigh: c.nUpHigh, ackDelay: 6, helmDelay: 2, airStarts: 5, airRefill: 1 / 90,
    propWalk: 0.07,
    AF: B * (c.D - T) + 110 * (B / 14), AL: L * (c.D - T) + 160 * (L / 90), xWind: -0.06 * L,
    thrusterMax: 35e3 * (L / 90) ** 1.5,
  };
}
/** Costeiro de carga geral, 90 m. */
export const makeCoaster = (load = 1) => makeShipParams('coaster', load);

/** Pontos do casco usados nas regras, todos proporcionais ao navio (xf à vante, ys a boreste). */
export interface ShipGeo {
  hull: [number, number][];       // contorno para encalhe, cais e abalroamento
  bow: number;                    // escovém, de onde sai a amarra
  berthBow: [number, number];     // bochecha e alheta de bombordo, que encostam no cais
  berthStern: [number, number];
  tug: number;                    // onde os rebocadores passam o cabo
}
export function shipGeo(p: ShipParams): ShipGeo {
  const L = p.L, B = p.B, h = B / 2;
  const a = 0.4 * L, b = (20 / 90) * L, c = (25 / 90) * L, d = (42 / 90) * L, s1 = (5 / 14) * B, s2 = (6 / 14) * B;
  return {
    hull: [[L / 2, 0], [a, s1], [a, -s1], [b, h], [b, -h], [0, h], [0, -h], [-c, h], [-c, -h], [-d, s2], [-d, -s2], [-L / 2, 0]],
    bow: d, berthBow: [a, -s1], berthStern: [-d, -s2], tug: a,
  };
}

export function makeState(x: number, y: number, psiDeg: number, speedKn = 0, telegraph = TELEGRAPH_STOP): ShipState {
  return {
    x, y, psi: psiDeg * D2R, u: speedKn * KN, v: 0, r: 0,
    n: TELEGRAPH[telegraph], telegraph, revTimer: 0, rudder: 0, rudderOrder: 0,
    telAck: telegraph, ackTimer: 0, helmAck: 0, helmTimer: 0, air: 5, noAir: false, starts: 0, wearEngine: 0, wearRudder: 0,
    thrusterOrder: 0, thruster: 0, thrusterEff: 1, bankSide: 0, bankForce: 0,
    stw: speedKn * KN, sway: 0, depth: 99, squat: 0, ukc: 99,
    relWindDir: 0, relWindSpeed: 0, curE: 0, curN: 0,
  };
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
function toward(v: number, target: number, step: number) {
  return v < target ? Math.min(target, v + step) : Math.max(target, v - step);
}

const BANK_D = [8, 20, 38, 62]; // distâncias do costado onde se sonda a margem, m
/** Quanto de margem há a boreste menos a bombordo, numa seção do navio: -1 a +1. */
function bankAsym(s: ShipState, p: ShipParams, env: Env, xf: number, sin: number, cos: number) {
  const bx = s.x + xf * sin, by = s.y + xf * cos;
  let a = 0, wsum = 0;
  for (const d of BANK_D) {
    const w = Math.exp(-d / (2 * p.B)), off = p.B / 2 + d;
    // "parede": 1 se é terra ou muito raso, 0 se há o dobro do calado de água
    const wall = (h: number) => clamp((2 * p.T - h) / (1.3 * p.T), 0, 1);
    a += w * (wall(env.depth(bx + off * cos, by - off * sin)) - wall(env.depth(bx - off * cos, by + off * sin)));
    wsum += w;
  }
  return a / wsum;
}

/** Afundamento dinâmico (Barrass), m. */
export function squatOf(p: ShipParams, stw: number, depth: number) {
  const vk = Math.abs(stw) / KN;
  const confined = 1 + clamp((p.T / Math.max(depth, 0.1) - 0.5) / 0.4, 0, 1);
  return (p.Cb * vk * vk) / 100 * confined;
}

export function stepShip(s: ShipState, p: ShipParams, env: Env, dt: number, ext: BodyForce) {
  // --- ordens não são cumpridas na hora: alguém precisa repetir e executar
  if (s.telAck !== s.telegraph) { s.ackTimer -= dt; if (s.ackTimer <= 0) s.telAck = s.telegraph; }
  if (s.helmAck !== s.rudderOrder) { s.helmTimer -= dt; if (s.helmTimer <= 0) s.helmAck = s.rudderOrder; }

  // --- máquina: a ordem do telégrafo não é a rotação real
  const tgt = TELEGRAPH[s.telAck], n0 = s.n, rud0 = s.rudder;
  s.air = Math.min(p.airStarts, s.air + p.airRefill * dt);
  s.noAir = false;
  if (s.n !== 0 && tgt * s.n < 0) {
    s.n = toward(s.n, 0, p.nDown * dt);
    if (s.n === 0) s.revTimer = p.revDelay; // parar e reverter o motor leva tempo
  } else if (s.n === 0 && tgt !== 0) {
    if (s.revTimer > 0) s.revTimer -= dt;
    else if (s.air < 1) s.noAir = true;     // motor parte com ar comprimido; sem ar, não parte
    else { s.air -= 1; s.starts++; s.n = toward(0, tgt, p.nUp * dt); }
  } else {
    const up = Math.abs(tgt) > Math.abs(s.n);
    s.n = toward(s.n, tgt, (up ? (Math.abs(s.n) >= 0.7 ? p.nUpHigh : p.nUp) : p.nDown) * dt);
  }
  // --- máquina do leme
  s.rudder = toward(s.rudder, clamp(s.helmAck, -p.rudderMax, p.rudderMax), p.rudderRate * dt);
  s.wearEngine += Math.abs(s.n - n0);
  s.wearRudder += Math.abs(s.rudder - rud0) / D2R;

  const sin = Math.sin(s.psi), cos = Math.cos(s.psi);
  // --- corrente: forças hidrodinâmicas usam a velocidade NA ÁGUA
  const [ce, cn] = env.current(s.x, s.y);
  const ur = s.u - (ce * sin + cn * cos);
  const vr = s.v - (ce * cos - cn * sin);
  const r = s.r;

  // --- águas rasas
  const h = env.depth(s.x, s.y);
  const squat = squatOf(p, ur, h);
  const k = clamp((p.T + squat) / Math.max(h, 0.1), 0, 0.98) ** 3;

  const { L, T } = p;
  const q = 0.5 * RHO * L * T;

  // --- casco
  const Xh = -p.kx * (1 + 1.5 * k) * ur * Math.abs(ur) - 1200 * ur;
  const Yh = q * (p.Yv * (1 + 1.5 * k) * vr * Math.abs(ur) + p.Yr * r * L * ur + p.Yvv * (1 + 2 * k) * vr * Math.abs(vr));
  const Nh = q * L * (p.Nv * (1 + 1.2 * k) * vr * ur + p.Nr * (1 + 1.3 * k) * r * L * Math.abs(ur) + p.Nrr * (1 + 2 * k) * L * L * r * Math.abs(r));

  // --- hélice
  let thrust: number;
  if (s.n >= 0) thrust = p.Tb * (s.n * s.n - 0.45 * s.n * Math.max(ur, 0) / p.U0);
  else thrust = -p.Tb * 0.75 * s.n * s.n;
  // em ré, hélice de passo direito joga a popa para bombordo
  const Ywalk = s.n < 0 ? -p.propWalk * p.Tb * s.n * s.n : 0;
  const Nwalk = -0.45 * L * Ywalk;

  // --- leme: só governa com água passando por ele (seguimento ou jato do hélice)
  const jet2 = p.wash * p.wash * Math.max(thrust, 0) / p.Tb;
  let uR: number;
  if (ur >= 0) uR = Math.sqrt((0.75 * ur) ** 2 + jet2) * (s.n < 0 ? 1 - 0.6 * Math.min(1, -s.n / 0.5) : 1);
  else uR = 0.75 * ur + Math.sqrt(jet2) * 0.5;
  const vR = vr - 0.5 * L * r;
  const dEff = Math.abs(uR) > 0.2 ? s.rudder + 0.4 * Math.atan2(vR, Math.abs(uR)) * Math.sign(uR) : s.rudder;
  const FN = 0.5 * RHO * p.AR * p.rudderCL * uR * Math.abs(uR) * Math.sin(dEff);
  const cd = Math.cos(s.rudder);
  const Xr = -Math.abs(FN * Math.sin(s.rudder));
  const Yr = -1.3 * FN * cd;
  const Nr = 0.635 * L * FN * cd;

  // --- efeito de margem: a água acelera entre o casco e a margem mais próxima.
  // A popa é sugada para a margem e a proa é empurrada para fora (almofada de proa).
  const aBow = bankAsym(s, p, env, 0.3 * L, sin, cos), aStern = bankAsym(s, p, env, -0.3 * L, sin, cos);
  const Ybank = q * ur * ur * 0.03 * (0.7 * aStern + 0.3 * aBow) * (1 + 2 * k);
  const Nbank = -q * L * ur * Math.abs(ur) * 0.006 * (aBow + aStern) / 2 * (1 + 2 * k);
  s.bankSide = (aBow + aStern) / 2; s.bankForce = Ybank;

  // --- impelidor lateral de proa: só rende com o navio quase parado
  s.thruster = toward(s.thruster, clamp(s.thrusterOrder, -1, 1), 0.2 * dt);
  s.thrusterEff = clamp(1 - Math.abs(ur) / (4.5 * KN), 0, 1) ** 2;
  const Ft = p.thrusterMax * s.thruster * s.thrusterEff;

  // --- vento sobre a obra morta
  const ax = -env.windSpeed * Math.sin(env.windFrom), ay = -env.windSpeed * Math.cos(env.windFrom);
  const gx = s.u * sin + s.v * cos, gy = s.u * cos - s.v * sin;
  const rx = ax - gx, ry = ay - gy;
  const rf = rx * sin + ry * cos, rs = rx * cos - ry * sin;
  const Vr = Math.hypot(rf, rs);
  const Xw = 0.5 * RHO_AIR * p.AF * 0.8 * Vr * rf;
  const Yw = 0.5 * RHO_AIR * p.AL * 0.95 * Vr * rs;
  const Nw = Yw * p.xWind;

  const X = Xh + thrust + Xr + Xw + ext.X;
  const Y = Yh + Ywalk + Yr + Yw + Ft + Ybank + ext.Y;
  const N = Nh + Nwalk + Nr + Nw + 0.42 * L * Ft + Nbank + ext.N;

  const mxx = p.mass + p.mx, myy = p.mass + p.my * (1 + 2 * k);
  const du = (X + (p.mass + 0.25 * p.my) * s.v * r) / mxx; // parte da massa adicional é cancelada pelo casco (X_vr)
  const dv = (Y - mxx * s.u * r) / myy;
  const dr = N / (p.Iz * (1 + k));
  s.u += du * dt; s.v += dv * dt; s.r += dr * dt;

  s.x += (s.u * sin + s.v * cos) * dt;
  s.y += (s.u * cos - s.v * sin) * dt;
  s.psi = (s.psi + s.r * dt + Math.PI * 2) % (Math.PI * 2);

  s.stw = ur; s.sway = vr; s.depth = h; s.squat = squat; s.ukc = h - p.T - squat;
  s.relWindDir = Math.atan2(-rs, -rf); s.relWindSpeed = Vr;
  s.curE = ce; s.curN = cn;
}

/** Converte um ponto do navio (xf à vante, ys a boreste) para o mundo. */
export function bodyToWorld(s: ShipState, xf: number, ys: number): [number, number] {
  const sin = Math.sin(s.psi), cos = Math.cos(s.psi);
  return [s.x + xf * sin + ys * cos, s.y + xf * cos - ys * sin];
}

/** Velocidade no fundo de um ponto do navio, no mundo. */
export function pointVelocity(s: ShipState, xf: number, ys: number): [number, number] {
  const sin = Math.sin(s.psi), cos = Math.cos(s.psi);
  const bu = s.u - s.r * ys; // guinando a boreste, o bordo de boreste recua
  const bv = s.v + s.r * xf; // e a proa cai para boreste
  return [bu * sin + bv * cos, bu * cos - bv * sin];
}

/** Força no mundo aplicada num ponto do navio -> força/momento no navio. */
export function worldForceAt(s: ShipState, fx: number, fy: number, xf: number, ys: number, out: BodyForce) {
  const sin = Math.sin(s.psi), cos = Math.cos(s.psi);
  const Fx = fx * sin + fy * cos, Fy = fx * cos - fy * sin;
  out.X += Fx; out.Y += Fy; out.N += xf * Fy - ys * Fx;
}
