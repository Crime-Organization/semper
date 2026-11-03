-- =====================================================================
-- Reforço do aviso de troca de e-mail pelo administrador (tarefa #226)
--   Limite de trocas por escritório, por hora, e reenvio automático dos avisos que falharam ou não foram confirmados.
--   Só acrescenta: duas funções novas, a rotina e uma regra nova na função de preparo. A versão anterior do site continua
--   funcionando; se ela encontrar o limite, mostra o erro genérico da troca.
-- =====================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- A mesma função de 20261103140000_trocar_email_pelo_administrador.sql, com o limite antes de mexer na conta. Cada troca desconecta
-- uma pessoa e gasta envios da caixa que todos os escritórios usam: são 10 por hora por escritório (TROCAS_DE_EMAIL_POR_HORA em
-- app/src/dados/limites.ts). As tentativas que falharam contam, porque também desconectam a pessoa.
create or replace function public.equipe_email_preparar(p_usuario uuid, p_nivel text, p_perfil uuid, p_email text)
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

  -- A trava faz duas trocas ao mesmo tempo esperarem uma pela outra, para as duas não contarem o mesmo número.
  perform 1 from public.escritorios e where e.id = v_alvo.escritorio_id for update;
  if (select count(*) from public.auditoria a
      where a.escritorio_id = v_alvo.escritorio_id and a.acao = 'troca_email' and a.em > now() - interval '1 hour') >= 10 then
    return query select 'limite'::text, null::bigint;
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

-- Os avisos a reenviar, já marcados com mais uma tentativa: se a função cair no meio, esta tentativa conta, e o aviso não fica
-- em repetição sem fim. Entram os que falharam e os sem marca (o envio não chegou ao fim). São até 3 reenvios, nas 24 horas depois
-- da troca, e 5 por vez, para não gastar a caixa; os 5 minutos de folga são mais que o tempo máximo da função que está enviando.
-- Quem teve menos tentativas vem primeiro: com o SMTP fora do ar, os avisos mais antigos não passam na frente dos outros.
-- A situação vem do que a conta tem agora: se o e-mail não é o novo, a troca não aconteceu de fato e o aviso diz que não foi confirmada.
create function public.equipe_email_avisos_pendentes()
returns table (registro bigint, situacao text, destinos text[])
language sql security definer set search_path = '' as $$
  with devidos as (
    select a.id from public.auditoria a
    where a.acao = 'troca_email'
      and a.em between now() - interval '24 hours' and now() - interval '5 minutes'
      and a.resumo ->> 'situacao' is distinct from 'falhou'
      and (a.resumo -> 'aviso_falhas' is null or jsonb_array_length(a.resumo -> 'aviso_falhas') > 0)
      and coalesce((a.resumo ->> 'aviso_reenvios')::int, 0) < 3
    order by coalesce((a.resumo ->> 'aviso_reenvios')::int, 0), a.em
    limit 5
    for update skip locked
  )
  update public.auditoria a
  set resumo = a.resumo || jsonb_build_object('aviso_reenvios', coalesce((a.resumo ->> 'aviso_reenvios')::int, 0) + 1)
  from devidos d, auth.users u
  where a.id = d.id and u.id::text = a.registro_id
  returning a.id,
    case when lower(u.email) = a.resumo ->> 'email_novo' then 'trocada' else 'nao-confirmada' end,
    case when a.resumo -> 'aviso_falhas' is null then array['antigo', 'gestao']
         else array(select jsonb_array_elements_text(a.resumo -> 'aviso_falhas')) end
$$;

revoke execute on function public.equipe_email_avisos_pendentes() from public, anon, authenticated;
grant execute on function public.equipe_email_avisos_pendentes() to service_role;

-- Chama a função do servidor. O endereço e a senha da rotina ficam no Vault, nunca no código: sem eles (banco local ou antes de
-- uma pessoa configurar), não chama nada. Os 120 segundos são quanto o pedido espera a resposta (em milissegundos).
create function privado.chamar_reenvio_de_avisos() returns void
language plpgsql security definer set search_path = '' as $$
declare v_url text; v_senha text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'semper_url_do_projeto';
  select decrypted_secret into v_senha from vault.decrypted_secrets where name = 'semper_senha_da_rotina';
  if v_url is null or v_senha is null then
    raise warning 'Reenvio de avisos: faltam semper_url_do_projeto ou semper_senha_da_rotina no Vault.';
    return;
  end if;
  perform net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/equipe-reenviar-avisos',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-senha-da-rotina', v_senha),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
end $$;

revoke execute on function privado.chamar_reenvio_de_avisos() from public, anon, authenticated;

-- A cada 15 minutos.
select cron.schedule('reenviar-avisos-de-troca', '*/15 * * * *', 'select privado.chamar_reenvio_de_avisos()');
