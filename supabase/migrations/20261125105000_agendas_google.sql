-- =====================================================================
-- Agendas do escritório no Google Agenda (tarefa #166, parte 1 de 2: as agendas e os compartilhamentos)
--   A conta Google do escritório (a mesma ligação dos contatos, 20261031120000_ligacao_google.sql) é a DONA de todas as
--   agendas. O SEMPER cria, como agendas secundárias dela: "Agenda – <nome>" para cada pessoa ativa da equipe, a "Geral",
--   uma por sala ativa e a "Administrativo". E as compartilha só para ver, por e-mail (o Google manda o convite): cada
--   pessoa vê a própria, a Geral e as das salas; os administradores, também a Administrativo. Nunca por link público.
--   - A permissão da agenda é pedida aos poucos (autorização incremental): o administrador clica em "Autorizar a agenda"
--     no cartão Conta Google, e o token novo cobre os contatos e a agenda juntos (os contatos não se desligam). O pedido
--     de ligação ganha a finalidade ('contatos' ou 'agendas'); somar a agenda só vale para a conta já ligada.
--   - As agendas no Google começam DESLIGADAS em cada escritório; o administrador liga em Configurações.
--   - O "e-mail do Google" de cada pessoa da equipe (emails_do_google): por padrão, o de entrada no SEMPER; a própria
--     pessoa e o administrador (com a mesma regra do nome: o de um administrador, só o master; o de um master, só ele)
--     podem informar outro.
--   - Quem grava no SEMPER nunca espera o Google: gatilhos põem o escritório numa FILA (agendas_google_fila) quando entra,
--     sai ou muda alguém da equipe, uma sala ou um e-mail do Google. A função do servidor google-agendas, chamada pela
--     rotina do banco a cada 2 minutos (ou pelo "Sincronizar agora"), arruma as agendas: cria as que faltam, compartilha,
--     muda o nome e retira o compartilhamento de quem saiu (a agenda fica com o escritório; reativar devolve).
--     As decisões são funções puras (supabase/functions/_compartilhado/agendasGoogle.ts).
--   - Se o Google falha, o pedido fica na fila e a tentativa se repete com esperas crescentes; a partir da 3ª falha,
--     Configurações mostra o problema. Autorização vencida ou retirada para a fila do escritório até a conta ser
--     autorizada de novo (ou o administrador pedir "Sincronizar agora").
--   - A fila já tem o "assunto" e o item: a parte 2 da #166 soma os eventos (compromissos, tarefas, prazos...).
--   Só acrescenta (colunas novas com valor padrão, tabelas, funções, gatilhos e uma rotina). A versão anterior do site
--   continua funcionando: ela não usa nada disto, e as funções antigas da ligação (ligacao_google_iniciar,
--   ligacao_pedido_conferir, ligacao_pedido_usar) continuam como eram.
-- =====================================================================

-- ---------------------------------------------------------------------
-- A permissão da agenda, pedida aos poucos
-- ---------------------------------------------------------------------

-- As permissões da agenda: as mesmas de ESCOPOS_DA_AGENDA em supabase/functions/_compartilhado/ligacao.ts.
create function privado.agenda_autorizada(p_escopos text[]) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(p_escopos, '{}') @> array['https://www.googleapis.com/auth/calendar.app.created', 'https://www.googleapis.com/auth/calendar.acls']
$$;
revoke execute on function privado.agenda_autorizada(text[]) from public, anon, authenticated;

alter table privado.ligacao_pedidos add column finalidade text not null default 'contatos' check (finalidade in ('contatos', 'agendas'));

-- Começa o pedido da permissão da agenda: só administradores, com a conta Google do escritório já ligada. Vale 10 minutos.
create function public.ligacao_google_iniciar_agendas(p_voltar_para text) returns text
language plpgsql security definer set search_path = '' as $$
declare v_estado text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  if not privado.sou_admin() then raise exception 'Apenas administradores autorizam a agenda na conta Google do escritório'; end if;
  if not exists (select 1 from privado.ligacoes l where l.escritorio_id = privado.meu_escritorio() and l.perfil_id is null and l.provedor = 'google') then
    raise exception 'Ligue a conta Google do escritório antes de autorizar a agenda';
  end if;
  delete from privado.ligacao_pedidos where pedido_em < now() - interval '10 minutes';
  insert into privado.ligacao_pedidos (estado, escritorio_id, perfil_id, provedor, voltar_para, verificador, pedido_por, finalidade)
  values (v_estado, privado.meu_escritorio(), null, 'google', p_voltar_para, privado.base64url(extensions.gen_random_bytes(48)), auth.uid(), 'agendas');
  return v_estado;
end $$;
revoke execute on function public.ligacao_google_iniciar_agendas(text) from public, anon;
grant execute on function public.ligacao_google_iniciar_agendas(text) to authenticated;

-- Ida ao Google (como ligacao_pedido_conferir), com a finalidade e, só no pedido da agenda, a conta ligada (o Google já abre nela).
create function public.ligacao_pedido_conferir_finalidade(p_estado text) returns table (voltar_para text, desafio text, finalidade text, conta_email text)
language sql stable security definer set search_path = '' as $$
  select p.voltar_para, privado.base64url(extensions.digest(p.verificador, 'sha256')), p.finalidade,
         case when p.finalidade = 'agendas' then l.conta_email end
  from privado.ligacao_pedidos p
  left join privado.ligacoes l on l.escritorio_id = p.escritorio_id and l.perfil_id is not distinct from p.perfil_id and l.provedor = p.provedor
  where p.estado = p_estado and p.pedido_em >= now() - interval '10 minutes'
$$;

-- Conclusão (como ligacao_pedido_usar, com as mesmas conferências), com a finalidade e a conta ligada agora. O pedido da
-- agenda sem conta ligada (desligada no meio do caminho) não serve: volta vazio, como um pedido vencido.
create function public.ligacao_pedido_consumir(p_estado text, p_usuario uuid, p_nivel text)
returns table (escritorio_id uuid, perfil_id uuid, provedor text, verificador text, finalidade text, conta_email text)
language plpgsql security definer set search_path = '' as $$
declare v privado.ligacao_pedidos; v_conta text;
begin
  delete from privado.ligacao_pedidos p where p.estado = p_estado and p.pedido_por = p_usuario returning * into v;
  if v.estado is null or v.pedido_em < now() - interval '10 minutes'
     or not exists (select 1 from public.perfis f where f.id = p_usuario and f.escritorio_id = v.escritorio_id
                    and f.ativo and f.papel in ('master', 'admin'))
     or (p_nivel is distinct from 'aal2'
         and exists (select 1 from auth.mfa_factors m where m.user_id = p_usuario and m.status = 'verified')) then
    return;
  end if;
  select l.conta_email into v_conta from privado.ligacoes l
  where l.escritorio_id = v.escritorio_id and l.perfil_id is not distinct from v.perfil_id and l.provedor = v.provedor;
  if v.finalidade = 'agendas' and v_conta is null then return; end if;
  return query select v.escritorio_id, v.perfil_id, v.provedor, v.verificador, v.finalidade, v_conta;
end $$;

revoke execute on function public.ligacao_pedido_conferir_finalidade(text), public.ligacao_pedido_consumir(text, uuid, text) from public, anon, authenticated;
grant execute on function public.ligacao_pedido_conferir_finalidade(text), public.ligacao_pedido_consumir(text, uuid, text) to service_role;

-- ---------------------------------------------------------------------
-- A chave e o problema das agendas, na ligação do escritório
-- ---------------------------------------------------------------------
alter table privado.ligacoes
  add column agendas_ativas          boolean not null default false,
  add column agendas_problema        text check (agendas_problema in ('autorizacao')),
  add column agendas_problema_em     timestamptz,
  add column agendas_sincronizado_em timestamptz;

-- Ligar a conta de novo, ou somar a agenda (ligacao_guardar muda o ligado_em), dá uma autorização nova: o problema some.
create function privado.ligacao_renovada_agendas() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.agendas_problema := null;
  new.agendas_problema_em := null;
  return new;
end $$;
create trigger renovada_agendas before update of ligado_em on privado.ligacoes for each row execute function privado.ligacao_renovada_agendas();

-- ---------------------------------------------------------------------
-- O e-mail do Google de cada pessoa da equipe (sem linha: o de entrada no SEMPER)
-- ---------------------------------------------------------------------
-- O tamanho é o de TAMANHO_EMAIL_DE_ACESSO (app/src/dados/limites.ts).
create table public.emails_do_google (
  perfil_id      uuid primary key references public.perfis on delete cascade,
  escritorio_id  uuid not null references public.escritorios on delete cascade,
  email          text not null check (length(email) <= 254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  atualizado_por uuid references auth.users on delete set null,
  atualizado_em  timestamptz not null default now()
);
create index emails_do_google_escritorio on public.emails_do_google (escritorio_id);
-- Cada um lê o próprio; os administradores, os do escritório. Ninguém grava pelo navegador: só email_do_google_salvar.
alter table public.emails_do_google enable row level security;
create policy leitura on public.emails_do_google for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and (perfil_id = (select auth.uid()) or (select privado.sou_admin())));
revoke all on public.emails_do_google from public, anon, authenticated;
grant select on public.emails_do_google to authenticated;
grant select, insert, update, delete on public.emails_do_google to service_role;

-- O e-mail do Google de alguém do escritório: o informado (vazio: usa o de entrada) e o de entrada (nada para a conta
-- reservada, que não tem e-mail de verdade). Só a própria pessoa e os administradores; para os outros, vazio.
create function public.email_do_google(p_perfil uuid) returns table (email text, padrao text)
language sql stable security definer set search_path = '' as $$
  select g.email, case when not f.reservada then lower(u.email) end
  from public.perfis f
  join auth.users u on u.id = f.id
  left join public.emails_do_google g on g.perfil_id = f.id
  where f.id = p_perfil and f.escritorio_id = privado.meu_escritorio() and f.excluido_em is null
    and (f.id = auth.uid() or privado.sou_admin())
$$;

-- Muda o e-mail do Google: a própria pessoa, ou um administrador com a regra do nome (equipe_definir_nome): o de um
-- administrador, só o master; o de um master, só ele mesmo. Vazio, ou igual ao de entrada, volta ao de entrada.
-- Fica no registro de ações.
create function public.email_do_google_salvar(p_perfil uuid, p_email text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_email text := lower(btrim(coalesce(p_email, ''))); v_alvo public.perfis; v_entrada text;
begin
  select * into v_alvo from public.perfis f where f.id = p_perfil and f.escritorio_id = privado.meu_escritorio() and f.excluido_em is null;
  if v_alvo.id is null then raise exception 'Usuário não encontrado'; end if;
  if p_perfil <> auth.uid() then
    if not privado.sou_admin() then raise exception 'Apenas administradores mudam o e-mail do Google de alguém da equipe'; end if;
    if v_alvo.papel = 'master' then raise exception 'Só o próprio master muda o e-mail do Google dele.'; end if;
    if v_alvo.papel = 'admin' and not exists (select 1 from public.perfis f where f.id = auth.uid() and f.papel = 'master') then
      raise exception 'Só o master muda o e-mail do Google de um administrador.';
    end if;
  end if;
  select lower(u.email) into v_entrada from auth.users u where u.id = p_perfil;
  if v_email = '' or (v_email = v_entrada and not v_alvo.reservada) then
    delete from public.emails_do_google where perfil_id = p_perfil;
  else
    if length(v_email) > 254 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
      raise exception 'Informe um e-mail válido.';
    end if;
    insert into public.emails_do_google as g (perfil_id, escritorio_id, email, atualizado_por)
    values (p_perfil, v_alvo.escritorio_id, v_email, auth.uid())
    on conflict (perfil_id) do update set email = excluded.email, atualizado_por = excluded.atualizado_por, atualizado_em = now();
  end if;
  insert into public.auditoria (escritorio_id, tabela, registro_id, acao, resumo, feito_por)
  values (v_alvo.escritorio_id, 'perfis', p_perfil::text, 'alteracao', jsonb_build_object('nome', v_alvo.nome, 'email_google', nullif(v_email, '')), auth.uid());
end $$;

revoke execute on function public.email_do_google(uuid), public.email_do_google_salvar(uuid, text) from public, anon;
grant execute on function public.email_do_google(uuid), public.email_do_google_salvar(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- As agendas criadas no Google e os compartilhamentos feitos
-- ---------------------------------------------------------------------
-- Uma agenda por tipo e dono (a pessoa ou a sala), por conta Google: ligar outra conta começa do zero nela; religar a
-- mesma reaproveita. google_id: o id que o Google deu (um e-mail longo).
create table public.agendas_google (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references public.escritorios on delete cascade,
  conta_email   text not null check (length(conta_email) <= 254),
  tipo          text not null check (tipo in ('pessoa', 'geral', 'sala', 'administrativo')),
  perfil_id     uuid references public.perfis on delete cascade,
  sala_id       uuid references public.salas on delete cascade,
  google_id     text not null check (length(google_id) <= 1024),
  nome          text not null check (length(nome) <= 300),
  criada_em     timestamptz not null default now(),
  check ((tipo = 'pessoa') = (perfil_id is not null) and (tipo = 'sala') = (sala_id is not null)),
  unique nulls not distinct (escritorio_id, conta_email, tipo, perfil_id, sala_id)
);

-- Um compartilhamento por agenda e e-mail; a regra é o id que o Google deu, guardado para retirar.
create table public.agenda_google_compartilhamentos (
  agenda_id        uuid not null references public.agendas_google on delete cascade,
  escritorio_id    uuid not null references public.escritorios on delete cascade,
  email            text not null check (length(email) <= 254),
  perfil_id        uuid references public.perfis on delete set null,
  regra            text not null check (length(regra) <= 1024),
  compartilhado_em timestamptz not null default now(),
  primary key (agenda_id, email)
);
create index agenda_google_compartilhamentos_escritorio on public.agenda_google_compartilhamentos (escritorio_id);

-- A fila: um pedido por escritório, assunto e item. 'agendas' (sem item): arrumar as agendas e os compartilhamentos do
-- escritório. A parte 2 da #166 soma os assuntos dos eventos. "versao" cresce a cada mudança, para a conclusão de uma
-- versão antiga não apagar a nova; "em_andamento_ate": o pedido está com uma execução da função até essa hora.
create table public.agendas_google_fila (
  id               uuid primary key default gen_random_uuid(),
  escritorio_id    uuid not null references public.escritorios on delete cascade,
  assunto          text not null check (assunto in ('agendas')),
  item_id          uuid,
  versao           integer not null default 1,
  pedido_em        timestamptz not null default now(),
  tentativas       integer not null default 0,
  proxima_em       timestamptz not null default now(),
  em_andamento_ate timestamptz,
  erro             text check (erro in ('autorizacao', 'temporario', 'recusado')),
  erro_detalhe     text check (length(erro_detalhe) <= 200),
  unique nulls not distinct (escritorio_id, assunto, item_id)
);
create index agendas_google_fila_devidos on public.agendas_google_fila (proxima_em);

-- Regras: cada escritório vê só as próprias linhas, e só os administradores. Ninguém grava pelo navegador.
alter table public.agendas_google enable row level security;
alter table public.agenda_google_compartilhamentos enable row level security;
alter table public.agendas_google_fila enable row level security;
create policy leitura on public.agendas_google for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and (select privado.sou_admin()));
create policy leitura on public.agenda_google_compartilhamentos for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and (select privado.sou_admin()));
create policy leitura on public.agendas_google_fila for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and (select privado.sou_admin()));
revoke all on public.agendas_google, public.agenda_google_compartilhamentos, public.agendas_google_fila from public, anon, authenticated;
grant select on public.agendas_google, public.agenda_google_compartilhamentos, public.agendas_google_fila to authenticated;
grant select, insert, update, delete on public.agendas_google, public.agenda_google_compartilhamentos, public.agendas_google_fila to service_role;

