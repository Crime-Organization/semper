-- =====================================================================
-- Andamentos, prazos e intimações dos processos (parte da tarefa #47)
--   - Andamento: o que aconteceu ou vai acontecer no processo, lançado à mão. É um andamento comum, uma intimação,
--     uma audiência ou uma perícia. Audiência e perícia têm também hora e local.
--   - Intimação: fica "a tratar" até virar tarefa ou até alguém marcar que não precisa de tarefa (tratada_em). Se a tarefa
--     for excluída, ela volta a ficar a tratar.
--   - Prazo: o último dia (final) é sempre o que vale. Quando foi calculado, guarda também a data da intimação, os dias
--     e a contagem; digitado à mão, esses ficam vazios. Pode nascer de uma intimação (andamento_id) e virar tarefa.
--   - Quem vê o processo vê, lança e muda os andamentos e os prazos dele. Com o processo arquivado, só lê.
--   - Excluir só esconde (excluido_em): desfazer devolve o item como estava, com o mesmo autor, a mesma data e as mesmas
--     ligações. Sai de verdade quando o processo é excluído.
--   - O que aparece na linha do item entra no histórico do processo, como estava e como ficou. A data de cumprir, de tratar
--     e de excluir é a do banco.
--   - A tarefa ganha processo_id: a tarefa criada de uma intimação ou de um prazo fica ligada ao processo.
--   Os tamanhos são os de TAMANHO_ANDAMENTO e TAMANHO_PRAZO em app/src/dados/limites.ts; os dias, PRAZO_MAXIMO_DIAS em
--   app/src/regras/prazos.ts; os anos, ANOS_DO_CALENDARIO.
--   Só acrescenta: duas tabelas, uma coluna em tarefas e funções novas. O histórico das tarefas passa a ignorar a coluna
--   nova. A versão anterior do site continua funcionando: ela não conhece nada disso.
-- =====================================================================

-- 1. Andamentos
create table public.processo_andamentos (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null default privado.meu_escritorio() references public.escritorios on delete cascade,
  processo_id   uuid not null references public.processos on delete cascade,
  tipo          text not null check (tipo in ('andamento', 'intimacao', 'audiencia', 'pericia')),
  data          date not null check (data between date '2000-01-01' and date '2100-12-31'),
  hora          time,
  local         text check (length(local) <= 200),
  texto         text not null check (btrim(texto) <> '' and length(texto) <= 4000),
  tratada_em    timestamptz,
  tratada_por   uuid references auth.users on delete set null,
  tarefa_id     uuid references public.tarefas on delete set null,
  excluido_em   timestamptz,
  criado_por    uuid default auth.uid() references auth.users on delete set null,
  criado_em     timestamptz not null default now(),
  atualizado_por uuid references auth.users on delete set null,
  atualizado_em timestamptz not null default now(),
  -- Hora e local são só de audiência e perícia; "tratada", só de intimação.
  check (tipo in ('audiencia', 'pericia') or (hora is null and local is null)),
  check (tipo = 'intimacao' or tratada_em is null)
);
create index processo_andamentos_processo on public.processo_andamentos (processo_id, data desc, criado_em desc);
create index processo_andamentos_a_tratar on public.processo_andamentos (escritorio_id, data) where tipo = 'intimacao' and tratada_em is null and excluido_em is null;
create index processo_andamentos_marcados on public.processo_andamentos (escritorio_id, data) where tipo in ('audiencia', 'pericia') and excluido_em is null;
create index processo_andamentos_tarefa on public.processo_andamentos (tarefa_id) where tarefa_id is not null;

-- 2. Prazos
create table public.processo_prazos (
  id               uuid primary key default gen_random_uuid(),
  escritorio_id    uuid not null default privado.meu_escritorio() references public.escritorios on delete cascade,
  processo_id      uuid not null references public.processos on delete cascade,
  descricao        text not null check (btrim(descricao) <> '' and length(descricao) <= 300),
  final            date not null check (final between date '2000-01-01' and date '2100-12-31'),
  -- Como foi calculado (tudo vazio: a data foi digitada à mão).
  intimacao        date check (intimacao between date '2000-01-01' and date '2100-12-31'),
  dias             integer check (dias between 1 and 1830),
  contagem         text check (contagem in ('corridos', 'uteis')),
  disponibilizacao boolean not null default false,
  sem_recesso      boolean not null default false,
  andamento_id     uuid references public.processo_andamentos on delete set null,
  tarefa_id        uuid references public.tarefas on delete set null,
  concluido_em     timestamptz,
  concluido_por    uuid references auth.users on delete set null,
  excluido_em      timestamptz,
  criado_por       uuid default auth.uid() references auth.users on delete set null,
  criado_em        timestamptz not null default now(),
  atualizado_por   uuid references auth.users on delete set null,
  atualizado_em    timestamptz not null default now(),
  check ((intimacao is null) = (dias is null) and (intimacao is null) = (contagem is null))
);
create index processo_prazos_processo on public.processo_prazos (processo_id, final);
create index processo_prazos_abertos on public.processo_prazos (escritorio_id, final) where concluido_em is null and excluido_em is null;
create index processo_prazos_andamento on public.processo_prazos (andamento_id) where andamento_id is not null;
create index processo_prazos_tarefa on public.processo_prazos (tarefa_id) where tarefa_id is not null;

-- 3. Arrumar e conferir antes de gravar. Rodam com a permissão de quem grava: só se liga o que essa pessoa pode ver.
-- Só a tarefa nova é conferida: a que já estava ligada e que a pessoa não vê não trava as outras alterações.
-- A data de uma marcação (tratada, cumprido, excluído) é a do banco, ao marcar; depois de marcada, não muda. Quem marcou
-- só muda ao marcar: a coluna não aceita gravação pela tela, e assim a exclusão do usuário (on delete set null) continua valendo.
create function privado.preparar_andamento() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.texto := btrim(new.texto);
  new.local := nullif(btrim(new.local), '');
  -- A tarefa foi desligada (ou excluída) sem ninguém mexer na marcação: a intimação volta a ficar a tratar.
  if tg_op = 'UPDATE' and old.tarefa_id is not null and new.tarefa_id is null and new.tratada_em is not distinct from old.tratada_em then
    new.tratada_em := null;
  end if;
  if new.tratada_em is null then
    new.tratada_por := null;
  elsif tg_op = 'INSERT' or old.tratada_em is null then
    new.tratada_em := now();
    new.tratada_por := auth.uid();
  else
    new.tratada_em := old.tratada_em;
  end if;
  if new.excluido_em is not null then
    new.excluido_em := case when tg_op = 'UPDATE' and old.excluido_em is not null then old.excluido_em else now() end;
  end if;
  -- Outra pessoa já criou a tarefa, com a tela desatualizada aqui: não troca uma tarefa por outra.
  if tg_op = 'UPDATE' and old.tarefa_id is not null and new.tarefa_id is not null and new.tarefa_id <> old.tarefa_id then
    raise exception 'Já existe uma tarefa ligada a este item.';
  end if;
  if new.tarefa_id is not null and (tg_op = 'INSERT' or new.tarefa_id is distinct from old.tarefa_id)
     and not exists (select 1 from public.tarefas t where t.id = new.tarefa_id and t.escritorio_id = new.escritorio_id) then
    raise exception 'Tarefa não encontrada neste escritório.';
  end if;
  return new;
end $$;
create trigger preparar before insert or update on public.processo_andamentos for each row execute function privado.preparar_andamento();
create trigger carimbo before update on public.processo_andamentos for each row execute function privado.carimbar();

create function privado.preparar_prazo() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.descricao := btrim(new.descricao);
  if new.concluido_em is null then
    new.concluido_por := null;
  elsif tg_op = 'INSERT' or old.concluido_em is null then
    new.concluido_em := now();
    new.concluido_por := auth.uid();
  else
    new.concluido_em := old.concluido_em;
  end if;
  if new.excluido_em is not null then
    new.excluido_em := case when tg_op = 'UPDATE' and old.excluido_em is not null then old.excluido_em else now() end;
  end if;
  if new.andamento_id is not null and (tg_op = 'INSERT' or new.andamento_id is distinct from old.andamento_id)
     and not exists (select 1 from public.processo_andamentos a where a.id = new.andamento_id and a.processo_id = new.processo_id) then
    raise exception 'Este andamento não é deste processo.';
  end if;
  -- Outra pessoa já criou a tarefa, com a tela desatualizada aqui: não troca uma tarefa por outra.
  if tg_op = 'UPDATE' and old.tarefa_id is not null and new.tarefa_id is not null and new.tarefa_id <> old.tarefa_id then
    raise exception 'Já existe uma tarefa ligada a este item.';
  end if;
  if new.tarefa_id is not null and (tg_op = 'INSERT' or new.tarefa_id is distinct from old.tarefa_id)
     and not exists (select 1 from public.tarefas t where t.id = new.tarefa_id and t.escritorio_id = new.escritorio_id) then
    raise exception 'Tarefa não encontrada neste escritório.';
  end if;
  return new;
end $$;
create trigger preparar before insert or update on public.processo_prazos for each row execute function privado.preparar_prazo();
create trigger carimbo before update on public.processo_prazos for each row execute function privado.carimbar();

-- 4. Histórico: o que muda na linha do item entra no histórico do processo, como estava e como ficou. As linhas são iguais
-- às de linhaDoAndamento e linhaDoPrazo em app/src/regras/andamentos.ts.
create function privado.linha_do_andamento(p_tipo text, p_data date, p_hora time, p_local text, p_texto text, p_tratada timestamptz) returns text
language sql immutable set search_path = '' as $$
  select case p_tipo when 'intimacao' then 'Intimação' when 'audiencia' then 'Audiência' when 'pericia' then 'Perícia' else 'Andamento' end
    || ' de ' || to_char(p_data, 'DD/MM/YYYY') || coalesce(' às ' || to_char(p_hora, 'HH24:MI'), '') || coalesce(' em ' || p_local, '')
    || ': ' || p_texto || case when p_tratada is null then '' else ' (tratada)' end
$$;
create function privado.linha_do_prazo(p_descricao text, p_final date, p_intimacao date, p_dias integer, p_contagem text, p_concluido timestamptz) returns text
language sql immutable set search_path = '' as $$
  select p_descricao || ': ' || to_char(p_final, 'DD/MM/YYYY')
    || coalesce(' (' || p_dias || case when p_dias = 1 then ' dia ' else ' dias ' end
         || case when p_contagem = 'uteis' then case when p_dias = 1 then 'útil' else 'úteis' end
                 else case when p_dias = 1 then 'corrido' else 'corridos' end end
         || ' desde ' || to_char(p_intimacao, 'DD/MM/YYYY') || ')', '')
    || case when p_concluido is null then '' else ' (cumprido)' end
$$;
revoke execute on function privado.linha_do_andamento(text, date, time, text, text, timestamptz) from public, anon;
revoke execute on function privado.linha_do_prazo(text, date, date, integer, text, timestamptz) from public, anon;

-- Ao excluir o processo, os andamentos e os prazos saem junto, e o processo já não existe para receber o histórico.
create function privado.gravar_no_historico_do_processo(p_processo uuid, p_escritorio uuid, p_campo text, p_de text, p_para text) returns void
language sql security definer set search_path = '' as $$
  insert into public.processo_historico (escritorio_id, processo_id, alteracoes, feito_por)
  select p_escritorio, p_processo, jsonb_build_object(p_campo, jsonb_build_object('de', p_de, 'para', p_para)), auth.uid()
  where p_de is distinct from p_para and exists (select 1 from public.processos p where p.id = p_processo)
$$;
revoke execute on function privado.gravar_no_historico_do_processo(uuid, uuid, text, text, text) from public, anon, authenticated;

create function privado.historico_andamento() returns trigger
language plpgsql security definer set search_path = '' as $$
declare de text; para text; atual public.processo_andamentos;
begin
  -- O que está excluído não tem linha: excluir vai da linha para o vazio, e desfazer, do vazio para a linha.
  if tg_op <> 'INSERT' and old.excluido_em is null then de := privado.linha_do_andamento(old.tipo, old.data, old.hora, old.local, old.texto, old.tratada_em); end if;
  if tg_op <> 'DELETE' and new.excluido_em is null then para := privado.linha_do_andamento(new.tipo, new.data, new.hora, new.local, new.texto, new.tratada_em); end if;
  atual := case when tg_op = 'DELETE' then old else new end;
  perform privado.gravar_no_historico_do_processo(atual.processo_id, atual.escritorio_id, 'andamento', de, para);
  return null;
end $$;
create trigger historico after insert or update or delete on public.processo_andamentos for each row execute function privado.historico_andamento();

create function privado.historico_prazo() returns trigger
language plpgsql security definer set search_path = '' as $$
declare de text; para text; atual public.processo_prazos;
begin
  if tg_op <> 'INSERT' and old.excluido_em is null then de := privado.linha_do_prazo(old.descricao, old.final, old.intimacao, old.dias, old.contagem, old.concluido_em); end if;
  if tg_op <> 'DELETE' and new.excluido_em is null then para := privado.linha_do_prazo(new.descricao, new.final, new.intimacao, new.dias, new.contagem, new.concluido_em); end if;
  atual := case when tg_op = 'DELETE' then old else new end;
  perform privado.gravar_no_historico_do_processo(atual.processo_id, atual.escritorio_id, 'prazo', de, para);
  return null;
end $$;
create trigger historico after insert or update or delete on public.processo_prazos for each row execute function privado.historico_prazo();

create trigger auditoria after insert or update or delete on public.processo_andamentos for each row execute function privado.auditar();
create trigger auditoria after insert or update or delete on public.processo_prazos for each row execute function privado.auditar();

-- 5. Quem pode: quem vê o processo lê; com o processo ativo, também lança, muda e exclui (excluido_em). Apagar de verdade,
-- só junto com o processo.
create function privado.processo_ativo(p_processo uuid, p_escritorio uuid) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from public.processos p where p.id = p_processo and p.escritorio_id = p_escritorio and p.arquivado_em is null)
$$;
revoke execute on function privado.processo_ativo(uuid, uuid) from public, anon;
grant execute on function privado.processo_ativo(uuid, uuid) to authenticated;

