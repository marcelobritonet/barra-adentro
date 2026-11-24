// Telas do passadiço: radar, ECDIS e doppler de atracação.
import { BERTH, berthSpeedKn, Game } from '../game/game';
import { pointVelocity } from '../sim/ship';
import { bodyToWorld, D2R, KN } from '../sim/ship';
import * as W from '../world/santos';

const TAU = Math.PI * 2;
const NM = 1852;
const FONT = 'ui-monospace, monospace';
const norm = (a: number) => ((a % TAU) + TAU) % TAU;

// ------------------------------------------------------------------ radar
export const RADAR_RANGES = [0.25, 0.5, 1, 2]; // milhas náuticas

/** Radar de proa para cima: a varredura pinta os ecos, que ficam até a volta seguinte. */
export class Radar {
  rangeI = 1;
  private glow = document.createElement('canvas');
  private gc: CanvasRenderingContext2D;
  private sweep = 0;
  private lastRange = -1;

  constructor(private size: number) {
    this.glow.width = this.glow.height = size * 2;
    this.gc = this.glow.getContext('2d')!;
  }
  reset() { this.gc.clearRect(0, 0, this.glow.width, this.glow.height); }

  draw(c: CanvasRenderingContext2D, g: Game, dt: number) {
    const S = this.size, N = S * 2, cx = N / 2, cy = N / 2, R = N / 2 - 6, gc = this.gc, s = g.s;
    const range = RADAR_RANGES[this.rangeI] * NM;
    if (this.rangeI !== this.lastRange) { this.reset(); this.lastRange = this.rangeI; }

    const a0 = this.sweep, a1 = a0 + Math.min(dt, 0.1) * TAU / 2.4;
    this.sweep = a1;
    // apaga o setor que a antena está varrendo e pinta os ecos novos
    gc.globalCompositeOperation = 'destination-out';
    gc.beginPath(); gc.moveTo(cx, cy); gc.arc(cx, cy, R + 4, a0 - Math.PI / 2, a1 - Math.PI / 2 + 0.04); gc.closePath(); gc.fill();
    gc.globalCompositeOperation = 'source-over';
    gc.fillStyle = '#8dffa8';
    const put = (th: number, r: number, sz: number) => {
      const rr = (r / range) * R; gc.fillRect(cx + rr * Math.sin(th) - sz / 2, cy - rr * Math.cos(th) - sz / 2, sz, sz);
    };
    for (let th = a0; th < a1; th += 0.018) {
      const b = s.psi + th, sb = Math.sin(b), cb = Math.cos(b);
      let hit = 0;
      for (let r = 30; r < range; r += range / 120) {
        if (W.depth(s.x + r * sb, s.y + r * cb) <= 0) { put(th, r, 3); if (++hit > 3) break; } // a terra faz sombra atrás
        else if (hit) break;
      }
    }
    const targets: [number, number, number][] = W.BUOYS.map(b => [b.x, b.y, 4]);
    for (const t of g.tugs) if (t.state !== 'none') targets.push([t.x, t.y, 6]);
    // navios dão eco grande, do tamanho do casco
    for (const o of g.traffic) if (o.active) for (let f = -0.5; f <= 0.5; f += 0.25) targets.push([o.x + Math.sin(o.psi) * o.L * f, o.y + Math.cos(o.psi) * o.L * f, 7]);
    for (const [tx, ty, sz] of targets) {
      const dx = tx - s.x, dy = ty - s.y, r = Math.hypot(dx, dy);
      if (r > range) continue;
      const th = norm(Math.atan2(dx, dy) - s.psi);
      if (norm(th - a0) < a1 - a0) put(th, r, sz);
    }

    c.save(); c.scale(0.5, 0.5);
    c.fillStyle = '#05080b'; c.fillRect(0, 0, N, N);
    c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.fillStyle = '#03140a'; c.fill(); c.save(); c.clip();
    c.drawImage(this.glow, 0, 0);
    c.strokeStyle = '#1f6a3a'; c.lineWidth = 1.5;
    for (let i = 1; i <= 4; i++) { c.beginPath(); c.arc(cx, cy, (R * i) / 4, 0, TAU); c.stroke(); }
    c.strokeStyle = '#d8e2ea'; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx, cy - R); c.stroke(); // linha de proa
    const sw = this.sweep;
    c.strokeStyle = '#8dffa8aa'; c.lineWidth = 2; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + R * Math.sin(sw), cy - R * Math.cos(sw)); c.stroke();
    c.restore();
    c.strokeStyle = '#2c8a4c'; c.lineWidth = 2; c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.stroke();
    c.fillStyle = '#8dffa8'; c.font = `22px ${FONT}`; c.textAlign = 'left';
    c.fillText(`${String(RADAR_RANGES[this.rangeI]).replace('.', ',')} MN`, 6, 22);
    c.fillText(`anéis ${Math.round(range / 4)} m`, 6, N - 8);
    c.textAlign = 'right'; c.fillText('PROA ▲', N - 6, 22);
    c.restore();
  }
}