-- ---------------------------------------------------------------------
-- Os gatilhos: o que muda a equipe, as salas ou os e-mails põe o escritório na fila
-- ---------------------------------------------------------------------

-- Põe (ou renova) um pedido na fila, só se o escritório tem as agendas ligadas. Uma mudança nova depois de o Google
-- recusar (talvez já corrigida) tenta logo; nas outras falhas, a espera continua.
create function privado.agendas_google_enfileirar(p_escritorio uuid, p_assunto text, p_item uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from privado.ligacoes l
                 where l.escritorio_id = p_escritorio and l.perfil_id is null and l.provedor = 'google' and l.agendas_ativas) then
    return;
  end if;
  insert into public.agendas_google_fila as f (escritorio_id, assunto, item_id) values (p_escritorio, p_assunto, p_item)
  on conflict (escritorio_id, assunto, item_id) do update
    set versao = f.versao + 1, pedido_em = now(),
        tentativas = case when f.erro = 'recusado' then 0 else f.tentativas end,
        proxima_em = case when f.erro = 'recusado' then now() else f.proxima_em end;
end $$;
revoke execute on function privado.agendas_google_enfileirar(uuid, text, uuid) from public, anon, authenticated;

-- Alguém entra na equipe, sai (desativado ou excluído), muda de nome ou de papel (a Administrativo é dos administradores).
create function privado.agendas_google_da_equipe() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform privado.agendas_google_enfileirar(new.escritorio_id, 'agendas', null);
  return null;
