import { Panel } from './bridge/panel';
import { Game, Scenario } from './game/game';
import { makeWaterCanvas, View } from './render/view';
import { D2R } from './sim/ship';
import { KN } from './sim/ship';
import * as W from './world/santos';
import { buildGrid } from './world/santos';
import { TIDE_PRESETS, TidePreset } from './world/tide';
import { berthBusy } from './game/traffic';
import { buy, CONTRACTS, CREW, CrewId, Level, loadCareer, newCareer, PARTS, PartId, salaries, saveCareer } from './game/career';

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
      ['Berço livre: aguardar ou pedir pelo rádio que o navio largue', !berthBusy(game)],
      ['Cruzar a barra; dali em diante, máximo de 8 nós', n.s > W.S_MOUTH],
      ['Primeira curva a bombordo; cruzar com o navio que sai, bombordo com bombordo', n.s > W.TURNS[3].s + 150],
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

// modo de jogo e carreira ficam guardados entre partidas
const FREE_KEY = 'barra-adentro.livre';
game.career = loadCareer();
try { game.free = localStorage.getItem(FREE_KEY) === '1'; } catch { /* sem armazenamento */ }
let portTab: 'contratos' | 'oficina' | 'tripulacao' = 'contratos', portMsg = '', confirmNew = false;
const brl = (v: number) => `R$ ${Math.round(v).toLocaleString('pt-BR')}`;

function shopRows(kind: 'part' | 'crew') {
  const c = game.career;
  const row = (id: string, label: string, levels: Level[], have: number) => {
    const cur = levels[have], next = levels[have + 1];
    return `<tr><td><b>${label}</b><br><span class="have">${cur.name}</span><br><small>${cur.effect}${cur.salary ? ` · soldada ${brl(cur.salary)} por viagem` : ''}</small></td>
      <td>${next ? `<b>${next.name}</b><br><small>${next.effect}${next.salary ? ` · soldada ${brl(next.salary)} por viagem` : ''}</small>` : '<span class="pos">Melhor nível</span>'}</td>
      <td>${next ? `<button data-buy="${kind}:${id}" ${c.money < next.price ? 'disabled' : ''}>${kind === 'part' ? 'Comprar' : 'Contratar'}<br>${brl(next.price)}</button>` : ''}</td></tr>`;
  };
  if (kind === 'crew') return `<table class="shop">${(Object.keys(CREW) as CrewId[]).map(k => row(k, CREW[k].label, CREW[k].levels, c.crew[k])).join('')}</table>
    <p class="dim">Tripulante contratado recebe soldada a cada viagem. Se a confiança da tripulação terminar uma viagem em −60 ou menos, o melhor contratado desembarca.</p>`;
  const groups = ['Máquina e governo', 'Instrumentos'] as const;
  return groups.map(gr => `<h3>${gr}</h3><table class="shop">${(Object.keys(PARTS) as PartId[]).filter(k => PARTS[k].group === gr).map(k => row(k, PARTS[k].label, PARTS[k].levels, c.parts[k])).join('')}</table>`).join('');
}

