-- =====================================================================
-- A primeira sincronização com o Google Contatos (tarefa #164, etapa 2 de 2)
--   Ao ligar a sincronização (20261120205439_contatos_google.sql), a conta Google do escritório quase sempre já tem os
--   contatos dos clientes. Antes de criar qualquer contato, a função do servidor google-sincronizar faz a PRIMEIRA
--   SINCRONIZAÇÃO: lê todos os contatos da conta, compara com as pessoas do escritório (por telefone, e-mail e nome, nas
--   regras de supabase/functions/_compartilhado/correspondenciaDeContatos.ts) e:
--   - liga à pessoa os contatos certos (contatos_google), sem mudar nada no Google;
--   - guarda os duvidosos na lista "Para conferir" (contatos_google_conferir), que o administrador vê em Configurações e
--     resolve: liga a uma pessoa, marca como "é outra pessoa" (o SEMPER cria um contato novo para ela) ou ignora;
--   - só então põe na fila quem ficou sem contato, para a fila criar os contatos novos.
--   Enquanto a primeira sincronização não termina, a fila do escritório espera (nada é criado no Google). E quem está numa
--   dúvida ainda aberta também espera: só vai ao Google depois da decisão.
--   A primeira sincronização é refeita sempre que a sincronização é ligada de novo ou a conta muda (os contatos já ligados
--   ficam; as dúvidas já decididas não voltam, nem depois de desligar a conta e ligá-la de novo).
--   Só acrescenta (colunas novas com valor padrão, uma tabela, funções novas, gatilhos novos, e funções da etapa 1 trocadas
--   por outras com a mesma assinatura). A versão anterior do site continua funcionando: ela não usa nada disto.
-- =====================================================================

-- ---------------------------------------------------------------------
-- A primeira sincronização, na ligação do escritório
-- ---------------------------------------------------------------------
-- contatos_primeira_em: quando terminou nesta conta (vazio: falta fazer). As tentativas, a espera, a reserva (uma execução
-- de cada vez) e o último erro seguem o modelo da fila.
alter table privado.ligacoes
  add column contatos_primeira_em           timestamptz,
  add column contatos_primeira_tentativas   integer not null default 0,
  add column contatos_primeira_proxima_em   timestamptz not null default now(),
  add column contatos_primeira_reservada_ate timestamptz,
  -- 'interno': o erro foi do próprio SEMPER (o banco recusou ou não respondeu), não do Google.
  add column contatos_primeira_erro         text check (contatos_primeira_erro in ('autorizacao', 'temporario', 'recusado', 'interno')),
  add column contatos_primeira_detalhe      text check (length(contatos_primeira_detalhe) <= 200);

-- ---------------------------------------------------------------------
-- A lista "Para conferir": um contato da conta Google que pode ser de uma (ou mais) pessoas do escritório
-- ---------------------------------------------------------------------
-- Guarda só o que ajuda a decidir (nome, telefones, e-mails, aniversário), lido do Google na primeira sincronização.
-- A decisão fica na linha (decisao, decidido_em, decidido_por): uma dúvida já decidida não volta numa próxima primeira
-- sincronização. Os tamanhos seguem os de correspondenciaDeContatos.ts (TAMANHO_DO_NOME_PARA_CONFERIR e afins).
create table public.contatos_google_conferir (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references public.escritorios on delete cascade,
  conta_email   text not null check (length(conta_email) <= 254),
  recurso       text not null check (recurso ~ '^people/[A-Za-z0-9_-]+$' and length(recurso) <= 200),
  etag          text check (length(etag) <= 200),
  nome          text check (length(nome) <= 200),
  telefones     text[] not null default '{}' check (cardinality(telefones) <= 10 and length(array_to_string(telefones, '')) <= 2540),
  emails        text[] not null default '{}' check (cardinality(emails) <= 10 and length(array_to_string(emails, '')) <= 2540),
  aniversario   text check (aniversario ~ '^([0-9]{4}-)?[0-9]{2}-[0-9]{2}$'),
  motivo        text not null check (motivo in ('varios', 'so-nome', 'conflito', 'repetido')),
  candidatos    uuid[] not null default '{}' check (cardinality(candidatos) <= 20),
  criado_em     timestamptz not null default now(),
  decisao       text check (decisao in ('ligada', 'outra', 'ignorada')),
  pessoa_id     uuid references public.pessoas on delete set null,
  decidido_em   timestamptz,
  decidido_por  uuid references auth.users on delete set null,
  unique (escritorio_id, conta_email, recurso)
);
create index contatos_google_conferir_abertos on public.contatos_google_conferir (escritorio_id, conta_email) where decisao is null;

-- Só os administradores do escritório leem; ninguém grava pelo navegador (só as funções abaixo).
alter table public.contatos_google_conferir enable row level security;
create policy leitura on public.contatos_google_conferir for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and (select privado.sou_admin()));
revoke all on public.contatos_google_conferir from public, anon, authenticated;
grant select on public.contatos_google_conferir to authenticated;
grant select, insert, update, delete on public.contatos_google_conferir to service_role;