alter table public.processo_andamentos enable row level security;
alter table public.processo_prazos     enable row level security;
revoke all on public.processo_andamentos, public.processo_prazos from anon;
-- O processo e quem criou não mudam depois (ficam de fora da lista).
revoke update, delete on public.processo_andamentos, public.processo_prazos from authenticated;
grant update (tipo, data, hora, local, texto, tratada_em, tarefa_id, excluido_em) on public.processo_andamentos to authenticated;
grant update (descricao, final, intimacao, dias, contagem, disponibilizacao, sem_recesso, andamento_id, tarefa_id, concluido_em, excluido_em) on public.processo_prazos to authenticated;

create policy leitura on public.processo_andamentos for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and exists (select 1 from public.processos p where p.id = processo_id));
create policy incluir on public.processo_andamentos for insert to authenticated
  with check (escritorio_id = (select privado.meu_escritorio()) and criado_por = (select auth.uid()) and privado.processo_ativo(processo_id, escritorio_id));
create policy alterar on public.processo_andamentos for update to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and privado.processo_ativo(processo_id, escritorio_id))
  with check (escritorio_id = (select privado.meu_escritorio()) and privado.processo_ativo(processo_id, escritorio_id));

create policy leitura on public.processo_prazos for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and exists (select 1 from public.processos p where p.id = processo_id));
create policy incluir on public.processo_prazos for insert to authenticated
  with check (escritorio_id = (select privado.meu_escritorio()) and criado_por = (select auth.uid()) and privado.processo_ativo(processo_id, escritorio_id));