// ------------------------------------------------------------------ ECDIS
export const ECDIS_SCALES = [1.5, 3, 6, 12]; // metros por pixel

export class Ecdis {
  scaleI = 1; headUp = true;
  private danger = document.createElement('canvas');

  constructor(grid: Float32Array, safety: number) {
    // contorno de segurança: água com menos que o calado mais uma folga
    const w = W.NX, h = W.NY, cv = this.danger; cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d')!, img = ctx.createImageData(w, h), n = W.NX + 1;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const d = grid[(W.NY - j) * n + i], k = (j * w + i) * 4;
      if (d > 0 && d < safety) { img.data[k] = 235; img.data[k + 1] = 60; img.data[k + 2] = 60; img.data[k + 3] = (i + j) % 2 ? 110 : 45; }
    }
    ctx.putImageData(img, 0, 0);
  }

  draw(c: CanvasRenderingContext2D, S: number, g: Game, base: HTMLCanvasElement) {
    const s = g.s, mpp = ECDIS_SCALES[this.scaleI], B = W.BOUNDS;
    const cx = S / 2, cy = this.headUp ? S * 0.68 : S / 2;
    c.fillStyle = '#0a1622'; c.fillRect(0, 0, S, S);
    c.save(); c.beginPath(); c.rect(0, 0, S, S); c.clip();
    c.translate(cx, cy); if (this.headUp) c.rotate(-s.psi); c.scale(1 / mpp, 1 / mpp);
    const X = (x: number) => x - s.x, Y = (y: number) => -(y - s.y), px = mpp; // px = 1 pixel de tela em metros
    c.imageSmoothingEnabled = false;
    c.drawImage(base, X(B.x0), Y(B.y1), B.x1 - B.x0, B.y1 - B.y0);
    c.drawImage(this.danger, X(B.x0), Y(B.y1), B.x1 - B.x0, B.y1 - B.y0);

    c.strokeStyle = '#ffffffb0'; c.lineWidth = px; c.setLineDash([6 * px, 5 * px]); c.beginPath();
    W.CENTER.forEach(([x, y], i) => (i ? c.lineTo(X(x), Y(y)) : c.moveTo(X(x), Y(y)))); c.stroke();
    // ponto de chamada e linha de espera
    c.setLineDash([]); c.lineWidth = 1.5 * px;
    for (const [ss, col] of [[W.CALL_POINT_S, '#e04fc0'], [W.HOLD_LINE_S, '#ff3b2f']] as [number, string][]) {
      const [ax, ay] = W.pointAt(ss, -200), [bx, by] = W.pointAt(ss, 200);
      c.strokeStyle = col; c.beginPath(); c.moveTo(X(ax), Y(ay)); c.lineTo(X(bx), Y(by)); c.stroke();
    }
    c.setLineDash([6 * px, 5 * px]); c.lineWidth = px;
    // derrota do plano e pontos de guinada
    if (g.hasPlan) {
      c.setLineDash([]); c.strokeStyle = '#ff9a2e'; c.lineWidth = 1.5 * px; c.beginPath();
      g.plan.track.forEach(([x, y], i) => (i ? c.lineTo(X(x), Y(y)) : c.moveTo(X(x), Y(y)))); c.stroke();
      for (const st of g.plan.steps) if (st.turn) { c.fillStyle = '#ff3b2f'; c.beginPath(); c.arc(X(st.turn.x), Y(st.turn.y), 4 * px, 0, TAU); c.fill(); }
      c.setLineDash([6 * px, 5 * px]); c.lineWidth = px;
    }
    c.strokeStyle = '#e04fc0'; c.beginPath(); c.arc(X(W.ANCHORAGE.x), Y(W.ANCHORAGE.y), W.ANCHORAGE.r, 0, TAU); c.stroke();
    c.strokeStyle = '#9fd0e8'; c.beginPath(); c.arc(X(W.BASIN.x), Y(W.BASIN.y), W.BASIN.r, 0, TAU); c.stroke(); c.setLineDash([]);
    const Q = W.QUAY;
    c.strokeStyle = '#6b5a3a'; c.lineWidth = 3 * px;
    for (const q of W.QUAYS) { c.beginPath(); c.moveTo(X(q.cx - q.tx * q.half), Y(q.cy - q.ty * q.half)); c.lineTo(X(q.cx + q.tx * q.half), Y(q.cy + q.ty * q.half)); c.stroke(); }
    c.strokeStyle = '#ffe14a'; c.lineWidth = 3 * px; c.beginPath();
    c.moveTo(X(Q.cx - Q.tx * Q.berthHalf * 1.4 + Q.nx * 3), Y(Q.cy - Q.ty * Q.berthHalf * 1.4 + Q.ny * 3));
    c.lineTo(X(Q.cx + Q.tx * Q.berthHalf * 1.4 + Q.nx * 3), Y(Q.cy + Q.ty * Q.berthHalf * 1.4 + Q.ny * 3)); c.stroke();
    for (const b of W.BUOYS) {
      c.fillStyle = b.kind === 'red' ? '#ff4040' : b.kind === 'green' ? '#18c050' : '#111';
      c.fillRect(X(b.x) - 2.5 * px, Y(b.y) - 2.5 * px, 5 * px, 5 * px);
    }
    for (const t of g.tugs) if (t.state !== 'none') { c.fillStyle = '#ff9a2e'; c.beginPath(); c.arc(X(t.x), Y(t.y), 3.5 * px, 0, TAU); c.fill(); }
    // alvos AIS: casco em escala, vetor de 3 minutos e nome
    for (const o of g.traffic) {
      if (!o.active) continue;
      const sn = Math.sin(o.psi), cs = Math.cos(o.psi), pts: [number, number][] = [[o.L / 2, 0], [o.L / 3, o.B / 2], [-o.L / 2, o.B / 2], [-o.L / 2, -o.B / 2], [o.L / 3, -o.B / 2]];
      c.beginPath(); pts.forEach(([f, r], i) => { const wx = o.x + f * sn + r * cs, wy = o.y + f * cs - r * sn; i ? c.lineTo(X(wx), Y(wy)) : c.moveTo(X(wx), Y(wy)); }); c.closePath();
      c.fillStyle = '#2a7bd6'; c.fill(); c.strokeStyle = '#04213f'; c.lineWidth = px; c.stroke();
      if (o.u > 0.2) { c.beginPath(); c.moveTo(X(o.x), Y(o.y)); c.lineTo(X(o.x + sn * o.u * 180), Y(o.y + cs * o.u * 180)); c.stroke(); }
    }
    if (g.anchor.state === 'down' || g.anchor.state === 'heaving') { c.fillStyle = '#ffd21a'; c.fillRect(X(g.anchor.ax) - 3 * px, Y(g.anchor.ay) - 3 * px, 6 * px, 6 * px); }

    // navio em escala, e a previsão de onde ele vai estar se nada mudar
    const hull = (x: number, y: number, psi: number) => {
      const sn = Math.sin(psi), cs = Math.cos(psi);
      const hl = g.p.L / 2, hb = g.p.B / 2, pts: [number, number][] = [[hl, 0], [hl * 0.67, hb], [-hl, hb], [-hl, -hb], [hl * 0.67, -hb]];
      c.beginPath();
      pts.forEach(([f, r], i) => { const wx = x + f * sn + r * cs, wy = y + f * cs - r * sn; i ? c.lineTo(X(wx), Y(wy)) : c.moveTo(X(wx), Y(wy)); });
      c.closePath();
    };
    let x = s.x, y = s.y, psi = s.psi;
    c.lineWidth = px; c.strokeStyle = '#000000b0';
    const track: [number, number][] = [[x, y]];
    for (let t = 1; t <= 180; t++) {
      x += s.u * Math.sin(psi) + s.v * Math.cos(psi); y += s.u * Math.cos(psi) - s.v * Math.sin(psi); psi += s.r;
      if (t % 10 === 0) track.push([x, y]);
      if (t % 60 === 0) { hull(x, y, psi); c.stroke(); }
    }
    c.setLineDash([3 * px, 3 * px]); c.beginPath(); track.forEach(([tx, ty], i) => (i ? c.lineTo(X(tx), Y(ty)) : c.moveTo(X(tx), Y(ty)))); c.stroke(); c.setLineDash([]);
    const [hx, hy] = bodyToWorld(s, g.p.L / 2 + 40 * mpp, 0), [bx, by] = bodyToWorld(s, g.p.L / 2, 0);
    c.strokeStyle = '#000'; c.beginPath(); c.moveTo(X(bx), Y(by)); c.lineTo(X(hx), Y(hy)); c.stroke();
    hull(s.x, s.y, s.psi); c.fillStyle = '#ff3b2f'; c.fill(); c.stroke();
    if (mpp > 5) { c.fillStyle = '#ff3b2f'; c.beginPath(); c.arc(0, 0, 3 * px, 0, TAU); c.fill(); }
    c.restore();

    // leituras
    const n = W.nearest(s.x, s.y), turn = W.TURNS.find(t => t.s > n.s + 1);
    const line = (txt: string, yy: number, col = '#d8e2ea') => {
      c.font = `10px ${FONT}`; const w = c.measureText(txt).width;
      c.fillStyle = '#05080bd0'; c.fillRect(3, yy - 10, w + 8, 13); c.fillStyle = col; c.textAlign = 'left'; c.fillText(txt, 7, yy);
    };
    line(`${this.headUp ? 'PROA ▲' : 'NORTE ▲'}  ${Math.round(S * mpp)} m de largura`, 13);
    line(`eixo do canal: ${n.d.toFixed(0)} m a ${n.side > 0 ? 'BB' : 'BE'}`, S - 32, n.d > W.DREDGED_HALF ? '#ff7a6a' : '#7dffb0');
    line(turn ? `curva em ${(turn.s - n.s).toFixed(0)} m → rumo ${String(Math.round(turn.course)).padStart(3, '0')}°` : 'sem curvas à frente', S - 18);
    line(`fundo ${(g.sog / KN).toFixed(1)} nós  ·  tracejado: 3 min`, S - 4);
    const tgt = g.traffic.filter(o => o.active && o.kind === 'outbound')[0];
    if (tgt) line(`AIS ${tgt.name}: ${(Math.hypot(tgt.x - s.x, tgt.y - s.y) / 1852).toFixed(2).replace('.', ',')} MN, ${(tgt.u / KN).toFixed(0)} nós`, 27, '#7dd3ff');
  }
}

