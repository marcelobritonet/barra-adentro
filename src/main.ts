import { Panel } from './bridge/panel';
import { Game, Scenario } from './game/game';
import { makeWaterCanvas, View } from './render/view';
import { D2R } from './sim/ship';
import { KN } from './sim/ship';
import * as W from './world/santos';
import { buildGrid } from './world/santos';
import { TIDE_PRESETS, TidePreset } from './world/tide';

const game = new Game();
const grid = buildGrid();
const view = new View(document.getElementById('world')!, grid, game.p);
const panel = new Panel(game, grid, makeWaterCanvas(grid, 20));
const overlay = document.getElementById('overlay')!;
const mission = document.getElementById('mission')!;
const help = document.getElementById('help')!;
const warpflag = document.getElementById('warpflag')!;

// equipamentos ligados ficam guardados entre partidas
const EQ_KEY = 'barra-adentro.equip';
try { Object.assign(game.equip, JSON.parse(localStorage.getItem(EQ_KEY) ?? '{}')); } catch { /* sem armazenamento */ }
let eqSaved = JSON.stringify(game.equip);
function setAllEquip(on: boolean) { for (const k of Object.keys(game.equip) as (keyof typeof game.equip)[]) game.equip[k] = on; }
const north = document.getElementById('north')!;

/** Lista de passos da missão, com o passo atual em destaque. */
function steps(): [string, boolean][] {
  const s = game.s;
  if (game.scenario === 'entrada') {
    const n = W.nearest(s.x, s.y), b = game.berth(), done = game.result?.ok === true;
    return [
      ['Pedir entrada ao VTS (aba Rádio)', game.vts === 'ok'],
      ['Cruzar a barra; dali em diante, máximo de 8 nós', n.s > W.S_MOUTH],
      ['Primeira curva a bombordo', n.s > W.TURNS[3].s + 150],
      ['Segunda curva a bombordo', n.s > W.TURNS[4].s + 150],
      ['Encostar a proa no berço amarelo, por bombordo', done || game.mooring > 0 || (Math.abs(b.along) <= W.QUAY.berthHalf && b.bow <= 8)],
      ['Parar e passar as espias (M)', done || game.mooring > 0],
    ];
  }
  const a = game.anchor, inZone = Math.hypot(s.x - W.ANCHORAGE.x, s.y - W.ANCHORAGE.y) < W.ANCHORAGE.r, down = a.state === 'down';
  return [
    ['Chegar ao fundeadouro (círculo rosa, a noroeste)', inZone || down],
    ['Tirar o seguimento: menos de 3 nós para largar', down || (inZone && game.sog < 3 * KN)],
    ['Largar o ferro (F)', down],
    ['Aguardar o ferro unhar, com o navio parado', game.holdTime > 0 || game.result?.ok === true],
  ];
}
let missionHtml = '';
function drawMission() {
  const st = steps(), cur = st.findIndex(x => !x[1]);
  const html = `<b>${game.scenario === 'entrada' ? 'Entrada e atracação' : 'Fundeio'}</b>` + st.map(([t, d], i) => `<div class="${d ? 'done' : i === cur ? 'now' : ''}">${d ? '✓' : i === cur ? '▶' : '·'} ${t}</div>`).join('');
  if (html !== missionHtml) mission.innerHTML = missionHtml = html;
}
help.innerHTML = `<h2>AJUDA</h2><p>Clique ou aperte <kbd>H</kbd> para fechar.</p><div class="cols">
  <div><h3>Comandos</h3><table>
    <tr><td><kbd>A</kbd> <kbd>D</kbd> / <kbd>←</kbd> <kbd>→</kbd></td><td>Leme 5° a bombordo / boreste</td></tr>
    <tr><td><kbd>Espaço</kbd></td><td>Leme a meio</td></tr>
    <tr><td><kbd>W</kbd> <kbd>S</kbd> / <kbd>↑</kbd> <kbd>↓</kbd></td><td>Telégrafo: mais adiante / mais a ré</td></tr>
    <tr><td><kbd>J</kbd> <kbd>K</kbd> <kbd>L</kbd></td><td>Impelidor de proa: bombordo / zero / boreste</td></tr>
    <tr><td><kbd>F</kbd> <kbd>G</kbd></td><td>Largar / virar o ferro</td></tr>
    <tr><td><kbd>M</kbd></td><td>Passar espias</td></tr>
    <tr><td><kbd>1</kbd>–<kbd>4</kbd>, <kbd>P</kbd></td><td>Tempo 1×, 2×, 4×, 8× / pausa</td></tr>
    <tr><td><kbd>Q</kbd> <kbd>E</kbd>, <kbd>Z</kbd> <kbd>X</kbd></td><td>Girar a vista / zoom</td></tr>
    <tr><td><kbd>C</kbd>, <kbd>T</kbd></td><td>Carta grande / vista superior de teste</td></tr>
  </table></div>
  <div><h3>O que lembrar</h3><table>
    <tr><td>Ordem ≠ efeito</td><td>A máquina leva 6 s para começar a cumprir e 47 s até meia força; o leme, 2 s e mais 19 s até 35°.</td></tr>
    <tr><td>Quebrar a guinada</td><td>Depois de pôr o leme a meio o navio ainda gira dezenas de graus. Use leme contrário antes de chegar ao rumo.</td></tr>
    <tr><td>Leme precisa de água</td><td>Sem seguimento e sem máquina adiante, o leme não governa. Um toque de máquina com leme carregado gira o navio.</td></tr>
    <tr><td>Ar de partida</td><td>Cada partida ou inversão gasta uma de 5 cargas; elas voltam devagar.</td></tr>
    <tr><td>Balizamento</td><td>Entrando: boia encarnada a boreste, verde a bombordo.</td></tr>
    <tr><td>Rebocadores</td><td>Só passam o cabo abaixo de 5 nós. Empurrar leva para bombordo, que é o lado do cais.</td></tr>
    <tr><td>Atracar</td><td>Chegue em ângulo raso, encoste a proa a menos de 0,3 nó e passe as espias; os cabos trazem a popa.</td></tr>
    <tr><td>Confiança</td><td>Erros e sustos derrubam; manobras limpas levantam. Ela muda a rapidez das ordens e os avisos.</td></tr>
  </table></div></div>`;
