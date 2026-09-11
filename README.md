# Affiliate Hub Core

Crie do ZERO uma aplicação web chamada Affiliate Hub.

O Affiliate Hub será uma plataforma pessoal de automação para afiliados, voltada para gerenciamento de ofertas, monitoramento de fontes, conversão de links de afiliado, criação de conteúdo e publicação em diferentes destinos.

A aplicação deve ser construída agora com frontend completo + banco de dados + autenticação + estrutura de backend preparada, porém as integrações e automações reais NÃO devem funcionar ainda.

A prioridade desta etapa é deixar o projeto com uma arquitetura profissional, organizada e escalável, pronta para que as funcionalidades sejam implementadas posteriormente dentro do próprio projeto.

---

1. STACK

Utilize:

- React

- TypeScript

- Vite

- Tailwind CSS

- shadcn/ui

- Supabase

- PostgreSQL

- Supabase Auth

- Supabase Storage

- Supabase Edge Functions quando necessário

Não adicionar tecnologias ou serviços externos desnecessariamente.

---

2. OBJETIVO DESTA ETAPA

Quero que o projeto tenha:

Frontend

Todas as páginas, componentes, navegação, formulários, tabelas, modais, filtros e estados visuais.

Backend

Banco de dados estruturado, relacionamentos, constraints, índices, RLS, tipos e estrutura de serviços.

Funcionalidades

As funcionalidades devem estar representadas e preparadas, mas não precisam funcionar ainda.

Por exemplo:

O botão:

"Conectar Telegram"

deve existir e abrir a interface de configuração, mas não precisa realizar a conexão real.

O botão:

"Criar automação"

deve salvar a estrutura da automação no banco, mas o sistema não deve executar a automação real.

O botão:

"Gerar link de afiliado"

pode apresentar a interface necessária, mas não precisa gerar o link real ainda.

---

3. DESIGN

Utilizar um design:

- Dark;

- moderno;

- minimalista;

- profissional;

- semelhante a um SaaS premium;

- alta densidade de informação;

- excelente hierarquia visual.

Cores

Background:

- #0B0D10 aproximadamente.

Cards:

- cinza escuro.

Texto:

- branco;

- cinza claro;

- cinza secundário.

Cor principal:

- azul.

Estados:

- verde → sucesso;

- vermelho → erro;

- amarelo → alerta;

- azul → processamento/informação.

Evitar excesso de cores, gradientes e sombras.

---

4. LAYOUT PRINCIPAL

Criar:

Sidebar

Affiliate Hub

Principal

- Dashboard

- Monitoramento

- Automações

- Ofertas

Conteúdo

- Templates

- Banners

Canais

- Fontes

- Destinos

Afiliados

- Links de Afiliado

Relatórios

- Publicações

- Estatísticas

Sistema

- Integrações

- Configurações

Na parte inferior:

- avatar;

- nome do usuário;

- menu de perfil.

---

5. AUTENTICAÇÃO

Implementar a estrutura de autenticação utilizando Supabase Auth.

Criar:

- Login;

- Cadastro;

- Recuperação de senha;

- Logout;

- proteção das rotas privadas;

- sessão persistente.

Após login:

→ Dashboard.

Cada usuário deve possuir seu próprio perfil.

Nunca confiar no frontend para autorização.

---

6. BANCO DE DADOS

Criar uma estrutura PostgreSQL profissional.

Utilizar UUID como identificador.

Todas as tabelas privadas devem possuir:

- created_at;

- updated_at;

- user_id quando aplicável.

Criar foreign keys apropriadas.

Criar índices nas colunas utilizadas frequentemente para:

- busca;

- filtros;

- relacionamentos;

- ordenação.

Utilizar constraints para evitar dados inválidos.

---

7. TABELA profiles

Criar:

profiles

Campos:

id

user_id

name

avatar_url

created_at

updated_at

Relacionar com:

auth.users

Um usuário deve possuir apenas um perfil.

---

8. MARKETPLACES

Criar:

marketplaces

Campos:

id

name

