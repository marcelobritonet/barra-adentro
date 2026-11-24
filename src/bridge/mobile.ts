// Tela de celular: o navio ocupa a tela, os valores que se acompanham o tempo todo ficam numa barra embaixo
// e cada equipamento sobe como uma folha quando chamado. Os instrumentos são os mesmos do painel de mesa,
// só mudam de lugar na página.
import { Game } from '../game/game';
import { D2R, KN, TELEGRAPH_STOP } from '../sim/ship';
import type { Panel } from './panel';

const KEY = 'barra-adentro.tela';
type Sheet = { title: string; parts: string[] };
/** Cada folha junta um ou mais instrumentos do painel (seletor de um elemento dentro do instrumento). */
const SHEETS: Record<string, Sheet> = {
  leme: { title: 'Leme', parts: ['#cRudder'] },
  maq: { title: 'Máquina', parts: ['#telegraph', '#cRpm'] },
  nav: { title: 'Agulha, velocidade e vento', parts: ['#cCompass', '#stw', '#cWind'] },
  sonda: { title: 'Ecobatímetro e doppler', parts: ['#cEcho', '#cDoppler'] },
  thr: { title: 'Impelidor de proa', parts: ['#thrbox'] },
  tela: { title: 'Carta, ECDIS e radar', parts: ['#mfd'] },
  ops: { title: 'Rádio, rebocadores e convés', parts: ['#ops'] },
  tempo: { title: 'Tempo e maré', parts: ['#topbar', '#tidebox'] },
};
/** Botões semitransparentes na borda: [folha, rótulo, aba do painel de operações]. */
const SIDE: [string, string, string?][] = [
  ['tela', 'Carta'], ['ops', 'Rádio', 'radio'], ['ops', 'Reboc.', 'tugs'], ['ops', 'Convés', 'deck'], ['thr', 'Impel.'], ['tempo', 'Tempo'],
];
const SHORT_TEL = ['T.F. RÉ', 'M.F. RÉ', 'DEV. RÉ', 'M.DEV. RÉ', 'PARA', 'M. DEV.', 'DEVAGAR', 'MEIA F.', 'TODA F.'];
const deg3 = (rad: number) => String(Math.round(((rad / D2R) % 360 + 360) % 360) % 360).padStart(3, '0');

export class Mobile {
  active = false;
  /** 'auto' segue o tamanho da janela; 'celular' força a tela de celular numa janela grande.
   *  Não existe forçar a tela de mesa numa janela pequena: o painel cobria tudo e não havia como voltar. */
  pref: 'auto' | 'celular' = 'auto';
  private open = new Set<string>();
  private home = new Map<HTMLElement, { parent: Node; next: Node | null }>();
  private shell: HTMLElement; private sheets: HTMLElement; private bar: HTMLElement; private side: HTMLElement;
  private mq = matchMedia('(max-width: 820px), (max-height: 500px)');
  private barHtml = '';

  constructor(private g: Game, private panel: Panel, private onChange: () => void) {
    const q = new URLSearchParams(location.search).get('tela');
    try { const v = q ?? localStorage.getItem(KEY); if (v === 'celular') this.pref = v; } catch { /* sem armazenamento */ }
    this.shell = document.createElement('div'); this.shell.id = 'mshell';
    this.shell.innerHTML = `<div id="mside">${SIDE.map(([k, l, t]) => `<button data-sheet="${k}" ${t ? `data-optab="${t}"` : ''}>${l}</button>`).join('')}</div><div id="msheets"></div><div id="mbar"></div>`;
    document.body.appendChild(this.shell);
    this.side = this.shell.querySelector('#mside')!; this.sheets = this.shell.querySelector('#msheets')!; this.bar = this.shell.querySelector('#mbar')!;
    this.shell.addEventListener('click', e => {
      const t = e.target as HTMLElement;
      const close = t.closest<HTMLElement>('[data-close]');
      if (close) return this.toggle(close.dataset.close!, false);
      const b = t.closest<HTMLElement>('#mside [data-sheet], #mbar [data-sheet]'); if (!b) return;
      const k = b.dataset.sheet!, tab = b.dataset.optab;
      if (tab) {   // três botões abrem a mesma folha, cada um na sua aba
        const same = this.open.has(k) && this.panel.tab === tab;
        this.panel.tab = tab; this.toggle(k, !same);
      } else this.toggle(k);
      b.blur();
    });
    this.sheets.addEventListener('click', e => this.panel.onClick(e));
    this.mq.addEventListener('change', () => this.apply());
    this.apply();
  }

  /** Alterna entre a tela de celular e a de mesa, e guarda a escolha. */
  flip() {
    if (this.mq.matches) return;
    this.pref = this.active ? 'auto' : 'celular';
    try { localStorage.setItem(KEY, this.pref); } catch { /* sem armazenamento */ }
    this.apply();
  }

  toggle(k: string, on = !this.open.has(k)) {
    if (on) this.open.add(k); else this.open.delete(k);
    this.sheets.querySelectorAll<HTMLElement>('.sheet').forEach(el => { el.hidden = !this.open.has(el.dataset.name!); });
  }
  closeAll() { for (const k of [...this.open]) this.toggle(k, false); }

