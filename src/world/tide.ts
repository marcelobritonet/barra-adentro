// Maré semidiurna. Para caber numa partida, corre 2× mais rápido que a real:
// um ciclo completo leva 6 h 12 min de jogo, e uma viagem de 1 h vê a maré mudar bastante.
export const TIDE_PERIOD = (12.42 * 3600) / 2;
export const TIDE_MEAN = 0.75, TIDE_AMP = 0.65;   // altura sobre o nível da carta: 0,10 a 1,40 m

export const FLOOD_FACTOR = 0.5;                    // a enchente corre a metade da vazante

export type TidePreset = 'vazante' | 'enchente' | 'baixamar' | 'preamar';
export const TIDE_PRESETS: Record<TidePreset, { label: string; phase: number; hint: string }> = {
  vazante: { label: 'Vazante', phase: 60, hint: 'Corrente contra na entrada; a água baixa durante a viagem.' },
  enchente: { label: 'Enchente', phase: 240, hint: 'Corrente a favor: o navio chega mais rápido e custa mais a parar.' },
  baixamar: { label: 'Baixa-mar', phase: 165, hint: 'Pouca água nos bancos; a corrente para e vira no meio da viagem.' },
  preamar: { label: 'Preamar', phase: -15, hint: 'Mais água sob a quilha; a corrente está parada e começa a vazar.' },
};

export interface Tide {
  height: number;   // m acima do nível da carta
  flow: number;     // -0,5 enchente plena, +1 vazante plena (o rio soma na vazante e segura a enchente)
  rising: boolean;
  toSlack: number;  // segundos até a corrente parar e virar
}
export function tideAt(t: number, preset: TidePreset): Tide {
  const phi = (TIDE_PRESETS[preset].phase * Math.PI) / 180 + (2 * Math.PI * t) / TIDE_PERIOD;
  const raw = Math.sin(phi);                  // nível caindo = vazante
  const flow = raw > 0 ? raw : raw * FLOOD_FACTOR;
  const p = ((phi % Math.PI) + Math.PI) % Math.PI;
  return { height: TIDE_MEAN + TIDE_AMP * Math.cos(phi), flow, rising: flow < 0, toSlack: ((Math.PI - p) / (2 * Math.PI)) * TIDE_PERIOD };
}
export function tideText(td: Tide) {
  const kn = Math.abs(td.flow) * 0.55 / 0.5144;
  const cur = kn < 0.15 ? 'estofa (corrente parada)' : `${td.flow > 0 ? 'vazante' : 'enchente'} de ${kn.toFixed(1).replace('.', ',')} nó no canal`;
  return `${td.height.toFixed(1).replace('.', ',')} m ${td.rising ? '▲ subindo' : '▼ baixando'} · ${cur} · vira em ${Math.round(td.toSlack / 60)} min`;
}