slug

logo_url

is_active

created_at

updated_at

Pré-cadastrar:

- Mercado Livre

- Shopee

- Amazon

- AliExpress

Não implementar APIs reais ainda.

---

9. CONTAS DE AFILIADO

Criar:

affiliate_accounts

Campos:

id

user_id

marketplace_id

name

status

created_at

updated_at

Criar estrutura preparada para futuramente armazenar configurações específicas de cada marketplace.

Não armazenar secrets diretamente nessa tabela.

---

10. CREDENCIAIS

Criar:

affiliate_credentials

Campos apropriados para armazenar futuramente credenciais/token de integração.

IMPORTANTE:

- nunca retornar secrets para o frontend;

- não expor tokens em logs;

- utilizar RLS;

- preparar arquitetura para criptografia/secret management posteriormente.

Nesta etapa não é necessário conectar nenhuma API.

---

11. PRODUTOS

Criar:

products

Campos:

id

user_id

marketplace_id

external_id

title

description

image_url

product_url

category

brand

created_at

updated_at

Criar índice para:

marketplace_id + external_id

---

12. OFERTAS

Criar:

offers

Campos:

id

user_id

product_id

source_id

title

original_price

sale_price

discount_percentage

coupon

currency

original_url

affiliate_url

status

captured_at

processed_at

created_at

updated_at

Status preparados:

captured

processing

processed

approved

rejected

published

error

---

13. MÍDIAS DAS OFERTAS

Criar:

offer_media

Relacionada a:

offers

Campos:

id

offer_id

type

url

position

created_at

Preparar para:

- imagem;

- vídeo;

- thumbnail.

---

14. FONTES

Criar:

sources

Campos:

id

user_id

name

type

identifier

status

configuration

created_at

updated_at

Tipos:

telegram

whatsapp

api

feed

manual

A coluna "configuration" pode utilizar JSONB.

Não implementar monitoramento real ainda.

---

15. DESTINOS

Criar:

destinations

Campos:

id

user_id

name

type

identifier

status

configuration

created_at

updated_at

Tipos:

telegram

whatsapp

other

---

16. MONITORAMENTOS

Criar:

monitors

Campos:

id

user_id

name

source_id

status

configuration

last_activity_at

created_at

updated_at

Status:

active

paused

error

O monitoramento real ainda não deve ser executado.

---

17. AUTOMAÇÕES

Criar:

automations

Campos:

id

user_id

name

description

status

source_id

destination_id

template_id

configuration

last_run_at

created_at

updated_at

Status:

active

paused

error

---

18. REGRAS DE AUTOMAÇÃO

Criar:

automation_rules

Campos:

id

automation_id

type

operator

value

configuration

created_at

updated_at

Preparar para futuramente suportar:

- marketplace;

- preço;

- desconto;

- categoria;

- palavras-chave;

- cupom;

- origem;

- horário;

- quantidade.

---

19. TEMPLATES

Criar:

templates

Campos:

id

user_id

name

content

type

is_default

created_at

updated_at

Permitir variáveis como:

{titulo}

{preco}

{preco_antigo}

{desconto}

{cupom}

{link}

{marketplace}

{categoria}

---

20. BANNERS

Criar:

banners

Campos:

id

user_id

name

configuration

preview_url

created_at

updated_at

A configuração deve utilizar JSONB para permitir evolução futura.

Não implementar geração automática real ainda.

---

21. LINKS DE AFILIADO

Criar:

affiliate_links

Campos:

id

user_id

marketplace_id

product_id

original_url

affiliate_url

status

created_at

updated_at

Criar índice/constraint apropriado para evitar duplicações desnecessárias.

---

22. PUBLICAÇÕES

Criar:

publications

Campos:

id

user_id

offer_id

destination_id

automation_id

content

status

scheduled_at

published_at

error_message

created_at

updated_at

Status:

pending

processing

published

failed

cancelled

---

23. MENSAGENS PROCESSADAS

Criar:

processed_messages

Campos:

id

user_id

source_id

external_message_id

