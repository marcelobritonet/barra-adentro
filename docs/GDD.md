# Barra Adentro — documento de design (rascunho)

Nome provisório. Simulador de entrada em canal e manobra de navio, em pixel art 3D isométrico. A graça é a **antecipação**: o navio responde devagar, então toda ordem precisa ser dada antes da hora.

## Pilares

| Pilar | O que significa |
|---|---|
| Antecipação | Ordem ≠ efeito. Máquina, leme e casco têm atraso. Quem reage, perde. |
| Instrumentos mandam | Sem o equipamento, a informação não aparece na tela. |
| Erro custa dinheiro | Multas, avarias e demora saem do frete. |
| Progressão por peças | Oficina estilo Top Gear: cada peça muda a física ou a informação disponível. |

## Loop

Contrato de carga → chegada à barra → rádio (Capitania/VTS, prático, rebocadores) → fundeio ou entrada no canal → manobra → atracação → frete menos multas e custos → oficina e tripulação → contrato mais valioso e mais difícil.

## Tela

Estado atual da interface (v0.3.0):

| Área | Conteúdo |
|---|---|
| Vista, canto superior esquerdo | Norte e lista de passos da missão |
| Vista, canto superior direito | Girar, zoom, carta grande, ajuda; indicador de tempo acelerado |
| Vista, centro alto | Faixa com as ordens do prático (amarelo piscando até cumprir) |
| Vista, embaixo | As 6 últimas mensagens do rádio |
| Painel, de cima para baixo | Relógio e confiança; agulha, velocidades e vento; leme, telégrafo e tacômetro; ecobatímetro, doppler e impelidor; tela multifunção e abas (rádio, rebocadores, convés, equipamentos) |

O painel encolhe inteiro em janelas baixas, sem rolagem.

| Lado | Conteúdo |
|---|---|
| Esquerda | Mundo em isométrica pixelizada. Giro em passos de 90° e zoom. |
| Direita | Passadiço: instrumentos e comandos. |

A vista superior não é câmera do mundo: ela vive na carta (e depois no ECDIS e no radar, com os modos "norte para cima" e "proa para cima"). No protótipo há uma tecla de teste (T) só para comparar.

## Porto: Santos

Um porto só, aprofundado. A carta é uma aproximação estilizada (baía ao sul, barra entre a Ponta da Praia e o Guarujá, canal que guina para oeste); profundidades e bancos são do jogo, não de carta oficial.

| Fase | Trecho | Desafio novo | Estado |
|---|---|---|---|
| 1 | Fundeadouro externo | Fundear: aproar ao vento, parar, largar o ferro | No protótipo |
| 2 | Barra + primeiro trecho | Entrar alinhado, calado, limite de velocidade | No protótipo |
| 3 | Duas curvas a bombordo | Antecipar a guinada e quebrá-la a tempo, com corrente | No protótipo |
| 4 | Berço depois da segunda curva | Atracação por bombordo, sem rebocador | No protótipo |
| 5 | Terminal da Ilha, no fundo do canal | Terceira curva e atracação por boreste, em que a ré joga a popa para fora | No jogo desde a v0.13.0 |
| 5b | Giro na bacia de evolução | Passar do cais, girar na bacia (250 m de raio) e atracar aproado ao mar, por boreste, com a enchente pela proa | No jogo desde a v0.16.0 |
| 6 | Tráfego | Pedir a navio que saia/aguarde, cruzamento, a contrabordo | A fazer |

## Física do navio

Três graus de liberdade (avanço, deriva, guinada), passo fixo de 0,05 s, determinístico. Código em `src/sim/ship.ts`, testes em `src/sim/ship.test.ts`.

