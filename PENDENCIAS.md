# Pendências

Fonte da verdade do projeto. Design em [docs/GDD.md](docs/GDD.md).

## Decisões em aberto

| # | Pendência | Sugestão | Situação |
|---|---|---|---|
| 1 | Porto | Santos | Usado no protótipo; falta confirmar |
| 2 | Nome do jogo | "Barra Adentro" | Provisório |
| 3 | Onde mora o projeto | `~/WebstormProjects/barra-adentro` | Decidido; git com remoto no GitHub, uma tag e uma release por entrega |
| 4 | Idioma | Português, termos náuticos reais | Usado no protótipo; falta confirmar |
| 5 | Controles | Teclado + mouse; toque depois | Usado no protótipo; falta confirmar |
| 6 | Câmera | Isométrica com giro de 90°; superior só na carta | Decidido; tecla T existe para comparar jogando |
| 7 | Equipamento inicial | Tudo desligado: GPS, guinada, radar, ECDIS, doppler, impelidor | Chaves de teste na aba Equip.; decidir depois de jogar |
| 8 | Quanto custa mexer demais | 5 partidas de ar, R$ 350 por variação de rotação, R$ 0,60 por grau de leme | Implementado; calibrar jogando |
| 10 | Peso do navio | Máquina 6 s + 47 s até meia força; leme 2 s + 1,8°/s | Segunda rodada de lentidão aplicada; confirmar se ainda parece arcade e em quê |
| 11 | Valores da confiança | Tabela no GDD | Implementado; calibrar jogando |
| 9 | Canal mais estreito ou corrente mais forte | Só se as curvas ainda parecerem fáceis | Em aberto |
| 12 | Validar a interface jogando | Passada feita na v0.3.0; falta a sua revisão: o que está pequeno, escondido ou confuso | Em aberto |
| 13 | Onde publicar as releases | github.com/marcelobritonet/barra-adentro (público) | Decidido; v0.1.0 a v0.5.0 publicadas |
| 14 | Publicar o jogo em produção | GitHub Pages a partir do build, a cada release | Em aberto |

## A fazer

| # | Item | Observação |
|---|---|---|
| 1 | Jogar de novo e ajustar | Atrasos de ordem, ar de partida, desgaste e o berço depois das curvas são novos; valores são um primeiro chute |
| 4 | Mais rádio | Pedir a um navio que aguarde, navio que recusa ou negocia; hoje há VTS, praticagem e pedir a largada |
| 12 | Diferenciar melhor os dois práticos | Hoje o sênior só embarca antes e antecipa um pouco mais |
| 13 | Prático no cenário de fundeio | Hoje só orienta a entrada |
| 14 | Prático comandar os rebocadores | Hoje quem ordena é o comandante |
| 15 | Calibrar rebocadores jogando | Empurrar a 25% por 45 s já encosta a 0,3 nó; ver se as potências fazem sentido |
| 5 | Mais tráfego | Atracar a contrabordo, sucção entre navios, mais de um navio em movimento |
| 7 | Resto do canal de Santos | O mapa já tem as curvas; faltam berços e missões |
| 8 | Oficina, tripulação e contratos | Parâmetros do navio já estão isolados em `makeCoaster` |
| 10 | Noite e nevoeiro | O radar já existe para isso |
| 16 | Prático na corrente parada e a favor | Na preamar ele atraca mal (84 min, prejuízo); na enchente recusa. Falta girar o navio para aproar a corrente ou comandar rebocadores |
| 17 | Prazo da viagem conforme a maré | Hoje é fixo em 75 min; esperar a virada estoura o prazo |
| 11 | Som | |

## Feito

| Item |
|---|
| Física do navio com 12 testes |
| Recorte estilizado de Santos: baía, bancos, barra, canal, cais, fundeadouro, balizamento |
| Vista isométrica pixelizada com giro e zoom |
| Painel do passadiço com 8 instrumentos |
| Cenários de fundeio e de entrada com atracação, com frete, custos e multas |
| Atraso de ordens, ar de partida, programa de carga e desgaste |
| Berço movido para depois das duas curvas do canal |
| Confiança da tripulação (−100 a +100), com efeito nas ordens, nos avisos e desembarque |
| Ecobatímetro e avisos passam a usar a menor água sob o casco |
| VTS e prático (dois níveis) que só dá ordens; testes automáticos com comandante obediente |
| Amarração com a popa trazida pelos cabos |
| Mensagens sobre a água, embaixo da tela do jogo |
| Rebocadores de proa e popa por rádio, com 6 testes |
| v0.2.0: impelidor de proa, doppler, radar, ECDIS, tela multifunção e painel sem rolagem |
| v0.3.0: passos da missão, botões de câmera, ajuda, alertas nas abas, predefinições de equipamento |
| v0.4.0: efeito de margem; prático refaz aproximação ruim |
| v0.5.0: marés (altura, corrente que inverte, 4 condições), prático recusa atracar com corrente a favor |
| v0.6.0: tráfego (fundeados, navio saindo, abalroamento, radar e AIS); correções do teclado e do molinete |
| v0.7.0: berço ocupado, pedido de largada pelo rádio, prático regula a chegada; porta estável para testar |
