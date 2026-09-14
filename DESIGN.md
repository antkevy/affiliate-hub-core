# DESIGN.md — Affiliate Hub

Registro do depoimento de design do redesenho de interface. Complementa
`PRODUCT.md` (verdade do produto) e o surface brief em
`.impeccable/surfaces/`.

## Decisão

- **Mundo escolhido: Telegram Native** — o hub é um feed de Telegram sério
  para quem vive no Telegram: uma conversa longa e calma com o mercado.
  Escolhido pelo usuário durante a rodada de direção (sua resposta anulou o
  sorteado, rodada `concept-seed` key `906585ae`; carta PICK do autônomo).
  Válido pelo mundo inteiro, inclusive a sobreviver navegação quieta, conteúdo
  denso, interação/estado e superfícies futuras diferentes.
- **Tema escuro permanece** (compromisso de marca de `PRODUCT.md`); usuário
  solo, desktop + celular; diferencial = automação ponta a ponta.

## Sistema

- **Paleta (oklch, navez profunda):** fundo `≈oklch(0.15 0.012 246)`, bolha
  incoming `≈oklch(0.212)`, surface/rail mais escura, hairlines `oklch(0.28)`.
  Uma única cor saturada (azul de envio, `primary`) **reservada a ações**;
  desabilitado perde a cor. Sucesso/aviso/erro vivos apenas como estados.
- **Tipografia:** uma face humana no sistema para leitura; numerais tabulares
  (`font-variant-numeric`) para preços, percentuais e contagens; display no
  mesmo sistema (calmo), sem voz de display importada.
- **Superfícies:** elevation declarada uma vez (borda + sombra suave 1px);
  bolhas `bubble` (incoming) e `bubble-out` (outgoing) com corner de "cauda"
  6px; radius base 0.875rem.
- **Navegação:** trilho de conversas no desktop (lista de chats com avatar,
  grupo ativo como chat selecionado); no celular, barra inferior fixa com 5
  abas (Dashboard, Ofertas, Conversor, Publicações, Mais) + bottom sheet com a
  navegação completa. Conteúdo com `pb` reservado para a barra.
- **Movimento:** um momento autoral — o **surto do pipeline** (faixa
  indeterminada percorrendo `fonte→filtro→post→envio`) dirigido por estado
  real (fila/processamento > 0); bolhas de saída entram com `animate-send`
  (ease-out, um único momento). `prefers-reduced-motion` zera tudo.
- **Superfícies de navegador tematizadas:** `::selection`, scrollbars,
  caret, `:focus-visible` a partir da paleta.

## Superfícies construídas

- **AppShell** — trilho de conversas (desktop) + barra inferior (mobile),
  menu completo em bottom sheet; grupo ativo = chat selecionado.
- **Dashboard -> "Hoje"** — a corrente: ofertas capturadas entram á esquerda
  (avatar do remetente, bolha com preço-dupla e `%OFF`), publicações saem à
  direita (bolha de saída), ações rápidas como chips sugestão, ciclo de
  automação em chips de pipeline com a faixa de surto. Estatísticas de fluxo e
  saúde da operação preservadas abaixo.
- **Ofertas** — gestão tabular preservada (superfície densa legítima); a
  fileira de métricas-azulejos foi substituída por chips de status; oferta em
  foco usa chips `%OFF` no tom de sucesso.
- **Publicações —> "Saída"** — registro como bolhas outgoing com remetente,
  horário e status; falhas com mensagem no próprio corpo.
- **PageHeader** — sem eyebrow/kicker (ban do `craft-floor`); título carrega o
  peso; descrição e ações ao lado.
- Demais telas (fontes, destinos, automações, templates, banners, conversor,
  links, integrações, configurações, estatísticas, monitoramento) herdam o
  mundo via tokens e primitivas — nenhuma funcionalidade removida.

## Verificação

- `tsc --noEmit` ✓ · `eslint --fix .` (0 erros) ✓ · vitest 54/54 ✓ · build ✓.
- Revisão de acabamento: `impeccable detect --json` sobre os alvos
  modificados — 1 aviso de "gray-on-color" pré-existente corrigido
  (chip `%OFF` amber-hardcoded → token).
- **Proveniência de rasters:** indisponível neste ambiente (nenhum navegador
  headless); a revisão foi feita in-thread sobre código + detector, sem
  screenshots de app. Registros visuais de referência do mundo:
  `impeccable.style/worlds/cards/*` (QUALITY BAR da rodada).

## Compromissos duráveis

- Acento saturado só em ação; preço/percentual sempre em numerais tabulares;
  "conversa" como metáfora de entidade (remetente + hora); erro = slip
  vermelho na etapa do pipeline; sem glass/desfoque decorativo; sem métricas
  em azulejo como estrutura de página.