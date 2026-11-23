# Registro de versões

Cada entrega vira uma tag `vX.Y.Z` com as notas abaixo.

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