| Efeito | Como entra | Estado |
|---|---|---|
| Inércia | Massa = deslocamento; massa adicional lateral e em guinada | Feito |
| Ordens | A máquina leva 6 s e o timoneiro 2 s para começar a cumprir; a confiança da tripulação muda isso em ±30% | Feito |
| Máquina | A rotação sobe e desce devagar: de parado a meia força leva 47 s, e de meia para toda força mais 60 s (programa de carga); inverter exige parar o motor (15 s) | Feito |
| Ar de partida | Cada partida ou inversão gasta uma de 5 garrafadas de ar; os compressores repõem uma a cada 90 s; sem ar, a máquina não parte | Feito |
| Desgaste | Variação de rotação, partidas e curso do leme viram custo no fim da viagem | Feito |
| Leme | Gira a 1,8°/s (navio velho, uma bomba só); a força vem da água que passa por ele (seguimento + jato do hélice) | Feito |
| Toque de máquina | Parado, leme carregado + máquina adiante gira o navio quase sem avançar | Feito |
| Efeito do hélice | Em ré, a popa cai para bombordo (passo direito) | Feito |
| Vento | Força na obra morta, com rajadas | Feito |
| Corrente | Forças usam a velocidade na água; o odômetro não vê a corrente; muda e inverte com a maré | Feito |
| Maré | Soma água à profundidade da carta | Feito |
| Águas rasas | Mais resistência, curva mais larga, afundamento (squat) com a velocidade | Feito |
| Ferro | Amarra em quartéis; unha conforme o filame; garra se o esforço passa do limite | Feito (simples) |
| Defensas do cais | Mola e atrito; multa pela velocidade do toque | Feito |
| Efeito de margem | Sucção da popa para a margem e proa empurrada para fora; cresce com o quadrado da velocidade e com a pouca água; sondado a até 62 m de cada bordo | Feito |
| Interação entre navios | Sucção de través e momento que inverte da proa para a popa do outro navio | Feito |
| Rebocadores | Forças externas na proa e na popa, com atraso | Feito |
| Impelidor de proa | Força lateral na proa, com atraso e perda de rendimento com o seguimento | Feito |
| Carga e lastro | Calado e área vélica mudam com a carga (`makeCoaster(load)`) | Parâmetro existe, sem uso no jogo |

Números do costeiro de 90 m carregado, medidos nos testes:

| Medida | Valor |
|---|---|
| Velocidade a toda força / meia / devagar / muito devagar | 9,4 / 6,5 / 3,8 / 1,9 nós |
| Diâmetro tático (leme 35°) | 3,8 comprimentos |
| Diâmetro tático em água rasa (h = 1,25 T) | 5,1 comprimentos |
| Parada com toda força ré, vindo de toda força | 7,0 comprimentos, 4 min |
| De devagar (3,8 nós), parar com meia força ré | 250 m, 4 min |
| Do repouso a 3 nós em meia força | 136 s |
| Leme 10° em meia força: tempo até 63% da guinada | 59 s |
| Leme 20° até guinar 30° | 89 s |
| Depois de pôr o leme a meio, o navio ainda gira | 47° (é preciso quebrar a guinada com leme contrário) |
| Só parando a máquina, até 1 nó | 24 comprimentos, 26 min |
| Abatimento parado, vento de través de 20 nós | 0,8 nó |
| Margem a 15 m do costado, a 6 nós | 39 kN de sucção e 6°/min de guinada para fora |
| Impelidor de proa, navio parado | 34°/min; a 4 nós, quase nada |

## Marés

| Tópico | Regra |
|---|---|
| Ciclo | Semidiurno, 2× mais rápido que o real: 6 h 12 min de jogo |
| Altura | 0,1 m (baixa-mar) a 1,4 m (preamar) sobre o nível da carta; soma à profundidade em toda a água |
| Corrente | Vazante com o nível caindo (contra quem entra), enchente com o nível subindo (a favor), com metade da força |
| Condições no menu | Vazante (padrão), enchente, baixa-mar (vira para enchente em uns 16 min), preamar (corrente parada, começa a vazar) |
| Informação | Faixa no painel, VTS ao autorizar, imediato quando vira |
| Prático | Não atraca com corrente a favor: manda fundear e esperar a virada |
| A fazer | Faixa entre-marés que seca, tábua de maré para planejar, prático que gira o navio para aproar a corrente |

Estado do prático por maré, com comandante obediente (teste automático):

| Maré | Resultado |
|---|---|
| Vazante | Atraca limpo em 56 min (sênior) e 59 min (padrão) |
| Preamar | Atraca, mas em 84 min e com prejuízo: a manobra em corrente parada ainda é ruim |
| Enchente e baixa-mar | Leva o navio inteiro até perto do berço e recusa atracar |
| Qualquer maré, com os dois rebocadores | Atraca em cerca de 50 min, com resultado de uns R$ 9.000 (os rebocadores custam perto de R$ 7.500) |

