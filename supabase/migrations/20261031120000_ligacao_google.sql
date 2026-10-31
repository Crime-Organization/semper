-- =====================================================================
-- Ligação com a conta Google (tarefa #164, parte 1: ligar e desligar)
--   O administrador liga a conta Google do escritório em Configurações. O
--   SEMPER guarda a autorização do Google (o "token de renovação") para,
--   nas próximas partes, criar e atualizar os contatos (e, na #166, as agendas).
--   - A ligação é de um provedor (hoje só o Google) e de um dono: o escritório
--     (perfil vazio: contatos, agendas do escritório) ou, no futuro, um usuário.
--   - O token fica no cofre criptografado do Supabase (Vault). Ninguém pelo
--     navegador lê o token: só as funções do servidor, com a chave de serviço.
--     Apagar a ligação (ou o escritório) apaga o token do cofre.
--   - Quem está logado vê só a conta ligada do próprio escritório (e-mail,
--     quando e por quem). Só administradores ligam e desligam.
--   - O caminho tem duas etapas, para ninguém ligar a conta Google de outra
--     pessoa ao próprio escritório mandando o link a ela:
--       1. o administrador pede a ligação (o "estado", válido 10 minutos);
--       2. depois do Google, a página de Configurações, ainda logada com quem
--          pediu, conclui a ligação com o código que só o navegador dele recebeu.
--     A conclusão confere que quem está logado é quem pediu e continua
--     administrador ativo do escritório. O pedido também leva o segredo do PKCE
--     (o Google só aceita o código com ele).
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

-- O pedido de ligação: criado quando o administrador clica em "Conectar", consumido na conclusão.
create table privado.ligacao_pedidos (
  estado        text primary key,
  escritorio_id uuid not null references public.escritorios on delete cascade,
  perfil_id     uuid references public.perfis on delete cascade,
  provedor      text not null check (provedor in ('google')),
  voltar_para   text not null check (voltar_para ~ '^https?://[^\s]+$' and length(voltar_para) <= 500),
  verificador   text not null,                                         -- o code_verifier do PKCE (nunca sai do servidor)
  pedido_por    uuid not null references auth.users on delete cascade,
  pedido_em     timestamptz not null default now()
);

revoke all on privado.ligacoes, privado.ligacao_pedidos from public, anon, authenticated;

-- Apagar uma ligação (desligar, ou o escritório e o usuário excluídos, em cascata) apaga também o token do cofre.
create function privado.apagar_segredo_da_ligacao() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from vault.secrets where id = old.segredo_id;
  return null;
end $$;
create trigger apagar_segredo after delete on privado.ligacoes for each row execute function privado.apagar_segredo_da_ligacao();

-- Texto em base64url (sem "=" no fim), como o PKCE pede.
create function privado.base64url(p bytea) returns text
language sql immutable set search_path = '' as $$
  select rtrim(translate(encode(p, 'base64'), E'+/\n', '-_'), '=')
$$;

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
  insert into privado.ligacao_pedidos (estado, escritorio_id, perfil_id, provedor, voltar_para, verificador, pedido_por)
  values (v_estado, privado.meu_escritorio(), null, 'google', p_voltar_para, privado.base64url(extensions.gen_random_bytes(48)), auth.uid());
  return v_estado;
end $$;

-- Desliga a conta Google do escritório: só administradores. Apaga a ligação (e, pelo gatilho, o token do cofre);
-- fica no registro de ações.
create function public.ligacao_google_desligar() returns void
language plpgsql security definer set search_path = '' as $$
declare v_ligacao privado.ligacoes;
begin
  if not privado.sou_admin() then raise exception 'Apenas administradores desligam a conta Google do escritório'; end if;
  delete from privado.ligacoes
  where escritorio_id = privado.meu_escritorio() and perfil_id is null and provedor = 'google'
  returning * into v_ligacao;
  if v_ligacao.id is null then return; end if;
  insert into public.auditoria (escritorio_id, tabela, registro_id, acao, resumo, feito_por)
  values (v_ligacao.escritorio_id, 'ligacoes', v_ligacao.id::text, 'exclusao', jsonb_build_object('email', v_ligacao.conta_email), auth.uid());
end $$;

revoke execute on function public.ligacao_google(), public.ligacao_google_iniciar(text), public.ligacao_google_desligar() from public, anon;
grant execute on function public.ligacao_google(), public.ligacao_google_iniciar(text), public.ligacao_google_desligar() to authenticated;

-- ---------------------------------------------------------------------
-- Pelas funções do servidor (chave de serviço), nunca pelo navegador
-- ---------------------------------------------------------------------

-- Ida ao Google: a página de volta e o desafio do PKCE de um pedido ainda válido (sem consumi-lo).
create function public.ligacao_pedido_conferir(p_estado text) returns table (voltar_para text, desafio text)
language sql stable security definer set search_path = '' as $$
  select p.voltar_para, privado.base64url(extensions.digest(p.verificador, 'sha256'))
  from privado.ligacao_pedidos p
  where p.estado = p_estado and p.pedido_em >= now() - interval '10 minutes'
$$;

-- Volta do Google: só a página de volta do pedido (mesmo vencido, para levar a pessoa de volta com o aviso).
create function public.ligacao_pedido_volta(p_estado text) returns text
language sql stable security definer set search_path = '' as $$
  select p.voltar_para from privado.ligacao_pedidos p where p.estado = p_estado
$$;

-- Conclusão: consome o pedido só se quem está logado (p_usuario, conferido pela função do servidor) é quem pediu, o
-- pedido tem menos de 10 minutos e a pessoa continua administradora ativa do mesmo escritório, com a verificação em
-- duas etapas feita nesta sessão (p_nivel = 'aal2') se ela a ativou, como em privado.sou_admin(). Devolve o escritório,
-- o dono e o verificador do PKCE; vazio em qualquer outro caso (e o pedido de outro usuário não é tocado).
create function public.ligacao_pedido_usar(p_estado text, p_usuario uuid, p_nivel text)
returns table (escritorio_id uuid, perfil_id uuid, provedor text, verificador text)
language plpgsql security definer set search_path = '' as $$
declare v privado.ligacao_pedidos;
begin
  delete from privado.ligacao_pedidos p where p.estado = p_estado and p.pedido_por = p_usuario returning * into v;
  if v.estado is null or v.pedido_em < now() - interval '10 minutes'
     or not exists (select 1 from public.perfis f where f.id = p_usuario and f.escritorio_id = v.escritorio_id
                    and f.ativo and f.papel in ('master', 'admin'))
     or (p_nivel is distinct from 'aal2'
         and exists (select 1 from auth.mfa_factors m where m.user_id = p_usuario and m.status = 'verified')) then
    return;
  end if;
  return query select v.escritorio_id, v.perfil_id, v.provedor, v.verificador;
end $$;

-- Guarda (ou troca) a ligação: o token vai para o cofre; a ligação anterior do mesmo dono é substituída. Devolve a
-- conta e o token antigos (se havia), para a função do servidor revogar no Google o token da conta que saiu. A trava
-- faz duas conclusões ao mesmo tempo, para o mesmo dono, irem uma depois da outra (a segunda troca a primeira).
create function public.ligacao_guardar(p_escritorio uuid, p_perfil uuid, p_provedor text, p_email text, p_escopos text[],
                                       p_token text, p_ligado_por uuid) returns table (email_antigo text, token_antigo text)
language plpgsql security definer set search_path = '' as $$
declare v_antiga privado.ligacoes; v_token_antigo text; v_segredo uuid; v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('ligacao:' || p_escritorio || ':' || coalesce(p_perfil::text, '') || ':' || p_provedor, 0));
  select * into v_antiga from privado.ligacoes
  where escritorio_id = p_escritorio and perfil_id is not distinct from p_perfil and provedor = p_provedor;
  if v_antiga.id is not null then
    select s.decrypted_secret into v_token_antigo from vault.decrypted_secrets s where s.id = v_antiga.segredo_id;
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
  return query select v_antiga.conta_email, v_token_antigo;
end $$;

-- O token de renovação de uma ligação (para as próximas partes: sincronizar contatos e agendas).
create function public.ligacao_token(p_escritorio uuid, p_perfil uuid, p_provedor text) returns text
language sql stable security definer set search_path = '' as $$
  select s.decrypted_secret from privado.ligacoes l join vault.decrypted_secrets s on s.id = l.segredo_id
  where l.escritorio_id = p_escritorio and l.perfil_id is not distinct from p_perfil and l.provedor = p_provedor
$$;

revoke execute on function public.ligacao_pedido_conferir(text), public.ligacao_pedido_volta(text), public.ligacao_pedido_usar(text, uuid, text),
  public.ligacao_guardar(uuid, uuid, text, text, text[], text, uuid), public.ligacao_token(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.ligacao_pedido_conferir(text), public.ligacao_pedido_volta(text), public.ligacao_pedido_usar(text, uuid, text),
  public.ligacao_guardar(uuid, uuid, text, text, text[], text, uuid), public.ligacao_token(uuid, uuid, text)
  to service_role;
