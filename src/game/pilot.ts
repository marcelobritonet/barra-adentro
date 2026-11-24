// Prático: só dá ordens. Quem executa é o comandante.
import { D2R, KN, pointVelocity } from '../sim/ship';
import type { TugMode } from './tugs';
import * as W from '../world/santos';
import type { Game } from './game';
import { berthBusy, berthShip, UNBERTH_TIME } from './traffic';

export type PilotGrade = 'padrao' | 'senior';
export const PILOTS = {
  // look: quão longe olha à frente (m); kd: quanto antecipa a guinada; step: finura das ordens (graus); gap: intervalo mínimo entre ordens (s)
  padrao: { label: 'Prático', fee: 2500, eta: 330, look: 320, kp: 1.4, kd: 46, step: 5, gap: 9 },
  senior: { label: 'Prático sênior', fee: 5500, eta: 170, look: 360, kp: 1.5, kd: 52, step: 5, gap: 6 },
};
const TEL_PHRASE = [
  'Toda força a ré', 'Meia força a ré', 'Devagar a ré', 'Muito devagar a ré', 'Para a máquina',
  'Muito devagar adiante', 'Devagar adiante', 'Meia força adiante', 'Toda força adiante',
];
const helmPhrase = (d: number) => d === 0 ? 'Leme a meio' : Math.abs(d) >= 35 ? `Todo o leme a ${d < 0 ? 'bombordo' : 'boreste'}` : `${d < 0 ? 'Bombordo' : 'Boreste'} ${Math.abs(d)}`;
const wrap = (a: number) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

export class Pilot {
  state: 'none' | 'called' | 'aboard' = 'none';
  grade: PilotGrade = 'padrao';
  eta = 0;
  helm = 0;          // ordem de leme em vigor, graus (+ boreste)
  tel = 4;           // ordem de máquina em vigor (índice do telégrafo)
  ready = false;     // já mandou passar as espias
  private lastHelm = -99; private lastTel = -99; private think = 0;
  private final = false; private kick = 0; private retry = false;
  /** Recusou atracar com corrente a favor; volta a orientar quando a maré virar. */
  declined = false;
  private meetSaid = false; private waitSaid = false; private paceSaid = false;
  private tugThink = 0; private tugSaid = false;
  /** O prático fala com os rebocadores ele mesmo, como na vida real. */
  private tug(g: Game, i: number, mode: TugMode, power = 0.25) {
    const t = g.tugs[i];
    if (t.state !== 'fast' || (t.mode === mode && (mode === 'stop' || t.power === power))) return;
    g.tugOrder(i, mode, power);
    g.say(this.name, `${t.name}, ${mode === 'stop' ? 'parar' : `${mode === 'push' ? 'empurrar' : mode === 'pull' ? 'puxar' : 'segurar'} a ${Math.round(power * 100)}%`}.`, 'pilot');
  }

  get name() { return PILOTS[this.grade].label; }

  call(g: Game, grade: PilotGrade) {
    this.state = 'called'; this.grade = grade; this.eta = PILOTS[grade].eta;
    g.ledger.pilot = PILOTS[grade].fee;
    g.say('Praticagem', `${this.name} a caminho, embarque em ${Math.round(this.eta / 60)} minutos. Mantenha no máximo 7 nós e fora da barra.`, 'info');
  }

  update(g: Game, dt: number) {
    if (this.state === 'called') {
      this.eta -= dt;
      if (this.eta > 0) return;
      if (g.sog > 7 * KN) return g.say('Lancha da praticagem', 'Reduza para 7 nós para o prático embarcar.', 'warn', 'board', 30);
      this.state = 'aboard'; this.tel = g.s.telegraph; this.helm = Math.round(g.s.rudderOrder / D2R);
      g.say(this.name, 'A bordo. Eu dou as ordens de leme e máquina; o senhor executa.', 'info');
    }
    if (this.state !== 'aboard' || g.scenario !== 'entrada') return;
    this.think -= dt; this.kick -= dt;
    if (this.think > 0) return;
    this.think = 1;
    const [helm, tel] = this.decide(g);
    this.order(g, helm, tel);
  }

