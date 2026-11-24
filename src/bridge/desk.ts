// Arrumações do painel na tela de mesa. Os instrumentos são sempre os mesmos; o que muda é onde cada um fica
// e o tamanho da tela multifunção (carta, ECDIS, radar, cais).
import type { Panel } from './panel';

const KEY = 'barra-adentro.painel';
export const DESKS = {
  console: 'Console embaixo, ECDIS grande à direita',
  flutuante: 'ECDIS grande sobre a vista',
  lado: 'Tudo no painel (ECDIS pequeno)',
} as const;
export type DeskKey = keyof typeof DESKS;
const ORDER = Object.keys(DESKS) as DeskKey[];
const inst = (sel: string) => document.querySelector<HTMLElement>(sel)!.closest<HTMLElement>('.inst')!;

export class Desk {
  /** Em janela larga, o console; em janela mais estreita ele encolheria demais, então a tela grande flutua. */
  variant: DeskKey = innerWidth >= 1300 ? 'console' : 'flutuante';
  private home = new Map<HTMLElement, { parent: Node; next: Node | null }>();
  private dock: HTMLElement; private strip: HTMLElement;

  constructor(private panel: Panel) {
    const q = new URLSearchParams(location.search).get('painel');
    try { const v = q ?? localStorage.getItem(KEY); if (v && v in DESKS) this.variant = v as DeskKey; } catch { /* sem armazenamento */ }
    this.dock = document.createElement('div'); this.dock.id = 'dock'; document.getElementById('world')!.appendChild(this.dock);
    this.strip = document.createElement('div'); this.strip.id = 'strip'; document.getElementById('app')!.appendChild(this.strip);
    for (const el of [this.dock, this.strip]) el.addEventListener('click', e => this.panel.onClick(e));
    this.apply();
  }

  next() {
    this.variant = ORDER[(ORDER.indexOf(this.variant) + 1) % ORDER.length];
    try { localStorage.setItem(KEY, this.variant); } catch { /* sem armazenamento */ }
    this.apply();
  }

  private move(el: HTMLElement, to: Node, before: Node | null = null) {
    if (!this.home.has(el)) this.home.set(el, { parent: el.parentNode!, next: el.nextSibling });
    to.insertBefore(el, before);
  }

  apply() {
    for (const [el, h] of [...this.home].reverse()) h.parent.insertBefore(el, h.next && h.next.parentNode === h.parent ? h.next : null);
    this.home.clear();
    for (const k of ORDER) document.body.classList.toggle('desk-' + k, k === this.variant);
    const bridge = document.getElementById('bridge')!, mfd = document.getElementById('mfd')!;
    if (this.variant === 'flutuante') this.move(mfd, this.dock);
    if (this.variant === 'console') {
      // embaixo da vista, o que se olha e se mexe o tempo todo; à direita, a tela grande, o rádio e o resto
      for (const sel of ['#cCompass', '#stw', '#cRudder', '#telegraph', '#cRpm', '#cEcho']) this.move(inst(sel), this.strip);
      const row3 = document.getElementById('thrbox')!.parentElement!;
      this.move(inst('#cWind'), row3, row3.firstChild);
      this.move(mfd, bridge, row3);
    }
    this.size();
  }

  /** Tamanho da tela multifunção conforme a arrumação e o espaço que há. */
  size() {
    if (document.body.classList.contains('mobile')) return;
    const world = document.getElementById('world')!;
    const px = this.variant === 'lado' ? 236 : this.variant === 'console' ? 472 : Math.round(Math.max(260, Math.min(472, world.clientHeight / 2 - 80, world.clientWidth / 2 - 50)))   // sem chegar ao meio da vista, onde está o navio;
    this.panel.setMfdSize(px);
    // o console encolhe para caber na largura da vista
    this.strip.style.zoom = '1';
    if (this.variant === 'console') this.strip.style.zoom = String(Math.min(1, world.clientWidth / Math.max(1, this.strip.scrollWidth)));
  }
}