-- A pessoa está numa dúvida ainda aberta na conta ligada agora, sem contato nessa conta: não vai ao Google até a decisão
-- (senão a fila criaria uma cópia do contato que pode ser dela).
create function privado.contato_google_em_duvida(p_pessoa uuid, p_escritorio uuid, p_conta text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.contatos_google_conferir k
                 where k.escritorio_id = p_escritorio and k.conta_email = p_conta and k.decisao is null and p_pessoa = any(k.candidatos))
     and not exists (select 1 from public.contatos_google c where c.pessoa_id = p_pessoa and c.conta_email = p_conta)
$$;
revoke execute on function privado.contato_google_em_duvida(uuid, uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Gatilhos: conta trocada refaz a primeira; conta desligada leva as dúvidas ABERTAS dela
-- ---------------------------------------------------------------------
-- As dúvidas já decididas ficam (como as ligações em contatos_google): ao ligar a mesma conta de novo, o que o
-- administrador já decidiu não volta para a lista.
create function privado.ligacao_conta_trocada() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.conta_email is distinct from old.conta_email then
    new.contatos_primeira_em := null;
    new.contatos_primeira_tentativas := 0;
    new.contatos_primeira_proxima_em := now();
    new.contatos_primeira_reservada_ate := null;
    new.contatos_primeira_erro := null;
    new.contatos_primeira_detalhe := null;
    delete from public.contatos_google_conferir k
    where k.escritorio_id = old.escritorio_id and k.conta_email = old.conta_email and k.decisao is null;
  end if;
  return new;
end $$;
create trigger conta_trocada before update of conta_email on privado.ligacoes
  for each row when (new.perfil_id is null and new.provedor = 'google') execute function privado.ligacao_conta_trocada();

create function privado.ligacao_apagada() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.contatos_google_conferir k
  where k.escritorio_id = old.escritorio_id and k.conta_email = old.conta_email and k.decisao is null;
  return null;
end $$;
create trigger apagada after delete on privado.ligacoes
  for each row when (old.perfil_id is null and old.provedor = 'google') execute function privado.ligacao_apagada();

-- ---------------------------------------------------------------------
-- Funções da etapa 1 que passam a respeitar a primeira sincronização (mesma assinatura)
-- ---------------------------------------------------------------------

-- Ligar a sincronização (de novo, inclusive) pede uma primeira sincronização nova: os contatos criados no Google enquanto
-- ela estava desligada (pela planilha antiga, à mão) são ligados em vez de copiados. Desligar esvazia a fila.
create or replace function public.sincronizacao_google_ligar(p_ligar boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v privado.ligacoes; v_antes boolean;
begin
  if not privado.sou_admin() then raise exception 'Apenas administradores ligam e desligam a sincronização dos contatos'; end if;
  select l.contatos_ativos into v_antes from privado.ligacoes l
  where l.escritorio_id = privado.meu_escritorio() and l.perfil_id is null and l.provedor = 'google';
  update privado.ligacoes l set contatos_ativos = coalesce(p_ligar, false)
  where l.escritorio_id = privado.meu_escritorio() and l.perfil_id is null and l.provedor = 'google'
  returning * into v;
  if v.id is null then raise exception 'Ligue a conta Google do escritório antes de sincronizar os contatos'; end if;
  if v.contatos_ativos and not v_antes then
    update privado.ligacoes l set contatos_primeira_em = null, contatos_primeira_tentativas = 0, contatos_primeira_proxima_em = now(),
                                  contatos_primeira_reservada_ate = null, contatos_primeira_erro = null, contatos_primeira_detalhe = null
    where l.id = v.id;
  end if;
  if not v.contatos_ativos then delete from public.contatos_google_fila f where f.escritorio_id = v.escritorio_id; end if;
  insert into public.auditoria (escritorio_id, tabela, registro_id, acao, resumo, feito_por)
  values (v.escritorio_id, 'ligacoes', v.id::text, 'alteracao', jsonb_build_object('email', v.conta_email, 'contatos', v.contatos_ativos), auth.uid());
end $$;

-- "Sincronizar agora" também libera para já a primeira sincronização que estava esperando depois de uma falha.
create or replace function public.contatos_google_agora(p_usuario uuid, p_nivel text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_escritorio uuid := privado.escritorio_do_admin(p_usuario, p_nivel);
begin
  if v_escritorio is null or not exists (select 1 from privado.ligacoes l where l.escritorio_id = v_escritorio
                                         and l.perfil_id is null and l.provedor = 'google' and l.contatos_ativos) then
    return null;
  end if;
  update privado.ligacoes l set contatos_problema = null, contatos_problema_em = null,
    contatos_primeira_proxima_em = case when l.contatos_primeira_em is null then now() else l.contatos_primeira_proxima_em end
  where l.escritorio_id = v_escritorio and l.perfil_id is null and l.provedor = 'google';
  update public.contatos_google_fila f set proxima_em = now()
  where f.escritorio_id = v_escritorio and (f.em_andamento_ate is null or f.em_andamento_ate < now());
  return v_escritorio;
end $$;

-- A fila só anda depois da primeira sincronização do escritório, e sem quem está numa dúvida aberta.
create or replace function public.contatos_google_pendentes(p_escritorio uuid, p_limite integer)
returns table (pessoa_id uuid, versao integer, tentativas integer, escritorio_id uuid, conta_email text, recurso text, etag text,
               tipo text, nome text, telefones text[], emails text[], nascimento date, abertura date)
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.contatos_google_fila f using public.pessoas p
  where p.id = f.pessoa_id and p.arquivado_em is not null and (p_escritorio is null or f.escritorio_id = p_escritorio);
  return query
  with devidos as (
    select f.pessoa_id from public.contatos_google_fila f
    join privado.ligacoes l on l.escritorio_id = f.escritorio_id and l.perfil_id is null and l.provedor = 'google'
    where l.contatos_ativos and l.contatos_problema is null and l.contatos_primeira_em is not null
      and f.proxima_em <= now() and (f.em_andamento_ate is null or f.em_andamento_ate < now())
      and (p_escritorio is null or f.escritorio_id = p_escritorio)
      and not privado.contato_google_em_duvida(f.pessoa_id, f.escritorio_id, l.conta_email)
    order by f.tentativas, f.pedido_em
    limit greatest(coalesce(p_limite, 0), 0)
    for update of f skip locked
  ), reservados as (
    update public.contatos_google_fila f set em_andamento_ate = now() + interval '10 minutes', tentativas = f.tentativas + 1
    from devidos d where f.pessoa_id = d.pessoa_id
    returning f.pessoa_id, f.versao, f.tentativas, f.escritorio_id
  )
  select r.pessoa_id, r.versao, r.tentativas, r.escritorio_id, l.conta_email, c.recurso, c.etag,
         p.tipo, p.nome, p.telefones, p.emails, p.nascimento, p.abertura
  from reservados r
  join public.pessoas p on p.id = r.pessoa_id
  join privado.ligacoes l on l.escritorio_id = r.escritorio_id and l.perfil_id is null and l.provedor = 'google'
  left join public.contatos_google c on c.pessoa_id = r.pessoa_id and c.conta_email = l.conta_email;
end $$;

-- A rotina chama a função do servidor quando há alguém na fila que possa ir agora, ou uma primeira sincronização por fazer.
create or replace function privado.chamar_sincronizacao_de_contatos() returns void
language plpgsql security definer set search_path = '' as $$
declare v_url text; v_senha text;
begin
  if not exists (select 1 from privado.ligacoes l
                 where l.perfil_id is null and l.provedor = 'google' and l.contatos_ativos and l.contatos_problema is null
                   and l.contatos_primeira_em is null and l.contatos_primeira_proxima_em <= now()
                   and (l.contatos_primeira_reservada_ate is null or l.contatos_primeira_reservada_ate < now()))
     and not exists (select 1 from public.contatos_google_fila f
                     join privado.ligacoes l on l.escritorio_id = f.escritorio_id and l.perfil_id is null and l.provedor = 'google'
                     where l.contatos_ativos and l.contatos_problema is null and l.contatos_primeira_em is not null
                       and f.proxima_em <= now() and (f.em_andamento_ate is null or f.em_andamento_ate < now())
                       and not privado.contato_google_em_duvida(f.pessoa_id, f.escritorio_id, l.conta_email)) then
    return;
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'semper_url_do_projeto';
  select decrypted_secret into v_senha from vault.decrypted_secrets where name = 'semper_senha_da_rotina';
  if v_url is null or v_senha is null then
    raise warning 'Sincronização de contatos: faltam semper_url_do_projeto ou semper_senha_da_rotina no Vault.';
    return;
  end if;
  perform net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/google-sincronizar',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-senha-da-rotina', v_senha),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
end $$;

-- ---------------------------------------------------------------------
-- Pelas funções do servidor (chave de serviço), nunca pelo navegador
-- ---------------------------------------------------------------------

-- Os escritórios com a primeira sincronização por fazer agora (de um, ou de todos), reservados para esta execução por
-- 10 minutos e com mais uma tentativa contada.
create function public.contatos_google_primeiras(p_escritorio uuid)
returns table (escritorio_id uuid, conta_email text, tentativas integer)
language sql security definer set search_path = '' as $$
  update privado.ligacoes l
  set contatos_primeira_reservada_ate = now() + interval '10 minutes', contatos_primeira_tentativas = l.contatos_primeira_tentativas + 1
  where l.id in (select x.id from privado.ligacoes x
                 where x.perfil_id is null and x.provedor = 'google' and x.contatos_ativos and x.contatos_problema is null
                   and x.contatos_primeira_em is null and x.contatos_primeira_proxima_em <= now()
                   and (x.contatos_primeira_reservada_ate is null or x.contatos_primeira_reservada_ate < now())
                   and (p_escritorio is null or x.escritorio_id = p_escritorio)
                 for update skip locked)
  returning l.escritorio_id, l.conta_email, l.contatos_primeira_tentativas
$$;

-- As pessoas do escritório (também as arquivadas: se voltarem, já estão ligadas), com o contato ligado a cada uma nesta
-- conta. Num valor só (não em linhas), para não esbarrar no limite de linhas da API em escritórios grandes.
create function public.contatos_google_pessoas(p_escritorio uuid, p_conta text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'tipo', p.tipo, 'nome', p.nome, 'telefones', p.telefones, 'emails', p.emails,
                                               'nascimento', p.nascimento, 'abertura', p.abertura, 'recurso', c.recurso) order by p.criado_em), '[]'::jsonb)
  from public.pessoas p
  left join public.contatos_google c on c.pessoa_id = p.id and c.conta_email = lower(p_conta)
  where p.escritorio_id = p_escritorio