help.addEventListener('click', () => { help.hidden = true; });
document.getElementById('camctl')!.addEventListener('click', e => {
  const b = (e.target as HTMLElement).closest('button'); if (!b) return;
  const c = b.dataset.cam;
  if (c === 'rl') view.rotate(-1); if (c === 'rr') view.rotate(1); if (c === 'zi') view.zoom(-1); if (c === 'zo') view.zoom(1);
  if (c === 'chart') panel.bigChart = !panel.bigChart; if (c === 'help') help.hidden = !help.hidden;
  b.blur();
});
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
    <div class="preset">Maré: ${(Object.keys(TIDE_PRESETS) as TidePreset[]).map(k => `<button data-tide="${k}" class="${game.tidePreset === k ? 'on' : ''}">${TIDE_PRESETS[k].label}</button>`).join('')}</div>
    <p class="dim" style="margin-top:0">${TIDE_PRESETS[game.tidePreset].hint} A maré corre 2× mais rápido que a real.</p>
    <div class="preset">Equipamentos de teste: <button data-eq="off" class="${Object.values(game.equip).some(Boolean) ? '' : 'on'}">Navio básico</button><button data-eq="on" class="${Object.values(game.equip).every(Boolean) ? 'on' : ''}">Tudo ligado</button><span class="dim">(radar, ECDIS, doppler, impelidor, GPS)</span></div>
    <p class="dim">Ajuda durante o jogo: tecla <kbd>H</kbd>. A carta é estilizada e não serve para navegação.</p>
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
  if (b.dataset.eq) { setAllEquip(b.dataset.eq === 'on'); return menu(); }
  if (b.dataset.tide) { game.tidePreset = b.dataset.tide as TidePreset; return menu(); }
  if (b.dataset.sc) {
    game.start(b.dataset.sc as Scenario);
    panel.reset(); overlay.hidden = true; shown = false; help.hidden = true;
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
  else if (k === 'h') help.hidden = !help.hidden;
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
  if (game.status !== 'menu') drawMission();
  const flag = game.status === 'running' ? (game.paused ? 'PAUSA' : game.warp > 1 ? `TEMPO ${game.warp}×` : '') : '';
  warpflag.hidden = !flag; if (flag && warpflag.textContent !== flag) warpflag.textContent = flag;
  const eq = JSON.stringify(game.equip);
  if (eq !== eqSaved) { eqSaved = eq; try { localStorage.setItem(EQ_KEY, eq); } catch { /* sem armazenamento */ } }
  if (game.status === 'done' && !shown) { shown = true; showResult(); }
  requestAnimationFrame(frame);
}
menu();
requestAnimationFrame(frame);

// acesso para depuração e testes no navegador
Object.assign(window, { game, view, panel });
