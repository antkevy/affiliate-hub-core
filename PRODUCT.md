# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Afiliado solo que caça ofertas (Telegram, Amazon, Shopee, feeds, APIs) e publica
em canal próprio do Telegram. Usa o produto no computador e também no celular
(edita fontes, checa ofertas e dispara publicações de qualquer lugar).

## Product Purpose

Affiliate Hub é o posto de comando de afiliado: captura ofertas de várias fontes,
filtra por regras e agenda, monta o post (texto com IA e banner renderizado no
servidor) e publica no destino no horário certo, com histórico de publicações e
estatísticas. Sucesso = o canal publicado sem trabalho manual repetido.

## Positioning

O diferencial é a automação de ponta a ponta: capturar → filtrar → redigir post
com IA → gerar banner → publicar agendado → medir, tudo em um painel único. É o
"piloto automático" do funil de afiliado, não um conversor de links.

## Operating Context

- Telas de configuração em formato de painel administrativo (fontes, monitores,
  destinos, templates, banners, integrações, automações).
- Dois modos de disparo: capturar/publicar manual ("rodar agora") e automações
  agendadas por cron.
- Uso também em telas pequenas (celular): navegação e edição precisam funcionar.

## Capabilities and Constraints

- Fontes de captura: Telegram (preview público), Amazon (Creators API), Shopee
  (Open API de Afiliados), feeds XML, APIs JSON e manual.
- Monitores com filtros (marketplace, desconto mínimo, preço máximo, palavras),
  agenda (dias + janela de horário), espaçamento entre posts e CTA tokenizado.
- Templates com tokens (`{title}`, `{cta}`, etc.), templates padrão por destino.
- Banners configuráveis renderizados no servidor (SVG→PNG via resvg) para posts
  agendados.
- Texto dos posts com IA (Groq), com fallback ao conteúdo local em falha.
- Destinos: Telegram (bot via proxy do servidor) e webhook; teste de envio.
- Conversor de links: Amazon, Shopee (API + reescrita), Magalu, KaBuM!,
  Terabyte, Mercado Livre (via sessão/meli.la), com subid e histórico.
- Estatísticas e lista de links gerados.
- Stack: TanStack Start/React, Vite, Tailwind v4 (tokens oklch), shadcn/ui,
  Supabase. Migrações via `supabase/migrations`; tipos gerados em
  `src/integrations/supabase/types.ts`. Testes Vitest; `tsc`, `eslint`, `build`.
- Projeto conectado ao Lovable: nunca reescrever histórico git publicado.
- Nenhuma credencial em código; credenciais ficam em `affiliate_accounts`.

## Brand Commitments

- Nome: "Affiliate Hub" (mantido).
- Tema escuro é obrigatório (requisito confirmado pelo usuário).
- Sem logo, cores ou referências visuais adicionais vinculadas.

## Evidence on Hand

Código, testes Vitest e build como evidência de comportamento. Não há depoimentos,
capturas de produção ou assets de marca para incluir; não inventar material comercial.

## Product Principles

- Automação é a promessa: reduzir trabalho manual repetido é o critério de sucesso.
- Estado visível e confiável: status de capturas/publicações claros a todo momento.
- Funciona bem no celular sem sacrificar o conforto no desktop.
- Escuro para sessões prolongadas de operação.
- Cada etapa do funil deve pedir o mínimo de cliques do usuário.