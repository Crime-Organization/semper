-- =====================================================================
-- Excluir um usuário da equipe (#155)
--   Até aqui só dava para desativar. Excluir apaga o acesso e os dados pessoais que só serviam a ele: o e-mail de acesso, a
--   senha, as sessões, as duas etapas, o perfil profissional (com a data da foto), a ligação com o Google, os avisos, as
--   preferências e os acessos às informações sigilosas. O e-mail sai também do registro de ações, dos convites e do registro
--   de entradas do login. Os dois arquivos da foto saem do Storage pelo site, logo depois (o banco não apaga arquivos do Storage).
--   O perfil fica, marcado como excluído, só com o nome: quem criou, alterou, comentou, recebeu ou é responsável por algo
--   continua aparecendo com o nome, e o registro de ações continua dizendo quem fez o quê. O que estava sob a
--   responsabilidade da pessoa continua no nome dela (decisão da responsável pelo SEMPER, 10/11/2026). O cadastro da pessoa
--   em Pessoas não muda, mas passa a poder ser apagado (antes, o perfil o prendia).
--   Quem exclui: a regra de desativar (administrador exclui usuários; só o master, administradores; ninguém exclui o master
--   nem a si mesmo). Só se exclui quem já está desativado (ou é conta reservada), e não há desfazer. O dono da plataforma
--   não é excluído por aqui, como na troca de e-mail.
--   A conta no login (auth.users) não é apagada: mais de 80 colunas apontam para ela, e apagá-la tiraria o nome de quem fez
--   cada coisa. Ela fica sem e-mail de verdade, sem senha e bloqueada, como a conta reservada.
--   Só acrescenta (uma coluna, gatilhos, uma função nova e uma versão nova de equipe_email_preparar, com os mesmos parâmetros).
--   A versão anterior do site continua funcionando: ela não lê a coluna nova e mostraria o excluído como desativado; o que ela
--   tentar fazer com ele (reativar, mudar o papel, trocar o e-mail) o banco recusa.
-- =====================================================================

alter table public.perfis add column excluido_em timestamptz;
comment on column public.perfis.excluido_em is 'Quando o usuário foi excluído da equipe. O perfil fica só com o nome, para os registros antigos.';

-- Excluído não volta: nem pela reativação, nem mudando o papel, nem por quem chamar o banco direto.
create function privado.excluido_nao_volta() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.ativo or new.papel is distinct from old.papel then raise exception 'Este usuário foi excluído e não volta à equipe.'; end if;
  return new;
end $$;
create trigger excluido_nao_volta before update of ativo, papel on public.perfis
  for each row when (old.excluido_em is not null) execute function privado.excluido_nao_volta();

-- A conta de quem foi excluído não volta a ter um e-mail de verdade: fecha também a troca que já estava a caminho quando a
-- exclusão aconteceu (a função equipe-trocar-email grava o e-mail novo pelo login depois de o banco dizer "pronto").
create function privado.conta_excluida_sem_email() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email is distinct from 'excluida-' || new.id || '@excluida.invalid'
     and exists (select 1 from public.perfis f where f.id = new.id and f.excluido_em is not null) then
    raise exception 'Este usuário foi excluído da equipe.';
  end if;
  return new;
end $$;
create trigger conta_excluida_sem_email before update of email on auth.users
  for each row execute function privado.conta_excluida_sem_email();

-- O cadastro em Pessoas de quem foi excluído pode ser apagado (LGPD): o perfil deixa de apontar para ele, e o nome fica no perfil.
create function privado.soltar_perfil_excluido() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.perfis f set pessoa_id = null where f.pessoa_id = old.id and f.excluido_em is not null;
  return old;
end $$;
create trigger soltar_perfil_excluido before delete on public.pessoas
  for each row execute function privado.soltar_perfil_excluido();

create function public.equipe_excluir(p_perfil uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_alvo public.perfis; v_email text; v_marca text := 'excluida-' || p_perfil || '@excluida.invalid'; v_convites text[];
begin
  if not privado.sou_admin() then raise exception 'Apenas administradores'; end if;
  if p_perfil = auth.uid() then raise exception 'Você não pode excluir a própria conta'; end if;
  select * into v_alvo from public.perfis f where f.id = p_perfil and f.escritorio_id = privado.meu_escritorio() for update;
  if v_alvo.id is null or v_alvo.excluido_em is not null then raise exception 'Usuário não encontrado'; end if;
  if v_alvo.papel = 'master' then raise exception 'O usuário master não pode ser excluído'; end if;
  if v_alvo.papel = 'admin' and not privado.sou_master() then raise exception 'Só o master gerencia administradores'; end if;
  if v_alvo.ativo then raise exception 'Desative o usuário antes de excluir'; end if;
  select lower(u.email) into v_email from auth.users u where u.id = p_perfil;
  -- Mexer na conta do dono o tiraria da plataforma (ao_cadastrar_usuario só religa quem ainda não tem conta).
  if exists (select 1 from public.plataforma_donos d where d.usuario_id = p_perfil or d.email = v_email) then
    raise exception 'O dono da plataforma não pode ser excluído';
  end if;

  -- A conta de acesso: e-mail de marca (.invalid, RFC 2606: nada chega a ele), senha que ninguém conhece, nada pendente e
  -- login bloqueado por 100 anos (o login não aceita um bloqueio sem fim). O nome que o convite pôs nos dados da conta sai.
  update auth.users u set email = v_marca, phone = null, raw_user_meta_data = '{}'::jsonb,
    encrypted_password = extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')),
    confirmation_token = '', recovery_token = '', recovery_sent_at = null, reauthentication_token = '',
    email_change = '', email_change_token_new = '', email_change_token_current = '', email_change_confirm_status = 0, email_change_sent_at = null,
    phone_change = '', phone_change_token = '', banned_until = now() + interval '100 years', updated_at = now()
  where u.id = p_perfil;
  delete from auth.identities i where i.user_id = p_perfil;
  delete from auth.refresh_tokens t where t.user_id = p_perfil::text;
  delete from auth.sessions s where s.user_id = p_perfil;
  delete from auth.mfa_factors m where m.user_id = p_perfil;
  delete from auth.one_time_tokens t where t.user_id = p_perfil;
  -- O registro de entradas do login guarda o e-mail; ficam a data, o IP e o id (o registro de acesso que a lei pede).
  update auth.audit_log_entries e set payload = ((e.payload::jsonb - 'traits') || jsonb_build_object('actor_username', v_marca))::json
  where e.payload ->> 'actor_id' = p_perfil::text;
  update auth.audit_log_entries e set payload = (e.payload::jsonb - 'traits')::json
  where e.payload -> 'traits' ->> 'user_id' = p_perfil::text;

  -- O que só servia à pessoa enquanto usava o sistema.
  delete from public.perfil_profissional pp where pp.perfil_id = p_perfil;
  delete from privado.ligacoes l where l.perfil_id = p_perfil;
  delete from privado.ligacao_pedidos lp where lp.perfil_id = p_perfil or lp.pedido_por = p_perfil;
  delete from public.mensagens m where m.perfil_id = p_perfil;
  delete from public.resumos_de_prazos r where r.perfil_id = p_perfil;
  delete from public.quadro_colunas_ocultas q where q.perfil_id = p_perfil;
  delete from public.pessoa_sigilo_acessos a where a.perfil_id = p_perfil;
  -- Os convites dela (o usado e os pendentes): os pendentes saem, o usado fica com o e-mail de marca.
  select array_agg(c.id::text) into v_convites from public.convites c
  where c.escritorio_id = v_alvo.escritorio_id and (c.usado_por = p_perfil or c.pessoa_id = v_alvo.pessoa_id);
  delete from public.convites c where c.pessoa_id = v_alvo.pessoa_id and c.usado_em is null;
  update public.convites c set email = v_marca where c.usado_por = p_perfil;
  update public.perfis f set preferencias = '{}'::jsonb, excluido_em = now() where f.id = p_perfil;

  -- O registro de ações guarda o nome (fica) e o e-mail (sai), como esquecer_pessoa faz com os cadastros.
  update public.auditoria a set resumo = a.resumo - 'email' - 'email_antigo' - 'email_novo'
  where a.escritorio_id = v_alvo.escritorio_id
    and ((a.tabela = 'perfis' and a.registro_id = p_perfil::text) or (a.tabela = 'convites' and a.registro_id = any(v_convites)));
  insert into public.auditoria (escritorio_id, tabela, registro_id, acao, resumo, feito_por)
  values (v_alvo.escritorio_id, 'perfis', p_perfil::text, 'exclusao', jsonb_build_object('nome', v_alvo.nome), auth.uid());
end $$;

revoke execute on function public.equipe_excluir(uuid) from public, anon;
grant execute on function public.equipe_excluir(uuid) to authenticated;

-- A troca de e-mail pelo administrador recusa quem foi excluído ('sem-permissao', que o site já entende). O resto é igual à
-- versão de 20261103162000_reforco_do_aviso_da_troca.sql.
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
     or exists (select 1 from public.plataforma_donos d where d.usuario_id = p_perfil or d.email = v_atual)
     or v_alvo.excluido_em is not null then
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

  -- A trava faz duas trocas ao mesmo tempo esperarem uma pela outra, para as duas não contarem o mesmo número. Esta não atrapalha
  -- quem só grava uma linha que aponta para o escritório.
  perform 1 from public.escritorios e where e.id = v_alvo.escritorio_id for no key update;
  if (select count(*) from public.auditoria a
      where a.escritorio_id = v_alvo.escritorio_id and a.acao = 'troca_email' and a.em > now() - interval '1 hour'
        and (v_quem.papel = 'master') = exists (select 1 from public.perfis p where p.id = a.feito_por and p.papel = 'master')) >= 10 then
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
