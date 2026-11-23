// Recorte ESTILIZADO da barra e do início do canal de Santos.
// Não é carta oficial e não serve para navegação: a forma geral (baía ao sul,
// barra entre a Ponta da Praia e o Guarujá, canal que guina para oeste) segue
// o porto real, mas profundidades e bancos foram desenhados para o jogo.
// x = leste, y = norte, em metros. Origem perto da boca da barra.

export const BOUNDS = { x0: -3600, x1: 2400, y0: -5600, y1: 4200 };
export const CELL = 20;
export const NX = (BOUNDS.x1 - BOUNDS.x0) / CELL;
export const NY = (BOUNDS.y1 - BOUNDS.y0) / CELL;

/** Eixo do canal dragado, do mar para dentro. */
export const CENTER: [number, number][] = [
  [-600, -4500], [-300, -2500], [0, -600], [150, 400], [200, 1300],
  [-100, 2200], [-900, 2900], [-1900, 3300], [-2900, 3500],
];
const SEG = CENTER.slice(0, -1).map((a, i) => {
  const b = CENTER[i + 1];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return { ax: a[0], ay: a[1], tx: (b[0] - a[0]) / len, ty: (b[1] - a[1]) / len, len, s0: 0 };
});
SEG.reduce((acc, sg) => { sg.s0 = acc; return acc + sg.len; }, 0);
export const CHANNEL_LENGTH = SEG[SEG.length - 1].s0 + SEG[SEG.length - 1].len;
export const S_MOUTH = SEG[2].s0;       // daqui para dentro é estuário
export const DREDGED_HALF = 110;        // meia largura dragada
export const DREDGED_DEPTH = 14;
const EST_HALF = 330;                   // meia largura do estuário, margem a margem
export const SPEED_LIMIT_KN = 8;

export interface Near { d: number; s: number; tx: number; ty: number; side: number }
/** Ponto mais próximo do eixo do canal. side > 0 = bombordo de quem entra. */
export function nearest(x: number, y: number): Near {
  let best: Near = { d: Infinity, s: 0, tx: 0, ty: 1, side: 0 };
  for (const g of SEG) {
    const px = x - g.ax, py = y - g.ay;
    const a = Math.max(0, Math.min(g.len, px * g.tx + py * g.ty));
    const dx = px - a * g.tx, dy = py - a * g.ty;
    const d = Math.hypot(dx, dy);
    if (d < best.d) best = { d, s: g.s0 + a, tx: g.tx, ty: g.ty, side: g.tx * dy - g.ty * dx };
  }
  return best;
}
export function pointAt(s: number, offset = 0): [number, number] {
  let g = SEG[0];
  for (const sg of SEG) if (s >= sg.s0) g = sg;
  const a = Math.min(s - g.s0, g.len);
  // offset > 0 = boreste de quem entra
  return [g.ax + a * g.tx + offset * g.ty, g.ay + a * g.ty - offset * g.tx];
}

// --- Cais (margem de Santos, depois da segunda curva do canal): atracação por bombordo
const QSEG = SEG[5];
export const QUAY_S = QSEG.s0 + 550;   // posição do berço ao longo do canal
const qa = pointAt(QUAY_S, -200);
export const QUAY = {
  cx: qa[0], cy: qa[1],
  tx: QSEG.tx, ty: QSEG.ty,           // ao longo do cais, sentido de quem entra
  nx: QSEG.ty, ny: -QSEG.tx,          // normal apontando para a água
  half: 170,                          // meia extensão do cais
  berthHalf: 40,                      // tolerância de posição ao longo do cais
  fender: 1.2,
};
/** Coordenadas locais do cais: a = ao longo, b = distância da face (b > 0 na água). */
export function quayLocal(x: number, y: number): [number, number] {
  const px = x - QUAY.cx, py = y - QUAY.cy;
  return [px * QUAY.tx + py * QUAY.ty, px * QUAY.nx + py * QUAY.ny];
}

export const ANCHORAGE = { x: -2100, y: -3600, r: 500 };

const SHOALS = [
  { x: -1000, y: -1500, r: 520, d: 2.5, name: 'Banco de Oeste' },
  { x: 620, y: -1900, r: 420, d: 3.0, name: 'Banco de Leste' },
  { x: 250, y: -3300, r: 130, d: 1.8, name: 'Laje' },
];
const HILLS = [
  { x: 950, y: 250, r: 420, h: 70 }, { x: 1600, y: -1000, r: 520, h: 110 },
  { x: 2000, y: 1500, r: 600, h: 90 }, { x: -2700, y: 700, r: 380, h: 60 },
  { x: -700, y: 4000, r: 500, h: 50 },
];

const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.max(0, Math.min(1, t));
function coastY(x: number) {
  const beach = -350 + 120 * Math.sin(x / 700);
  return x < 200 ? beach : beach - (x - 200) * 0.9;
}