  private decide(g: Game): [number, number] {
    const P = PILOTS[this.grade], s = g.s, Q = W.QUAY;
    const n = W.nearest(s.x, s.y), ds = W.QUAY_S - n.s, b = g.berth();
    const steer = (tx: number, ty: number, max: number) => {
      const e = wrap(Math.atan2(tx - s.x, ty - s.y) - s.psi) / D2R;
      return Math.max(-max, Math.min(max, e * P.kp - (s.r / D2R) * P.kd));
    };
    if (g.mooring > 0) return [0, 4];

    // --- berço ocupado, ou o navio que largou ainda não passou por nós: segura o navio no canal, a boreste
    const other = berthShip(g);
    const busy = !this.final && berthBusy(g);
    const blocked = busy || (!this.final && !!other && other.phase === 'underway' && other.s > n.s - 120);
    if (busy && n.s > W.S_MOUTH + 1050) {
      if (berthBusy(g) && !this.waitSaid) {
        this.waitSaid = true;
        g.say(this.name, `Berço ocupado pelo ${other!.name}. Vamos aguardar na reta, a boreste do canal${other!.asked ? '' : '; peça a ele pelo rádio que largue'}.`, 'warn');
      }
      const anchored = g.anchor.state === 'down' || g.anchor.state === 'heaving';
      if (g.tide.flow < -0.1 || anchored) {
        // com corrente a favor não dá para ficar parado no canal: só fundeando
        if (!anchored) g.say(this.name, 'Com a corrente a favor não seguro o navio aqui. Tire o seguimento e largue o ferro.', 'warn', 'holdflood', 90);
        return [0, anchored ? 4 : s.u > 0.25 ? 2 : 4];
      }
      // segura o navio aproado à vazante no meio da reta, longe das curvas
      const left = W.S_MOUTH + 1500 - n.s, vT = Math.max(0, Math.min(1.2, left / 350));
      const [hx, hy] = W.pointAt(n.s + P.look, 55);
      return [steer(hx, hy, 25), g.sog > vT + 0.5 && s.u > 0 ? 2 : g.sog > vT + 0.12 && s.u > 0 ? 4 : 5];
    }

    // --- com corrente a favor não se atraca: o navio não para nem governa. Espera a maré virar.
    if (ds < 1000 && !this.final && g.mooring <= 0) {
      const helped = g.tugs.every(t => t.state === 'fast');
      if (this.declined && helped) { this.declined = false; g.say(this.name, 'Com os dois rebocadores eu atraco mesmo com esta corrente. Vamos.', 'info'); }
      if (g.tide.flow < -0.1 && !this.declined && !helped) {
        this.declined = true;
        g.say(this.name, `Corrente a favor no berço: assim eu não atraco. Tire o seguimento, largue o ferro e aguarde a maré virar, em ${Math.round(g.tide.toSlack / 60)} min. Ou chame os dois rebocadores, que com eles eu atraco.`, 'warn');
      }
      if (this.declined) {
        const anchored = g.anchor.state === 'down' || g.anchor.state === 'heaving';
        if (g.tide.flow > 0.12 && !anchored && b.along < -200) {
          this.declined = false;
          g.say(this.name, 'A maré virou, corrente pela proa. Vamos atracar.', 'info');
        } else {
          if (g.tide.flow > 0.12 && anchored) g.say(this.name, 'A maré virou. Suspenda o ferro e eu levo o navio ao berço.', 'info', 'pilotheave', 120);
          return [0, anchored ? 4 : s.u > 0.25 ? 2 : s.u < -0.25 ? 5 : 4]; // só segura o navio
        }
      }
    }

    // --- aproximação e atracação (só depois que o navio que saiu passar por nós)
    if ((ds < 800 && !blocked) || this.final) {
      // rota em coordenadas do cais (a = ao longo, b = distância da face ao centro do navio):
      // sai do eixo, converge em ângulo raso e fica paralela só na hora de encostar
      // com os dois rebocadores de cabo passado, para paralelo a 20 m e eles encostam o navio
      const tugs = g.tugs.every(t => t.state === 'fast');
      if (tugs && !this.tugSaid) { this.tugSaid = true; g.say(this.name, 'Rebocadores de cabo passado. Eu falo com eles: paro o navio paralelo ao cais e eles encostam.', 'info'); }
      const end = Q.fender + 7.5 + (tugs ? 20 : 0);
      // fica afastado da margem rasa até a bacia do berço: perto dela a proa é empurrada para fora
      const path: [number, number][] = [[-800, 200], [-240, 78], [-15, end]];
      const seg = (a: number) => (a < -240 ? 0 : 1);
      const pathB = (a: number) => {
        if (a >= -15) return end;
        const [a0, b0] = path[seg(a)], [a1, b1] = path[seg(a) + 1];
        return b0 + (b1 - b0) * Math.max(0, (a - a0) / (a1 - a0));
      };
      const slope = (a: number) => { if (a >= -15) return 0; const [a0, b0] = path[seg(a)], [a1, b1] = path[seg(a) + 1]; return (b1 - b0) / (a1 - a0); };
      const a = b.along, [, bc] = W.quayLocal(s.x, s.y);
      const qh = Math.atan2(Q.tx, Q.ty);
      const Lk = 160;
      const lead = a + (this.grade === 'senior' ? 110 : 80);  // o bom prático já prepara a próxima pernada
      // rumo desejado em relação ao cais (+ = abrindo); nunca aponta de frente para o cais
      const want = Math.max(-24 * D2R, Math.min(18 * D2R, Math.atan(slope(lead)) - Math.atan((bc - pathB(a)) / Lk)));
      const dh = wrap(s.psi - qh);
      const track = (max: number) => Math.max(-max, Math.min(max, (wrap(want - dh) / D2R) * P.kp * 1.6 - (s.r / D2R) * P.kd));
      const u = s.u, rem = -a;                                 // quanto falta até o meio do berço
      const stopDist = u > 0 ? u * 30 + u * u / 0.012 : 0;     // o navio é pesado: começa a parar cedo
      const bowIn = b.bow <= 7, sternIn = b.stern <= 30, inPos = Math.abs(a) <= Q.berthHalf - 8;
      this.tugThink -= 1;

      if (!this.final) {
        if (rem < (tugs ? 45 : 60) || (inPos && bowIn)) this.final = true;
        // perfil de velocidade NO FUNDO: com corrente a favor ou parada, a mesma máquina dá muito mais seguimento
        const vT = rem > 520 ? 1.5 : rem > 260 ? 1.0 : 0.55;
        let tel = this.tel < 4 && g.sog <= vT + 0.15 ? 4 : this.tel;
        if (g.sog > vT + 0.5) tel = 2;
        else if (g.sog > vT + 0.15) tel = Math.min(tel, 4);
        else if (g.sog < vT - 0.15) tel = vT > 1.2 ? 6 : 5;
        else if (tel > 5) tel = 5;
        // sem máquina o leme não governa: se o rumo está fugindo (a margem empurra a proa para fora), dá um toque adiante
        const off = Math.abs(wrap(want - dh)) / D2R;
        if (tel === 4 && off > 4 && rem > stopDist + 40) tel = 5;
        if (off > 9 && rem > 150 && g.sog < 1.6) tel = 6;
        if (rem < 140 && b.bow < 30 && g.sog > 0.5) tel = 2;     // chega devagar: o toque tem de ser macio
        if (rem < stopDist + 15) tel = u > 0.5 ? 2 : 4;
        // o rebocador de popa ajuda a tirar seguimento, o que salva a manobra com corrente a favor
        if (tugs && this.tugThink <= 0) {
          this.tugThink = 6;
          if (g.sog > vT + 0.25) this.tug(g, 1, 'brake', g.sog > vT + 0.7 ? 1 : 0.5); else if (g.sog < vT + 0.05) this.tug(g, 1, 'stop');
          this.tug(g, 0, 'stop');
        }
        return [track(off > 6 ? 35 : 25), tel];
      }
      if (tugs) {
        // cada rebocador fecha a sua ponta devagar: mais rápido longe, quase parado ao tocar
        if (this.tugThink <= 0) {
          this.tugThink = 6;
          ([[0, 36, -5, b.bow], [1, -42, -6, b.stern]] as const).forEach(([i, xf, ys, gap]) => {
            const [vx, vy] = pointVelocity(s, xf, ys), closing = -(vx * Q.nx + vy * Q.ny);
            const wantV = gap > 12 ? 0.14 : gap > 4 ? 0.08 : 0.03;
            if (closing < wantV - 0.03) this.tug(g, i, 'push', gap > 25 ? 0.5 : gap > 6 ? 0.25 : 0.1);
            else if (closing > wantV + 0.10) this.tug(g, i, 'pull', 0.25);
            else if (closing > wantV + 0.03 || g.tugs[i].mode === 'pull') this.tug(g, i, 'stop');
          });
        }
        if (inPos && bowIn && b.stern <= 8 && g.sog < 0.25) {
          if (!this.ready) { this.ready = true; g.say(this.name, 'Navio encostado. Pode passar as espias.', 'info'); }
          return [0, 4];
        }
        if (rem < -12) return [0, u < -0.25 ? 4 : u > 0.1 ? 1 : 2];
        if (u > 0.12 && rem < stopDist + 8) return [0, u > 0.5 ? 1 : 2];
        if (rem > 20) return [0, u < 0.3 ? 5 : 4];
        return [0, u < -0.15 ? 5 : 4];
      }
      // chegou torto ou longe demais: sai a ré e aproxima de novo, em vez de insistir
      if (!this.retry && Math.abs(u) < 0.25 && b.bow > 14) {
        this.retry = true; g.say(this.name, 'Aproximação ruim. Vamos sair a ré e entrar de novo.', 'warn');
      }
      if (this.retry) {
        if (a < -190 || bc > 160) { this.retry = false; this.final = false; return [0, 4]; }
        return [0, u > -0.9 ? (u > 0 ? 1 : 2) : 4];
      }
      // junto ao berço
      if (inPos && bowIn && sternIn && g.sog < 0.25) {
        if (!this.ready) { this.ready = true; g.say(this.name, 'Navio em posição. Pode passar as espias.', 'info'); }
        return [0, 4];
      }
      if (rem < -15) return [0, u < -0.3 ? 4 : u > 0.1 ? 1 : 2];             // passou do berço: volta a ré, com força se a corrente empurra
      if (u > 0.15 && rem < stopDist + 8) return [0, u > 0.5 ? 1 : 2];        // quebra o seguimento a ré; o hélice puxa a popa para o cais
      if (rem > 25) return [track(20), u < 0.35 ? 5 : 4];                     // falta avançar
      if (!sternIn) return [0, u > -0.15 ? 1 : 4];                             // popa muito aberta: ré forte, o hélice puxa a popa para o cais
      if (!bowIn) { if (this.kick <= -40) this.kick = 16; return [-35, this.kick > 0 ? 5 : 4]; } // proa aberta: toque de máquina com leme a bombordo
      return [0, 4];
    }

    // --- canal: mira num ponto do eixo à frente e quebra a guinada antes
    // navio saindo pela frente: fica a boreste do eixo para cruzar bombordo com bombordo
    const meeting = g.traffic.some(o => o.kind === 'outbound' && o.phase !== 'gone' && o.s > n.s - 150 && o.s - n.s < 3200);
    if (meeting && !this.meetSaid) { this.meetSaid = true; g.say(this.name, 'Navio saindo. Vamos pelo boreste do canal e cruzar bombordo com bombordo.', 'info'); }
    const [tx, ty] = W.pointAt(n.s + P.look, meeting ? 50 : 0);
    let tel = n.s < W.S_MOUTH - 500 ? 7 : 6;
    if (n.s >= W.S_MOUTH - 500 && g.sog > 6 * KN) tel = 5;       // folga do limite de 8 nós, mesmo com a corrente a favor
    if (ds < 1900 && g.sog > 1.6) tel = g.sog > 2.4 ? 2 : g.sog > 1.9 ? 4 : 5; // já vai tirando seguimento para o berço
    // berço ocupado: regula a chegada à reta para a hora em que ele estiver livre, em vez de correr e ficar parado
    if (busy && other && Number.isFinite(other.departAt)) {
      const free = other.departAt + UNBERTH_TIME + 60 - g.time, dist = W.S_MOUTH + 1500 - n.s;
      if (free > 0 && dist > 0) {
        const cap = Math.max(0.45, dist / free);
        if (g.sog > cap + 0.9) tel = Math.min(tel, 2); else if (g.sog > cap + 0.25) tel = Math.min(tel, 4); else if (g.sog > cap) tel = Math.min(tel, 5);
        if (!this.paceSaid && cap < 2) { this.paceSaid = true; g.say(this.name, `O berço só fica livre em ${Math.round(free / 60)} min. Vamos devagar para chegar na hora${other.asked ? '' : '; ou peça ao ' + other.name + ' que largue antes'}.`, 'info'); }
      }
    }
    return [steer(tx, ty, 25), tel];
  }

  private order(g: Game, helmRaw: number, tel: number) {
    const P = PILOTS[this.grade];
    const helm = Math.max(-35, Math.min(35, Math.round(helmRaw / P.step) * P.step)) || 0;
    const urgent = Math.abs(helm - this.helm) >= 20 || this.final;
    if (helm !== this.helm && (urgent || g.time - this.lastHelm >= P.gap)) {
      this.helm = helm; this.lastHelm = g.time;
      g.say(this.name, helmPhrase(helm) + '.', 'pilot');
    }
    if (tel !== this.tel && g.time - this.lastTel >= 4) {
      this.tel = tel; this.lastTel = g.time;
      g.say(this.name, TEL_PHRASE[tel] + '.', 'pilot');
    }
  }
}
