-- =====================================================================
-- Salas do escritório e agendamento interno, sem horário duplicado (#308)
--   - Cada escritório cadastra as salas dele (nome e capacidade) nas Configurações. Só administradores cadastram, mudam, desativam e
--     reativam; todos da equipe veem as salas (para escolher no compromisso e filtrar a agenda). Sala não se exclui: desativada, ela
--     some das opções novas, e os compromissos antigos continuam mostrando o nome dela.
--   - O compromisso ganha a sala (sala_id). Ao gravar, o banco confere: a sala é do escritório; a sala escolhida agora está ativa; e
--     ela não está ocupada por outro compromisso ativo no mesmo horário. Sem hora de fim, o compromisso ocupa a sala por 1 hora; sem
--     hora (o dia inteiro), o dia todo (as mesmas contas de app/src/regras/sala.ts). Não contam os arquivados nem os da coluna
--     "Cancelado" (uma coluna comum do quadro, sem marco: vai pelo nome, como em privado.prazos_da_equipe). A trava na sala faz dois
--     agendamentos ao mesmo tempo serem conferidos um depois do outro.
--   - ocupacao_da_sala: os compromissos que ocupam uma sala num dia, para a tela avisar o conflito antes de salvar. Vem o código e o
--     horário de todos; o título, só dos que quem pergunta vê.
--   - O histórico do compromisso mostra o nome da sala.
--   Os tamanhos são os de TAMANHO_SALA em app/src/dados/limites.ts.
--
--   Só acrescenta: uma tabela, uma coluna, funções, gatilhos e regras novos, e o histórico do compromisso com um campo a mais. A versão
--   anterior do site continua funcionando: ela não conhece as salas e não grava a coluna nova.
-- =====================================================================

-- 1. As salas.
create table public.salas (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null default privado.meu_escritorio() references public.escritorios on delete cascade,
  nome          text not null check (length(nome) between 1 and 80),
  capacidade    integer not null check (capacidade between 1 and 999),   -- quantas pessoas cabem
  ativa         boolean not null default true,
  criado_por    uuid default auth.uid() references auth.users on delete set null,
  criado_em     timestamptz not null default now(),
  atualizado_por uuid references auth.users on delete set null,
  atualizado_em timestamptz not null default now()
);
-- Duas salas do mesmo escritório não têm o mesmo nome (maiúsculas e acentos não contam).
create unique index salas_nome_unico on public.salas (escritorio_id, privado.sem_acento(nome));

-- O nome sem espaços nas pontas, e quem mudou por último.
create function privado.preparar_sala() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.nome := btrim(new.nome);
  if tg_op = 'UPDATE' then
    new.atualizado_por := auth.uid();
    new.atualizado_em := now();
  end if;
  return new;
end $$;
revoke execute on function privado.preparar_sala() from public, anon, authenticated;
create trigger preparar before insert or update on public.salas for each row execute function privado.preparar_sala();
create trigger auditoria after insert or update or delete on public.salas for each row execute function privado.auditar();

alter table public.salas enable row level security;
revoke all on public.salas from anon;
revoke update, delete on public.salas from authenticated;
grant select, insert on public.salas to authenticated;
grant update (nome, capacidade, ativa) on public.salas to authenticated;
create policy leitura on public.salas for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio()));
create policy incluir on public.salas for insert to authenticated
  with check (escritorio_id = (select privado.meu_escritorio()) and (select privado.sou_admin()) and criado_por = (select auth.uid()));
create policy alterar on public.salas for update to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and (select privado.sou_admin()))
  with check (escritorio_id = (select privado.meu_escritorio()));

-- 2. A sala do compromisso.
alter table public.compromissos add column sala_id uuid references public.salas on delete restrict;
create index compromissos_sala on public.compromissos (sala_id, data) where sala_id is not null;
grant update (sala_id) on public.compromissos to authenticated;

-- Os minutos do dia que o compromisso ocupa na sala, [início, fim): sem hora de fim, 1 hora; sem hora, o dia todo.
create function privado.minutos_na_sala(p_hora time, p_hora_fim time, out inicio integer, out fim integer)
language sql immutable parallel safe set search_path = '' as $$
  select coalesce((extract(hour from p_hora) * 60 + extract(minute from p_hora))::integer, 0),
         case when p_hora_fim is not null then (extract(hour from p_hora_fim) * 60 + extract(minute from p_hora_fim))::integer
              when p_hora is not null then least((extract(hour from p_hora) * 60 + extract(minute from p_hora))::integer + 60, 1440)
              else 1440 end
$$;
-- A coluna "Cancelado" do quadro (pelo nome, como privado.prazos_da_equipe).
create function privado.coluna_cancelada(p_etapa uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.quadro_colunas q where q.id = p_etapa and lower(q.nome) like 'cancelad%')
$$;
revoke execute on function privado.coluna_cancelada(uuid) from public, anon, authenticated;

-- Os compromissos que ocupam a sala no dia, fora um (o que está sendo gravado): os ativos e não cancelados, de qualquer pessoa.
create function privado.ocupacoes_da_sala(p_sala uuid, p_data date, p_fora uuid)
returns table (id uuid, codigo text, tipo text, hora time, hora_fim time)
language sql stable security definer set search_path = '' as $$
  select c.id, c.codigo, c.tipo, c.hora, c.hora_fim
  from public.compromissos c
  where c.sala_id = p_sala and c.data = p_data and c.id is distinct from p_fora and c.arquivado_em is null
    and not privado.coluna_cancelada(c.etapa_id)
    and c.escritorio_id = coalesce(privado.meu_escritorio(), c.escritorio_id)
  order by c.hora nulls first, c.codigo
