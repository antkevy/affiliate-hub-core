---
version: 1
slug: "src-routes-authenticated-route-tsx"
primary_target: "src/routes/_authenticated/route.tsx"
related_targets: ["src/routes/_authenticated/dashboard.tsx","src/routes/_authenticated/ofertas.tsx","src/routes/_authenticated/publicacoes.tsx","src/routes/_authenticated/conversor.tsx","src/routes/_authenticated/monitoramento.tsx"]
---

# Surface brief: app autenticado (todas as telas)

Mode: operate.

## Scope and mode

Redesenho do mundo visual de todo o app autenticado (AppShell + 16 rotas),
mantendo 100% das funcionalidades. Usuário solo, desktop + celular, tema escuro
obrigatório.

## Direction contract

THESIS: O hub vira um feed de Telegram sério para quem vive no Telegram: o app é
uma conversa longa e calma com o mercado — sala de leitura, não console admin.
Ele recusa o grid padrão de cards shadcn + métricas em azulejos e o corredor de
dashboard genérico.

OWN-WORLD: fundo chat-navy profundo (escuro, levemente frio); coluna de mensagem;
entidades como bolhas de conversa — publicações/saídas à direita (outgoing),
ofertas capturadas/fontes à esquerda (incoming) com remetente e hora; única cor
saturada (azul de envio) reservada a controles acionáveis; preços e percentuais
em numerais tabulares; toda entidade tem identidade de conversa mínima (chip
inicial, nome, timestamp).

STORY: O operador abre e vê o dia: o que os canais trouxeram, o que foi
publicado, onde falhou — como ver o próprio canal de fora. Cada etapa se dobra
em uma conversa (thread de fonte, offer, publicação). "Publicar agora" e
"Executar automação" são os únicos gestos sonoros.

FIRST VIEWPORT: trilho de conversas à esquerda (drawer no desktop; barra inferior
no celular); à direita a corrente "Hoje" — bolhas de ofertas entrando (par de
preço, chip %OFF, tag marketplace) e bolhas de publicações saindo, entrelaçadas,
com faixa de pipeline (fonte→filtro→post→envio) em chips de status no topo.
Ação primária "Executar captura" fixa no rodapé da corrente.

FORM: forma escolhida = Telegram Native (meu top-ranked; carta PICK), seed
906585ae. Assinatura: o surto do pipeline — ao Publicar, um varrimento
amortecido percorre fonte→filtro→post→envio; falha inflama um slip vermelho na
etapa.

FINISH: unreviewed and undocumented is unfinished; this build ends with the
finish review, the verdict, DESIGN.md, and every shipping raster carrying its
provenance.
