-- =====================================================================
-- O administrador troca o e-mail de acesso de quem perdeu o e-mail antigo (tarefa #222)
--   A troca em si é feita pela função do servidor equipe-trocar-email, com a chave de serviço, no login do Supabase.
--   Estas funções do banco decidem se ela pode acontecer e deixam o rastro; só a chave de serviço as chama.
--   Só acrescenta (uma ação nova no registro e duas funções novas): a versão anterior do site continua funcionando.
-- =====================================================================

alter table public.auditoria drop constraint auditoria_acao_check;
alter table public.auditoria add constraint auditoria_acao_check
  check (acao in ('inclusao', 'alteracao', 'exclusao', 'leitura', 'exportacao', 'importacao', 'troca_email'));

-- Antes da troca: confere tudo, tira da conta o que dava acesso pelo e-mail antigo e registra a ação. O registro vem antes de
-- propósito: se a função do servidor cair no meio, sobra um registro a mais, nunca uma troca sem registro. As regras são as
-- de Desativar na tela de Equipe, com a verificação em duas etapas como em privado.sou_admin(); p_usuario e p_nivel vêm da
-- sessão, conferida pela função do servidor.
-- Duas contas ficam mais protegidas, porque tomá-las daria mais do que o administrador já tem:
--   o dono da plataforma, que enxerga todos os escritórios (nem o master troca);
--   quem alcança informações sigilosas, que um administrador não vê (privado.pode_ver_sigilos; só o master, que já as vê, troca).
-- A limpeza fica aqui, na mesma transação da autorização: se o banco não puder fazê-la, nada muda. Se o login recusar a troca
-- em seguida, a pessoa só precisa entrar de novo. Saem os pedidos de troca e os links ainda válidos (um pedido parado poderia
-- trocar o e-mail de novo mais tarde) e as sessões abertas (quem invadiu o e-mail antigo não pode continuar logado).
create function public.equipe_email_preparar(p_usuario uuid, p_nivel text, p_perfil uuid, p_email text)
returns table (resultado text, registro bigint)
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(btrim(p_email));
  v_quem public.perfis; v_alvo public.perfis; v_atual text; v_registro bigint;
begin
  select * into v_quem from public.perfis f where f.id = p_usuario and f.ativo and f.papel in ('master', 'admin');
  select * into v_alvo from public.perfis f where f.id = p_perfil for update;
  select lower(u.email) into v_atual from auth.users u where u.id = p_perfil;
  if v_quem.id is null or v_alvo.id is null or v_alvo.escritorio_id <> v_quem.escritorio_id or v_alvo.id = v_quem.id
     or v_alvo.papel = 'master' or (v_alvo.papel = 'admin' and v_quem.papel <> 'master')
     or (p_nivel is distinct from 'aal2'
         and exists (select 1 from auth.mfa_factors m where m.user_id = p_usuario and m.status = 'verified'))
     or exists (select 1 from public.plataforma_donos d where d.usuario_id = p_perfil or d.email = v_atual) then
    return query select 'sem-permissao'::text, null::bigint;
    return;
  end if;
  if v_quem.papel <> 'master'
     and (exists (select 1 from public.pessoa_sigilo_acessos a where a.perfil_id = p_perfil)
          or exists (select 1 from public.pessoa_sigilos s where s.criado_por = p_perfil)
          or exists (select 1 from public.pessoa_sigilos s join public.pessoas x on x.id = s.pessoa_id where x.criado_por = p_perfil)) then
    return query select 'so-o-master'::text, null::bigint;
    return;
  end if;
  -- A mesma regra do e-mail que o login aceita (app/src/regras/conta.ts); 254 é TAMANHO_EMAIL_DE_ACESSO em app/src/dados/limites.ts.
  if v_email is null or length(v_email) > 254 or v_email !~ '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$' then
    return query select 'email-invalido'::text, null::bigint;
    return;
  end if;
  if exists (select 1 from auth.users u where lower(u.email) = v_email or (lower(u.email_change) = v_email and u.id <> p_perfil))
     or exists (select 1 from public.plataforma_donos d where d.email = v_email) then
    return query select 'email-em-uso'::text, null::bigint;
    return;
  end if;
  if exists (select 1 from public.convites c where c.email = v_email and c.usado_em is null) then
    return query select 'convite-pendente'::text, null::bigint;
    return;
  end if;

  update auth.users u set email_change = '', email_change_token_new = '', email_change_token_current = '',
    email_change_confirm_status = 0, email_change_sent_at = null, recovery_token = '', recovery_sent_at = null
  where u.id = p_perfil;
  delete from auth.one_time_tokens t where t.user_id = p_perfil;
  delete from auth.sessions s where s.user_id = p_perfil;

  insert into public.auditoria (escritorio_id, tabela, registro_id, acao, resumo, feito_por)
  values (v_alvo.escritorio_id, 'perfis', p_perfil::text, 'troca_email',
          jsonb_build_object('nome', v_alvo.nome, 'email_antigo', v_atual, 'email_novo', v_email), p_usuario)
  returning id into v_registro;
  return query select 'pronto'::text, v_registro;
end $$;

-- O login recusou a troca: o registro passa a dizer que ela não aconteceu (a tentativa continua registrada).
create function public.equipe_email_falhou(p_registro bigint) returns void
language sql security definer set search_path = '' as $$
  update public.auditoria set resumo = resumo || '{"situacao": "falhou"}'::jsonb where id = p_registro and acao = 'troca_email'
$$;

revoke execute on function public.equipe_email_preparar(uuid, text, uuid, text), public.equipe_email_falhou(bigint)
  from public, anon, authenticated;
grant execute on function public.equipe_email_preparar(uuid, text, uuid, text), public.equipe_email_falhou(bigint)
  to service_role;