create policy alterar on public.processo_prazos for update to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and privado.processo_ativo(processo_id, escritorio_id))
  with check (escritorio_id = (select privado.meu_escritorio()) and privado.processo_ativo(processo_id, escritorio_id));

-- 6. A tarefa ligada ao processo. A ligação nasce com a tarefa e não muda depois (fica de fora de grant update).
alter table public.tarefas add column processo_id uuid references public.processos on delete set null;
create index tarefas_processo on public.tarefas (processo_id) where processo_id is not null;

-- Roda com a permissão de quem grava: só se liga um processo que essa pessoa pode ver.
create function privado.conferir_processo_da_tarefa() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.processo_id is not null
     and not exists (select 1 from public.processos p where p.id = new.processo_id and p.escritorio_id = new.escritorio_id) then
    raise exception 'Processo não encontrado neste escritório.';
  end if;
  return new;
end $$;
create trigger conferir_processo before insert on public.tarefas for each row execute function privado.conferir_processo_da_tarefa();

-- O histórico da tarefa é a função de 20261030120000_tempo_nas_tarefas.sql, com processo_id entre as colunas ignoradas:
-- quando o processo é excluído, a ligação some sem escrever um identificador no histórico.
create or replace function privado.historico_tarefa() returns trigger
language plpgsql security definer set search_path = '' as $$
declare a jsonb := '{}'; k text; vo jsonb := to_jsonb(old); vn jsonb := to_jsonb(new);
begin
  for k in select jsonb_object_keys(vn) loop
    continue when k in ('id', 'escritorio_id', 'codigo', 'pessoa_nome', 'demanda_codigo', 'contrato_codigo', 'busca', 'etapa_ordem',
                        'arquivado_por', 'criado_por', 'criado_em', 'atualizado_por', 'atualizado_em', 'concluida_em', 'processo_id');
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
      when 'demanda_id' then jsonb_build_object('demanda', jsonb_build_object('de', old.demanda_codigo, 'para', new.demanda_codigo))
      when 'contrato_id' then jsonb_build_object('contrato', jsonb_build_object('de', old.contrato_codigo, 'para', new.contrato_codigo))
      else jsonb_build_object(k, jsonb_build_object('de', vo -> k, 'para', vn -> k))
    end;
  end loop;
  if a <> '{}' then
    insert into public.tarefa_historico (escritorio_id, tarefa_id, alteracoes, feito_por)
    values (new.escritorio_id, new.id, a, auth.uid());
  end if;
  return null;
end $$;
