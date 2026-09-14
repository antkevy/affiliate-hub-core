---
version: 3
slug: "src-routes-authenticated-route-tsx"
primary_target: "src/routes/_authenticated/route.tsx"
related_targets: ["src/routes/_authenticated/dashboard.tsx","src/routes/_authenticated/ofertas.tsx","src/routes/_authenticated/publicacoes.tsx","src/routes/_authenticated/conversor.tsx","src/routes/_authenticated/monitoramento.tsx"]
---

# Surface brief: app autenticado (todas as telas)

Mode: operate.

## Scope and mode

Redesenho estrutural do app autenticado (AppShell + rotas), mantendo 100% das
funcionalidades. Usuário solo, desktop + celular, tema escuro obrigatório.
Substitui tanto o mundo Telegram Native (seed 906585ae) quanto o re-theme
"Terminal jr." que o usuário recusou por ser só repintura (mesma estrutura,
outra cor).

## Direction contract

THESIS: O hub é a mesa de operação de um afiliado solo: um terminal escuro onde
cada número é uma verdade ao vivo e o piloto automático roda em segundo plano.
O usuário recusou o layout "admin padrão" (rail lateral + chips de status +
cards verticais) mesmo re-colorido — o **modelo estrutural** precisa ser outro,
não só a paleta.

OWN-WORLD: fundo quase-preto neutro ("watch bowl", leve frio); uma única cor
saturada — fósforo âmbar — reservada a ações e ao estado vivo; verde/vermelho
só em deltas reais e estados; entidades como instrumentos (placa de símbolo
mono + código + hora); preços/percentuais em numerais tabulares mono.

NAVIGATION: **barra de menus no topo** (estação de trabalho, sem sidebar):
Painel e Ofertas como chaves diretas; Canais, Conteúdo, Afiliados, Relatórios
e Sistema como menus discretos (grupos); chave ativa = âmbar com filete de 1px.
Mobile: barra inferior fixa (5 guias) + bottom sheet. Ticker global de pipeline
(`cap · fila · env`, estado `operando/parado`, **hora da última leitura**).

STORY: O operador abre a mesa e vê o blotter: Entradas no tape (linhas densas:
placa, título, preço mono, `%OFF` verde, status) e Saídas no log de transmissões
(mono, destino · hora · status). "Executar captura"/"Publicar agora" são os
gestos sonoros; falha inflama um slip vermelho.

FORM: forma Terminal de Trading (carta PICK do autônomo), seed 876772dd.
Estrutura blotter no lugar de feed de cards; linhas de leitura mono no lugar de
chips; dados densos e escaneáveis, sem axas genéricas.

FINISH: unreviewed and undocumented is unfinished; this build ends with the
finish review, the verdict, DESIGN.md, and every shipping raster carrying its
provenance.