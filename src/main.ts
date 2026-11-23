import { Panel } from './bridge/panel';
import { Game, Scenario } from './game/game';
import { makeWaterCanvas, View } from './render/view';
import { D2R } from './sim/ship';
import { buildGrid } from './world/santos';

const game = new Game();
const grid = buildGrid();
const view = new View(document.getElementById('world')!, grid, game.p);
const panel = new Panel(game, grid, makeWaterCanvas(grid, 20));
const overlay = document.getElementById('overlay')!;
const goal = document.getElementById('goal')!;
const north = document.getElementById('north')!;

const GOALS: Record<Scenario, string> = {
  entrada: 'Peça entrada ao VTS pelo rádio (e um prático, se quiser). Entre pela barra e siga o canal balizado (encarnada a boreste, verde a bombordo) pelas duas curvas a bombordo. O berço, marcado em amarelo, fica depois da segunda curva: atraque por bombordo, pare com a proa encostada e passe as espias (M).',
  fundeio: 'Siga para o fundeadouro (círculo rosa, a noroeste), aproe ao vento, tire o seguimento e largue o ferro (F). Aguarde o ferro unhar.',
};
const money = (v: number) => `<span class="${v >= 0 ? 'pos' : 'neg'}">${v < 0 ? '−' : ''}R$ ${Math.abs(v).toLocaleString('pt-BR')}</span>`;