## Plano de viagem

Nasceu do teste: sem plano, manobra antecipada vira tentativa e erro. Código em `src/game/plan.ts`.

| Parte | Regra |
|---|---|
| Pernas | Do ponto de partida ao berço, cortadas nas curvas do canal (de 4° ou mais) e nas mudanças de máquina |
| Por perna | Rumo, distância, máquina, velocidade no fundo (já com a corrente de agora) e tempo |
| Ponto de guinada | Simula-se o navio desta viagem fazendo a curva com o leme do plano (10°, 15° ou 20° conforme o ângulo); daí sai quantos metros antes do vértice começar e a quantos graus quebrar |
| Referência | Cada ponto é dito em relação à boia mais próxima: "com a boia 12 pelo través", "170 m antes da boia 17" |
| Parada | Simulada: distância para cair a 1 nó só parando a máquina, mais a distância com devagar ré |
| Rádio | Tabela com onde fazer cada chamado: VTS no ponto de chamada (1.200 m da barra), prático junto, navio do berço logo depois, rebocadores ao cruzar a barra, draga a 800 m |
| Linha de espera | A 300 m da barra; sem autorização do VTS não se passa dela |
| Sem GPS | O plano vale pelas boias; a proa avisa a de referência |
| Com GPS ou ECDIS | O quadro mostra metros e minutos até a próxima ação |

Números do costeiro carregado: a curva de 31° para o cais começa 250 m antes do vértice, com leme BB 15, quebrando aos 7°. O graneleiro começa uns 420 m antes.

A fazer: desenhar ou editar a derrota à mão na carta, escolher a velocidade do plano, plano que se recalcula quando a maré vira.

## Céu: dia, noite e nevoeiro

| Céu | O que muda | Frete |
|---|---|---|
| Dia claro | Nada | tabela |
| Noite | Só as luzes: boias piscando, luzes de navegação, cidade e cais | +15% |
| Nevoeiro | 300 m de visibilidade, limite de 6 nós, 10 min a mais de prazo | +30% |

O céu não muda a física, só o que se vê da ponte; por isso radar, ECDIS e GPS passam a valer o que custam. A fazer: sinais sonoros de nevoeiro, noite com nevoeiro, chuva.

## Som

Sintetizado em `src/audio/sound.ts`, que só observa o jogo.

| Som | Quando |
|---|---|
| Diesel | Sempre; tom e volume seguem a rotação real, não a ordem |
| Água e vento | Seguem a velocidade na água e o vento relativo |
| Sinos do telégrafo | Um na ordem, dois quando a máquina responde |
| Rádio | Estalo por mensagem; sons próprios para prático, aviso e erro |
| Alarme | Menos de 1,5 m sob o casco |
| Amarra, ferro, pancada, rebocador | Nos eventos |
| Apito | Tecla B; automático no nevoeiro a cada 2 min; cinco curtos do navio que sai |

A fazer: ajuste de ouvido, som ambiente do porto, música no porto.

## Confiança da tripulação

Uma medida só, de −100 a +100, que começa em 0 e persiste entre viagens. O comandante ganha e perde.

| Tópico | Regra |
|---|---|
| Perde | Pouca água sob o casco (−3), excesso de velocidade (−2), ordens de máquina demais (−3), ré de emergência (−4), ferro garrando (−3), ficar sem ar (−8), boia (−8), encostar duro (−6), pancada no cais (−18), ferro perdido (−20), encalhe ou colisão (−30), atraso (−5) |
| Ganha | Atracação macia (+8), entrada concluída (+15), fundeio concluído (+8), manobra sem nenhuma multa (+10) |
| Efeito nas ordens | Atraso da máquina, do timoneiro e tempo de amarração multiplicados por 0,7 (confiança +100) a 1,3 (−100) |
| Efeito nos avisos | Com confiança alta o imediato avisa pouca água mais cedo, avisa antes do limite de velocidade e a proa informa distâncias com mais frequência; com confiança baixa os avisos chegam em cima da hora ou não chegam |
| Tom do rádio | Acima de +40: "…, comandante."; abaixo de −40: respostas secas e hesitantes |
| Desembarque | Terminar uma viagem com −60 ou menos: o timoneiro vai embora (R$ 6.000) e a confiança volta para −30 |
| A fazer | Quando houver contratação: tripulantes bons e caros também desembarcam, e cada um tolera um nível diferente |

