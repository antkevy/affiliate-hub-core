# DESIGN.md — Affiliate Hub

Registro do depoimento de design do redesenho de interface. Complementa
`PRODUCT.md` (verdade do produto) e o surface brief em
`.impeccable/surfaces/`.

## Decisão

- **Mundo escolhido: Terminal de Trading** — o hub é a mesa de operação de um
  único afiliado: terminal escuro, números em mono tabular como verdade ao
  vivo, e o "piloto automático" como um algo rodando em segundo plano. O feed
  é um tape (fita) de movimentos do dia. Escolhido pelo usuário na rodada de
  direção (carta PICK do autônomo, sobre o sorteado "Recibo da Venda"; rodada
  `concept-seed` key `876772dd`). Substitui o mundo anterior (Telegram Native,
  key `906585ae`, descartado pelo usuário).
- **Tema escuro permanece** (compromisso de marca de `PRODUCT.md`); usuário
  solo, desktop + celular; diferencial = automação ponta a ponta.

## Sistema

- **Paleta (oklch, "watch bowl" neutro quase-preto):** fundo
  `≈oklch(0.135 0.007 264)`, painéis `oklch(0.19)`/`oklch(0.22)`, hairline
  `oklch(0.27)`. Uma única cor saturada — **fósforo âmbar**
  `≈oklch(0.8 0.16 80)`, `primary` — **reservada a ações** (botões, cupom
  copiável, foco, caret, seleção, chip de estado vivo); desabilitado perde a
  cor. Verde (bid) e vermelho (ask) apenas em deltas reais e estados de
  sucesso/erro. O desconto `%OFF` é o "spread no verde". Nada de halo colorido
  de offset zero; elevation definida por borda 1px + sombra suave.
- **Tipografia:** corpo DM Sans (sistema); **display Space Grotesk**
  (voice de painel, self-hosted via @fontsource); **dados/números JetBrains
  Mono** self-hosted, sempre `tabular-nums`. Sem faces de sistema como voz de
  display.
- **Superfícies:** painéis "ticket" — radic base 0.875rem, borda 1px hairline,
  e o ticket de saída (`ticket-out`) carrega a única tinta de ação. Labels de
  seção em mono maiúsculo espaçado (`text-eyebrow`), nunca kicker sobre
  heading.
- **Navegação:** trilho de instrumentos no desktop (placa de símbolo quadrada
  por entrada; grupo ativo em âmbar); no celular, barra inferior fixa com 5
   guias (Dashboard, Ofertas, Conversor, Publicações, Mais) + bottom sheet com
  a navegação completa; `pb` reservado para a barra + `safe-area-inset-bottom`.
- **Movimento:** um momento autoral — o **surto do tape** (faixa indeterminada
  percorrendo `fonte→filtro→post→envio`) dirigido por estado real
  (fila/processamento > 0); saídas entram como linha de fita (`animate-send`,
  ease-out, um único momento). Nada anima continuamente sem necessidade.
  `prefers-reduced-motion` zera tudo.
- **Superfícies de navegador tematizadas:** `::selection`, scrollbars,
  caret (`âmbar`), `:focus-visible` a partir da paleta.

## Superfícies construídas

- **AppShell** — trilho de instrumentos (desktop) + barra inferior (mobile),
  menu completo em bottom sheet; marca com placa de sinal âmbar e tagline
  mono; grupo ativo = rota em âmbar.
- **Dashboard → "Mesa"** — a fita do dia: ofertas capturadas entram como
  tickets com placa de símbolo (código do marketplace, mono), preço em mono
  com original riscado e `%OFF` verde, status pill; publicações saem à direita
  como tickets de transmissão; faixa de ciclo em chips de pipeline mono com o
  surto; ações rápidas como chips; estatísticas de fluxo e saúde da operação
  preservadas abaixo.
- **Ofertas** — gestão tabular preservada (superfície densa legítima), com
  carrossel de chips de status; `%OFF` tokenizado em verde; cupom copiável
  como affordance âmbar; desconto em numerais mono.
- **Publicações —> "Saída"** — log de transmissões: linha de cabeçalho mono
  `[ENVIADA|FALHOU|NA FILA] · tempo`, ticket de saída com preview e status;
  falhas com mensagem no próprio corpo.
- **PageHeader** — sem eyebrow/kicker (ban do `craft-floor`); título carrega o
  peso; descrição e ações ao lado.
- Demais telas (fontes, destinos, automações, templates, banners, conversor,
  links, integrações, configurações, estatísticas, monitoramento) herdam o
  mundo via tokens e primitivas — nenhuma funcionalidade removida.

## Verificação

- `tsc --noEmit` ✓ · `eslint` (0 erros; 8 warnings `react-refresh`
  pré-existentes) ✓ · vitest 54/54 ✓ · build ✓ · `impeccable detect --json`
  sobre os alvos (incl. passada `--viewport 390x844`) — limpo.
- Build servido (`NITRO_PRESET=node-server`) responde 200 nas rotas
  autenticadas; artefatos compilados confirmam as fontes self-hosted (woff2 de
  Space Grotesk/JetBrains Mono emitidos + `@font-face` relativos), os tokens
  (`--primary:oklch(80% .16 80)`) e os utilitários `ticket`, `ticket-out`,
  `inst-row`, `pipeline-step-live`.
- **Proveniência de rasters:** indisponível **neste host** (Android/bionic, sem
  navegador executável — o `chrome-headless-shell` glibc não roda sem o loader
  dinâmico). A checagem mobile foi feita por auditoria estática responsiva
  (containers `min-w-0`, sidebars apenas em `lg:`, `overflow-x-auto` no
  container da tabela, `pb-28` + `safe-area-inset-bottom` cobrindo a barra
  inferior, alvos de toque ≥ 44px nas guias) + artefatos do build; rodada
  visual em navegador real fica pendente no celular/dispositivo do usuário.
  Referências visuais do mundo: `impeccable.style/worlds/cards/*` (QUALITY BAR
  da rodada).

## Compromissos duráveis

- Acento saturado (fósforo âmbar) só em ação; verde/vermelho apenas como
  deltas e estados; preço/percentual sempre em numerais tabulares mono;
  entidades com identidade de instrumento (placa + código + hora); erro =
  slip vermelho na etapa do pipeline; sem glass/desfoque decorativo; sem
  métricas-azulejo como estrutura de página; fontes de display e dados
  self-hosted.