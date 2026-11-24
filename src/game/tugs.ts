// Rebocadores: recebem ordens pelo rádio e aplicam força no costado de boreste.
// Empurrar leva o navio para bombordo (para o cais); puxar, para boreste.
import { BodyForce, KN, ShipState } from '../sim/ship';
import * as W from '../world/santos';
import type { Game } from './game';

export type TugMode = 'stop' | 'push' | 'pull' | 'brake';
export const TUG_FEE = 1800;        // saída do rebocador
export const TUG_PER_MIN = 60;      // com cabo passado
const FMAX = 120e3, BRAKE_MAX = 80e3, RAMP = 0.12, ETA = 240, REPOSITION = 15, ACK = 4;
const MODE_TEXT: Record<TugMode, string> = { stop: 'parado, aguardando', push: 'empurrando', pull: 'puxando', brake: 'segurando por ante a ré' };

export class Tug {
  state: 'none' | 'called' | 'waiting' | 'fast' = 'none';
  mode: TugMode = 'stop'; power = 0.25;
  eta = 0;
  force = 0;       // lateral aplicada, N (+ boreste)
  brake = 0;       // força de frenagem aplicada, N
  // posição para o desenho, no referencial do navio (xf, ys, rumo relativo) ou no mundo enquanto vem
  x = 0; y = 0; psi = 0; line = false;
  private bx = 0; private by = 60; private bh = 0;
  private doing: TugMode = 'stop'; private doingPower = 0.25;
  private ack = 0; private repos = 0; private x0 = 0; private y0 = 0;

  constructor(public name: string, public where: 'proa' | 'popa', public xf: number) {}

  call(g: Game) {
    if (this.state !== 'none') return;
    this.state = 'called'; this.eta = ETA;
    this.x0 = W.QUAY.cx - W.QUAY.tx * 260 + W.QUAY.nx * 50; this.y0 = W.QUAY.cy - W.QUAY.ty * 260 + W.QUAY.ny * 50;
    this.x = this.x0; this.y = this.y0;
    g.ledger.tugs += TUG_FEE;
    g.say(`Rebocador ${this.name}`, `Saindo para a sua ${this.where}. Chego em ${Math.round(ETA / 60)} minutos, da barra para dentro.`, 'info');
  }
  order(g: Game, mode: TugMode, power = this.power) {
    if (this.state !== 'fast') return;
    if (mode === this.mode && power === this.power) return;
    this.mode = mode; this.power = power; this.ack = ACK;
  }