## Passadiço

| Instrumento | Para que serve | Disponível | Estado |
|---|---|---|---|
| Timão + indicador de ângulo do leme | Ordem ≠ ângulo real | Início | Feito |
| Telégrafo + tacômetro | Ordem ≠ rotação real | Início | Feito |
| Agulha | Rumo, com um pouco de atraso | Início | Feito |
| Odômetro | Velocidade na água, só avanço | Início | Feito |
| Ecobatímetro | Menor água sob o casco (proa, popa e bordos), traço e alarme | Início | Feito |
| Anemômetro | Vento relativo | Início | Feito |
| Carta de papel | Sem a posição do navio | Início | Feito |
| Molinete | Largar e virar o ferro, escolher quartéis | Início | Feito |
| Comunicações | Mensagens sobre a água, embaixo da tela do jogo; VHF com VTS e praticagem | Início | Feito |
| GPS | Velocidade e rumo no fundo; posição na carta | Upgrade | Feito (chave de teste) |
| Indicador de taxa de guinada | Antecipar o fim da curva | Upgrade | Feito (chave de teste) |
| Radar | Proa para cima, varredura com sombra de terra, boias e rebocadores, 0,25 a 2 milhas | Upgrade | Feito (chave de teste); falta AIS e alvos de tráfego |
| ECDIS | Navio em escala, norte ou proa para cima, contorno de segurança, previsão de 3 min, distância ao eixo e próxima curva | Upgrade | Feito (chave de teste) |
| Doppler de atracação | Velocidade lateral de proa e popa e avanço, no fundo | Upgrade | Feito (chave de teste) |
| Impelidor de proa | 35 kN na proa; perde rendimento com o seguimento e não rende acima de 4,5 nós | Upgrade | Feito (chave de teste) |

Sem doppler, quem informa a distância ao cais é a proa, pelo rádio ("Proa a 12 m, popa a 30 m do cais").

## Prático, rebocadores e rádio

| Item | Estado |
|---|---|
| VTS: pedir entrada antes da barra (resposta em 20 s; cruzar sem autorização custa R$ 8.000 e confiança) | Feito |
| Prático opcional, em dois níveis, que embarca depois de um tempo e só com o navio a até 7 nós | Feito |
| Ordens do prático no rádio e num quadro do painel, em vermelho enquanto não cumpridas | Feito |
| Amarração: basta a proa encostada (até 8 m) e a popa a até 35 m; os cabos trazem a popa | Feito |
| Rebocadores de proa e de popa, chamados e comandados pelo rádio | Feito |
| Pedir ao navio do berço que adiante a largada | Feito |
| Pedir passagem ao navio lento à frente | Feito |
| Navio que recusa ou cobra | A fazer |

| Prático | Custo | Embarque | Diferença |
|---|---|---|---|
| Padrão | R$ 2.500 | 5,5 min | Ordens corretas, prepara a pernada seguinte mais tarde |
| Sênior | R$ 5.500 | 3 min | Embarca antes e ordena mais cedo |

| Rebocadores | Regra |
|---|---|
| Chamada | Um na proa (Tupi) e um na popa (Guará); R$ 1.800 de saída cada, mais R$ 60/min com cabo passado |
| Chegada | 4 min; só operam da barra para dentro e só passam o cabo com o navio a até 5 nós; largam o cabo acima de 6,5 nós |
| Ordens | Empurrar (leva para bombordo, para o cais), puxar (para boreste), parar; o de popa também segura o seguimento. Potência de 10, 25, 50 ou 100% |
| Força | 120 kN cada (80 kN segurando); rendem menos com o navio andando e nada acima de 6 nós |
| Atraso | 4 s para cumprir, a força sobe aos poucos, e trocar entre empurrar e puxar leva 15 s de reposicionamento |
| Com prático a bordo | É ele quem dá as ordens aos rebocadores: o de popa segura o seguimento na chegada e os dois encostam o navio de lado |

Com um comandante que obedece na hora (teste automático), os dois atracam: o sênior em 56 min e o padrão em 59 min de jogo. A diferença entre eles ainda é pequena e precisa de calibragem.

Ideias ainda não feitas:

- O prático demora a embarcar; enquanto isso o jogador avança até o ponto de espera ou fundeia.
- O prático **só dá ordens** ("leme 10 a boreste", "devagar adiante") e o jogador executa. Prático melhor (mais caro) ordena mais cedo e com mais precisão.
- Rebocadores recebem ordens por rádio (empurrar/puxar, proa/popa, potência) e cobram por hora.
- VHF por menu: pedir entrada, pedir a um navio que aguarde ou saia, avisar intenção.

## Atracar a contrabordo

| Tópico | Regra |
|---|---|
| Alvo | O Serra Azul, de 150 m, fundeado; atraca-se no costado de boreste dele |
| Geometria | O costado funciona como um cais com defensas de 2,5 m, e acompanha o giro do navio na amarra |
| Como concluir | Proa a até 8 m e popa a até 35 m das defensas, no meio do navio (±30 m), quase parado; depois, espias |
| Toque | Medido em relação ao costado: até 0,3 nó, macio; 0,3 a 0,6, R$ 3.000; 0,6 a 1,2, R$ 15.000; acima, avaria grave nos dois |
| Abalroamento | Bater fora da zona das defensas ou esmagá-las: R$ 120.000 |
| Sem apoio | Não há VTS, prático nem rebocadores nessa manobra |
| A fazer | Atracar a contrabordo de um navio atracado no cais; rebocador na manobra; transbordo com o navio em movimento |

## Tráfego

| Tópico | Regra |
|---|---|
| Fundeados | Três navios de 120 a 150 m no fundeadouro; aproam a resultante de vento e corrente e giram devagar (até 3°/min) quando a maré vira |
| Folga para fundear | Cerca de 280 m do ferro de cada um; dentro do giro de outro o fundeio não é confirmado e a confiança cai |
| Berço ocupado | Um navio de 180 m começa atracado no berço do jogador. Larga aos 30 min, ou 6 min depois de um pedido pelo rádio; leva 4 min para abrir do cais |
| Navio saindo | Depois de largar, desce o canal a 6 nós (8 na baía) pelo lado dele e não desvia |
| Cruzamento | Bombordo com bombordo; quem entra fica a boreste do eixo |
| Abalroamento | Fim da viagem, R$ 120.000 |
| Passar raspando | Menos de 35 m de navio em movimento ou 25 m de fundeado: −6 de confiança e protesto pelo rádio |
| Como ver | Na vista; eco no radar; alvo AIS no ECDIS com vetor, distância e velocidade |
| Navio à frente | A draga Itaoca, de 70 m, sobe o canal a 2 nós pelo boreste. Pedindo passagem pelo rádio ela sai do canal dragado por 8 min e só volta com o caminho livre |
| Sucção entre cascos | De través os navios se puxam; pela proa do outro a nossa proa é jogada para fora, pela popa é puxada. 25 kN a 6 nós e 40 m |
| A fazer | Navio que recusa ou negocia o pedido, navio entrando atrás de você, contrabordo de navio atracado |

## Economia

| Item | Protótipo | Ideia completa |
|---|---|---|
| Frete | R$ 28.000 (entrada), R$ 3.500 (fundeio) | Contratos por carga, prazo e risco |
| Óleo | Proporcional ao cubo da rotação | Idem, por tipo de máquina |
| Desgaste da máquina | R$ 350 por variação completa de rotação + R$ 120 por partida | Peças melhores desgastam menos |
| Desgaste do leme | R$ 0,60 por grau de curso | Idem |
| Demora | R$ 300/min além de 75 min (entrada) ou 40 min (fundeio) | Janela de maré e de berço |
| Excesso de velocidade | R$ 40/s acima de 8 nós no canal | Limites por trecho |
| Boia abalroada | R$ 2.500 | Idem |
| Toque no cais | 0,3–0,6 nó: R$ 3.000; 0,6–1,2 nó: R$ 15.000; acima: fim de jogo | Avaria por zona do casco |
| Ferro perdido | R$ 25.000 (largar acima de 3 nós) | Idem |
| Encalhe / margem | R$ 45.000 / R$ 60.000, fim de jogo | Salvamento, vistoria, tempo parado |
| Praticagem | R$ 2.500 ou R$ 5.500 | Por porte do navio |
| Rebocadores | R$ 1.800 de saída + R$ 60/min com cabo, cada | Por hora e por potência |

## Progressão

