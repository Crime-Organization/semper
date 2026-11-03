-- =====================================================================
-- 016 · Comentários nos cartões, com @ (menções)
--   A comunicação da equipe acontece nos comentários de cada cartão:
--   Pessoas e Contratos agora; cada módulo novo acrescenta a sua coluna.
--   - O comentário pertence a um cartão (uma pessoa ou um contrato) e
--     some junto com ele (LGPD).
--   - "@usuario" no texto marca um colega: o banco acha as menções no
--     próprio texto, só de quem está ativo na equipe do escritório.
--     Em contratos, que servem ao controle financeiro, só advogados podem
--     ser mencionados.
--   - Quem escreveu edita (fica a data da edição) e apaga; os
--     administradores também apagam. Apagar fica no registro de ações.
--   - Quem vê o cartão vê os comentários dele: a leitura passa pelas
--     regras do próprio cartão (se a visibilidade dos contratos mudar,
--     os comentários acompanham).
--   Só acrescenta: tabela, regras e gatilhos novos. A versão anterior do
--   site continua funcionando (ela não usa comentários).
-- =====================================================================

create table public.comentarios (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null default privado.meu_escritorio() references public.escritorios on delete cascade,
  -- o cartão: exatamente um (cada módulo novo acrescenta a sua coluna e entra na regra comentario_de_um_cartao)
  pessoa_id     uuid references public.pessoas on delete cascade,
  contrato_id   uuid references public.contratos on delete cascade,
  autor_id      uuid default auth.uid() references public.perfis on delete set null,
  texto         text not null check (char_length(texto) between 1 and 5000),   -- TAMANHO_COMENTARIO em limites.ts
  mencoes       uuid[] not null default '{}',   -- perfis marcados com @ (o gatilho preparar acha no texto)
  criado_em     timestamptz not null default now(),
  editado_em    timestamptz,
  constraint comentario_de_um_cartao check (num_nonnulls(pessoa_id, contrato_id) = 1)
);
create index comentarios_da_pessoa on public.comentarios (pessoa_id, criado_em desc) where pessoa_id is not null;
create index comentarios_do_contrato on public.comentarios (contrato_id, criado_em desc) where contrato_id is not null;
create index comentarios_escritorio on public.comentarios (escritorio_id);

-- O texto sem espaços nas pontas; as menções vêm do texto ("@usuario" no começo ou depois de espaço ou pontuação,
-- para um e-mail como joao@exemplo.com não contar). Em contratos, só advogados. Na edição, fica a data.
create function privado.preparar_comentario() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_nome text;
begin
  new.texto := btrim(new.texto);
  if new.texto = '' then raise exception 'Escreva o comentário.'; end if;
  if tg_op = 'UPDATE' then new.editado_em := now(); end if;
  select coalesce(array_agg(distinct p.id), '{}') into new.mencoes
  from regexp_matches(new.texto, '(^|[^a-z0-9._-])@([a-z0-9._-]+)', 'gi') as m(partes)
  join public.perfis p on p.usuario = rtrim(lower(m.partes[2]), '.') and p.escritorio_id = new.escritorio_id and p.ativo;
  if new.contrato_id is not null then
    select p.nome into v_nome from public.perfis p where p.id = any(new.mencoes) and p.funcao <> 'advogado' order by p.nome limit 1;
    if v_nome is not null then
      raise exception 'Não é possível mencionar % em contratos: só advogados podem ser mencionados.', v_nome;
    end if;
  end if;
  return new;
end $$;
create trigger preparar before insert or update of texto on public.comentarios
  for each row execute function privado.preparar_comentario();
create trigger auditoria after delete on public.comentarios for each row execute function privado.auditar();

alter table public.comentarios enable row level security;
revoke all on public.comentarios from anon;
-- Depois de escrito, só o texto muda (o autor, o cartão e as datas não).
revoke update on public.comentarios from authenticated;
grant update (texto) on public.comentarios to authenticated;

-- Quem vê o cartão vê os comentários: a consulta ao cartão passa pelas regras de leitura dele.
create policy leitura on public.comentarios for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio())
         and (pessoa_id is null or exists (select 1 from public.pessoas p where p.id = pessoa_id))
         and (contrato_id is null or exists (select 1 from public.contratos k where k.id = contrato_id)));
create policy incluir on public.comentarios for insert to authenticated
  with check (escritorio_id = (select privado.meu_escritorio()) and autor_id = (select auth.uid())
              and (pessoa_id is null or exists (select 1 from public.pessoas p where p.id = pessoa_id))
              and (contrato_id is null or exists (select 1 from public.contratos k where k.id = contrato_id)));
create policy alterar on public.comentarios for update to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and autor_id = (select auth.uid()))
  with check (escritorio_id = (select privado.meu_escritorio()) and autor_id = (select auth.uid()));
create policy apagar on public.comentarios for delete to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and (autor_id = (select auth.uid()) or (select privado.sou_admin())));