  update(g: Game, dt: number, ext: BodyForce) {
    const s = g.s;
    if (this.state === 'none') return;
    const sin = Math.sin(s.psi), cos = Math.cos(s.psi);
    const toWorld = (xf: number, ys: number): [number, number] => [s.x + xf * sin + ys * cos, s.y + xf * cos - ys * sin];
    if (this.state === 'called') {
      this.eta -= dt;
      const k = Math.max(0, Math.min(1, 1 - this.eta / ETA)), [tx, ty] = toWorld(this.xf, 60);
      const nx = this.x0 + (tx - this.x0) * k, ny = this.y0 + (ty - this.y0) * k;
      if (Math.hypot(nx - this.x, ny - this.y) > 0.01) this.psi = Math.atan2(nx - this.x, ny - this.y);
      this.x = nx; this.y = ny;
      if (this.eta <= 0) { this.state = 'waiting'; this.bx = this.xf; this.by = 60; this.bh = 0; }
      return;
    }
    const inside = W.nearest(s.x, s.y).s > W.S_MOUTH - 200;
    if (this.state === 'waiting') {
      if (!inside) g.say(`Rebocador ${this.name}`, 'Aguardando o senhor da barra para dentro.', 'info', 'tugbar' + this.where, 120);
      else if (Math.abs(s.stw) > 5 * KN) g.say(`Rebocador ${this.name}`, 'Muito seguimento. Reduza para 5 nós para eu passar o cabo.', 'warn', 'tugfast' + this.where, 40);
      else { this.state = 'fast'; this.mode = this.doing = 'stop'; g.say(`Rebocador ${this.name}`, `Cabo passado na ${this.where}. Às ordens.`, 'info'); }
    } else {
      g.ledger.tugs += TUG_PER_MIN / 60 * dt;
      if (Math.abs(s.stw) > 6.5 * KN) {
        this.state = 'waiting'; this.force = this.brake = 0; this.mode = this.doing = 'stop';
        g.say(`Rebocador ${this.name}`, 'Seguimento demais, larguei o cabo!', 'bad');
      }
    }
    // a ordem leva um tempo para ser cumprida
    if (this.ack > 0 && (this.ack -= dt) <= 0) {
      const flip = (this.doing === 'push' && this.mode === 'pull') || (this.doing === 'pull' && this.mode === 'push') || (this.doing === 'brake') !== (this.mode === 'brake');
      if (flip && this.doing !== 'stop') this.repos = REPOSITION; // trocar de posição leva tempo
      this.doing = this.mode; this.doingPower = this.power;
      g.say(`Rebocador ${this.name}`, this.mode === 'stop' ? 'Parando.' : `${MODE_TEXT[this.mode][0].toUpperCase()}${MODE_TEXT[this.mode].slice(1)} a ${Math.round(this.power * 100)}%.`, 'info');
    }
    let wantF = 0, wantB = 0;
    if (this.state === 'fast') {
      if (this.repos > 0) this.repos -= dt;
      else if (this.doing === 'push') wantF = -FMAX * this.doingPower;
      else if (this.doing === 'pull') wantF = FMAX * this.doingPower;
      else if (this.doing === 'brake') wantB = BRAKE_MAX * this.doingPower;
    }
    const step = (v: number, t: number, max: number) => (v < t ? Math.min(t, v + max * RAMP * dt) : Math.max(t, v - max * RAMP * dt));
    this.force = step(this.force, wantF, FMAX); this.brake = step(this.brake, wantB, BRAKE_MAX);
    // rebocador só rende com o navio devagar
    const eff = Math.max(0, Math.min(1, 1 - (Math.abs(s.stw) - 1.5) / 1.5));
    ext.Y += this.force * eff; ext.N += this.xf * this.force * eff;
    if (Math.abs(s.u) > 0.03) ext.X -= this.brake * eff * Math.sign(s.u);

    // --- posição para o desenho
    const d = this.state === 'fast' ? this.doing : 'stop', hb = g.p.B / 2;
    const [gx, gy, gh] = this.state !== 'fast' ? [this.xf, 45, 0]
      : d === 'push' ? [this.xf, hb + 10, -Math.PI / 2] : d === 'pull' ? [this.xf, hb + 41, Math.PI / 2]
      : d === 'brake' ? [this.xf - 45, 3, 0] : [this.xf, hb + 13, 0];
    const k = Math.min(1, dt * 0.25);
    this.bx += (gx - this.bx) * k; this.by += (gy - this.by) * k; this.bh += (gh - this.bh) * k;
    [this.x, this.y] = toWorld(this.bx, this.by); this.psi = s.psi + this.bh;
    this.line = this.state === 'fast';
  }

  status() {
    if (this.state === 'none') return 'não chamado';
    if (this.state === 'called') return `a caminho, ${Math.floor(this.eta / 60)}:${String(Math.floor(this.eta % 60)).padStart(2, '0')}`;
    if (this.state === 'waiting') return 'ao lado, sem cabo';
    if (this.repos > 0) return 'trocando de posição';
    return this.doing === 'stop' ? 'cabo passado, parado' : `${MODE_TEXT[this.doing]} ${Math.round(Math.abs(this.doing === 'brake' ? this.brake / BRAKE_MAX : this.force / FMAX) * 100)}%`;
  }
}
export const makeTugs = (xf = 36) => [new Tug('Tupi', 'proa', xf), new Tug('Guará', 'popa', -xf)];
export type { ShipState };
