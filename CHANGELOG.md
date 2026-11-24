# Registro de versões

Cada entrega vira uma tag `vX.Y.Z` com as notas abaixo.

## v0.22.0 — Vento e corrente que se percebem

Pergunta do teste: "ainda não consigo perceber a influência do vento e da corrente. Ela acontece?"

Acontece, mas a viagem padrão escondia: o sueste de 7 nós entra pela popa e a vazante vem pela proa, os dois alinhados com a derrota. Medido no costeiro carregado: na baía a corrente de través tira o navio 79 a 88 m do rumo a cada 800 m; no canal ela só reduz a velocidade no fundo de 3,8 para 2,9 nós; parado a 60 m do cais, o vento abre a popa 34 m e gira o navio 16 a 20° em 5 minutos.

- Vento por contrato: sueste 7 nós (padrão), leste 18, nordeste 16, sudoeste 22 e calmaria. Contratos de 2 estrelas ou mais podem vir com vento de través e pagam mais por isso. No modo livre há um seletor de vento.
- Com vento acima de 20 nós a praticagem suspende o serviço; a barra segue aberta e a manobra é sua.
- O GPS mostra o abatimento: "abatendo N° para BE/BB".
- O plano de viagem ganhou a coluna "Governar": o rumo a levar na agulha para fazer o rumo da pernada, já com corrente e vento. Com leste de 18 nós no primeiro trecho do canal: governar 006 para fazer 003.
- Carneirinhos na água, que correm com o vento e aumentam com a força dele.
- Limite conhecido: o abatimento por vento no canal é pequeno com o navio carregado (2 a 3°, cerca de 7 m em 700 m segurando o rumo). Quem sofre mais é navio leve e navio devagar.

## v0.21.1 — Modo livre também começa equipado

Pergunta do teste: "começar o jogo do zero ainda está com o navio sem nenhum equipamento?"

- Na carreira não: desde a v0.18.0 o navio sai com GPS, indicador de guinada e doppler.
- No modo livre, sim, e era um defeito: ele continuava com o padrão antigo, sem nada ligado. Agora começa "de série", igual à carreira.
- Segundo defeito corrigido: o modo livre herdava os equipamentos da última viagem da carreira, porque os dois gravavam no mesmo lugar. Agora o modo livre guarda a própria escolha.
- Três predefinições no modo livre: De série, Tudo ligado e À moda antiga. Ligar um equipamento na aba Equip. passa a valer para as viagens livres seguintes.

## v0.21.0 — Os cabos acertam a posição; painel de atracação

Retorno do teste da v0.20.0: "ainda é difícil manter o navio no ponto sem ficar indo para a frente e para trás; é muito sensível" e "na atracação os equipamentos perdem o sentido; tem que ficar só rebocador e convés".

- Ao longo do cais, quem acerta a posição são os cabos, não a máquina. As espias passam com o navio até 100 m fora do ponto (antes 60); os espringues correm o navio ao longo do cais até o lugar, a uns 0,5 nó, e ele só é dado como atracado a menos de 20 m do ponto. No teste, 80 m em 6 minutos de jogo, com a máquina parada.
- Tela de atracação: junto ao berço, no lugar da carta entra uma tela com o navio e o cais vistos de cima. Mostra quantos metros faltam ao longo do cais, a distância da proa e da popa às defensas, o seguimento avante ou a ré contra o que o plano pede e, com doppler, quanto cada ponta fecha ou abre. O navio fica verde quando já dá para passar as espias.
- O painel muda sozinho: ao chegar ao berço, as abas viram "Cais", com só espias e rebocadores, sem textos de explicação. Ao se afastar, volta ao que estava. As outras abas continuam ao alcance.
- Vale também para a manobra a contrabordo.
- 2 testes novos.

## v0.20.0 — Atracação que perdoa

Retorno do teste: "atracar ainda é um problema: muito difícil controlar o vai e vem do navio próximo ao cais, e precisa ser muito preciso" e "os rebocadores só puxam e empurram; não seguram para não ir para vante e para ré".