end $$;
create trigger agendas_google after insert or update of nome, ativo, papel, excluido_em on public.perfis
  for each row execute function privado.agendas_google_da_equipe();

-- Uma sala nova, renomeada, desativada ou reativada.
create trigger agendas_google after insert or update of nome, ativa on public.salas
  for each row execute function privado.agendas_google_da_equipe();

-- O e-mail do Google informado, trocado ou apagado (volta ao de entrada).
create function privado.agendas_google_do_email() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform privado.agendas_google_enfileirar(coalesce(new.escritorio_id, old.escritorio_id), 'agendas', null);
  return null;
end $$;
create trigger agendas_google after insert or update or delete on public.emails_do_google
  for each row execute function privado.agendas_google_do_email();

-- O e-mail de entrada trocado: vale para quem não informou outro e-mail do Google.
create function privado.agendas_google_do_email_de_entrada() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_escritorio uuid;
begin
  select f.escritorio_id into v_escritorio from public.perfis f where f.id = new.id;
  if v_escritorio is not null then perform privado.agendas_google_enfileirar(v_escritorio, 'agendas', null); end if;
  return null;
end $$;
create trigger agendas_google_email_de_entrada after update of email on auth.users
  for each row when (old.email is distinct from new.email) execute function privado.agendas_google_do_email_de_entrada();