// ------------------------------------------------------------------ doppler
/** Doppler de atracação: velocidade lateral da proa e da popa e avanço, no fundo. */
export function drawDoppler(c: CanvasRenderingContext2D, Wd: number, H: number, g: Game) {
  const s = g.s;
  c.clearRect(0, 0, Wd, H); c.fillStyle = '#05080b'; c.fillRect(0, 0, Wd, H);
  if (!g.equip.doppler) { c.fillStyle = '#2f4a3c'; c.font = `11px ${FONT}`; c.textAlign = 'center'; c.fillText('não instalado', Wd / 2, H / 2 + 4); return; }
  const cx = Wd / 2, arm = g.p.L * 0.44, bow = (s.v + s.r * arm) / KN, stern = (s.v - s.r * arm) / KN, fwd = s.u / KN;
  c.fillStyle = '#3a4854'; c.beginPath(); c.moveTo(cx, 6); c.lineTo(cx + 9, 22); c.lineTo(cx + 9, H - 8); c.lineTo(cx - 9, H - 8); c.lineTo(cx - 9, 22); c.closePath(); c.fill();
  const side = (v: number, y: number) => {
    const col = Math.abs(v) > 0.3 ? '#ff7a6a' : Math.abs(v) > 0.15 ? '#ffcf6a' : '#7dffb0';
    c.fillStyle = col; c.font = `bold 13px ${FONT}`;
    if (Math.abs(v) < 0.005) { c.textAlign = 'center'; c.fillText('0,00', cx + 42, y + 4); return; }
    const right = v > 0, tx = right ? cx + 14 : cx - 14, dir = right ? 1 : -1;
    c.beginPath(); c.moveTo(tx + dir * 14, y); c.lineTo(tx + dir * 4, y - 6); c.lineTo(tx + dir * 4, y + 6); c.closePath(); c.fill(); c.fillRect(tx, y - 2, dir * 6, 4);
    c.textAlign = right ? 'left' : 'right'; c.fillText(Math.abs(v).toFixed(2).replace('.', ','), tx + dir * 18, y + 4);
  };
  side(bow, 18); side(stern, H - 14);
  c.fillStyle = '#d8e2ea'; c.font = `bold 12px ${FONT}`; c.textAlign = 'center';
  c.fillText(`${fwd >= 0 ? '▲' : '▼'} ${Math.abs(fwd).toFixed(2).replace('.', ',')}`, cx, H / 2 + 4);
  c.fillStyle = '#7f93a3'; c.font = `8px ${FONT}`; c.textAlign = 'left'; c.fillText('nós', 3, H - 3);
}