$$;
revoke execute on function privado.ocupacoes_da_sala(uuid, date, uuid) from public, anon;
grant execute on function privado.ocupacoes_da_sala(uuid, date, uuid) to authenticated;

-- Antes de gravar: a sala é do escritório, a escolhida agora está ativa e está livre no horário.
create function privado.conferir_sala_do_compromisso() returns trigger
language plpgsql security definer set search_path = '' as $$
declare s public.salas; o record; n record; x record;
begin
  if new.sala_id is null then
    return new;
  end if;
  -- A trava na sala: dois agendamentos dela ao mesmo tempo são conferidos um depois do outro.
  select * into s from public.salas where id = new.sala_id and escritorio_id = new.escritorio_id for update;
  if s.id is null then
    raise exception 'Sala não encontrada neste escritório.';
  end if;
  if not s.ativa and (tg_op = 'INSERT' or new.sala_id is distinct from old.sala_id) then
    raise exception 'A sala % está desativada. Escolha outra sala.', s.nome;
  end if;
  if new.arquivado_em is not null or privado.coluna_cancelada(new.etapa_id) then
    return new;
  end if;
  select * into n from privado.minutos_na_sala(new.hora, new.hora_fim);
  for o in select * from privado.ocupacoes_da_sala(new.sala_id, new.data, new.id) loop
    select * into x from privado.minutos_na_sala(o.hora, o.hora_fim);
    if x.inicio < n.fim and n.inicio < x.fim then
      raise exception 'A sala % já está ocupada % pelo compromisso %. Escolha outro horário ou outra sala.', s.nome,
        case when o.hora is null then 'o dia inteiro'
             else 'das ' || to_char(make_interval(mins => x.inicio), 'HH24:MI') || ' às ' || to_char(make_interval(mins => x.fim), 'HH24:MI') end,
        o.codigo;
    end if;
  end loop;
  return new;
end $$;
revoke execute on function privado.conferir_sala_do_compromisso() from public, anon, authenticated;
create trigger conferir_sala before insert or update of sala_id, data, hora, hora_fim, etapa_id, arquivado_em on public.compromissos
  for each row execute function privado.conferir_sala_do_compromisso();

-- Para a tela: quem ocupa a sala no dia. Roda com a permissão de quem pergunta: o título vem pela regra de leitura dos compromissos
-- (só o que a pessoa vê); o código e o horário, de todos. A sala precisa ser do escritório de quem pergunta.
create function public.ocupacao_da_sala(p_sala uuid, p_data date, p_fora uuid default null)
returns table (id uuid, codigo text, tipo text, hora time, hora_fim time, titulo text)
language sql stable set search_path = '' as $$
  select o.id, o.codigo, o.tipo, o.hora, o.hora_fim, (select c.titulo from public.compromissos c where c.id = o.id)
  from privado.ocupacoes_da_sala(p_sala, p_data, p_fora) o
  where exists (select 1 from public.salas s where s.id = p_sala)
$$;
revoke execute on function public.ocupacao_da_sala(uuid, date, uuid) from public, anon;
grant execute on function public.ocupacao_da_sala(uuid, date, uuid) to authenticated;

-- 3. O histórico do compromisso: a de 20261119233811_grupos_da_equipe.sql, com a sala pelo nome.
CREATE OR REPLACE FUNCTION privado.historico_compromisso()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a jsonb := '{}'; k text; vo jsonb := to_jsonb(old); vn jsonb := to_jsonb(new);
begin
  for k in select jsonb_object_keys(vn) loop
    continue when k in ('id', 'escritorio_id', 'codigo', 'pessoa_nome', 'processo_codigo', 'processo_numero', 'busca', 'nome_ordem', 'etapa_ordem',
                        'arquivado_por', 'criado_por', 'criado_em', 'atualizado_por', 'atualizado_em');
    continue when vo -> k is not distinct from vn -> k;
    a := a || case k
      when 'etapa_id' then jsonb_build_object('etapa', jsonb_build_object(
        'de', (select nome from public.quadro_colunas where id = old.etapa_id),
        'para', (select nome from public.quadro_colunas where id = new.etapa_id)))
      when 'responsavel_id' then jsonb_build_object(k, jsonb_build_object(
        'de', (select nome from public.perfis where id = old.responsavel_id),
        'para', (select nome from public.perfis where id = new.responsavel_id)))
      when 'participantes' then jsonb_build_object(k, jsonb_build_object(
        'de', privado.nomes_da_equipe(old.participantes), 'para', privado.nomes_da_equipe(new.participantes)))
      when 'pessoas' then jsonb_build_object(k, jsonb_build_object(
        'de', privado.nomes_dos_clientes(old.pessoas, ', '), 'para', privado.nomes_dos_clientes(new.pessoas, ', ')))
      when 'processo_id' then jsonb_build_object('processo', jsonb_build_object('de', old.processo_numero, 'para', new.processo_numero))
      when 'grupos' then jsonb_build_object(k, jsonb_build_object('de', privado.nomes_dos_grupos(old.grupos), 'para', privado.nomes_dos_grupos(new.grupos)))
      when 'sala_id' then jsonb_build_object('sala', jsonb_build_object(
        'de', (select nome from public.salas where id = old.sala_id), 'para', (select nome from public.salas where id = new.sala_id)))
      else jsonb_build_object(k, jsonb_build_object('de', vo -> k, 'para', vn -> k))
    end;
  end loop;
  if a <> '{}' then
    insert into public.compromisso_historico (escritorio_id, compromisso_id, alteracoes, feito_por)
    values (new.escritorio_id, new.id, a, auth.uid());
  end if;
  return null;
end $function$;