- Defensas que absorvem a pancada. Antes eram mola pura: o navio encostava e era devolvido até 17 m. Agora devolvem só uma fração; depois de um toque macio o navio afasta no máximo 3 m.
- Amarração mais tolerante, como na prática: a primeira espia passa com a proa a até 15 m das defensas (antes 8), a popa a até 45 m (antes 35), posição ao longo do cais de ±60 m (antes ±40) e até 0,8 nó de seguimento (antes 0,5). Os cabos nos guinchos puxam com mais força e seguram o navio ao longo do cais.
- Toque menos punitivo: macio até 0,4 nó (antes 0,3), duro até 0,9, pancada até 1,6; acima disso, avaria grave.
- Plano de atracação: a velocidade no fundo para cada distância do berço (2 nós a 400 m, 1,5 a 250 m, 1 a 120 m, 0,5 a 50 m). O quadro do plano mostra o pedido e a sua velocidade, e avisa "pode passar as espias" quando dá.
- O imediato cobra quando você está rápido para a distância, e a proa avisa quando o navio está fechando de lado rápido demais.
- Rebocadores no sentido do comprimento: os dois agora rebocam para vante, para ré e seguram o navio no lugar. Com os dois segurando, uma corrente que levaria o navio 95 m em 4 minutos leva 8 m.
- 8 testes novos; todas as viagens com prático continuam atracando.

## v0.19.0 — O que a janela mostra

Observação do teste: "só trabalhamos os equipamentos e o navio é só para ver". Em vez de pôr o ECDIS sobre o navio, a vista passou a dar informação própria, do jeito que se lê num navio de verdade.

- Faróis de alinhamento: uma torre listrada em terra no fim de cada reta do canal. A lanterna é de setores: branca com o navio no eixo, encarnada se ele abriu para boreste (o lado das boias encarnadas), verde se abriu para bombordo. Só o farol da reta em que você está fica aceso.
- Boias que mostram a corrente: deitam para onde ela corre e deixam um rastro a jusante; quanto mais forte, mais deitadas e mais longo o rastro. Mudam quando a maré vira.
- Fumaça da chaminé: vai com o vento verdadeiro, e sai mais preta quando a máquina está ganhando rotação, o que deixa visível o atraso entre a ordem e a resposta.
- Esteira mais longa e mais fina: mostra o caminho que a popa fez, curva na guinada e torta quando o navio deriva.
- Marola de proa que cresce com a velocidade na água.
- A ajuda (tecla H) ganhou a seção "O que a janela mostra".
- 4 testes novos dos faróis.

## v0.18.0 — Progressão do lado certo e publicação

Retorno do teste: "navio sem nada é praticamente impossível; em vez de navio iniciante tem cara de avançado".

- O navio de partida já vem com GPS, indicador de guinada e doppler. A dificuldade passa a vir do contrato (maré, noite, nevoeiro, berço, giro) e do navio; o dinheiro compra navios maiores, máquina melhor, radar, ECDIS e impelidor.
- Carreiras já começadas ganham esses três instrumentos ao carregar.
- "À moda antiga": o navio sem instrumentos virou desafio de fim de jogo. Alguns contratos de quatro estrelas ou mais aparecem com os instrumentos eletrônicos apagados (pane no quadro de 24 volts), valem cinco estrelas e pagam 40% a mais. Restam agulha, odômetro, ecobatímetro e o plano de bordo.
- No modo livre, a predefinição sem equipamentos passou a se chamar "À moda antiga".
- O jogo passa a ser publicado no GitHub Pages a cada versão, por um fluxo que roda os testes antes de publicar.

## v0.17.1 — Onde fazer cada chamado de rádio

Pedido em teste: "tem que dizer em que momento devo pedir autorização de entrada; hoje a posição está vaga".

- Ponto de chamada: a 1.200 m da barra, é onde se pede a entrada ao VTS. Linha de espera: a 300 m da barra, de onde não se passa sem a autorização. As duas aparecem na carta e no ECDIS, atravessadas no canal.
- O plano de bordo ganhou a tabela "Rádio: onde chamar", com o lugar de cada chamado (amarrado a uma boia), o quê pedir e por quê ali: VTS, prático, navio do berço, rebocadores e draga. Os tempos são calculados para o seu navio: em quantos minutos você chega à linha de espera e ao berço.
- O imediato avisa ao chegar ao ponto de chamada sem autorização, dizendo quantos metros faltam para a linha de espera.
- O quadro do plano mostra o chamado pendente, com destaque quando é hora de fazê-lo.
- 1 teste novo.

## v0.17.0 — Plano de viagem e vista que se arrasta

Pedido em teste: "está difícil fazer as coisas no olho; fica tudo tentativa e erro".

