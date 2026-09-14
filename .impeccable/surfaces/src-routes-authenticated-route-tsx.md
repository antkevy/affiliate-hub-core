---
version: 2
slug: "src-routes-authenticated-route-tsx"
primary_target: "src/routes/_authenticated/route.tsx"
related_targets: ["src/routes/_authenticated/dashboard.tsx","src/routes/_authenticated/ofertas.tsx","src/routes/_authenticated/publicacoes.tsx","src/routes/_authenticated/conversor.tsx","src/routes/_authenticated/monitoramento.tsx"]
---

# Surface brief: app autenticado (todas as telas)

Mode: operate.

## Scope and mode

Redesenho do mundo visual de todo o app autenticado (AppShell + 16 rotas),
mantendo 100% das funcionalidades. Usuário solo, desktop + celular, tema escuro
obrigatório. Substitui o mundo anterior (Telegram Native, seed 906585ae,
descartado pelo usuário).

## Direction contract

THESIS: O hub vira a mesa de operação de um afiliado solo: um terminal escuro
onde cada número é uma verdade ao vivo, o "piloto automático" aparece como um
algo rodando em segundo plano, e o feed do dia é um tape (fita) de movimentos.
Recusa o grid padrão de cards shadcn + métricas em azulejos e o corredor de
dashboard genérico.

OWN-WORLD: fundo quase-preto neutro ("watch bowl", leve frio); uma única cor
saturada — fósforo âmbar — reservada a ações e ao estado vivo; verde/vermelho
só em deltas reais e estados; entidades como instrumentos (placa de símbolo
mono + código + hora); preços e percentuais sempre em numerais tabulares mono;
labels de seção em mono maiúsculo.

STORY: O operador abre a mesa e vê o tape do dia: o que as fontes trouxeram
(capturadas → fila → enviadas), o que foi publicado e onde falhou — como ler o
próprio algoritmo. Cada etapa do ciclo aparece como ticket de status; cada
entrada é um instrumento. "Publicar agora" e "Executar automação" são os únicos
gestos sonoros.

FIRST VIEWPORT: trilho de instrumentos à esquerda (drawer no desktop; barra
inferior no celular, 5 guias + safe-area); à direita a fita "Mesa" — tickets
de ofertas entrando (placa de símbolo, par de preço, `%OFF` no verde) e
tickets de transmissão saindo, entrelaçados, com a faixa de pipeline
(fonte→filtro→post→envio) em chips mono no topo. Ação primária "Executar
captura" na cabeça da fita.

FORM: forma escolhida = Terminal de Trading (carta PICK do autônomo), seed
876772dd. Assinatura: o surto do tape — ao Publicar, um varrimento amortecido
percorre fonte→filtro→post→envio; falha inflama um slip vermelho na etapa.

FINISH: unreviewed and undocumented is unfinished; this build ends with the
finish review, the verdict, DESIGN.md, and every shipping raster carrying its
provenance.