/** Profundidade em metros; valor <= 0 é terra (o módulo é a altura). */
export function depth(x: number, y: number): number {
  const [a, b] = quayLocal(x, y);
  if (Math.abs(a) <= QUAY.half && b <= 0 && b >= -220) return -3;
  if (Math.abs(a) <= QUAY.half + 50 && b > 0 && b <= 120) return 11; // bacia do berço
  const n = nearest(x, y);
  if (n.s > S_MOUTH) {
    if (n.d >= EST_HALF) return -landHeight(x, y);
    if (n.d < DREDGED_HALF) return DREDGED_DEPTH;
    if (n.d < 170) return lerp(DREDGED_DEPTH, 7, (n.d - DREDGED_HALF) / 60);
    return lerp(7, 0.4, (n.d - 170) / (EST_HALF - 170));
  }
  const cy = coastY(x);
  if (y > cy) return -landHeight(x, y);
  const shore = (cy - y) * (x < 200 ? 1 : 0.74);
  let nat = Math.min(17, 0.5 + shore / 70);
  for (const sh of SHOALS) {
    const dd = Math.hypot(x - sh.x, y - sh.y) / sh.r;
    if (dd < 1) nat = Math.min(nat, sh.d + dd * dd * (nat - sh.d));
  }
  if (n.d < 170) return Math.max(nat, lerp(DREDGED_DEPTH, nat, (n.d - DREDGED_HALF) / 60));
  return nat;
}
function landHeight(x: number, y: number) {
  let h = 2.5;
  for (const hl of HILLS) {
    const dd = Math.hypot(x - hl.x, y - hl.y) / hl.r;
    if (dd < 1) h += hl.h * (1 - dd * dd) ** 2;
  }
  return h;
}

/** Corrente (leste, norte) em m/s. tide: +1 vazante, -1 enchente. */
export function current(x: number, y: number, tide = 1): [number, number] {
  const n = nearest(x, y);
  let mag: number;
  let drift = 0;
  if (n.s > S_MOUTH) {
    mag = 0.55 * Math.max(0.2, 1 - (n.d / EST_HALF) ** 2);
    const [a, b] = quayLocal(x, y);
    if (Math.abs(a) < 260 && b < 100) mag *= 0.45; // remanso junto ao cais
  } else {
    mag = 0.55 * Math.exp(-(S_MOUTH - n.s) / 1800) * Math.exp(-((n.d / 500) ** 2));
    drift = 0.18 * Math.min(1, (coastY(x) - y) / 600); // corrente costeira para leste
  }
  return [-tide * mag * n.tx + drift, -tide * mag * n.ty];
}

export interface Buoy { x: number; y: number; kind: 'red' | 'green' | 'danger'; id: string }
/** Balizamento IALA B: encarnada a boreste de quem entra, verde a bombordo. */
export const BUOYS: Buoy[] = (() => {
  const out: Buoy[] = [];
  const marks = [200, 1000, 1800, 2600, 3300, 3900, S_MOUTH + 500, S_MOUTH + 1250, SEG[4].s0, SEG[4].s0 + 470, SEG[5].s0, SEG[6].s0, SEG[6].s0 + 900];
  marks.forEach((s, i) => {
    const [rx, ry] = pointAt(s, DREDGED_HALF + 15), [gx, gy] = pointAt(s, -(DREDGED_HALF + 15));
    out.push({ x: rx, y: ry, kind: 'red', id: `${2 * i + 2}` });
    if (depth(gx, gy) > 0) out.push({ x: gx, y: gy, kind: 'green', id: `${2 * i + 1}` });
  });
  out.push({ x: SHOALS[2].x, y: SHOALS[2].y - 160, kind: 'danger', id: 'Laje' });
  return out;
})();
export const SHOAL_NAMES = SHOALS.map(s => ({ x: s.x, y: s.y, name: s.name }));

/** Grade de profundidade para o desenho (a simulação usa depth() direto). */
export function buildGrid(): Float32Array {
  const g = new Float32Array((NX + 1) * (NY + 1));
  for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) {
    g[j * (NX + 1) + i] = depth(BOUNDS.x0 + i * CELL, BOUNDS.y0 + j * CELL);
  }
  return g;
}

/** Cor da carta por faixa de profundidade. */
export function depthColor(d: number): [number, number, number] {
  if (d <= 0) return [222, 200, 150];
  if (d < 2) return [168, 226, 208];
  if (d < 5) return [104, 198, 204];
  if (d < 8) return [62, 160, 194];
  if (d < 11) return [42, 124, 176];
  if (d < 13.5) return [30, 96, 156];
  return [22, 74, 134];
}
export const DEPTH_BANDS = [2, 5, 8, 11, 13.5];