-- A conta ligada mudou de permissões (a agenda autorizada de novo) ou de conta (outra conta: as agendas dela começam do zero).
create function privado.agendas_google_da_ligacao() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.perfil_id is null and new.provedor = 'google' then perform privado.agendas_google_enfileirar(new.escritorio_id, 'agendas', null); end if;
  return null;
end $$;
create trigger agendas_google after update of escopos, conta_email on privado.ligacoes
  for each row when (new.agendas_ativas) execute function privado.agendas_google_da_ligacao();

-- A conta desligada: a fila das agendas do escritório esvazia (as agendas e os compartilhamentos ficam, da conta).
create function privado.agendas_google_sem_ligacao() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.perfil_id is null and old.provedor = 'google' then delete from public.agendas_google_fila f where f.escritorio_id = old.escritorio_id; end if;
  return null;
end $$;
create trigger agendas_google_sem_ligacao after delete on privado.ligacoes for each row execute function privado.agendas_google_sem_ligacao();

-- ---------------------------------------------------------------------
-- Pelo navegador (administradores)
-- ---------------------------------------------------------------------

-- Como estão as agendas do escritório. Vazio sem conta ligada ou para quem não é administrador. "autorizada": a conta deu
-- a permissão da agenda. "com_falha": pedidos que já falharam 3 vezes ou mais. O problema mais grave vem primeiro:
-- autorização > Google fora > dados recusados.
create function public.agendas_google_situacao()
returns table (ativa boolean, autorizada boolean, pendentes integer, com_falha integer, problema text, problema_em timestamptz,
               sincronizado_em timestamptz, agendas integer, compartilhamentos integer)