- Plano de bordo antes de zarpar: uma tabela por perna com rumo a governar, distância, máquina, velocidade prevista no fundo e tempo, e a derrota desenhada na carta. O tempo só começa a correr quando você zarpa.
- Ponto de guinada calculado para cada curva: onde começar (amarrado a uma boia que se enxerga), quanto leme, e a quantos graus do rumo novo quebrar com leme contrário. Sai de simular o seu navio, com a carga, a máquina e o leme que ele tem; por isso muda com o graneleiro e com as peças da oficina.
- Parada calculada do mesmo jeito: a que distância do berço parar a máquina e quando dar ré.
- Durante a manobra, um quadro mostra a perna atual, o rumo e a máquina do plano e a próxima ação. Na guinada ele mostra o rumo em que quebrar. Com GPS ou ECDIS, mostra quantos metros e minutos faltam.
- A proa canta a boia de referência de cada guinada quando ela passa pelo través.
- A derrota e os pontos de guinada aparecem na carta e no ECDIS.
- Há plano também para fundeio, contrabordo, Terminal da Ilha e giro na bacia.
- Arrastar a vista com o mouse para olhar adiante; o botão Centrar, a tecla V ou um duplo clique voltam ao navio.
- Tecla O e botão Plano reabrem o plano durante a viagem.
- 4 testes novos, incluindo um que segue o plano à risca e confere que o navio termina sobre o rumo novo, a menos de 30 m do eixo.

## v0.16.0 — Giro na bacia de evolução

- Nova manobra: atracar aproado ao mar. Você entra com a enchente a favor, passa do Cais de Santos, para na bacia de evolução, gira o navio e volta para atracar por boreste, de proa para a corrente.
- Bacia de evolução: um círculo de 250 m de raio, dragado a 12 m, logo depois do cais; aparece na vista, na carta e no ECDIS.
- Novo contrato de quatro estrelas, "Girar e atracar aproado ao mar" (R$ 42.000, com enchente). No modo livre é uma opção do Cais de Santos.
- Com os dois rebocadores, o prático conduz tudo: para na bacia, gira com o de proa empurrando e o de popa puxando, e leva ao cais. Sem rebocadores ele avisa que não gira o navio, devolve a manobra ao comandante e retoma quando a proa estiver para o mar.
- A draga não entra na bacia enquanto há um navio girando nela.
- 2 testes novos.

## v0.15.0 — Navio à frente e sucção entre cascos

- Sucção entre navios: ao passar perto de outro casco, os dois se puxam quando estão de través; com o outro pela proa a sua proa é jogada para fora, e com ele pela popa, puxada para dentro. Cresce com o quadrado da velocidade e some com distância. A 6 nós e 40 m, são 25 kN.
- O imediato avisa quando a sucção passa de 10 kN.
- Navio à frente: a draga Itaoca sobe o canal a 2 nós pelo lado de boreste. Você pode seguir atrás, ultrapassar pelo bombordo dela (o lado de quem sai) ou pedir passagem pelo rádio.
- Pedindo passagem, ela sai do canal dragado para a margem e fica quase parada por 8 minutos, e só volta quando você já se afastou.
- Com prático a bordo é ele quem pede a passagem; enquanto a draga não abre, ele segue atrás com dois minutos de folga.
- 2 testes novos, e as viagens com prático seguem atracando com a draga e o navio que sai no caminho.

## v0.14.0 — Atracar a contrabordo

- Terceiro tipo de manobra: atracar no costado de um navio fundeado (o Serra Azul), para um transbordo. Não há cais, VTS, prático nem rebocador.
- O "cais" é o costado de boreste dele, com defensas, e acompanha o giro do navio na amarra. Você começa pela popa dele, chega paralelo e quase parado, encosta a proa e passa as espias (M).
- O que vale é a velocidade em relação ao costado: encostar a mais de 0,3 nó custa caro, e esmagar as defensas ou bater fora delas é abalroamento.
- Novo contrato de duas estrelas, "Transbordo a contrabordo", e um terceiro cenário no modo livre.
- Os navios fundeados passaram a girar bem mais devagar (no máximo 3 graus por minuto), como navios de verdade na amarra.
- 4 testes novos. A tela desta manobra não foi conferida no navegador nesta entrega.

## v0.13.0 — Terminal da Ilha: o fundo do canal

- Segundo berço: o Terminal da Ilha, de granéis líquidos, na margem norte, 1 km além do Cais de Santos e depois de uma terceira curva.
- A atracação é por boreste. Com hélice de passo direito, dar máquina a ré joga a popa para bombordo, para longe do cais: o truque que ajuda no Cais de Santos aqui atrapalha.
- Novo contrato de quatro estrelas para o terminal, com cargas líquidas (etanol, óleo vegetal, suco de laranja, gasolina). No modo livre o berço é escolhido no menu.
- O navio que ocupa o berço, os rebocadores e o prático acompanham o berço de destino. Os rebocadores trabalham no bordo oposto ao cais, e o prático faz a aproximação espelhada.
- Todos os cais aparecem na vista, na carta e no ECDIS; o de destino fica em amarelo.
- O mundo passou a aceitar vários berços (`QUAYS` em `src/world/santos.ts`), o que abre caminho para os próximos.