content_hash

processed_at

created_at

Criar índices e constraints para futuramente impedir processamento duplicado.

Não implementar o processamento real agora.

---

24. JOBS

Preparar arquitetura para processamento assíncrono.

Criar:

jobs

Campos:

id

user_id

type

status

payload

attempts

available_at

started_at

completed_at

error_message

created_at

updated_at

Status:

pending

processing

completed

failed

cancelled

Nesta etapa NÃO criar workers reais.

Apenas deixar a estrutura preparada.

---

25. AUDITORIA

Criar:

audit_logs

Campos:

id

user_id

action

entity_type

entity_id

metadata

created_at

Utilizar JSONB para metadata.

Preparar para registrar futuramente:

- login;

- criação;

- edição;

- exclusão;

- alteração de configurações;

- integrações.

---

26. ROW LEVEL SECURITY

Implementar RLS corretamente.

Regra principal:

Um usuário só pode:

- visualizar seus próprios registros;

- criar seus próprios registros;

- editar seus próprios registros;

- excluir seus próprios registros.

Nunca permitir que um usuário consulte registros pertencentes a outro usuário.

Para tabelas relacionadas, garantir isolamento através do relacionamento com "user_id".

Não colocar service role key no frontend.

---

27. STORAGE

Preparar Supabase Storage para:

- avatars;

- offer-media;

- banners;

- logos.

Criar políticas de acesso apropriadas.

Usuários não devem conseguir acessar ou modificar arquivos privados de outros usuários.

---

28. DASHBOARD

Criar dashboard completa com:

KPIs

- Ofertas capturadas;

- Ofertas processadas;

- Ofertas publicadas;

- Automações ativas.

Gráficos

- ofertas por dia;

- publicações;

- marketplaces;

- destinos.

Atividade recente

Timeline de eventos.

Status das automações

Lista das automações ativas/pausadas.

Se ainda não houver dados reais, mostrar empty states elegantes em vez de inventar estatísticas como se fossem reais.

---

29. MONITORAMENTO

Criar interface completa:

- lista de monitors;

- status;

- fonte;

- última atividade;

- quantidade de ofertas;

- configuração;

- ativar;

- pausar;

- editar;

- excluir.

Criar formulário:

Novo monitoramento

com:

1. Nome;

2. Fonte;

3. Marketplace;

4. Filtros;

5. Destino;

6. Template;

7. Configurações.

Salvar a configuração no banco.

Não iniciar nenhum monitoramento real.

---

30. AUTOMAÇÕES

Criar:

- lista;

- criação;

- edição;

- duplicação;

- ativação;

- pausa;

- exclusão.

Criar editor visual da automação:

Fonte

↓

Captura

↓

Filtros

↓

Processamento

↓

Link de afiliado

↓

Template

↓

Destino

Os blocos devem ser visualmente editáveis.

A automação pode ser salva no banco, mas não deve executar nenhuma ação real.

---

31. OFERTAS

Criar:

- tabela;

- cards;

- busca;

- filtros;

- ordenação;

- detalhes;

- histórico.

Permitir criar/editar/excluir ofertas manualmente para testar a interface e a estrutura do banco.

---

32. TEMPLATES

Criar editor com:

Editor

Textarea/Editor de texto.

Preview

Preview em tempo real.

Variáveis clicáveis.

Salvar templates no banco.

---

33. BANNERS

Criar editor visual.

Permitir configurar:

- imagem;

- título;

- preço;

- preço antigo;

- desconto;

- cupom;

- CTA;

- logo.

Salvar configuração no banco.

A geração final do banner pode ficar preparada, mas não precisa gerar imagens automaticamente ainda.

---

34. INTEGRAÇÕES

Criar página com:

- Telegram;

- WhatsApp;

- Mercado Livre;

- Shopee;

- Amazon;

- AliExpress.

Cada integração deve possuir:

- status;

- configuração;

- botão conectar;

- botão desconectar;

- campos necessários.

IMPORTANTE:

Não fingir que uma integração está conectada.