language sql stable security definer set search_path = '' as $$
  with l as (
    select * from privado.ligacoes l
    where l.escritorio_id = privado.meu_escritorio() and l.perfil_id is null and l.provedor = 'google' and privado.sou_admin()
  ), f as (
    select count(*)::int as pendentes,
           count(*) filter (where f.tentativas >= 3)::int as com_falha,
           bool_or(f.tentativas >= 3 and f.erro = 'temporario') as fora,
           bool_or(f.tentativas >= 3 and f.erro = 'recusado') as recusado,
           max(f.proxima_em) filter (where f.tentativas >= 3) as falhou_em
    from public.agendas_google_fila f where f.escritorio_id = (select l.escritorio_id from l)
  )
  select l.agendas_ativas, privado.agenda_autorizada(l.escopos), f.pendentes, f.com_falha,
         coalesce(l.agendas_problema, case when f.fora then 'google-fora' when f.recusado then 'recusado' end),
         case when l.agendas_problema is not null then l.agendas_problema_em when f.fora or f.recusado then f.falhou_em end,
         l.agendas_sincronizado_em,
         (select count(*)::int from public.agendas_google a where a.escritorio_id = l.escritorio_id and a.conta_email = l.conta_email),
         (select count(*)::int from public.agenda_google_compartilhamentos c join public.agendas_google a on a.id = c.agenda_id
          where a.escritorio_id = l.escritorio_id and a.conta_email = l.conta_email)
  from l, f
$$;