## v0.12.0 — Som

- Todo o som é sintetizado no navegador, sem arquivos de áudio.
- Contínuos: diesel que sobe de tom e volume com a rotação, água no casco com o seguimento, vento com o vento relativo, amarra correndo ao largar e ao virar.
- Sinos do telégrafo: um toque na ordem e dois quando a máquina responde, o que deixa o atraso audível.
- Rádio: estalo a cada mensagem, com som próprio para ordem do prático, aviso e erro grave.
- Alarme do ecobatímetro, pancada no cais, ferro na água, rebocador ao passar o cabo, fim de viagem.
- Apito do navio na tecla B. No nevoeiro, um apito longo a cada 2 minutos, o seu e o do navio que vem, mais fraco com a distância. O navio que sai dá cinco apitos curtos se você estiver no lado dele.
- Liga e desliga na tecla N ou no botão Som; a escolha fica guardada.
- Não foi ouvido por uma pessoa: os volumes e timbres saíram de cálculo e precisam de ajuste de ouvido.

## v0.11.0 — Noite e nevoeiro

- Noite: a vista escurece e só se veem as luzes. As boias piscam na cor delas, os navios e rebocadores mostram luzes de navegação (mastro, bordos encarnado e verde, alcançado), a cidade e o cais se acendem.
- Nevoeiro: visibilidade de 300 m em volta do navio e limite de 6 nós no canal. Sem radar é quase às cegas.
- Contratos de três estrelas ou mais podem cair à noite (+15% de frete) e os de quatro ou mais, com nevoeiro (+30% e 10 min a mais de prazo). No modo livre o céu é escolhido no menu.
- Correção: os rebocadores passavam por dentro do navio ao chegar e ao trocar de posição. Agora contornam o casco, com um teste que garante isso.

## v0.10.0 — Navio maior, reputação e ofertas que mudam

- Segundo navio: graneleiro de 130 m, 15.000 t carregado e 7,4 m de calado. Leva 214 s para ir de parado a 3 nós (o costeiro, 136 s) e 1.290 m para parar com toda força ré (o costeiro, 630 m). Custa R$ 150.000 e exige reputação 25.
- Estaleiro no porto: o navio antigo entra na troca por 60% do preço. Máquina, leme, ar e impelidor ficam com ele; instrumentos e tripulação vão junto.
- Reputação de 0 a 100: sobe com entregas (três pontos por estrela, mais dois se a viagem for limpa) e cai seis em cada fracasso. Começa liberando contratos de até duas estrelas e libera uma estrela a cada dez pontos.
- As ofertas mudam a cada viagem: tipo de carga e frete (de −10% a +15%). No graneleiro os fretes são 2,6× maiores e o prazo, 15 min mais longo.
- No modo livre dá para escolher o navio.
- As medidas do navio deixaram de ser fixas em 90 m: casco, pontos de amarração, rebocadores, defensas, ferro e instrumentos acompanham o navio.
- O prático adapta a antecipação e a velocidade ao porte do navio. Com o graneleiro e dois rebocadores ele atraca, mas abre demais na segunda curva e chega torto.

## v0.9.0 — Carreira: contratos, oficina e tripulação

- A tela inicial virou o porto, com caixa (começa em R$ 8.000), contratos, oficina e tripulação. O resultado de cada viagem entra no caixa.
- Seis contratos, de uma a cinco estrelas. Cada um define carga, calado (3,8 a 5,2 m), maré, frete (R$ 3.500 a R$ 48.000) e prazo. Navio mais carregado é mais pesado, cala mais e vale mais.
- Oficina, peça a peça: máquina principal (2 níveis), máquina do leme (2), ar de partida, impelidor de proa (2), GPS, indicador de guinada, doppler, radar e ECDIS. Cada compra muda a física ou a informação disponível.
- Tripulação: timoneiro, chefe de máquinas e imediato, com dois níveis cada. Reduzem o atraso das ordens, o desgaste e antecipam os avisos; recebem soldada a cada viagem.
- Se a confiança da tripulação terminar uma viagem em −60 ou menos, quem desembarca é o melhor tripulante contratado.
- Modo livre: sem dinheiro, com cenário, maré e equipamentos à escolha, como era antes.
- 6 testes novos da carreira.

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
