# Pendências

Fonte da verdade do projeto. Design em [docs/GDD.md](docs/GDD.md).

## Decisões em aberto

| # | Pendência | Sugestão | Situação |
|---|---|---|---|
| 1 | Porto | Santos | Usado no protótipo; falta confirmar |
| 2 | Nome do jogo | "Barra Adentro" | Provisório |
| 3 | Onde mora o projeto | `~/WebstormProjects/barra-adentro` | Decidido; ainda sem controle de versão (git) |
| 4 | Idioma | Português, termos náuticos reais | Usado no protótipo; falta confirmar |
| 5 | Controles | Teclado + mouse; toque depois | Usado no protótipo; falta confirmar |
| 6 | Câmera | Isométrica com giro de 90°; superior só na carta | Decidido; tecla T existe para comparar jogando |
| 7 | Equipamento inicial | Tudo desligado: GPS, guinada, radar, ECDIS, doppler, impelidor | Chaves de teste na aba Equip.; decidir depois de jogar |
| 8 | Quanto custa mexer demais | 5 partidas de ar, R$ 350 por variação de rotação, R$ 0,60 por grau de leme | Implementado; calibrar jogando |
| 10 | Peso do navio | Máquina 6 s + 47 s até meia força; leme 2 s + 1,8°/s | Segunda rodada de lentidão aplicada; confirmar se ainda parece arcade e em quê |
| 11 | Valores da confiança | Tabela no GDD | Implementado; calibrar jogando |
| 9 | Canal mais estreito ou corrente mais forte | Só se as curvas ainda parecerem fáceis | Em aberto |

## A fazer

| # | Item | Observação |
|---|---|---|
| 1 | Jogar de novo e ajustar | Atrasos de ordem, ar de partida, desgaste e o berço depois das curvas são novos; valores são um primeiro chute |
| 4 | Mais rádio | Pedir a navio que aguarde ou saia; hoje há VTS e praticagem |
| 12 | Diferenciar melhor os dois práticos | Hoje o sênior só embarca antes e antecipa um pouco mais |
| 13 | Prático no cenário de fundeio | Hoje só orienta a entrada |
| 14 | Prático comandar os rebocadores | Hoje quem ordena é o comandante |
| 15 | Calibrar rebocadores jogando | Empurrar a 25% por 45 s já encosta a 0,3 nó; ver se as potências fazem sentido |
| 5 | Tráfego e interação entre navios | Inclui atracar a contrabordo |
| 6 | Efeito de margem | |
| 7 | Resto do canal de Santos | O mapa já tem as curvas; faltam berços e missões |
| 8 | Oficina, tripulação e contratos | Parâmetros do navio já estão isolados em `makeCoaster` |
| 9 | AIS e alvos de tráfego no radar | Depende do tráfego |
| 10 | Maré (enchente/vazante) e noite/nevoeiro | A corrente já aceita o sentido da maré |
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
