-- =====================================================================
-- 004 · Convite com link secreto
--   O primeiro acesso deixa de valer só pelo e-mail: exige o código do link
--   que o administrador enviou ao convidado. Sem ele, quem souber o e-mail de
--   um convite pendente não consegue criar a conta no lugar do convidado.
--   O banco guarda só o resumo (SHA-256) do código, e o link vale 7 dias.
--   Convites criados antes desta mudança precisam de um link novo
--   (Equipe e acessos > Convites pendentes > Novo link).
-- =====================================================================

alter table public.convites add column codigo_hash text, add column link_criado_em timestamptz;

create function privado.resumo_codigo(t text) returns text
language sql immutable set search_path = '' as $$
  select encode(extensions.digest(coalesce(t, ''), 'sha256'), 'hex')
$$;

-- Gera um código novo para o convite (o anterior deixa de valer) e o devolve, só desta vez.
create function privado.novo_codigo_convite(p_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare v text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  update public.convites set codigo_hash = privado.resumo_codigo(v), link_criado_em = now() where id = p_id;
  return v;
end $$;
revoke execute on function privado.resumo_codigo(text), privado.novo_codigo_convite(uuid) from public, anon, authenticated;

-- Convidar: igual a antes, e agora devolve também o código do link.
drop function public.convite_criar(uuid, text, text);
create function public.convite_criar(p_pessoa uuid, p_email text, p_papel text default 'usuario')
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pessoa public.pessoas; v_email text := lower(btrim(p_email)); c public.convites; v_codigo text;
begin
  if not privado.sou_admin() then raise exception 'Apenas administradores convidam usuários'; end if;
  if p_papel not in ('admin', 'usuario') and not (p_papel = 'master' and privado.sou_master()) then
    raise exception 'Papel inválido';
  end if;
  if p_papel = 'admin' and not privado.sou_master() then raise exception 'Só o master convida administradores'; end if;
  select * into v_pessoa from public.pessoas where id = p_pessoa and escritorio_id = privado.meu_escritorio();
  if v_pessoa.id is null then raise exception 'Pessoa não encontrada'; end if;
  if exists (select 1 from public.perfis where pessoa_id = p_pessoa) then raise exception 'Esta pessoa já é usuária do sistema'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'E-mail inválido'; end if;
  if exists (select 1 from auth.users where lower(email) = v_email) then raise exception 'Este e-mail já tem conta no SEMPER'; end if;
  delete from public.convites where email = v_email and usado_em is null and escritorio_id = privado.meu_escritorio();
  if exists (select 1 from public.convites where email = v_email and usado_em is null) then
    raise exception 'Este e-mail já tem um convite pendente';
  end if;
  insert into public.convites (escritorio_id, email, nome, papel, pessoa_id, criado_por)
  values (privado.meu_escritorio(), v_email, v_pessoa.nome, p_papel, p_pessoa, auth.uid())
  returning * into c;
  v_codigo := privado.novo_codigo_convite(c.id);
  return jsonb_build_object('id', c.id, 'email', c.email, 'nome', c.nome, 'papel', c.papel,
                            'pessoa_id', c.pessoa_id, 'criado_em', c.criado_em, 'codigo', v_codigo);
end $$;

-- Link novo para um convite pendente (perdido ou vencido). O link anterior deixa de valer.
create function public.convite_novo_link(p_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare c public.convites;
begin
  if not privado.sou_admin() then raise exception 'Apenas administradores'; end if;
  select * into c from public.convites where id = p_id and escritorio_id = privado.meu_escritorio() and usado_em is null;
  if c.id is null then raise exception 'Convite não encontrado'; end if;
  if c.papel <> 'usuario' and not privado.sou_master() then raise exception 'Só o master gera links de convites de administradores'; end if;
  return privado.novo_codigo_convite(p_id);
end $$;

revoke execute on function public.convite_criar(uuid, text, text), public.convite_novo_link(uuid) from public, anon;
grant execute on function public.convite_criar(uuid, text, text), public.convite_novo_link(uuid) to authenticated;

-- Ao criar a conta: exige o convite do e-mail E o código do link (enviado em "convite", nos dados do cadastro).
create or replace function privado.ao_cadastrar_usuario() returns trigger
language plpgsql security definer set search_path = '' as $$
declare c public.convites; v_pessoa uuid; v_base text; v_usuario text; n int := 1; partes text[];
begin
  select * into c from public.convites
  where email = lower(new.email) and usado_em is null
    and codigo_hash = privado.resumo_codigo(new.raw_user_meta_data ->> 'convite')
    and link_criado_em > now() - interval '7 days'
  limit 1;
  if c.id is null then
    raise exception 'SEMPER: convite inválido ou vencido';
  end if;

  v_pessoa := c.pessoa_id;
  if v_pessoa is null then
    insert into public.pessoas (escritorio_id, tipo, nome, emails, criado_por)
    values (c.escritorio_id, 'contato', upper(c.nome), array[lower(new.email)], new.id)
    returning id into v_pessoa;
  end if;

  -- @usuario: primeiro e último nome, sem acentos (mateus.goncalves); repete com número se já existir.
  partes := regexp_split_to_array(regexp_replace(privado.sem_acento(btrim(c.nome)), '[^a-z ]', '', 'g'), '\s+');
  v_base := left(coalesce(nullif(partes[1], ''), 'usuario') || case when array_length(partes, 1) > 1 then '.' || partes[array_length(partes, 1)] else '' end, 36);
  v_usuario := v_base;
  while exists (select 1 from public.perfis where escritorio_id = c.escritorio_id and usuario = v_usuario) loop
    n := n + 1; v_usuario := v_base || n;
  end loop;

  insert into public.perfis (id, escritorio_id, pessoa_id, nome, usuario, papel)
  values (new.id, c.escritorio_id, v_pessoa, initcap(lower(c.nome)), v_usuario, c.papel);
  insert into public.pessoa_responsaveis (pessoa_id, perfil_id, escritorio_id)
  values (v_pessoa, new.id, c.escritorio_id) on conflict do nothing;

  update public.convites set usado_em = now(), usado_por = new.id, codigo_hash = null where id = c.id;
  update public.plataforma_donos set usuario_id = new.id where email = lower(new.email);
  return new;
end $$;