-- Liga ou desliga as agendas no Google (só administradores, com a conta ligada e, para ligar, a agenda autorizada).
-- Ligar põe o escritório na fila; desligar esvazia a fila (nada é apagado no Google). Fica no registro de ações.
create function public.agendas_google_ligar(p_ligar boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v privado.ligacoes;
begin
  if not privado.sou_admin() then raise exception 'Apenas administradores ligam e desligam as agendas no Google'; end if;
  select * into v from privado.ligacoes l
  where l.escritorio_id = privado.meu_escritorio() and l.perfil_id is null and l.provedor = 'google' for update;
  if v.id is null then raise exception 'Ligue a conta Google do escritório antes de ligar as agendas'; end if;
  if coalesce(p_ligar, false) and not privado.agenda_autorizada(v.escopos) then
    raise exception 'Autorize a agenda na conta Google do escritório antes de ligar as agendas';
  end if;
  update privado.ligacoes l set agendas_ativas = coalesce(p_ligar, false) where l.id = v.id returning * into v;
  if v.agendas_ativas then
    perform privado.agendas_google_enfileirar(v.escritorio_id, 'agendas', null);
  else
    delete from public.agendas_google_fila f where f.escritorio_id = v.escritorio_id;
  end if;
  insert into public.auditoria (escritorio_id, tabela, registro_id, acao, resumo, feito_por)
  values (v.escritorio_id, 'ligacoes', v.id::text, 'alteracao', jsonb_build_object('email', v.conta_email, 'agendas', v.agendas_ativas), auth.uid());
end $$;

revoke execute on function public.agendas_google_situacao(), public.agendas_google_ligar(boolean) from public, anon;
grant execute on function public.agendas_google_situacao(), public.agendas_google_ligar(boolean) to authenticated;

-- ---------------------------------------------------------------------
-- Pelas funções do servidor (chave de serviço), nunca pelo navegador
-- ---------------------------------------------------------------------

-- "Sincronizar agora": o escritório do administrador (como em contatos_google_agora), com as agendas ligadas e
-- autorizadas; o escritório entra na fila, liberado para já (as esperas e o problema de autorização são zerados: se
-- continuar falhando, a função marca de novo). Vazio se não é administrador ou se as agendas estão desligadas.
create function public.agendas_google_agora(p_usuario uuid, p_nivel text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_escritorio uuid := privado.escritorio_do_admin(p_usuario, p_nivel);
begin
  if v_escritorio is null or not exists (select 1 from privado.ligacoes l where l.escritorio_id = v_escritorio and l.perfil_id is null
                                         and l.provedor = 'google' and l.agendas_ativas and privado.agenda_autorizada(l.escopos)) then
    return null;
  end if;
  update privado.ligacoes l set agendas_problema = null, agendas_problema_em = null
  where l.escritorio_id = v_escritorio and l.perfil_id is null and l.provedor = 'google';
  perform privado.agendas_google_enfileirar(v_escritorio, 'agendas', null);
  update public.agendas_google_fila f set proxima_em = now()
  where f.escritorio_id = v_escritorio and (f.em_andamento_ate is null or f.em_andamento_ate < now());
  return v_escritorio;
end $$;

-- Os pedidos a fazer agora (de um escritório, ou de todos), já reservados para esta execução por 10 minutos (mais que o
-- tempo máximo de uma função do servidor) e com mais uma tentativa contada. Só de escritórios com as agendas ligadas e
-- autorizadas, sem problema de autorização. Quem tem menos tentativas vem primeiro. Vem com a conta ligada agora.
create function public.agendas_google_pendentes(p_escritorio uuid, p_limite integer)
returns table (id uuid, escritorio_id uuid, assunto text, item_id uuid, versao integer, tentativas integer, conta_email text)
language plpgsql security definer set search_path = '' as $$
begin
  return query
  with devidos as (
    select f.id from public.agendas_google_fila f
    join privado.ligacoes l on l.escritorio_id = f.escritorio_id and l.perfil_id is null and l.provedor = 'google'
    where l.agendas_ativas and l.agendas_problema is null and privado.agenda_autorizada(l.escopos)
      and f.proxima_em <= now() and (f.em_andamento_ate is null or f.em_andamento_ate < now())
      and (p_escritorio is null or f.escritorio_id = p_escritorio)
    order by f.tentativas, f.pedido_em
    limit greatest(coalesce(p_limite, 0), 0)
    for update of f skip locked
  ), reservados as (
    update public.agendas_google_fila f set em_andamento_ate = now() + interval '10 minutes', tentativas = f.tentativas + 1
    from devidos d where f.id = d.id
    returning f.id, f.escritorio_id, f.assunto, f.item_id, f.versao, f.tentativas
  )
  select r.id, r.escritorio_id, r.assunto, r.item_id, r.versao, r.tentativas, l.conta_email
  from reservados r
  join privado.ligacoes l on l.escritorio_id = r.escritorio_id and l.perfil_id is null and l.provedor = 'google';
end $$;

-- O estado das agendas de um escritório, para o plano (EstadoDasAgendas em _compartilhado/agendasGoogle.ts): a equipe
-- (o e-mail do Google: o informado, ou o de entrada; a conta reservada só com o informado; quem foi excluído conta como
-- desativado), as salas, as agendas já criadas na conta ligada e os compartilhamentos delas.
create function public.agendas_google_estado(p_escritorio uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  with l as (
    select l.conta_email from privado.ligacoes l where l.escritorio_id = p_escritorio and l.perfil_id is null and l.provedor = 'google'
  ), a as (
    select a.* from public.agendas_google a, l where a.escritorio_id = p_escritorio and a.conta_email = l.conta_email
  )
  select jsonb_build_object(
    'conta_email', (select conta_email from l),
    'equipe', coalesce((select jsonb_agg(jsonb_build_object(
        'perfil_id', f.id, 'nome', f.nome, 'email', coalesce(g.email, case when not f.reservada then lower(u.email) end),
        'ativo', f.ativo and f.excluido_em is null, 'admin', f.papel in ('master', 'admin')) order by f.nome)
      from public.perfis f join auth.users u on u.id = f.id left join public.emails_do_google g on g.perfil_id = f.id
      where f.escritorio_id = p_escritorio), '[]'::jsonb),
    'salas', coalesce((select jsonb_agg(jsonb_build_object('sala_id', s.id, 'nome', s.nome, 'ativa', s.ativa) order by s.nome)
      from public.salas s where s.escritorio_id = p_escritorio), '[]'::jsonb),
    'agendas', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'tipo', a.tipo, 'perfil_id', a.perfil_id, 'sala_id', a.sala_id,
        'google_id', a.google_id, 'nome', a.nome) order by a.criada_em) from a), '[]'::jsonb),
    'compartilhamentos', coalesce((select jsonb_agg(jsonb_build_object('agenda_id', c.agenda_id, 'email', c.email, 'regra', c.regra))
      from public.agenda_google_compartilhamentos c join a on a.id = c.agenda_id), '[]'::jsonb)
  )