$$;

-- Terminou: grava as ligações certas e as dúvidas (a decidida antes não volta), marca a primeira como feita e põe na fila
-- as pessoas ativas que ficaram sem contato e sem dúvida aberta. Se a conta mudou ou a sincronização foi desligada no
-- meio, não grava nada. Devolve quantos contatos foram ligados, quantas dúvidas abertas há e quantas pessoas foram para a fila.
create function public.contatos_google_primeira_concluir(p_escritorio uuid, p_conta text, p_ligar jsonb, p_conferir jsonb)
returns table (ligados integer, para_conferir integer, novos integer)
language plpgsql security definer set search_path = '' as $$
declare v privado.ligacoes; v_ligados int; v_novos int; v_conferir int;
begin
  select * into v from privado.ligacoes l
  where l.escritorio_id = p_escritorio and l.perfil_id is null and l.provedor = 'google' for update;
  if v.id is null or v.conta_email <> lower(p_conta) or not v.contatos_ativos or v.contatos_primeira_em is not null then
    return query select 0, 0, 0; return;
  end if;

  with novas as (
    insert into public.contatos_google as c (pessoa_id, escritorio_id, conta_email, recurso, etag)
    select x.pessoa_id, p_escritorio, v.conta_email, x.recurso, x.etag
    from jsonb_to_recordset(coalesce(p_ligar, '[]'::jsonb)) as x(pessoa_id uuid, recurso text, etag text)
    join public.pessoas p on p.id = x.pessoa_id and p.escritorio_id = p_escritorio
    where not exists (select 1 from public.contatos_google o where o.conta_email = v.conta_email and o.escritorio_id = p_escritorio and o.recurso = x.recurso)
    on conflict (pessoa_id, conta_email) do nothing
    returning 1
  ) select count(*)::int into v_ligados from novas;

  insert into public.contatos_google_conferir as k (escritorio_id, conta_email, recurso, etag, nome, telefones, emails, aniversario, motivo, candidatos)
  select p_escritorio, v.conta_email, x.recurso, x.etag, x.nome, coalesce(x.telefones, '{}'), coalesce(x.emails, '{}'), x.aniversario, x.motivo,
         array(select p.id from unnest(x.candidatos) with ordinality as u(id, n)
               join public.pessoas p on p.id = u.id and p.escritorio_id = p_escritorio order by u.n)
  from jsonb_to_recordset(coalesce(p_conferir, '[]'::jsonb))
       as x(recurso text, etag text, nome text, telefones text[], emails text[], aniversario text, motivo text, candidatos uuid[])
  on conflict (escritorio_id, conta_email, recurso) do nothing;
  -- Uma dúvida sem nenhuma pessoa possível do escritório não serve para nada; e a dúvida aberta (de uma primeira anterior)
  -- cujo contato acabou de ser ligado a alguém já está resolvida.
  delete from public.contatos_google_conferir k
  where k.escritorio_id = p_escritorio and k.conta_email = v.conta_email and k.decisao is null
    and (cardinality(k.candidatos) = 0
         or exists (select 1 from public.contatos_google c where c.recurso = k.recurso and c.conta_email = k.conta_email and c.escritorio_id = k.escritorio_id));

  insert into public.contatos_google_fila (pessoa_id, escritorio_id)
    select p.id, p.escritorio_id from public.pessoas p
    where p.escritorio_id = p_escritorio and p.arquivado_em is null
      and not exists (select 1 from public.contatos_google c where c.pessoa_id = p.id and c.conta_email = v.conta_email)
      and not privado.contato_google_em_duvida(p.id, p_escritorio, v.conta_email)
  on conflict (pessoa_id) do nothing;
  -- Quem vai ganhar um contato novo: as pessoas ativas sem contato e sem dúvida (as que já estavam na fila também).
  select count(*)::int into v_novos from public.contatos_google_fila f
  where f.escritorio_id = p_escritorio
    and not exists (select 1 from public.contatos_google c where c.pessoa_id = f.pessoa_id and c.conta_email = v.conta_email)
    and not privado.contato_google_em_duvida(f.pessoa_id, p_escritorio, v.conta_email);

  select count(*)::int into v_conferir from public.contatos_google_conferir k
  where k.escritorio_id = p_escritorio and k.conta_email = v.conta_email and k.decisao is null;

  update privado.ligacoes l set contatos_primeira_em = now(), contatos_primeira_reservada_ate = null, contatos_primeira_erro = null,
                                contatos_primeira_detalhe = null, contatos_primeira_tentativas = 0
  where l.id = v.id;
  insert into public.auditoria (escritorio_id, tabela, registro_id, acao, resumo, feito_por)
  values (p_escritorio, 'ligacoes', v.id::text, 'alteracao',
          jsonb_build_object('email', v.conta_email, 'primeira_sincronizacao', jsonb_build_object('ligados', v_ligados, 'para_conferir', v_conferir, 'novos', v_novos)), null);
  return query select v_ligados, v_conferir, v_novos;
