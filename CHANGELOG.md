# Registro de versões

Cada entrega vira uma tag `vX.Y.Z` com as notas abaixo.

## v0.8.0 — Prático comanda os rebocadores

- Com os dois rebocadores de cabo passado, é o prático que fala com eles, como na vida real: você continua executando só leme e máquina.
- Na aproximação, o rebocador de popa segura o seguimento. Junto ao berço o prático para o navio paralelo a 20 m do cais e cada rebocador fecha a sua ponta devagar, quase parado ao tocar.
- Com rebocadores o prático atraca nas quatro marés, inclusive com corrente a favor, em cerca de 50 min de jogo. Sem eles continua recusando a enchente.
- Se ele já tinha recusado e os rebocadores passam o cabo, ele retoma a manobra.
- 4 testes novos: viagem completa com prático e rebocadores em vazante, preamar, enchente e baixa-mar.

## v0.7.0 — Berço ocupado e rádio entre navios

- O navio de 180 m agora começa atracado no seu berço. Sem ninguém pedir, larga aos 30 min; ele leva 4 min para abrir do cais e então sai pelo canal.
- Novo no rádio: chamar o navio e pedir que adiante a largada. Ele larga 6 min depois do pedido. A hora em que você pede decide onde será o cruzamento.
- O VTS informa o berço ocupado e a previsão de largada ao autorizar a entrada. Não dá para passar espias com o berço ocupado.
- A lista de passos ganhou "berço livre", e a aba Rádio pisca enquanto o pedido não foi feito.
- O prático regula a velocidade para chegar à reta do canal quando o berço estiver livre, em vez de correr e ficar parado; só abre para o berço depois que o navio que saiu passar. Com corrente a favor, manda fundear.
- No cenário de fundeio o navio não sai: é por isso que você fundeia.
- `scripts-estavel.sh` gera uma versão fechada a partir de uma tag, para testar numa porta que não recarrega durante o desenvolvimento.

## v0.6.0 — Tráfego

- Três navios fundeados no fundeadouro, que giram com o vento e a corrente. Para fundear é preciso achar um lugar com cerca de 280 m de folga do ferro de cada um; fundear dentro do giro de outro não é aceito.
- Um navio de 180 m sai pelo canal a 6 nós pouco depois do início e cruza com quem entra perto da primeira curva. Ele mantém o lado dele e não desvia: o cruzamento é bombordo com bombordo.
- Abalroamento encerra a viagem (R$ 120.000). Passar a menos de 35 m de um navio em movimento, ou 25 m de um fundeado, custa confiança e rende um protesto pelo rádio.
- O VTS avisa a saída do navio, o imediato informa marcação e distância, e o navio reclama se você estiver do lado errado do canal.
- Os navios aparecem na vista, dão eco no radar e são alvos AIS no ECDIS, com casco em escala, vetor de 3 minutos, distância e velocidade.
- O prático vai para o boreste do canal quando há navio saindo.
- Correção: depois de usar uma lista (quartéis, potência do rebocador) o teclado parava de comandar o navio.
- Correção: virar o ferro parecia não funcionar. O molinete ficou mais rápido (4 quartéis em 3 min), a proa canta cada quartel e o painel mostra o tempo que falta.

## v0.5.0 — Marés

- Maré semidiurna que corre 2× mais rápido que a real (um ciclo em 6 h 12 min de jogo): numa viagem de 1 h a altura e a corrente mudam de verdade.
- A altura da maré (0,1 a 1,4 m) soma água à profundidade da carta: na baixa-mar os bancos ficam mais perigosos.
- A corrente acompanha a maré e inverte: vazante contra quem entra, enchente a favor (com metade da força). O navio fundeado gira quando ela vira.
- Quatro condições no menu: vazante, enchente, baixa-mar e preamar.
- Faixa de maré no painel: altura, tendência, corrente no canal e tempo até virar. O VTS informa a maré ao autorizar e o imediato avisa quando ela vira.
- Com corrente a favor no berço o prático recusa atracar: manda tirar o seguimento, fundear e aguardar a virada, e retoma quando a corrente vier pela proa.
- O prático passou a controlar a velocidade no fundo e nunca aponta de frente para o cais.
- 4 testes de maré e 3 novos de prático.

## v0.4.0 — Efeito de margem

- Perto de uma margem, banco ou cais, a popa é sugada para ela e a proa é empurrada para fora. O efeito cresce com o quadrado da velocidade na água e com a pouca profundidade, e some com o navio parado ou no meio do canal.
- O navio sonda a margem a 8, 20, 38 e 62 m de cada bordo, na proa e na popa; água com menos de duas vezes o calado já conta como margem.
- O imediato avisa quando a sucção passa de 12 kN e lembra o remédio: leme para o lado da margem.
- O prático mantém distância da margem rasa até a bacia do berço, usa toques de máquina para governar, chega mais devagar e, se a aproximação sair ruim, sai a ré e entra de novo.
- 2 testes novos de física; as viagens com prático continuam atracando sem multas.

## v0.3.0 — Interface

- Lista de passos da missão no canto da vista, com o passo atual em destaque e os concluídos marcados.
- Botões de câmera (girar, zoom, carta) e ajuda (tecla H) com comandos e lembretes de manobra.
- Abas de operação piscam quando pedem atenção: rádio (VTS pendente ou ordem do prático não cumprida), rebocadores (sem cabo), convés (ferro garrando ou proa encostada).
- Aba Convés mostra a distância ao berço e o que falta para passar as espias.
- Indicador de tempo acelerado e de pausa sobre a vista.
- Menu com predefinições de equipamento ("navio básico" e "tudo ligado"); a escolha fica guardada entre partidas.
- Conferido em 1440×900 e 1280×720, sem rolagem.

## v0.2.0 — Instrumentos

- Impelidor de proa: 35 kN, sobe aos poucos e perde rendimento com o seguimento (nada acima de 4,5 nós). Teclas J, K, L.
- Doppler de atracação: velocidade lateral da proa e da popa e avanço, no fundo.
- Radar de proa para cima, com varredura, sombra de terra, boias e rebocadores; alcances de 0,25 a 2 milhas.
- ECDIS: navio em escala, norte ou proa para cima, contorno de segurança, previsão de 3 minutos, distância ao eixo do canal e aviso da próxima curva.
- Tela multifunção (carta, ECDIS, radar) e abas de operação (rádio, rebocadores, convés, equipamentos).
- O painel inteiro cabe na tela e encolhe em janelas baixas, sem rolagem.
- Ordens do prático em faixa sobre a vista do jogo.
- Todos os equipamentos novos são chaves de teste na aba Equip.; nascem desligados.

## v0.1.0 — Protótipo jogável

- Física do navio em 3 graus de liberdade: inércia, atraso de máquina e leme, efeito do hélice, vento, corrente, águas rasas e afundamento.
- Recorte estilizado de Santos: baía, bancos, barra, canal com duas curvas, cais, fundeadouro e balizamento.
- Vista isométrica pixelizada com giro de 90° e zoom.
- Passadiço: agulha, odômetro, anemômetro, leme, telégrafo, tacômetro, ar de partida, ecobatímetro, carta e molinete.
- Cenários de fundeio e de entrada com atracação, com frete, custos, multas e desgaste.
- Confiança da tripulação, de −100 a +100, com efeito nas ordens e nos avisos.
- Rádio: autorização do VTS, prático em dois níveis que só dá ordens, rebocadores de proa e de popa.