Inicialmente todas devem aparecer como:

Não configurada

ou

Desconectada

---

35. ESTATÍSTICAS

Criar estrutura visual para:

- cliques;

- publicações;

- conversões;

- receita/comissão;

- performance por marketplace;

- performance por destino.

Preparar o frontend para futuramente receber dados reais.

---

36. SERVIÇOS DO FRONTEND

Não colocar regras de negócio diretamente nas páginas.

Criar uma camada:

services/

Separar por domínio:

services/

├── offers

├── automations

├── monitors

├── templates

├── banners

├── sources

├── destinations

├── affiliate

├── publications

└── integrations

As funções podem inicialmente apenas fazer CRUD ou retornar estado de "não implementado" quando dependerem de uma integração futura.

---

37. TYPESCRIPT

Criar tipos/interfaces centralizados.

Exemplo:

types/

├── offer.ts

├── automation.ts

├── monitor.ts

├── template.ts

├── marketplace.ts

├── publication.ts

└── integration.ts

Evitar:

any

sempre que possível.

---

38. TRATAMENTO DE ERROS

Criar padrão consistente para:

- loading;

- sucesso;

- erro;

- empty state.

Erros vindos do backend nunca devem quebrar a interface.

Não mostrar informações sensíveis ao usuário.

---

39. RESPONSIVIDADE

Desktop:

- sidebar fixa;

- conteúdo amplo;

- tabelas;

- gráficos.

Mobile:

- sidebar drawer;

- cards em coluna;

- tabelas adaptadas;

- filtros em drawer;

- formulários em uma coluna;

- editor de automação vertical.

---

40. SEGURANÇA

Aplicar desde o início:

- RLS;

- validação de dados;

- autorização no backend;

- UUID;

- foreign keys;

- constraints;

- índices;

- proteção contra IDOR;

- não expor secrets;

- não colocar service role no frontend;

- validação de uploads;

- tratamento seguro de erros.

Não criar mecanismos para burlar bloqueios, banimentos ou controles de plataformas.

---

41. ARQUITETURA PARA FUTURO

A arquitetura deve permitir adicionar posteriormente:

- conectores de marketplaces;

- Telegram;

- WhatsApp através de mecanismos oficiais/autorizados;

- workers;

- filas;

- processamento de mensagens;

- geração de links afiliados;

- publicação automática;

- analytics;

- webhooks.

Criar interfaces/abstrações quando fizer sentido, mas não implementar essas integrações agora.

---

42. REGRA IMPORTANTE

Não criar funcionalidades falsas.

Se algo ainda não estiver implementado, mostrar claramente:

"Esta funcionalidade será configurada posteriormente."

Não criar dados falsos de conexões, publicações, cliques ou comissões como se fossem dados reais.

Dados mockados podem ser utilizados exclusivamente para demonstrar gráficos e layout, quando necessário, e devem estar claramente separados.

---

43. RESULTADO FINAL

Ao terminar, quero ter um Affiliate Hub completo visualmente e estruturalmente, com:

- autenticação;

- dashboard;

- banco PostgreSQL;

- RLS;

- Storage;

- estrutura de backend;

- CRUD básico;

- páginas;

- componentes;

- serviços;

- tipos;

- navegação;

- formulários;

- estados;

- responsividade;

- arquitetura preparada para integrações futuras.

Porém:

NÃO implementar ainda a execução real das automações, scraping, monitoramento de grupos, publicação automática ou integrações externas.

O projeto deve ficar pronto para que essas funções possam ser adicionadas posteriormente sem precisar refazer a arquitetura.

Antes de finalizar:

1. Verifique todas as relações do banco.

2. Verifique foreign keys.

3. Verifique RLS.

4. Verifique índices.

5. Verifique tipos TypeScript.

6. Verifique rotas.

7. Verifique responsividade.

8. Verifique estados de loading/erro/empty.

9. Verifique se nenhum secret está exposto.

10. Verifique se não existem erros de build.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/5ff664bb-0430-4284-88c0-fa168e024a98).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
