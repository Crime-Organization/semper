-- =====================================================================
-- Conta reservada: alguém da equipe que não entra no sistema (#215)
--   Para constar como responsável ou participante de um contrato, a pessoa precisa de um perfil, e o perfil precisa de uma conta de
--   login. Quem saiu do escritório, ou ainda não usa o sistema, ganha uma conta reservada: e-mail de marca (nenhum e-mail de verdade
--   é guardado), senha que ninguém conhece, bloqueada no login e com o perfil desativado.
--   A função equipe-reservar-conta faz a ordem: preparar (o banco decide se pode e cria o convite de uso único), criar a conta no
--   login com a chave de serviço (o gatilho ao_cadastrar_usuario cria o perfil a partir do convite) e concluir. Se o login recusar,
--   desistir apaga o convite.
--   Só acrescenta (uma coluna, um gatilho e funções). A versão anterior do site continua funcionando: ela não lê a coluna nova.
-- =====================================================================

alter table public.perfis add column reservada boolean not null default false;
comment on column public.perfis.reservada is 'Conta reservada: consta na equipe, sem acesso ao sistema.';

alter table public.auditoria drop constraint auditoria_acao_check;
alter table public.auditoria add constraint auditoria_acao_check
  check (acao in ('inclusao', 'alteracao', 'exclusao', 'leitura', 'exportacao', 'importacao', 'troca_email', 'reserva_conta'));

-- Reativar não é o caminho de dar acesso: o login continua bloqueado e o e-mail é de marca. Dar acesso vira uma tarefa própria.
create function privado.conta_reservada_nao_reativa() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.reservada and new.ativo then raise exception 'Esta conta está reservada: a pessoa não tem acesso ao sistema.'; end if;
  return new;
end $$;
create trigger reservada_nao_reativa before update of ativo on public.perfis
  for each row when (old.reservada) execute function privado.conta_reservada_nao_reativa();

-- Só um administrador ativo reserva, para uma pessoa do próprio escritório que ainda não é da equipe. Quem usa duas etapas precisa
-- estar com elas confirmadas nesta sessão. Uma tentativa anterior que não terminou é substituída.
create function public.equipe_reserva_preparar(p_usuario uuid, p_nivel text, p_pessoa uuid)
returns table (resultado text, email text, codigo text)
language plpgsql security definer set search_path = '' as $$
declare v_quem public.perfis; v_pessoa public.pessoas; v_email text; v_convite uuid;
begin
  select * into v_quem from public.perfis f where f.id = p_usuario and f.ativo and f.papel in ('master', 'admin');
  select * into v_pessoa from public.pessoas p where p.id = p_pessoa for update;
  if v_quem.id is null or v_pessoa.id is null or v_pessoa.escritorio_id <> v_quem.escritorio_id
     or (p_nivel is distinct from 'aal2'
         and exists (select 1 from auth.mfa_factors m where m.user_id = p_usuario and m.status = 'verified')) then
    return query select 'sem-permissao'::text, null::text, null::text;
    return;
  end if;
  if exists (select 1 from public.perfis f where f.pessoa_id = p_pessoa) then
    return query select 'ja-na-equipe'::text, null::text, null::text;
    return;
  end if;
  delete from public.convites c where c.pessoa_id = p_pessoa and c.usado_em is null and c.email like '%@reservada.invalid';
  if exists (select 1 from public.convites c where c.pessoa_id = p_pessoa and c.usado_em is null) then
    return query select 'convite-pendente'::text, null::text, null::text;
    return;
  end if;
  -- .invalid é reservado pela RFC 2606: nenhum e-mail chega a este endereço.
  v_email := 'conta-' || gen_random_uuid() || '@reservada.invalid';
  insert into public.convites (escritorio_id, email, nome, papel, pessoa_id, criado_por)
  values (v_quem.escritorio_id, v_email, v_pessoa.nome, 'usuario', p_pessoa, p_usuario)
  returning id into v_convite;
  return query select 'pronto'::text, v_email, privado.novo_codigo_convite(v_convite);
end $$;

-- Marca o perfil que o login acabou de criar, e fica no registro de ações.
create function public.equipe_reserva_concluir(p_usuario uuid, p_email text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_quem public.perfis; v_alvo public.perfis;
begin
  select * into v_quem from public.perfis f where f.id = p_usuario and f.ativo and f.papel in ('master', 'admin');
  select f.* into v_alvo from public.perfis f join auth.users u on u.id = f.id
  where lower(u.email) = lower(p_email) and p_email like '%@reservada.invalid';
  if v_quem.id is null or v_alvo.id is null or v_alvo.escritorio_id <> v_quem.escritorio_id then
    raise exception 'Conta reservada não encontrada.';
  end if;
  update public.perfis f set ativo = false, reservada = true where f.id = v_alvo.id;
  insert into public.auditoria (escritorio_id, tabela, registro_id, acao, resumo, feito_por)
  values (v_alvo.escritorio_id, 'perfis', v_alvo.id::text, 'reserva_conta', jsonb_build_object('nome', v_alvo.nome), p_usuario);
end $$;

-- O login recusou: o convite que sobrou não serve para nada.
create function public.equipe_reserva_desistir(p_usuario uuid, p_email text) returns void
language sql security definer set search_path = '' as $$
  delete from public.convites c
  where c.email = lower(p_email) and c.email like '%@reservada.invalid' and c.usado_em is null
    and c.escritorio_id = (select f.escritorio_id from public.perfis f where f.id = p_usuario and f.ativo and f.papel in ('master', 'admin'))
$$;

revoke execute on function public.equipe_reserva_preparar(uuid, text, uuid), public.equipe_reserva_concluir(uuid, text), public.equipe_reserva_desistir(uuid, text)
  from public, anon, authenticated;
grant execute on function public.equipe_reserva_preparar(uuid, text, uuid), public.equipe_reserva_concluir(uuid, text), public.equipe_reserva_desistir(uuid, text)
  to service_role;