function menu() {
  overlay.hidden = false;
  const c = game.career;
  const head = `<h1>BARRA ADENTRO</h1>
    <div class="modes"><button data-mode="career" class="${game.free ? '' : 'on'}">Carreira</button><button data-mode="free" class="${game.free ? 'on' : ''}">Modo livre</button>
      <span class="dim">${game.free ? 'Sem dinheiro: escolha cenário, maré e equipamentos à vontade.' : 'Entregue cargas, pague as contas e equipe o navio.'}</span></div>`;
  const foot = `<p class="dim">Confiança da tripulação: <b>${sign(game.trust)}</b> (−100 a +100) <button data-reset="1">Zerar</button> · Ajuda no jogo: <kbd>H</kbd> · A carta é estilizada e não serve para navegação.</p>`;
  if (game.free) {
    overlay.innerHTML = `<div class="card">${head}
      <p>Você comanda o <b>N/M Maré Mansa</b>, um costeiro de 90 m chegando à barra de Santos. O navio demora a obedecer: dê a ordem antes de precisar dela.</p>
      <div class="choices">
        <button data-sc="entrada">▶ Entrada e atracação<small>VTS, prático opcional, berço ocupado por um navio que precisa sair, cruzamento no canal, duas curvas e atracação por bombordo.</small></button>
        <button data-sc="fundeio">▶ Fundeio<small>Fundear entre os navios do fundeadouro externo. Mais curto, bom para aprender.</small></button>
      </div>
      <div class="preset">Maré: ${(Object.keys(TIDE_PRESETS) as TidePreset[]).map(k => `<button data-tide="${k}" class="${game.tidePreset === k ? 'on' : ''}">${TIDE_PRESETS[k].label}</button>`).join('')}</div>
      <p class="dim" style="margin-top:0">${TIDE_PRESETS[game.tidePreset].hint} A maré corre 2× mais rápido que a real.</p>
      <div class="preset">Equipamentos: <button data-eq="off" class="${Object.values(game.equip).some(Boolean) ? '' : 'on'}">Navio básico</button><button data-eq="on" class="${Object.values(game.equip).every(Boolean) ? 'on' : ''}">Tudo ligado</button><span class="dim">(ou um a um, na aba Equip. do painel)</span></div>
      ${foot}</div>`;
    return;
  }
  const tabs = ([['contratos', 'Contratos'], ['oficina', 'Oficina'], ['tripulacao', 'Tripulação']] as const).map(([k, l]) => `<button data-port="${k}" class="${portTab === k ? 'on' : ''}">${l}</button>`).join('');
  const body = portTab === 'contratos'
    ? `<div class="contracts">${CONTRACTS.map(ct => `<button data-contract="${ct.id}">
        <span class="stars">${'★'.repeat(ct.stars)}${'☆'.repeat(5 - ct.stars)}</span><b>${ct.title}</b><span class="pay">${brl(ct.freight)}</span>
        <small>${ct.cargo} · calado ${(3.6 + 1.6 * ct.load).toFixed(1).replace('.', ',')} m · maré: ${TIDE_PRESETS[ct.tide].label.toLowerCase()} · prazo ${ct.parMin} min<br>${ct.note}</small></button>`).join('')}</div>`
    : shopRows(portTab === 'oficina' ? 'part' : 'crew');
  overlay.innerHTML = `<div class="card wide">${head}
    <div class="purse"><span>N/M Maré Mansa · ${c.voyages} viage${c.voyages === 1 ? 'm' : 'ns'}</span><span>Caixa <b class="${c.money >= 0 ? 'pos' : 'neg'}">${brl(c.money)}</b>${salaries(c) ? ` · soldadas ${brl(salaries(c))} por viagem` : ''}</span></div>
    <div class="tabs">${tabs}<span class="sp"></span><button data-newcareer="1" class="${confirmNew ? 'danger' : ''}">${confirmNew ? 'Confirmar: apagar a carreira' : 'Recomeçar'}</button></div>
    ${portMsg ? `<p class="neg">${portMsg}</p>` : ''}
    ${body}
    ${foot}</div>`;
}
function showResult() {
  const r = game.result!;
  overlay.hidden = false;
  overlay.innerHTML = `<div class="card">
    <h2 class="${r.ok ? 'pos' : 'neg'}">${r.title}</h2>
    <p>${r.detail}</p>
    <table>${r.lines.map(([l, v]) => `<tr><td>${l}</td><td>${money(v)}</td></tr>`).join('')}
      <tr class="total"><td>Resultado da viagem</td><td>${money(r.total)}</td></tr>
      ${game.free ? '' : `<tr><td>Caixa</td><td>${money(game.career.money)}</td></tr>`}
      <tr><td>Confiança da tripulação</td><td>${sign(r.trustBefore)} → <span class="${r.trustAfter >= r.trustBefore ? 'pos' : 'neg'}">${sign(r.trustAfter)}</span></td></tr></table>
    ${r.left ? '<p class="neg">A tripulação perdeu a confiança em você e alguém desembarcou. O substituto chega desconfiado.</p>' : ''}
    <div class="choices"><button data-again="1">↻ ${game.free ? 'Tentar de novo' : 'Repetir o contrato'}</button><button data-menu="1">${game.free ? '☰ Menu' : '⚓ Voltar ao porto'}</button></div>
  </div>`;
}
function launch(sc: Scenario) {
  game.start(sc);
  panel.reset(); overlay.hidden = true; shown = false; help.hidden = true;
}
overlay.addEventListener('click', e => {
  const b = (e.target as HTMLElement).closest('button'); if (!b) return;
  const d = b.dataset;
  if (!d.newcareer) confirmNew = false;
  portMsg = '';
  if (d.menu) return menu();
  if (d.reset) { game.resetTrust(); return menu(); }
  if (d.eq) { setAllEquip(d.eq === 'on'); return menu(); }
  if (d.tide) { game.tidePreset = d.tide as TidePreset; return menu(); }
  if (d.mode) { game.free = d.mode === 'free'; try { localStorage.setItem(FREE_KEY, game.free ? '1' : '0'); } catch { /* sem armazenamento */ } return menu(); }
  if (d.port) { portTab = d.port as typeof portTab; return menu(); }
  if (d.buy) { const [kind, id] = d.buy.split(':'); portMsg = buy(game.career, kind as 'part' | 'crew', id) ?? ''; saveCareer(game.career); return menu(); }
  if (d.newcareer) { if (!confirmNew) { confirmNew = true; return menu(); } confirmNew = false; game.career = newCareer(); saveCareer(game.career); game.resetTrust(); return menu(); }
  if (d.contract) { const ct = CONTRACTS.find(x => x.id === d.contract)!; game.contract = ct; return launch(ct.scenario); }
  if (d.again) return launch(game.scenario);
  if (d.sc) { game.contract = null; return launch(d.sc as Scenario); }
});

addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey) return;
  if (e.target instanceof HTMLSelectElement) { if (e.key.startsWith('Arrow') || e.key === ' ' || e.key === 'Enter') return; e.target.blur(); }
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