// ------------------------------------------------------------------ tela de atracação
/**
 * Navio e cais vistos de cima, com o que importa junto ao berço: distância da proa e da popa,
 * quanto falta ao longo do cais e as velocidades. Os números são os que a proa e a popa cantam pelo rádio.
 */
export function drawBerth(c: CanvasRenderingContext2D, S: number, g: Game) {
  const s = g.s, p = g.p, Q = W.QUAY, b = g.berth(), m = Q.side;
  c.fillStyle = '#071018'; c.fillRect(0, 0, S, S);
  const k = (S - 70) / (p.L + 150);                    // pixels por metro
  // tela: o cais fica embaixo, a água em cima; "para vante" é para a direita se o cais está a bombordo
  const cx = S / 2, qy = S - 58, dir = m;              // dir: sentido de "avante" na tela
  const X = (a: number) => cx + dir * a * k, Y = (d: number) => qy - d * k;
  // cais e defensas
  c.fillStyle = '#5c6268'; c.fillRect(0, qy + Q.fender * k, S, 26);
  c.fillStyle = '#20242a'; c.fillRect(0, qy, S, Q.fender * k + 1);
  // ponto: onde o navio deve ficar, e até onde os cabos alcançam
  const reach = Math.min(BERTH.alongMax, Q.half - p.L / 2 + 25);
  c.fillStyle = '#ffe14a22'; c.fillRect(X(-p.L / 2 * dir) < X(p.L / 2 * dir) ? X(-p.L / 2 * dir) : X(p.L / 2 * dir), qy - (p.B + 4) * k, p.L * k, (p.B + 4) * k);
  c.strokeStyle = '#ffe14a'; c.setLineDash([4, 3]); c.strokeRect(Math.min(X(-p.L / 2), X(p.L / 2)), qy - (p.B + 4) * k, p.L * k, (p.B + 4) * k); c.setLineDash([]);
  c.strokeStyle = '#ffe14a'; c.beginPath(); c.moveTo(cx, qy + 2); c.lineTo(cx, qy + 14); c.stroke();
  // o navio, pela distância da proa e da popa às defensas e pela posição ao longo do cais
  const [bf] = g.geo.berthBow, [sf] = g.geo.berthStern, a = b.along;
  const along = Math.max(-(p.L + 60), Math.min(p.L + 60, a));
  const bx = X(along + bf), sx = X(along + sf), by = Y(Math.max(0, b.bow) + Q.fender), sy = Y(Math.max(0, b.stern) + Q.fender);
  const ang = Math.atan2(by - sy, bx - sx);
  c.save(); c.translate((bx + sx) / 2, (by + sy) / 2 - p.B * k / 2); c.rotate(ang);
  const hl = p.L * k / 2, hb = p.B * k / 2;
  c.fillStyle = g.canMoor || g.mooring > 0 ? '#2fb85a' : '#c7d2da'; c.strokeStyle = '#05080b'; c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(hl, 0); c.lineTo(hl * 0.62, -hb); c.lineTo(-hl, -hb); c.lineTo(-hl, hb); c.lineTo(hl * 0.62, hb); c.closePath(); c.fill(); c.stroke();
  c.restore();
  // cotas
  const kn = (v: number) => (Math.abs(v) / KN).toFixed(2).replace('.', ',');
  const lab = (txt: string, x: number, y: number, col: string, align: CanvasTextAlign = 'center', size = 11) => { c.fillStyle = col; c.font = `bold ${size}px ${FONT}`; c.textAlign = align; c.fillText(txt, x, y); };
  const gapCol = (d: number, max: number) => (d <= max ? '#7dffb0' : '#ffcf6a');
  c.strokeStyle = '#7f93a3'; c.lineWidth = 1; c.setLineDash([2, 2]);
  c.beginPath(); c.moveTo(bx, by); c.lineTo(bx, qy); c.moveTo(sx, sy); c.lineTo(sx, qy); c.stroke(); c.setLineDash([]);
  lab(`PROA ${Math.max(0, b.bow).toFixed(b.bow < 10 ? 1 : 0)} m`, Math.max(46, Math.min(S - 46, bx)), qy + 38, gapCol(b.bow, BERTH.bowMax));
  lab(`POPA ${Math.max(0, b.stern).toFixed(b.stern < 10 ? 1 : 0)} m`, Math.max(46, Math.min(S - 46, sx)), qy + 52, gapCol(b.stern, BERTH.sternMax));
  // ao longo do cais
  const off = Math.abs(a), okA = off <= reach;
  lab(off < 3 ? 'NO PONTO' : `${off.toFixed(0)} m ${a > 0 ? 'AVANTE' : 'A RÉ'} do ponto`, cx, 16, off <= BERTH.alongDone ? '#7dffb0' : okA ? '#ffd76a' : '#ff7a6a', 'center', 12);
  lab(okA ? (off <= BERTH.alongDone ? '' : 'os cabos alcançam') : `cabos alcançam até ${reach.toFixed(0)} m`, cx, 29, '#7f93a3', 'center', 9);
  // velocidades: avante ou a ré, e de lado se houver doppler
  const want = berthSpeedKn(off), fast = g.sog / KN > want * 1.25 + 0.1;
  lab(`${s.u >= 0 ? 'AVANTE' : 'A RÉ'} ${kn(s.u)} nó`, 6, 48, fast ? '#ff7a6a' : '#d8e2ea', 'left', 13);
  lab(`plano: ${String(want).replace('.', ',')} nó`, 6, 61, '#7f93a3', 'left', 9);
  // seta do seguimento
  const ax = S - 60, ay = 46, len = Math.max(-34, Math.min(34, dir * s.u * 60));
  c.strokeStyle = fast ? '#ff7a6a' : '#d8e2ea'; c.lineWidth = 3; c.beginPath(); c.moveTo(ax - len, ay); c.lineTo(ax + len, ay); c.stroke();
  if (Math.abs(len) > 3) { c.fillStyle = c.strokeStyle; c.beginPath(); c.moveTo(ax + len + Math.sign(len) * 7, ay); c.lineTo(ax + len, ay - 5); c.lineTo(ax + len, ay + 5); c.closePath(); c.fill(); }
  if (g.equip.doppler) {
    const side = (xf: number, y0: number) => { const [vx, vy] = pointVelocity(s, xf, y0 * m); return -(vx * Q.nx + vy * Q.ny); };   // + = fechando
    const vb = side(...g.geo.berthBow), vs = side(...g.geo.berthStern);
    const col = (v: number) => (v > BERTH.hard ? '#ff7a6a' : v > BERTH.soft ? '#ffcf6a' : '#7dffb0');
    lab(`${vb >= 0 ? 'fecha' : 'abre'} ${kn(vb)}`, Math.max(46, Math.min(S - 46, bx)), Math.min(by, sy) - p.B * k - 18, col(vb), 'center', 10);
    lab(`${vs >= 0 ? 'fecha' : 'abre'} ${kn(vs)}`, Math.max(46, Math.min(S - 46, sx)), Math.min(by, sy) - p.B * k - 6, col(vs), 'center', 10);
  }
  if (g.mooring > 0) lab('AMARRANDO: máquina parada', cx, 84, '#7dffb0', 'center', 11);
  else if (g.canMoor) { c.fillStyle = '#ffcf6a'; c.fillRect(cx - 94, 72, 188, 16); lab('PODE PASSAR AS ESPIAS (M)', cx, 84, '#10151a', 'center', 11); }
}
