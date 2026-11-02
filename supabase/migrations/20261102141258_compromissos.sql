-- =====================================================================
-- Compromissos: a agenda do escritório (tarefa #48)
--   - Tipos: audiência, perícia, reunião e outro (TIPOS_COMPROMISSO em app/src/regras/compromisso.ts).
--     Audiência e perícia exigem um processo e a modalidade (presencial ou virtual), e só elas têm resultado.
--   - Data e hora como o relógio de Brasília mostra, sem conversão de fuso: data (date) e hora (time).
--     Só o tipo "outro" pode ficar sem hora (o dia inteiro).
--   - Pode ser ligado a pessoas do cadastro e a um processo, e aparece no cartão de cada um.
--   - Um responsável e participantes, sempre da equipe.
--   - Quem vê e muda: os administradores, quem criou, o responsável, os participantes e quem vê o processo ligado.
--   - Agenda geral: o compromisso com essa marca é visto por todos do escritório; mudar, só quem já podia.
--   - Quadro por situação: Agendado (início), Confirmado, Realizado (concluído) e Cancelado.
--   - Excluir um processo leva as audiências e perícias dele; os outros compromissos só perdem a ligação.
--   Os tamanhos são os de TAMANHO_COMPROMISSO em app/src/dados/limites.ts.
--
--   Só acrescenta (tabelas, gatilhos e regras novos; a coluna compromisso_id nos comentários). A regra dos comentários
--   que diz "um cartão só" fica mais larga, para aceitar o compromisso. A versão anterior do site continua funcionando:
--   ela não conhece os compromissos.
-- =====================================================================

-- 1. O compromisso
create table public.compromissos (
  id              uuid primary key default gen_random_uuid(),
  escritorio_id   uuid not null default privado.meu_escritorio() references public.escritorios on delete cascade,
  codigo          text not null,                  -- dado pelo gatilho codigo (curto e aleatório)
  tipo            text not null check (tipo in ('audiencia', 'pericia', 'reuniao', 'outro')),
  titulo          text check (length(titulo) <= 300),   -- sem ele (só em audiência e perícia), o cartão mostra o tipo e as pessoas
  data            date not null,
  hora            time,
  hora_fim        time,
  modalidade      text check (modalidade in ('presencial', 'virtual')),
  local           text check (length(local) <= 300),
  resultado       text check (length(resultado) <= 4000),
  observacoes     text check (length(observacoes) <= 4000),
  geral           boolean not null default false,  -- Agenda geral: todos do escritório veem
  responsavel_id  uuid not null references public.perfis on delete restrict,
  participantes   uuid[] not null default '{}' check (cardinality(participantes) <= 20),   -- perfis da equipe
  pessoas         uuid[] not null default '{}' check (cardinality(pessoas) <= 10),         -- pessoas do cadastro
  pessoa_nome     text not null default '',        -- os nomes juntos ("A; B"), para a lista, a ordem e a busca
  processo_id     uuid references public.processos on delete set null,
  processo_codigo text,                            -- para mostrar mesmo a quem não pode abrir o processo
  processo_numero text,                            -- idem, e para a busca
  -- quadro
  etapa_id        uuid references public.quadro_colunas on delete set null,
  etapa_ordem     double precision,
  -- arquivo: só compromissos arquivados podem ser excluídos
  arquivado_em    timestamptz,
  arquivado_por   uuid references auth.users on delete set null,
  criado_por      uuid default auth.uid() references auth.users on delete set null,
  criado_em       timestamptz not null default now(),
  atualizado_por  uuid references auth.users on delete set null,
  atualizado_em   timestamptz not null default now(),
  busca           text generated always as (privado.sem_acento(
                    codigo || ' ' || coalesce(titulo, '') || ' ' || pessoa_nome || ' ' || coalesce(local, '') || ' '
                    || coalesce(processo_codigo, '') || ' ' || coalesce(processo_numero, '') || ' '
                    || regexp_replace(coalesce(processo_numero, ''), '\D', '', 'g'))) stored,
  -- a ordem por nome: o nome do cartão ou, sem ele, as pessoas (é o que aparece na tela)
  nome_ordem      text generated always as (privado.sem_acento(coalesce(titulo, pessoa_nome))) stored,
  unique (escritorio_id, codigo),
  constraint compromisso_tem_nome check (titulo is not null or tipo in ('audiencia', 'pericia')),
  constraint compromisso_tem_processo check (processo_id is not null or tipo not in ('audiencia', 'pericia')),
  constraint compromisso_tem_modalidade check (modalidade is not null or tipo not in ('audiencia', 'pericia')),
  constraint compromisso_tem_hora check (hora is not null or tipo = 'outro'),
  constraint compromisso_termina_depois check (hora_fim is null or (hora is not null and hora_fim > hora)),
  constraint compromisso_resultado_do_tipo check (resultado is null or tipo in ('audiencia', 'pericia'))
);
create index compromissos_data on public.compromissos (escritorio_id, data, hora);
create index compromissos_etapa on public.compromissos (escritorio_id, etapa_id, etapa_ordem);
create index compromissos_responsavel on public.compromissos (responsavel_id);
create index compromissos_processo on public.compromissos (processo_id) where processo_id is not null;

create trigger codigo before insert on public.compromissos for each row execute function privado.gerar_codigo();

-- Liga cada pessoa ao compromisso: quem está num compromisso não pode ser excluído, e ele aparece no cartão dela.
create table public.compromisso_pessoas (
  compromisso_id uuid not null references public.compromissos on delete cascade,
  pessoa_id      uuid not null constraint compromisso_pessoas_pessoa_id_fkey references public.pessoas on delete restrict,
  escritorio_id  uuid not null references public.escritorios on delete cascade,
  ordem          integer not null default 0,
  primary key (compromisso_id, pessoa_id)
);
create index compromisso_pessoas_pessoa on public.compromisso_pessoas (pessoa_id);

-- Confere e arruma o compromisso antes de gravar: textos limpos, pessoas e equipe do escritório, sem repetir, os nomes
-- das pessoas juntos e o processo do escritório, que quem liga pode ver, com o código e o número copiados.
create function privado.preparar_compromisso() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v uuid[] := '{}'; x uuid; p public.processos;
begin
  new.titulo := nullif(btrim(new.titulo), '');
  new.local := nullif(btrim(new.local), '');
  new.resultado := nullif(btrim(new.resultado), '');
  new.observacoes := nullif(btrim(new.observacoes), '');
  foreach x in array new.pessoas loop
    continue when x is null or x = any(v);
    if not exists (select 1 from public.pessoas where id = x and escritorio_id = new.escritorio_id) then
      raise exception 'Pessoa não encontrada neste escritório.';
    end if;
    v := v || x;
  end loop;
  new.pessoas := v;
  new.pessoa_nome := coalesce(privado.nomes_dos_clientes(v, '; '), '');

  if not exists (select 1 from public.perfis where id = new.responsavel_id and escritorio_id = new.escritorio_id) then
    raise exception 'O responsável precisa ser alguém da equipe do escritório.';
  end if;
  v := '{}';
  foreach x in array new.participantes loop
    continue when x is null or x = any(v) or x = new.responsavel_id;
    -- Confere só quem está entrando: quem já estava e saiu da equipe não trava as outras alterações.
    if (tg_op = 'INSERT' or x <> all(old.participantes))
       and not exists (select 1 from public.perfis where id = x and escritorio_id = new.escritorio_id) then
      raise exception 'O participante precisa ser alguém da equipe do escritório.';
    end if;
    v := v || x;
  end loop;
  new.participantes := v;

  if new.processo_id is null then
    new.processo_codigo := null;
    new.processo_numero := null;
  elsif tg_op = 'INSERT' or new.processo_id is distinct from old.processo_id then
    select * into p from public.processos where id = new.processo_id and escritorio_id = new.escritorio_id;
    if p.id is null or (auth.uid() is not null
        and not privado.vejo_processo(p.escritorio_id, p.criado_por, p.responsavel_id, p.colaboradores)) then
      raise exception 'Processo não encontrado neste escritório.';
    end if;
    new.processo_codigo := p.codigo;
    new.processo_numero := p.numero;
  end if;
  return new;
end $$;
create trigger preparar before insert or update of titulo, local, resultado, observacoes, pessoas, responsavel_id, participantes, processo_id
  on public.compromissos for each row execute function privado.preparar_compromisso();
-- As cópias dos nomes das pessoas e do número do processo não contam como alteração do compromisso.
create trigger carimbo before update on public.compromissos
  for each row when (old.pessoa_nome is not distinct from new.pessoa_nome and old.processo_numero is not distinct from new.processo_numero)
  execute function privado.carimbar();

create function privado.copiar_pessoas_do_compromisso() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.compromisso_pessoas p where p.compromisso_id = new.id and p.pessoa_id <> all (new.pessoas);
  insert into public.compromisso_pessoas (compromisso_id, pessoa_id, escritorio_id, ordem)
  select new.id, u.id, new.escritorio_id, u.i::integer from unnest(new.pessoas) with ordinality as u(id, i)
  on conflict (compromisso_id, pessoa_id) do update set ordem = excluded.ordem;
  return null;
end $$;
create trigger copiar_pessoas after insert or update of pessoas on public.compromissos
  for each row execute function privado.copiar_pessoas_do_compromisso();

-- O nome de uma pessoa que muda no cadastro muda também nos compromissos dela.
create function privado.nome_da_pessoa_nos_compromissos() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.compromissos c set pessoa_nome = privado.nomes_dos_clientes(c.pessoas, '; ') where new.id = any(c.pessoas);
  return null;
end $$;
create trigger nome_nos_compromissos after update of nome on public.pessoas
  for each row when (old.nome is distinct from new.nome) execute function privado.nome_da_pessoa_nos_compromissos();

-- O número de um processo que muda muda também nos compromissos dele.
create function privado.numero_do_processo_nos_compromissos() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.compromissos c set processo_numero = new.numero where c.processo_id = new.id;
  return null;
end $$;
create trigger numero_nos_compromissos after update of numero on public.processos
  for each row when (old.numero is distinct from new.numero) execute function privado.numero_do_processo_nos_compromissos();

-- Excluir um processo leva as audiências e perícias dele, que não existem sem processo. Os outros compromissos ficam,
-- sem a ligação (on delete set null).
create function privado.audiencias_do_processo_excluido() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.compromissos c where c.processo_id = old.id and c.tipo in ('audiencia', 'pericia');
  return old;
end $$;
create trigger audiencias_saem_junto before delete on public.processos
  for each row execute function privado.audiencias_do_processo_excluido();

-- 2. Histórico: o que mudou, campo a campo, com os nomes.
create table public.compromisso_historico (
  id             bigint generated always as identity primary key,
  escritorio_id  uuid not null references public.escritorios on delete cascade,
  compromisso_id uuid not null references public.compromissos on delete cascade,
  alteracoes     jsonb not null,                  -- {"campo": {"de": ..., "para": ...}}
  feito_por      uuid references auth.users on delete set null,
  em             timestamptz not null default now()
);
create index compromisso_historico_compromisso on public.compromisso_historico (compromisso_id, em desc);

create function privado.historico_compromisso() returns trigger
language plpgsql security definer set search_path = '' as $$
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
      else jsonb_build_object(k, jsonb_build_object('de', vo -> k, 'para', vn -> k))
    end;
  end loop;
  if a <> '{}' then
    insert into public.compromisso_historico (escritorio_id, compromisso_id, alteracoes, feito_por)
    values (new.escritorio_id, new.id, a, auth.uid());
  end if;
  return null;
end $$;
create trigger historico after update on public.compromissos for each row execute function privado.historico_compromisso();
create trigger auditoria after insert or update or delete on public.compromissos for each row execute function privado.auditar();

-- LGPD: ao excluir uma pessoa, o nome dela sai do histórico dos compromissos em que já esteve.
create function privado.esquecer_pessoa_nos_compromissos() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.compromisso_historico h
  set alteracoes = jsonb_set(h.alteracoes, '{pessoas}', jsonb_build_object(
    'de', replace(h.alteracoes -> 'pessoas' ->> 'de', old.nome, 'pessoa excluída'),
    'para', replace(h.alteracoes -> 'pessoas' ->> 'para', old.nome, 'pessoa excluída')))
  where h.escritorio_id = old.escritorio_id and h.alteracoes ? 'pessoas'
    and (position(old.nome in coalesce(h.alteracoes -> 'pessoas' ->> 'de', '')) > 0
         or position(old.nome in coalesce(h.alteracoes -> 'pessoas' ->> 'para', '')) > 0);
  return null;
end $$;
create trigger esquecer_nos_compromissos after delete on public.pessoas
  for each row execute function privado.esquecer_pessoa_nos_compromissos();

-- 3. Quem vê e muda: administradores, quem criou, o responsável, os participantes e quem vê o processo ligado.
--    A leitura também vale para quem é do escritório, quando o compromisso está na Agenda geral.
create function privado.participo_do_compromisso(p_escritorio uuid, p_criado_por uuid, p_responsavel uuid, p_participantes uuid[], p_processo uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_escritorio = privado.meu_escritorio()
     and (privado.sou_admin() or auth.uid() in (p_criado_por, p_responsavel) or auth.uid() = any(p_participantes)
          or exists (select 1 from public.processos p where p.id = p_processo
                     and privado.vejo_processo(p.escritorio_id, p.criado_por, p.responsavel_id, p.colaboradores)))
$$;
revoke execute on function privado.participo_do_compromisso(uuid, uuid, uuid, uuid[], uuid) from public, anon;
grant execute on function privado.participo_do_compromisso(uuid, uuid, uuid, uuid[], uuid) to authenticated;

alter table public.compromissos          enable row level security;
alter table public.compromisso_pessoas   enable row level security;
alter table public.compromisso_historico enable row level security;
revoke all on public.compromissos, public.compromisso_pessoas, public.compromisso_historico from anon;
revoke insert, update, delete on public.compromisso_pessoas, public.compromisso_historico from authenticated;

create policy leitura on public.compromissos for select to authenticated
  using ((geral and escritorio_id = (select privado.meu_escritorio()))
         or privado.participo_do_compromisso(escritorio_id, criado_por, responsavel_id, participantes, processo_id));
create policy incluir on public.compromissos for insert to authenticated
  with check (escritorio_id = (select privado.meu_escritorio()) and criado_por = (select auth.uid())
              and privado.etapa_valida(etapa_id, 'compromissos'));
create policy alterar on public.compromissos for update to authenticated
  using (privado.participo_do_compromisso(escritorio_id, criado_por, responsavel_id, participantes, processo_id))
  with check (escritorio_id = (select privado.meu_escritorio()) and privado.etapa_valida(etapa_id, 'compromissos'));
create policy apagar on public.compromissos for delete to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and arquivado_em is not null
         and (criado_por = (select auth.uid()) or (select privado.sou_admin())));
revoke update on public.compromissos from authenticated;
grant update (tipo, titulo, data, hora, hora_fim, modalidade, local, resultado, observacoes, geral, responsavel_id, participantes, pessoas,
  processo_id, etapa_id, etapa_ordem, arquivado_em, arquivado_por) on public.compromissos to authenticated;

-- As pessoas e o histórico seguem quem vê o compromisso.
create policy leitura on public.compromisso_pessoas for select to authenticated
  using (exists (select 1 from public.compromissos c where c.id = compromisso_id));
create policy leitura on public.compromisso_historico for select to authenticated
  using (exists (select 1 from public.compromissos c where c.id = compromisso_id));

-- 4. Comentários também nos compromissos. Só se menciona quem vê o compromisso.
alter table public.comentarios add column compromisso_id uuid references public.compromissos on delete cascade;
create index comentarios_do_compromisso on public.comentarios (compromisso_id, criado_em desc) where compromisso_id is not null;
alter table public.comentarios drop constraint comentario_de_um_cartao;
alter table public.comentarios add constraint comentario_de_um_cartao check (num_nonnulls(pessoa_id, contrato_id, demanda_id, tarefa_id, compromisso_id) = 1);

alter policy leitura on public.comentarios
  using (escritorio_id = (select privado.meu_escritorio())
         and (pessoa_id is null or exists (select 1 from public.pessoas p where p.id = pessoa_id))
         and (contrato_id is null or exists (select 1 from public.contratos k where k.id = contrato_id))
         and (demanda_id is null or exists (select 1 from public.demandas d where d.id = demanda_id))
         and (tarefa_id is null or exists (select 1 from public.tarefas t where t.id = tarefa_id))
         and (compromisso_id is null or exists (select 1 from public.compromissos c where c.id = compromisso_id)));
alter policy incluir on public.comentarios
  with check (escritorio_id = (select privado.meu_escritorio()) and autor_id = (select auth.uid())
              and (pessoa_id is null or exists (select 1 from public.pessoas p where p.id = pessoa_id))
              and (contrato_id is null or exists (select 1 from public.contratos k where k.id = contrato_id))
              and (demanda_id is null or exists (select 1 from public.demandas d where d.id = demanda_id))
              and (tarefa_id is null or exists (select 1 from public.tarefas t where t.id = tarefa_id))
              and (compromisso_id is null or exists (select 1 from public.compromissos c where c.id = compromisso_id)));

-- Roda depois do gatilho "preparar" (a ordem é a do nome), que acha as menções no texto: fora da Agenda geral, quem não
-- é administrador, não está no compromisso e não vê o processo ligado não pode ser mencionado.
create function privado.mencao_no_compromisso() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_nome text;
begin
  select p.nome into v_nome from public.perfis p, public.compromissos c
  where c.id = new.compromisso_id and p.id = any(new.mencoes) and not c.geral and p.papel not in ('master', 'admin')
    and p.id is distinct from c.criado_por and p.id <> c.responsavel_id and not p.id = any(c.participantes)
    and not exists (select 1 from public.processos x where x.id = c.processo_id
                    and (p.id = x.criado_por or p.id = x.responsavel_id or p.id = any(x.colaboradores)))
  order by p.nome limit 1;
  if v_nome is not null then
    raise exception 'Não é possível mencionar % neste compromisso: inclua essa pessoa como participante antes.', v_nome;
  end if;
  return new;
end $$;
create trigger preparar_mencao_no_compromisso before insert or update of texto on public.comentarios
  for each row when (new.compromisso_id is not null) execute function privado.mencao_no_compromisso();

-- 5. Etiquetas: a mesma lista do escritório, ligada como nos outros módulos (20261101131705_etiquetas.sql).
create table public.compromisso_etiquetas (
  escritorio_id  uuid not null default privado.meu_escritorio() references public.escritorios on delete cascade,
  compromisso_id uuid not null references public.compromissos on delete cascade,
  etiqueta_id    uuid not null,
  primary key (compromisso_id, etiqueta_id),
  foreign key (etiqueta_id, escritorio_id) references public.etiquetas (id, escritorio_id) on delete cascade
);
create index compromisso_etiquetas_etiqueta on public.compromisso_etiquetas (etiqueta_id);
alter table public.compromisso_etiquetas enable row level security;
revoke all on public.compromisso_etiquetas from anon;
revoke update on public.compromisso_etiquetas from authenticated;
create policy leitura on public.compromisso_etiquetas for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and exists (select 1 from public.compromissos c where c.id = compromisso_id));
-- Ler segue quem vê; aplicar e tirar, só quem pode mudar o compromisso (quem só lê a Agenda geral, não).
create policy incluir on public.compromisso_etiquetas for insert to authenticated
  with check (escritorio_id = (select privado.meu_escritorio()) and exists (select 1 from public.compromissos c where c.id = compromisso_id
              and privado.participo_do_compromisso(c.escritorio_id, c.criado_por, c.responsavel_id, c.participantes, c.processo_id)));