$$;

-- A agenda criada no Google: guarda (ou troca, se já havia uma do mesmo tipo e dono nesta conta, e então os
-- compartilhamentos antigos, da agenda velha, saem). Devolve o id do SEMPER.
create function public.agendas_google_agenda_criada(p_escritorio uuid, p_conta text, p_tipo text, p_perfil uuid, p_sala uuid,
                                                    p_google text, p_nome text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  select a.id into v_id from public.agendas_google a
  where a.escritorio_id = p_escritorio and a.conta_email = lower(p_conta) and a.tipo = p_tipo
    and a.perfil_id is not distinct from p_perfil and a.sala_id is not distinct from p_sala;
  if v_id is not null then
    delete from public.agenda_google_compartilhamentos c where c.agenda_id = v_id;
    update public.agendas_google a set google_id = p_google, nome = p_nome, criada_em = now() where a.id = v_id;
    return v_id;
  end if;
  insert into public.agendas_google (escritorio_id, conta_email, tipo, perfil_id, sala_id, google_id, nome)
  values (p_escritorio, lower(p_conta), p_tipo, p_perfil, p_sala, p_google, p_nome)
  returning id into v_id;
  return v_id;
end $$;

-- O nome mudado no Google.
create function public.agendas_google_agenda_renomeada(p_agenda uuid, p_nome text) returns void
language sql security definer set search_path = '' as $$
  update public.agendas_google set nome = p_nome where id = p_agenda
$$;

-- A agenda foi apagada no Google: o SEMPER a esquece (e os compartilhamentos dela), e o próximo plano a cria de novo.
create function public.agendas_google_agenda_sumiu(p_agenda uuid) returns void
language sql security definer set search_path = '' as $$
  delete from public.agendas_google where id = p_agenda
$$;

-- O compartilhamento feito (ou refeito) no Google, com a regra para retirar depois.
create function public.agendas_google_compartilhada(p_agenda uuid, p_email text, p_perfil uuid, p_regra text) returns void
language sql security definer set search_path = '' as $$
  insert into public.agenda_google_compartilhamentos as c (agenda_id, escritorio_id, email, perfil_id, regra)
  select a.id, a.escritorio_id, lower(p_email), p_perfil, p_regra from public.agendas_google a where a.id = p_agenda
  on conflict (agenda_id, email) do update set regra = excluded.regra, perfil_id = excluded.perfil_id, compartilhado_em = now()
$$;

-- O compartilhamento retirado no Google.
create function public.agendas_google_retirada(p_agenda uuid, p_email text) returns void
language sql security definer set search_path = '' as $$
  delete from public.agenda_google_compartilhamentos where agenda_id = p_agenda and email = lower(p_email)
$$;

-- Terminou o pedido. Com p_restam (faltou tempo nesta execução), ele volta para a próxima, sem contar como tentativa
-- falha. Sem p_restam, sai da fila se ninguém mudou nada enquanto isso (senão volta, para levar a mudança nova).
create function public.agendas_google_concluir(p_pedido uuid, p_versao integer, p_restam boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_escritorio uuid;
begin
  select f.escritorio_id into v_escritorio from public.agendas_google_fila f where f.id = p_pedido;
  if v_escritorio is null then return; end if;
  if not coalesce(p_restam, false) then delete from public.agendas_google_fila f where f.id = p_pedido and f.versao = p_versao; end if;
  update public.agendas_google_fila f set em_andamento_ate = null, tentativas = 0, erro = null, erro_detalhe = null, proxima_em = now()
  where f.id = p_pedido;
  update privado.ligacoes l set agendas_sincronizado_em = now()
  where l.escritorio_id = v_escritorio and l.perfil_id is null and l.provedor = 'google';
end $$;

-- Deu errado: o pedido continua na fila e espera p_espera segundos (a função calcula, crescendo com as tentativas).
-- Autorização vencida ou retirada marca o problema na ligação: a fila do escritório para até a agenda ser autorizada de
-- novo (ou o administrador pedir "Sincronizar agora").
create function public.agendas_google_falhou(p_pedido uuid, p_erro text, p_detalhe text, p_espera integer) returns void
language plpgsql security definer set search_path = '' as $$
declare v_escritorio uuid;
begin
  update public.agendas_google_fila f
  set em_andamento_ate = null, erro = p_erro, erro_detalhe = left(p_detalhe, 200),
      proxima_em = now() + make_interval(secs => greatest(coalesce(p_espera, 0), 0))
  where f.id = p_pedido
  returning f.escritorio_id into v_escritorio;
  if p_erro = 'autorizacao' and v_escritorio is not null then
    update privado.ligacoes l set agendas_problema = 'autorizacao', agendas_problema_em = now()
    where l.escritorio_id = v_escritorio and l.perfil_id is null and l.provedor = 'google' and l.agendas_problema is null;
  end if;
end $$;

revoke execute on function public.agendas_google_agora(uuid, text), public.agendas_google_pendentes(uuid, integer), public.agendas_google_estado(uuid),
  public.agendas_google_agenda_criada(uuid, text, text, uuid, uuid, text, text), public.agendas_google_agenda_renomeada(uuid, text),
  public.agendas_google_agenda_sumiu(uuid), public.agendas_google_compartilhada(uuid, text, uuid, text), public.agendas_google_retirada(uuid, text),
  public.agendas_google_concluir(uuid, integer, boolean), public.agendas_google_falhou(uuid, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.agendas_google_agora(uuid, text), public.agendas_google_pendentes(uuid, integer), public.agendas_google_estado(uuid),
  public.agendas_google_agenda_criada(uuid, text, text, uuid, uuid, text, text), public.agendas_google_agenda_renomeada(uuid, text),
  public.agendas_google_agenda_sumiu(uuid), public.agendas_google_compartilhada(uuid, text, uuid, text), public.agendas_google_retirada(uuid, text),
  public.agendas_google_concluir(uuid, integer, boolean), public.agendas_google_falhou(uuid, text, text, integer)
  to service_role;

-- ---------------------------------------------------------------------
-- A rotina: a cada 2 minutos, chama a função do servidor se há algum pedido para agora
-- ---------------------------------------------------------------------
-- O endereço e a senha da rotina ficam no Vault (os mesmos dos contatos): sem eles, não chama nada. Os 120 segundos são
-- quanto o pedido espera a resposta (em milissegundos).
create function privado.chamar_sincronizacao_das_agendas() returns void
language plpgsql security definer set search_path = '' as $$
declare v_url text; v_senha text;
begin
  if not exists (select 1 from public.agendas_google_fila f
                 join privado.ligacoes l on l.escritorio_id = f.escritorio_id and l.perfil_id is null and l.provedor = 'google'
                 where l.agendas_ativas and l.agendas_problema is null and privado.agenda_autorizada(l.escopos)
                   and f.proxima_em <= now() and (f.em_andamento_ate is null or f.em_andamento_ate < now())) then
    return;
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'semper_url_do_projeto';
  select decrypted_secret into v_senha from vault.decrypted_secrets where name = 'semper_senha_da_rotina';
  if v_url is null or v_senha is null then
    raise warning 'Agendas no Google: faltam semper_url_do_projeto ou semper_senha_da_rotina no Vault.';
    return;
  end if;
  perform net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/google-agendas',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-senha-da-rotina', v_senha),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
end $$;

revoke execute on function privado.chamar_sincronizacao_das_agendas() from public, anon, authenticated;

select cron.schedule('sincronizar-agendas-google', '*/2 * * * *', 'select privado.chamar_sincronizacao_das_agendas()');
