-- =====================================================================
-- Ligação com a conta Google (tarefa #164, parte 1: ligar e desligar)
--   O administrador liga a conta Google do escritório em Configurações. O
--   SEMPER guarda a autorização do Google (o "token de renovação") para,
--   nas próximas partes, criar e atualizar os contatos (e, na #166, as agendas).
--   - A ligação é de um provedor (hoje só o Google) e de um dono: o escritório
--     (perfil vazio: contatos, agendas do escritório) ou, no futuro, um usuário.
--   - O token fica no cofre criptografado do Supabase (Vault). Ninguém pelo
--     navegador lê o token: só as funções do servidor, com a chave de serviço.
--   - Quem está logado vê só a conta ligada do próprio escritório (e-mail,
--     quando e por quem). Só administradores ligam e desligam.
--   - O pedido de ligação vale por 10 minutos e é usado uma vez só (o "estado"
--     que vai ao Google e volta), para ninguém ligar uma conta em nome de outro
--     escritório.
--   Só acrescenta (tabelas, funções e regras novas). A versão anterior do site
--   continua funcionando (ela não usa a ligação).
-- =====================================================================

create extension if not exists supabase_vault with schema vault;

create table privado.ligacoes (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references public.escritorios on delete cascade,
  perfil_id     uuid references public.perfis on delete cascade,      -- vazio: a ligação é do escritório
  provedor      text not null check (provedor in ('google')),
  conta_email   text not null check (length(conta_email) <= 254),
  escopos       text[] not null default '{}',
  segredo_id    uuid not null,                                         -- o token de renovação, no Vault
  ligado_por    uuid references auth.users on delete set null,
  ligado_em     timestamptz not null default now(),
  unique nulls not distinct (escritorio_id, perfil_id, provedor)
);

-- O pedido de ligação: criado quando o administrador clica em "Conectar", conferido e apagado na volta do Google.
create table privado.ligacao_pedidos (
  estado        text primary key,
  escritorio_id uuid not null references public.escritorios on delete cascade,
  perfil_id     uuid references public.perfis on delete cascade,
  provedor      text not null check (provedor in ('google')),
  voltar_para   text not null check (voltar_para ~ '^https?://[^\s]+$' and length(voltar_para) <= 500),
  pedido_por    uuid not null references auth.users on delete cascade,
  pedido_em     timestamptz not null default now()
);

revoke all on privado.ligacoes, privado.ligacao_pedidos from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Pelo navegador (quem está logado)
-- ---------------------------------------------------------------------

-- A conta Google ligada ao escritório: e-mail, quando e por quem (nunca o token). Vazio: nenhuma conta ligada.
create function public.ligacao_google() returns table (conta_email text, escopos text[], ligado_em timestamptz, ligado_por uuid)
language sql stable security definer set search_path = '' as $$
  select l.conta_email, l.escopos, l.ligado_em, l.ligado_por
  from privado.ligacoes l
  where l.escritorio_id = privado.meu_escritorio() and l.perfil_id is null and l.provedor = 'google'
$$;

-- Começa a ligação: só administradores. Devolve o "estado" que vai ao Google e volta; vale 10 minutos.
-- "voltar_para" é a página do SEMPER para onde o Google devolve a pessoa (a função do servidor confere o endereço).
create function public.ligacao_google_iniciar(p_voltar_para text) returns text
language plpgsql security definer set search_path = '' as $$
declare v_estado text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  if not privado.sou_admin() then raise exception 'Apenas administradores ligam a conta Google do escritório'; end if;
  delete from privado.ligacao_pedidos where pedido_em < now() - interval '10 minutes';
  insert into privado.ligacao_pedidos (estado, escritorio_id, perfil_id, provedor, voltar_para, pedido_por)
  values (v_estado, privado.meu_escritorio(), null, 'google', p_voltar_para, auth.uid());
  return v_estado;
end $$;

-- Desliga a conta Google do escritório: só administradores. Apaga a ligação e o token do cofre; fica no registro de ações.
create function public.ligacao_google_desligar() returns void
language plpgsql security definer set search_path = '' as $$
declare v_ligacao privado.ligacoes;
begin
  if not privado.sou_admin() then raise exception 'Apenas administradores desligam a conta Google do escritório'; end if;
  delete from privado.ligacoes
  where escritorio_id = privado.meu_escritorio() and perfil_id is null and provedor = 'google'
  returning * into v_ligacao;
  if v_ligacao.id is null then return; end if;
  delete from vault.secrets where id = v_ligacao.segredo_id;
  insert into public.auditoria (escritorio_id, tabela, registro_id, acao, resumo, feito_por)
  values (v_ligacao.escritorio_id, 'ligacoes', v_ligacao.id::text, 'exclusao', jsonb_build_object('email', v_ligacao.conta_email), auth.uid());
end $$;

revoke execute on function public.ligacao_google(), public.ligacao_google_iniciar(text), public.ligacao_google_desligar() from public, anon;
grant execute on function public.ligacao_google(), public.ligacao_google_iniciar(text), public.ligacao_google_desligar() to authenticated;

-- ---------------------------------------------------------------------
-- Pelas funções do servidor (chave de serviço), nunca pelo navegador
-- ---------------------------------------------------------------------

-- Confere e consome o pedido: devolve o escritório, o dono, a página de volta e quem pediu, se o estado existe e
-- tem menos de 10 minutos. O pedido é apagado em qualquer caso (vale uma vez só).
create function public.ligacao_pedido_usar(p_estado text)
returns table (escritorio_id uuid, perfil_id uuid, provedor text, voltar_para text, pedido_por uuid)
language sql security definer set search_path = '' as $$
  delete from privado.ligacao_pedidos p where p.estado = p_estado
  returning p.escritorio_id, p.perfil_id, p.provedor,
    case when p.pedido_em >= now() - interval '10 minutes' then p.voltar_para end, p.pedido_por
$$;

-- A página de volta de um pedido ainda válido, sem consumi-lo (a ida ao Google confere o estado antes de redirecionar).
create function public.ligacao_pedido_conferir(p_estado text) returns text
language sql stable security definer set search_path = '' as $$
  select p.voltar_para from privado.ligacao_pedidos p where p.estado = p_estado and p.pedido_em >= now() - interval '10 minutes'
$$;

-- Guarda (ou troca) a ligação: o token vai para o cofre; a ligação anterior do mesmo dono é substituída.
create function public.ligacao_guardar(p_escritorio uuid, p_perfil uuid, p_provedor text, p_email text, p_escopos text[],
                                       p_token text, p_ligado_por uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_antiga privado.ligacoes; v_segredo uuid; v_id uuid;
begin
  select * into v_antiga from privado.ligacoes
  where escritorio_id = p_escritorio and perfil_id is not distinct from p_perfil and provedor = p_provedor;
  if v_antiga.id is not null then
    perform vault.update_secret(v_antiga.segredo_id, p_token);
    update privado.ligacoes set conta_email = lower(p_email), escopos = p_escopos, ligado_por = p_ligado_por, ligado_em = now()
    where id = v_antiga.id;
    v_id := v_antiga.id;
  else
    v_segredo := vault.create_secret(p_token, 'ligacao-' || p_provedor || '-' || gen_random_uuid(), 'Token de renovação de uma ligação do SEMPER');
    insert into privado.ligacoes (escritorio_id, perfil_id, provedor, conta_email, escopos, segredo_id, ligado_por)
    values (p_escritorio, p_perfil, p_provedor, lower(p_email), p_escopos, v_segredo, p_ligado_por)
    returning id into v_id;
  end if;
  insert into public.auditoria (escritorio_id, tabela, registro_id, acao, resumo, feito_por)
  values (p_escritorio, 'ligacoes', v_id::text, case when v_antiga.id is null then 'inclusao' else 'alteracao' end,
          jsonb_build_object('email', lower(p_email)), p_ligado_por);
end $$;

-- O token de renovação de uma ligação (para as próximas partes: sincronizar contatos e agendas).
create function public.ligacao_token(p_escritorio uuid, p_perfil uuid, p_provedor text) returns text
language sql stable security definer set search_path = '' as $$
  select s.decrypted_secret from privado.ligacoes l join vault.decrypted_secrets s on s.id = l.segredo_id
  where l.escritorio_id = p_escritorio and l.perfil_id is not distinct from p_perfil and l.provedor = p_provedor
$$;

revoke execute on function public.ligacao_pedido_usar(text), public.ligacao_pedido_conferir(text),
  public.ligacao_guardar(uuid, uuid, text, text, text[], text, uuid), public.ligacao_token(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.ligacao_pedido_usar(text), public.ligacao_pedido_conferir(text),
  public.ligacao_guardar(uuid, uuid, text, text, text[], text, uuid), public.ligacao_token(uuid, uuid, text)
  to service_role;