  apply() {
    const want = this.mq.matches || this.pref === 'celular';
    const flipBtn = document.querySelector<HTMLElement>('[data-cam="layout"]'); if (flipBtn) flipBtn.hidden = this.mq.matches;
    if (want === this.active) return;
    this.active = want;
    document.body.classList.toggle('mobile', want);
    if (want) {
      this.sheets.innerHTML = '';
      for (const [name, sh] of Object.entries(SHEETS)) {
        const el = document.createElement('div'); el.className = 'sheet'; el.dataset.name = name; el.hidden = !this.open.has(name);
        el.innerHTML = `<div class="sheethead"><b>${sh.title}</b><button data-close="${name}" title="Fechar">✕</button></div><div class="sheetbody"></div>`;
        const body = el.querySelector('.sheetbody')!;
        for (const sel of sh.parts) {
          const inst = document.querySelector<HTMLElement>(sel)?.closest<HTMLElement>('.inst'); if (!inst) continue;
          if (!this.home.has(inst)) this.home.set(inst, { parent: inst.parentNode!, next: inst.nextSibling });
          body.appendChild(inst);
        }
        this.sheets.appendChild(el);
      }
    } else {
      // devolve cada instrumento ao lugar de origem, de trás para a frente para os vizinhos baterem
      for (const [inst, h] of [...this.home].reverse()) h.parent.insertBefore(inst, h.next && h.next.parentNode === h.parent ? h.next : null);
      this.home.clear(); this.sheets.innerHTML = '';
    }
    this.onChange();
  }

  update() {
    if (!this.active) return;
    const g = this.g, s = g.s, run = g.status !== 'menu';
    // plano, ajuda e telas do porto ocupam a tela toda: a barra e os botões saem da frente
    const covered = ['plan', 'help'].some(id => !document.getElementById(id)!.hidden) || !document.getElementById('overlay')!.hidden;
    this.shell.classList.toggle('idle', !run || covered);
    const hasPos = g.equip.gps || g.equip.ecdis;
    const rud = Math.round(s.rudder / D2R), ord = Math.round(s.rudderOrder / D2R);
    const side = (v: number) => v === 0 ? 'MEIO' : `${v < 0 ? 'BB' : 'BE'} ${Math.abs(v)}`;
    const rot = s.r / D2R * 60;
    const ukc = g.ukcMin, tel = s.telegraph;
    const cell = (k: string, h: string, v: string, sub: string, cls = '') => `<button data-sheet="${k}" class="${this.open.has(k) ? 'on ' : ''}${cls}"><small>${h}</small><b>${v}</b><i>${sub}</i></button>`;
    const html =
      cell('nav', 'Rumo', deg3(s.psi) + '°', g.equip.rot && Math.abs(rot) >= 1 ? `${rot > 0 ? '▶' : '◀'} ${Math.abs(rot).toFixed(0)}°/min` : 'firme') +
      cell('nav', hasPos ? 'No fundo' : 'Na água', ((hasPos ? g.sog : Math.abs(s.stw)) / KN).toFixed(1), hasPos && Math.abs(g.leeway) >= 1 ? `abate ${Math.abs(g.leeway).toFixed(0)}° ${g.leeway > 0 ? 'BE' : 'BB'}` : 'nós') +
      cell('leme', 'Leme', side(rud), rud === ord ? 'na ordem' : `indo a ${side(ord)}`, rud === ord ? '' : 'moving') +
      cell('maq', 'Máquina', SHORT_TEL[tel], `${Math.round(Math.abs(s.n) * 100)}% ${s.n < -0.01 ? 'ré' : tel === TELEGRAPH_STOP && Math.abs(s.n) < 0.01 ? 'parada' : 'rot.'}`, tel > TELEGRAPH_STOP ? 'ahead' : tel < TELEGRAPH_STOP ? 'astern' : '') +
      cell('sonda', 'Sonda', ukc > 50 ? '>50' : Math.max(0, ukc).toFixed(1), 'm', ukc < 1.5 ? 'bad' : ukc < 3 ? 'warn' : '');
    if (html !== this.barHtml) this.bar.innerHTML = this.barHtml = html;
    // rótulo e alerta dos botões da borda
    const mfdName = { carta: 'Carta', ecdis: 'ECDIS', radar: 'Radar', atracar: 'Cais' }[this.panel.mfd];
    this.side.querySelectorAll<HTMLElement>('button').forEach(b => {
      const k = b.dataset.sheet!, tab = b.dataset.optab;
      if (k === 'tela' && b.textContent !== mfdName) b.textContent = mfdName;
      b.classList.toggle('on', this.open.has(k) && (!tab || this.panel.tab === tab || (tab === 'tugs' && this.panel.tab === 'manobra')));
      if (tab) b.classList.toggle('alert', !!document.querySelector(`[data-tab="${tab}"].alert, [data-tab="${tab === 'tugs' ? 'manobra' : tab}"].alert`) || (tab === 'tugs' && g.canMoor && !this.open.has('ops')));
      if (k === 'thr') b.hidden = !g.equip.thruster;
    });
  }
}