end $$;

-- Deu errado: a primeira continua por fazer e espera p_espera segundos. Autorização vencida ou retirada marca o problema
-- na ligação, como na fila.
create function public.contatos_google_primeira_falhou(p_escritorio uuid, p_erro text, p_detalhe text, p_espera integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update privado.ligacoes l
  set contatos_primeira_reservada_ate = null, contatos_primeira_erro = p_erro, contatos_primeira_detalhe = left(p_detalhe, 200),
      contatos_primeira_proxima_em = now() + make_interval(secs => greatest(coalesce(p_espera, 0), 0)),
      contatos_problema = case when p_erro = 'autorizacao' then 'autorizacao' else l.contatos_problema end,
      contatos_problema_em = case when p_erro = 'autorizacao' and l.contatos_problema is null then now() else l.contatos_problema_em end
  where l.escritorio_id = p_escritorio and l.perfil_id is null and l.provedor = 'google';
end $$;

-- A primeira sincronização do escritório ainda falta (com a sincronização ligada): o "Sincronizar agora" avisa, em vez de
-- dizer que está tudo em dia, quando ela falhou ou está sendo feita por outra execução.
create function public.contatos_google_primeira_por_fazer(p_escritorio uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from privado.ligacoes l
                 where l.escritorio_id = p_escritorio and l.perfil_id is null and l.provedor = 'google'
                   and l.contatos_ativos and l.contatos_primeira_em is null)
$$;

revoke execute on function public.contatos_google_primeiras(uuid), public.contatos_google_pessoas(uuid, text),
  public.contatos_google_primeira_concluir(uuid, text, jsonb, jsonb), public.contatos_google_primeira_falhou(uuid, text, text, integer),
  public.contatos_google_primeira_por_fazer(uuid)
  from public, anon, authenticated;
grant execute on function public.contatos_google_primeiras(uuid), public.contatos_google_pessoas(uuid, text),
  public.contatos_google_primeira_concluir(uuid, text, jsonb, jsonb), public.contatos_google_primeira_falhou(uuid, text, text, integer),
  public.contatos_google_primeira_por_fazer(uuid)
  to service_role;

-- ---------------------------------------------------------------------
-- Pelo navegador (administradores)
-- ---------------------------------------------------------------------

-- Como está a primeira sincronização: se já terminou (e quando), quantas dúvidas estão abertas e o problema dela:
--   'google-fora'       : o Google não respondeu 3 vezes ou mais (passa sozinho);
--   'primeira-recusada' : o Google recusou a leitura (já na 1ª vez: não passa sozinho, por exemplo uma conta com contatos
--                         demais) ou o próprio SEMPER falhou 3 vezes ou mais; o administrador precisa avisar o suporte.
-- Vazio sem conta ligada ou para quem não é administrador.
create function public.primeira_sincronizacao_google()
returns table (ativa boolean, primeira_em timestamptz, para_conferir integer, problema text, problema_em timestamptz)
language sql stable security definer set search_path = '' as $$
  select x.contatos_ativos, x.contatos_primeira_em, x.para_conferir, x.problema,
         case when x.problema is not null then x.contatos_primeira_proxima_em end
  from (
    select l.contatos_ativos, l.contatos_primeira_em, l.contatos_primeira_proxima_em,
           (select count(*)::int from public.contatos_google_conferir k
            where k.escritorio_id = l.escritorio_id and k.conta_email = l.conta_email and k.decisao is null) as para_conferir,
           case when l.contatos_primeira_em is not null then null
                when l.contatos_primeira_erro = 'recusado' then 'primeira-recusada'
                when l.contatos_primeira_tentativas < 3 then null
                when l.contatos_primeira_erro = 'temporario' then 'google-fora'
                when l.contatos_primeira_erro = 'interno' then 'primeira-recusada' end as problema
    from privado.ligacoes l
    where l.escritorio_id = privado.meu_escritorio() and l.perfil_id is null and l.provedor = 'google' and privado.sou_admin()
  ) x
$$;

-- As dúvidas abertas da conta ligada agora, as mais antigas primeiro, com as pessoas possíveis de cada uma (só as do
-- escritório). Num valor só, para não esbarrar no limite de linhas da API. Vazio para quem não é administrador.
create function public.contatos_google_para_conferir() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', k.id, 'nome', k.nome, 'telefones', k.telefones, 'emails', k.emails, 'aniversario', k.aniversario, 'motivo', k.motivo,
    'criado_em', k.criado_em,
    'candidatos', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'codigo', p.codigo, 'tipo', p.tipo, 'nome', p.nome,
                                                                'telefones', p.telefones, 'emails', p.emails, 'nascimento', p.nascimento,
                                                                'abertura', p.abertura, 'arquivada', p.arquivado_em is not null,
                                                                -- Já tem um contato nesta conta: não pode ser ligada a outro.
                                                                'ligada', exists (select 1 from public.contatos_google c
                                                                                  where c.pessoa_id = p.id and c.conta_email = k.conta_email))
                                                order by u.n), '[]'::jsonb)
                   from unnest(k.candidatos) with ordinality as u(id, n)
                   join public.pessoas p on p.id = u.id and p.escritorio_id = k.escritorio_id)
  ) order by k.criado_em, k.nome, k.id), '[]'::jsonb)
  from public.contatos_google_conferir k
  join privado.ligacoes l on l.escritorio_id = k.escritorio_id and l.perfil_id is null and l.provedor = 'google' and l.conta_email = k.conta_email
  where k.escritorio_id = privado.meu_escritorio() and privado.sou_admin() and k.decisao is null