create policy apagar on public.compromisso_etiquetas for delete to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and exists (select 1 from public.compromissos c where c.id = compromisso_id
         and privado.participo_do_compromisso(c.escritorio_id, c.criado_por, c.responsavel_id, c.participantes, c.processo_id)));

-- 6. O quadro de cada escritório. "Agendado" e "Realizado" são as colunas-marco.
insert into public.quadro_sugestoes (modulo, nome, ordem) values
  ('compromissos', 'Agendado', 1), ('compromissos', 'Confirmado', 2), ('compromissos', 'Realizado', 3), ('compromissos', 'Cancelado', 4)
on conflict do nothing;

create function privado.criar_quadro_de_compromissos(p_escritorio uuid) returns void
language sql security definer set search_path = '' as $$
  insert into public.quadro_colunas (escritorio_id, modulo, nome, ordem, criado_por, marco)
  select p_escritorio, 'compromissos', s.nome, s.ordem, null, case s.nome when 'Agendado' then 'inicio' when 'Realizado' then 'concluido' end
  from public.quadro_sugestoes s
  where s.modulo = 'compromissos'
    and not exists (select 1 from public.quadro_colunas c where c.escritorio_id = p_escritorio and c.modulo = 'compromissos');
$$;
revoke execute on function privado.criar_quadro_de_compromissos(uuid) from public, anon, authenticated;

select privado.criar_quadro_de_compromissos(id) from public.escritorios;

-- Escritório novo já nasce com o quadro.
create function privado.quadro_de_compromissos_do_escritorio_novo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform privado.criar_quadro_de_compromissos(new.id);
  return null;
end $$;
create trigger quadro_de_compromissos after insert on public.escritorios
  for each row execute function privado.quadro_de_compromissos_do_escritorio_novo();

-- 7. O módulo ligado.
alter table public.escritorios alter column modulos set default '{"pessoas": true, "contratos": true, "demandas": true, "tarefas": true, "processos": true, "compromissos": true}';
update public.escritorios set modulos = modulos || '{"compromissos": true}' where not modulos ? 'compromissos';