Catálogo em `src/game/career.ts`. Há carreira com caixa, contratos, oficina e tripulação, e um modo livre sem dinheiro.

Princípio (decidido no teste da v0.17.1): **o começo tem de ser o mais fácil**. Neste jogo equipamento é informação e controle, então começar sem nada deixava o primeiro navio mais difícil que o último. Desde a v0.18.0 o navio de partida já vem com GPS, indicador de guinada e doppler; a dificuldade vem do contrato e do navio. O navio sem instrumentos virou o desafio "à moda antiga": contrato de cinco estrelas, +40% de frete.

| Contrato | Estrelas | Carga e calado | Maré | Frete | Prazo |
|---|---|---|---|---|---|
| Aguardar berço (fundeio) | 1 | Lastro, 3,8 m | Vazante | R$ 3.500 | 40 min |
| Fertilizante, meia carga | 2 | 1.600 t, 4,5 m | Vazante | R$ 16.000 | 75 min |
| Fertilizante, carga completa | 3 | 2.900 t, 5,2 m | Vazante | R$ 28.000 | 75 min |
| Açúcar na preamar | 4 | 2.900 t, 5,2 m | Preamar | R$ 34.000 | 80 min |
| Trigo na baixa-mar | 5 | 2.900 t, 5,2 m | Baixa-mar | R$ 40.000 | 90 min |
| Carga urgente na enchente | 5 | 2.900 t, 5,2 m | Enchente | R$ 48.000 | 70 min |

| Peça | Níveis e preço | Efeito |
|---|---|---|
| Máquina principal | R$ 12.000, depois R$ 35.000 | Sobe de rotação 40% e 80% mais rápido; inverte em 11 s e 8 s; +25% de empuxo no último |
| Máquina do leme | R$ 8.000, depois R$ 22.000 | Leme a 2,6°/s e 3,0°/s; +35% de força no último |
| Ar de partida | R$ 5.000 | 8 partidas, repõe a cada 55 s |
| Impelidor de proa | R$ 30.000, depois R$ 25.000 | 35 kN e 60 kN |
| GPS, guinada, doppler, radar, ECDIS | R$ 4.000, 3.000, 9.000, 15.000, 20.000 | Ligam o instrumento |

| Tripulante | Níveis: contratação e soldada por viagem | Efeito |
|---|---|---|
| Timoneiro | R$ 6.000 e R$ 800; R$ 15.000 e R$ 1.500 | Cumpre o leme em 1,2 s e 0,6 s (de fábrica, 2 s) |
| Chefe de máquinas | R$ 7.000 e R$ 900; R$ 18.000 e R$ 1.800 | Atende o telégrafo em 4 s e 2,5 s (de fábrica, 6 s); 30% e 60% menos desgaste |
| Imediato | R$ 6.000 e R$ 800; R$ 14.000 e R$ 1.400 | Avisa pouca água com 2,5 m e 3,5 m; no último, amarra na metade do tempo |

| Navio | Medidas | Massa carregado | Calado | Preço | Reputação | Frete |
|---|---|---|---|---|---|---|
| Costeiro | 90 × 14 m | 4.800 t | 3,6 a 5,2 m | de partida | 0 | tabela |
| Graneleiro | 130 × 20 m | 15.000 t | 4,6 a 7,4 m | R$ 150.000 | 25 | 2,6× |

| Reputação | Regra |
|---|---|
| Ganho | 3 por estrela do contrato entregue, +2 se não houve multa |
| Perda | 6 por viagem fracassada |
| Efeito | Libera contratos: até 2 estrelas no começo, mais uma a cada 10 pontos; libera o graneleiro com 25 |
| Ofertas | Mudam a cada viagem: carga e frete de −10% a +15% |

A fazer: um terceiro navio, tripulantes com nome e tolerância própria, manutenção, contratos com prazo de validade.

Ideias originais:

| Eixo | Exemplos |
|---|---|
| Oficina | Máquina (resposta e potência), leme (área e velocidade), hélice, thruster, ferros, instrumentos |
| Tripulação | Timoneiro (precisão do leme), chefe de máquinas (resposta), imediato (avisos mais cedo), marinheiros (tempo de amarração) |
| Navios | Costeiro → graneleiro → porta-contêineres: mais frete, mais massa, mais calado, mais equipamento |