$$;

-- A decisão do administrador sobre uma dúvida:
--   'ligar'   : o contato é da pessoa p_pessoa (do escritório, ainda sem contato nesta conta); nada muda no Google agora, e
--               as outras pessoas possíveis, sem contato, vão para a fila e ganham um contato novo;
--   'outra'   : o contato é de outra pessoa; as pessoas possíveis que estão sem contato vão para a fila e ganham um contato novo;
--   'ignorar' : deixa o contato como está, sem ligar nem criar nada (a pessoa vai ao Google quando for editada).
-- A dúvida sai da lista e não volta. Fica no registro de ações.
create function public.contatos_google_conferir_decidir(p_id uuid, p_acao text, p_pessoa uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare k public.contatos_google_conferir; v privado.ligacoes; v_decisao text;
begin
  if not privado.sou_admin() then raise exception 'Apenas administradores decidem os contatos para conferir'; end if;
  select * into k from public.contatos_google_conferir x
  where x.id = p_id and x.escritorio_id = privado.meu_escritorio() and x.decisao is null for update;
  if k.id is null then raise exception 'Este contato já foi conferido'; end if;
  select * into v from privado.ligacoes l
  where l.escritorio_id = k.escritorio_id and l.perfil_id is null and l.provedor = 'google' and l.conta_email = k.conta_email;
  if v.id is null then raise exception 'A conta Google deste contato não está mais ligada'; end if;
  v_decisao := case p_acao when 'ligar' then 'ligada' when 'outra' then 'outra' when 'ignorar' then 'ignorada' end;
  if v_decisao is null then raise exception 'Decisão desconhecida'; end if;

  if v_decisao = 'ligada' then
    if not exists (select 1 from public.pessoas p where p.id = p_pessoa and p.escritorio_id = k.escritorio_id) then
      raise exception 'Escolha uma pessoa do escritório';
    end if;
    if exists (select 1 from public.contatos_google c where c.pessoa_id = p_pessoa and c.conta_email = k.conta_email) then
      raise exception 'Esta pessoa já está ligada a outro contato do Google';
    end if;
    if exists (select 1 from public.contatos_google c where c.recurso = k.recurso and c.conta_email = k.conta_email and c.escritorio_id = k.escritorio_id) then
      raise exception 'Este contato do Google já está ligado a outra pessoa';
    end if;
    insert into public.contatos_google (pessoa_id, escritorio_id, conta_email, recurso, etag)
    values (p_pessoa, k.escritorio_id, k.conta_email, k.recurso, k.etag);
  end if;

  update public.contatos_google_conferir x
  set decisao = v_decisao, pessoa_id = case when v_decisao = 'ligada' then p_pessoa end, decidido_em = now(), decidido_por = auth.uid()
  where x.id = k.id;

  -- 'ligar' e 'outra': quem era possível e ficou sem contato (e sem outra dúvida aberta) vai para a fila e ganha um contato novo.
  if v_decisao in ('ligada', 'outra') and v.contatos_ativos then
    insert into public.contatos_google_fila as f (pessoa_id, escritorio_id)
    select p.id, p.escritorio_id from public.pessoas p
    where p.id = any(k.candidatos) and p.escritorio_id = k.escritorio_id and p.arquivado_em is null
      and not exists (select 1 from public.contatos_google c where c.pessoa_id = p.id and c.conta_email = k.conta_email)
      and not privado.contato_google_em_duvida(p.id, k.escritorio_id, k.conta_email)
    on conflict (pessoa_id) do update set proxima_em = now();
  end if;

  insert into public.auditoria (escritorio_id, tabela, registro_id, acao, resumo, feito_por)
  values (k.escritorio_id, 'contatos_google_conferir', k.id::text, 'alteracao',
          jsonb_build_object('decisao', v_decisao, 'pessoa', case when v_decisao = 'ligada' then p_pessoa end), auth.uid());
end $$;

revoke execute on function public.primeira_sincronizacao_google(), public.contatos_google_para_conferir(),
  public.contatos_google_conferir_decidir(uuid, text, uuid) from public, anon;
grant execute on function public.primeira_sincronizacao_google(), public.contatos_google_para_conferir(),
  public.contatos_google_conferir_decidir(uuid, text, uuid) to authenticated;
