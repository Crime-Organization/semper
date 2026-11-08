-- Caixa de mensagens (#112). Só acrescenta (uma tabela, uma função e um gatilho nos comentários, que não muda o que eles
-- gravam). A versão anterior do site continua funcionando: ela não lê as mensagens.
--   - Cada pessoa tem as suas mensagens, e só ela as vê (nem um administrador vê as dos outros).
--   - O primeiro tipo é a menção: quem é marcado com @ num comentário recebe uma mensagem. Quem escreveu não recebe a
--     própria menção.
--   - O texto continua só no comentário: editar o comentário muda o que a mensagem mostra, e apagar o comentário (ou o
--     cartão) apaga a mensagem. O acesso ao texto passa pelas regras do comentário e do cartão: quem deixou de ver o
--     cartão continua com a mensagem, mas sem o texto.
--   - Editar o comentário: quem passou a ser marcado recebe a mensagem; quem deixou de ser perde a dele. Quem está
--     desativado continua com a dele (a lista de menções só conta os ativos, mas ninguém tirou essa pessoa do texto).
--     Limite conhecido: quem trocou o próprio @ deixa de ser achado no texto antigo, e perde a mensagem se ele for editado.
--   - Só a data de leitura muda pela tela. Quem cria as mensagens é o gatilho.
--   - As menções que já existiam entram como lidas: a caixa mostra o histórico, sem encher o contador de uma vez.
-- Outro tipo de mensagem (ex.: prazo, #113) = um valor novo em "tipo" e a sua coluna, numa migração nova.

create table public.mensagens (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references public.escritorios on delete cascade,
  perfil_id     uuid not null references public.perfis on delete cascade,   -- quem recebe
  tipo          text not null default 'mencao' check (tipo in ('mencao')),
  comentario_id uuid references public.comentarios on delete cascade,
  criado_em     timestamptz not null default now(),
  lido_em       timestamptz,
  unique (perfil_id, comentario_id)
);
create index mensagens_da_pessoa on public.mensagens (perfil_id, criado_em desc);
create index mensagens_nao_lidas on public.mensagens (perfil_id) where lido_em is null;
create index mensagens_do_comentario on public.mensagens (comentario_id);
create index mensagens_escritorio on public.mensagens (escritorio_id);

alter table public.mensagens enable row level security;
revoke all on public.mensagens from anon;
revoke insert, update, delete on public.mensagens from authenticated;
grant update (lido_em) on public.mensagens to authenticated;

create policy leitura on public.mensagens for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and perfil_id = (select auth.uid()));
create policy alterar on public.mensagens for update to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and perfil_id = (select auth.uid()))
  with check (escritorio_id = (select privado.meu_escritorio()) and perfil_id = (select auth.uid()));

-- Depois de o gatilho "preparar" achar as menções no texto. O gatilho é "update of texto", e não "of mencoes", porque
-- quem muda as menções é o próprio "preparar": a coluna nem aparece no comando de quem edita.
create function privado.mensagens_do_comentario() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    delete from public.mensagens m where m.comentario_id = new.id and not m.perfil_id = any(new.mencoes)
      and exists (select 1 from public.perfis p where p.id = m.perfil_id and p.ativo);
  end if;
  insert into public.mensagens (escritorio_id, perfil_id, comentario_id)
  select new.escritorio_id, m.perfil, new.id
  from unnest(new.mencoes) as m(perfil)
  where m.perfil is distinct from new.autor_id
  on conflict (perfil_id, comentario_id) do nothing;
  return null;
end $$;
revoke execute on function privado.mensagens_do_comentario() from public, anon, authenticated;
create trigger mensagens after insert or update of texto on public.comentarios
  for each row execute function privado.mensagens_do_comentario();

-- As menções que já existiam, como lidas.
insert into public.mensagens (escritorio_id, perfil_id, comentario_id, criado_em, lido_em)
select c.escritorio_id, m.perfil, c.id, c.criado_em, now()
from public.comentarios c
cross join lateral unnest(c.mencoes) as m(perfil)
where m.perfil is distinct from c.autor_id
  and exists (select 1 from public.perfis p where p.id = m.perfil)
on conflict (perfil_id, comentario_id) do nothing;
