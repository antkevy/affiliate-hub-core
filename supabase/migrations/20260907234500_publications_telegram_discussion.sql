-- Comentários / seção de discussão do Telegram.
-- Guarda o id numérico do chat e da mensagem publicados no canal, e o par
-- (grupo de discussão, mensagem encaminhada) para montar o botão "Comentar".
alter table public.publications
  add column if not exists remote_chat_id bigint,
  add column if not exists remote_message_id bigint,
  add column if not exists discussion_chat_id bigint,
  add column if not exists discussion_message_id bigint;

create index if not exists publications_remote_lookup_idx
  on public.publications (remote_chat_id, remote_message_id);