const sign = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v)}`;

function menu() {
  overlay.hidden = false;
  overlay.innerHTML = `<div class="card">
    <h1>BARRA ADENTRO</h1>
    <p>Protótipo de manobra de navios. Você comanda o <b>N/M Maré Mansa</b>, um costeiro de 90 m e 4.800 t carregado, chegando à barra de Santos.
    O navio demora a obedecer: dê a ordem antes de precisar dela.</p>
    <div class="choices">
      <button data-sc="entrada">▶ Entrada e atracação<small>Autorização do VTS, prático opcional, barra, duas curvas com limite de 8 nós e corrente de vazante, atracação por bombordo. Frete R$ 28.000.</small></button>
      <button data-sc="fundeio">▶ Fundeio<small>Berço ocupado: fundear no fundeadouro externo e aguardar. Mais curto, bom para aprender.</small></button>
    </div>
    <table>
      <tr><td><kbd>A</kbd> <kbd>D</kbd> ou <kbd>←</kbd> <kbd>→</kbd></td><td>Leme 5° a bombordo / boreste</td></tr>
      <tr><td><kbd>Espaço</kbd></td><td>Leme a meio</td></tr>
      <tr><td><kbd>W</kbd> <kbd>S</kbd> ou <kbd>↑</kbd> <kbd>↓</kbd></td><td>Telégrafo: mais adiante / mais a ré</td></tr>
      <tr><td><kbd>F</kbd> <kbd>G</kbd> <kbd>M</kbd></td><td>Largar ferro / virar ferro / passar espias</td></tr>
      <tr><td><kbd>J</kbd> <kbd>K</kbd> <kbd>L</kbd></td><td>Impelidor de proa: bombordo / zero / boreste (se instalado)</td></tr>
      <tr><td><kbd>1</kbd>–<kbd>4</kbd> <kbd>P</kbd></td><td>Acelerar o tempo (1×, 2×, 4×, 8×) / pausa</td></tr>
      <tr><td><kbd>Q</kbd> <kbd>E</kbd> <kbd>Z</kbd> <kbd>X</kbd> <kbd>C</kbd></td><td>Girar a vista / zoom / carta</td></tr>
    </table>
    <p>Confiança da tripulação: <b>${sign(game.trust)}</b> (de −100 a +100). Ela muda a rapidez com que as ordens são cumpridas e o quanto a tripulação avisa. <button data-reset="1">Zerar</button></p>
    <p class="dim">A carta é estilizada e não serve para navegação.</p>
  </div>`;
}
function showResult() {
  const r = game.result!;
  overlay.hidden = false;
  overlay.innerHTML = `<div class="card">
    <h2 class="${r.ok ? 'pos' : 'neg'}">${r.title}</h2>
    <p>${r.detail}</p>
    <table>${r.lines.map(([l, v]) => `<tr><td>${l}</td><td>${money(v)}</td></tr>`).join('')}
      <tr class="total"><td>Resultado da viagem</td><td>${money(r.total)}</td></tr>
      <tr><td>Confiança da tripulação</td><td>${sign(r.trustBefore)} → <span class="${r.trustAfter >= r.trustBefore ? 'pos' : 'neg'}">${sign(r.trustAfter)}</span></td></tr></table>
    ${r.left ? '<p class="neg">A tripulação perdeu a confiança em você e o timoneiro desembarcou. O substituto chega desconfiado.</p>' : ''}
    <div class="choices"><button data-sc="${game.scenario}">↻ Tentar de novo</button><button data-menu="1">☰ Menu</button></div>
  </div>`;
}
overlay.addEventListener('click', e => {
  const b = (e.target as HTMLElement).closest('button'); if (!b) return;
  if (b.dataset.menu) return menu();
  if (b.dataset.reset) { game.resetTrust(); return menu(); }
  if (b.dataset.sc) {
    game.start(b.dataset.sc as Scenario);
    panel.reset(); goal.textContent = GOALS[game.scenario]; overlay.hidden = true; shown = false;
  }
});

addEventListener('keydown', e => {
  if (e.target instanceof HTMLSelectElement || e.metaKey || e.ctrlKey) return;
  const k = e.key.toLowerCase(), s = game.s;
  const helm = (d: number) => game.setRudderDeg(Math.round(s.rudderOrder / D2R / 5) * 5 + d);
  if (k === 'a' || k === 'arrowleft') helm(-5);
  else if (k === 'd' || k === 'arrowright') helm(5);
  else if (k === ' ') game.setRudderDeg(0);
  else if (k === 'w' || k === 'arrowup') game.setTelegraph(s.telegraph + 1);
  else if (k === 's' || k === 'arrowdown') game.setTelegraph(s.telegraph - 1);
  else if (k === 'f') game.letGoAnchor();
  else if (k === 'g') game.heaveAnchor();
  else if (k === 'm') game.moor();
  else if (k === 'p') game.paused = !game.paused;
  else if ('1234'.includes(k)) game.warp = [1, 2, 4, 8][+k - 1];
  else if (k === 'q') view.rotate(-1);
  else if (k === 'e') view.rotate(1);
  else if (k === 'z') view.zoom(-1);
  else if (k === 'x') view.zoom(1);
  else if (k === 't') view.top = !view.top;
  else if (k === 'c') panel.bigChart = !panel.bigChart;
  else if (k === 'j') game.setThruster(Math.round((s.thrusterOrder - 0.25) * 4) / 4);
  else if (k === 'l') game.setThruster(Math.round((s.thrusterOrder + 0.25) * 4) / 4);
  else if (k === 'k') game.setThruster(0);
  else return;
  e.preventDefault();
});
document.getElementById('world')!.addEventListener('wheel', e => { view.zoom(e.deltaY > 0 ? 1 : -1); e.preventDefault(); }, { passive: false });

// se o painel não couber na altura da janela, ele encolhe inteiro, sem rolagem
const bridge = document.getElementById('bridge')!;
function fit() {
  bridge.style.transform = ''; bridge.style.height = 'auto'; bridge.style.marginLeft = '';
  const k = Math.min(1, innerHeight / bridge.scrollHeight);
  bridge.style.transform = k < 1 ? `scale(${k})` : '';
  bridge.style.height = `${100 / k}%`;
  bridge.style.marginLeft = k < 1 ? `${-500 * (1 - k)}px` : '';
}
addEventListener('resize', fit); fit(); setTimeout(fit, 300);

let last = performance.now(), shown = false;
function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  game.update(dt);
  view.render(game, dt);
  panel.update(dt);
  north.style.transform = `rotate(${view.compassDeg}deg)`;
  if (game.status === 'done' && !shown) { shown = true; showResult(); }
  requestAnimationFrame(frame);
}
menu();
requestAnimationFrame(frame);

// acesso para depuração e testes no navegador
Object.assign(window, { game, view, panel });
