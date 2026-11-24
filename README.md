# Barra Adentro

Protótipo de um jogo de manobra de navios em pixel art 3D isométrico: entrar pela barra de Santos, seguir o canal e atracar, com um navio que demora a obedecer. A graça é a antecipação.

A carta do jogo é estilizada e **não serve para navegação**.

Jogar: https://marcelobritonet.github.io/barra-adentro/

## Rodar

```bash
npm install
npm run dev
```

Abra o endereço que o Vite mostrar. Testes: `npm test`.

Para jogar uma versão fechada enquanto o código muda, gere-a a partir de uma tag e sirva em outra porta:

```bash
sh scripts-estavel.sh v0.7.0
npx vite preview --outDir .estavel --port 5180
```

## Onde está cada coisa

| Caminho | Conteúdo |
|---|---|
| `docs/GDD.md` | Documento de design |
| `PENDENCIAS.md` | Decisões em aberto e o que falta fazer |
| `CHANGELOG.md` | Notas de cada versão |
| `src/sim` | Física do navio e do ferro |
| `src/world` | Recorte de Santos e marés |
| `src/game` | Regras, prático, rebocadores e tráfego |
| `src/render`, `src/bridge` | Vista isométrica e painel do passadiço |
