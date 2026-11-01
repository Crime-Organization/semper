-- =====================================================================
-- Processos: cadastro, cartão, quadros Judicial e Administrativo (parte da tarefa #47)
--   - Um processo é judicial ou administrativo (não muda depois), com número e pelo menos um cliente.
--   - Código curto e aleatório, como as demandas. O número não repete no escritório, dentro de cada tipo.
--   - Um responsável (qualquer um da equipe), colaboradores (da equipe) e clientes (do cadastro).
--   - Órgão de tramitação: a sigla (TJMG, INPI…), a mesma dos órgãos do calendário de prazos.
--   - Cada tipo tem o seu quadro, com colunas em grupos; Encerrado começa fechado. Primeira e última coluna são marcos.
--   - Sistema, natureza e área vêm de listas prontas (app/src/regras/processo.ts); o administrador acrescenta opções.
--   - Quem vê: quem não é administrador vê só os processos que criou, de que é responsável ou colaborador.
--   - Etiquetas: a mesma lista do escritório, ligada como nos outros módulos.
--   Os tamanhos são os de TAMANHO_PROCESSO em app/src/dados/limites.ts.
--   Só acrescenta. As regras check de quadro_colunas e quadro_grupos ficam mais largas (dois quadros novos). A versão
--   anterior do site continua funcionando: ela não conhece os processos.
-- =====================================================================

-- 1. Os dois quadros novos
alter table public.quadro_colunas drop constraint quadro_colunas_modulo_check;
alter table public.quadro_colunas add constraint quadro_colunas_modulo_check check (modulo in (
  'pessoas', 'contratos', 'demandas', 'tarefas', 'processos', 'compromissos', 'anotacoes', 'financeiro', 'processos_judiciais', 'processos_administrativos'));
alter table public.quadro_grupos drop constraint quadro_grupos_modulo_check;
alter table public.quadro_grupos add constraint quadro_grupos_modulo_check check (modulo in (
  'pessoas', 'contratos', 'demandas', 'tarefas', 'processos', 'compromissos', 'anotacoes', 'financeiro', 'processos_judiciais', 'processos_administrativos'));

-- 2. O processo
create table public.processos (
  id                 uuid primary key default gen_random_uuid(),
  escritorio_id      uuid not null default privado.meu_escritorio() references public.escritorios on delete cascade,
  codigo             text not null,                  -- dado pelo gatilho codigo (curto e aleatório)
  tipo               text not null check (tipo in ('judicial', 'administrativo')),
  numero             text not null check (btrim(numero) <> '' and length(numero) <= 60),
  titulo             text check (length(titulo) <= 300),   -- o nome do cartão; sem ele, aparecem os clientes
  responsavel_id     uuid not null references public.perfis on delete restrict,
  colaboradores      uuid[] not null default '{}' check (cardinality(colaboradores) <= 20),
  clientes           uuid[] not null check (cardinality(clientes) between 1 and 10),
  cliente_nome       text not null default '',       -- os nomes juntos ("A; B"), para a lista, a ordem e a busca
  -- dos dois tipos
  orgao              text check (length(orgao) <= 20),
  sistema            text check (length(sistema) <= 120),
  polo               text check (polo in ('autor', 'reu', 'terceiro')),
  area               text check (length(area) <= 120),
  meio               text check (meio in ('fisico', 'eletronico')),
  -- só dos judiciais
  natureza           text check (length(natureza) <= 120),
  gratuidade         text check (gratuidade in ('pedida', 'concedida', 'negada', 'nao_pedida')),
  comarca            text check (length(comarca) <= 120),
  vara               text check (length(vara) <= 120),
  classe             text check (length(classe) <= 200),
  assunto            text check (length(assunto) <= 200),
  juiz               text check (length(juiz) <= 200),
  distribuicao       date,
  valor_causa        numeric(16, 2) check (valor_causa >= 0),
  instancia          text check (length(instancia) <= 60),
  segredo            boolean not null default false,
  advogado_contrario text check (length(advogado_contrario) <= 200),
  observacoes        text check (length(observacoes) <= 4000),
  -- quadro
  etapa_id           uuid references public.quadro_colunas on delete set null,
  etapa_ordem        double precision,
  -- arquivo: só processos arquivados podem ser excluídos
  arquivado_em       timestamptz,
  arquivado_por      uuid references auth.users on delete set null,
  criado_por         uuid default auth.uid() references auth.users on delete set null,
  criado_em          timestamptz not null default now(),
  atualizado_por     uuid references auth.users on delete set null,
  atualizado_em      timestamptz not null default now(),
  busca              text generated always as (privado.sem_acento(
                       codigo || ' ' || numero || ' ' || regexp_replace(numero, '\D', '', 'g') || ' ' || coalesce(titulo, '') || ' ' || cliente_nome
                       || ' ' || coalesce(orgao, '') || ' ' || coalesce(comarca, '') || ' ' || coalesce(vara, ''))) stored,
  unique (escritorio_id, codigo)
);
create unique index processos_numero_unico on public.processos (escritorio_id, tipo, btrim(numero));
create index processos_etapa on public.processos (escritorio_id, etapa_id, etapa_ordem);
create index processos_responsavel on public.processos (responsavel_id);

create trigger codigo before insert on public.processos for each row execute function privado.gerar_codigo();

-- Liga cada cliente ao processo: quem é cliente de um processo não pode ser excluído.
create table public.processo_clientes (
  processo_id   uuid not null references public.processos on delete cascade,
  pessoa_id     uuid not null constraint processo_clientes_pessoa_id_fkey references public.pessoas on delete restrict,
  escritorio_id uuid not null references public.escritorios on delete cascade,
  ordem         integer not null default 0,
  primary key (processo_id, pessoa_id)
);
create index processo_clientes_pessoa on public.processo_clientes (pessoa_id);

-- Confere e arruma o processo antes de gravar: textos limpos, sigla do órgão em maiúsculas, clientes e equipe do
-- escritório, sem repetir, e os nomes dos clientes juntos em cliente_nome.
create function privado.preparar_processo() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v uuid[] := '{}'; x uuid;
begin
  new.numero := btrim(new.numero);
  new.titulo := nullif(btrim(new.titulo), '');
  new.orgao := nullif(upper(btrim(new.orgao)), '');
  new.sistema := nullif(btrim(new.sistema), '');
  new.area := nullif(btrim(new.area), '');
  new.natureza := nullif(btrim(new.natureza), '');
  new.comarca := nullif(btrim(new.comarca), '');
  new.vara := nullif(btrim(new.vara), '');
  foreach x in array new.clientes loop
    continue when x is null or x = any(v);
    if not exists (select 1 from public.pessoas where id = x and escritorio_id = new.escritorio_id) then
      raise exception 'Cliente não encontrado neste escritório.';
    end if;
    v := v || x;
  end loop;
  if cardinality(v) = 0 then raise exception 'Escolha pelo menos um cliente.'; end if;
  new.clientes := v;
  new.cliente_nome := coalesce(privado.nomes_dos_clientes(v, '; '), '');

  if not exists (select 1 from public.perfis where id = new.responsavel_id and escritorio_id = new.escritorio_id) then
    raise exception 'O responsável precisa ser alguém da equipe do escritório.';
  end if;
  v := '{}';
  foreach x in array new.colaboradores loop
    continue when x is null or x = any(v) or x = new.responsavel_id;
    if not exists (select 1 from public.perfis where id = x and escritorio_id = new.escritorio_id) then
      raise exception 'O colaborador precisa ser alguém da equipe do escritório.';
    end if;
    v := v || x;
  end loop;
  new.colaboradores := v;
  return new;
end $$;
create trigger preparar before insert or update on public.processos
  for each row execute function privado.preparar_processo();
-- A cópia dos nomes dos clientes não conta como alteração do processo.
create trigger carimbo before update on public.processos
  for each row when (old.cliente_nome is not distinct from new.cliente_nome) execute function privado.carimbar();

create function privado.copiar_clientes_do_processo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.processo_clientes c where c.processo_id = new.id and c.pessoa_id <> all (new.clientes);
  insert into public.processo_clientes (processo_id, pessoa_id, escritorio_id, ordem)
  select new.id, u.id, new.escritorio_id, u.i::integer from unnest(new.clientes) with ordinality as u(id, i)
  on conflict (processo_id, pessoa_id) do update set ordem = excluded.ordem;
  return null;
end $$;
create trigger copiar_clientes after insert or update of clientes on public.processos
  for each row execute function privado.copiar_clientes_do_processo();

-- O nome de um cliente que muda no cadastro muda também nos processos dele.
create function privado.nome_do_cliente_nos_processos() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.processos p set cliente_nome = privado.nomes_dos_clientes(p.clientes, '; ') where new.id = any(p.clientes);
  return null;
end $$;
create trigger nome_nos_processos after update of nome on public.pessoas
  for each row when (old.nome is distinct from new.nome) execute function privado.nome_do_cliente_nos_processos();

-- 3. Histórico: o que mudou, campo a campo, com os nomes.
create table public.processo_historico (
  id            bigint generated always as identity primary key,
  escritorio_id uuid not null references public.escritorios on delete cascade,
  processo_id   uuid not null references public.processos on delete cascade,
  alteracoes    jsonb not null,                  -- {"campo": {"de": ..., "para": ...}}
  feito_por     uuid references auth.users on delete set null,
  em            timestamptz not null default now()
);
create index processo_historico_processo on public.processo_historico (processo_id, em desc);

create function privado.historico_processo() returns trigger
language plpgsql security definer set search_path = '' as $$
declare a jsonb := '{}'; k text; vo jsonb := to_jsonb(old); vn jsonb := to_jsonb(new);
begin
  for k in select jsonb_object_keys(vn) loop
    continue when k in ('id', 'escritorio_id', 'codigo', 'tipo', 'cliente_nome', 'busca', 'etapa_ordem', 'arquivado_por',
                        'criado_por', 'criado_em', 'atualizado_por', 'atualizado_em');
    continue when vo -> k is not distinct from vn -> k;
    a := a || case k
      when 'etapa_id' then jsonb_build_object('etapa', jsonb_build_object(
        'de', (select nome from public.quadro_colunas where id = old.etapa_id),
        'para', (select nome from public.quadro_colunas where id = new.etapa_id)))
      when 'responsavel_id' then jsonb_build_object(k, jsonb_build_object(
        'de', (select nome from public.perfis where id = old.responsavel_id),
        'para', (select nome from public.perfis where id = new.responsavel_id)))
      when 'colaboradores' then jsonb_build_object(k, jsonb_build_object(
        'de', privado.nomes_da_equipe(old.colaboradores), 'para', privado.nomes_da_equipe(new.colaboradores)))
      when 'clientes' then jsonb_build_object(k, jsonb_build_object(
        'de', privado.nomes_dos_clientes(old.clientes, ', '), 'para', privado.nomes_dos_clientes(new.clientes, ', ')))
      else jsonb_build_object(k, jsonb_build_object('de', vo -> k, 'para', vn -> k))
    end;
  end loop;
  if a <> '{}' then
    insert into public.processo_historico (escritorio_id, processo_id, alteracoes, feito_por)
    values (new.escritorio_id, new.id, a, auth.uid());
  end if;
  return null;
end $$;
create trigger historico after update on public.processos for each row execute function privado.historico_processo();
create trigger auditoria after insert or update or delete on public.processos for each row execute function privado.auditar();

-- LGPD: ao excluir uma pessoa, o nome dela sai do histórico dos processos em que já foi cliente.
create function privado.esquecer_pessoa_nos_processos() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.processo_historico h
  set alteracoes = jsonb_set(h.alteracoes, '{clientes}', jsonb_build_object(
    'de', replace(h.alteracoes -> 'clientes' ->> 'de', old.nome, 'pessoa excluída'),
    'para', replace(h.alteracoes -> 'clientes' ->> 'para', old.nome, 'pessoa excluída')))
  where h.escritorio_id = old.escritorio_id and h.alteracoes ? 'clientes'
    and (position(old.nome in coalesce(h.alteracoes -> 'clientes' ->> 'de', '')) > 0
         or position(old.nome in coalesce(h.alteracoes -> 'clientes' ->> 'para', '')) > 0);
  return null;
end $$;
create trigger esquecer_nos_processos after delete on public.pessoas
  for each row execute function privado.esquecer_pessoa_nos_processos();

-- 4. Quem vê: administradores, quem criou, o responsável e os colaboradores.
create function privado.vejo_processo(p_escritorio uuid, p_criado_por uuid, p_responsavel uuid, p_colaboradores uuid[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_escritorio = privado.meu_escritorio()
     and (privado.sou_admin() or auth.uid() in (p_criado_por, p_responsavel) or auth.uid() = any(p_colaboradores))
$$;
revoke execute on function privado.vejo_processo(uuid, uuid, uuid, uuid[]) from public, anon;
grant execute on function privado.vejo_processo(uuid, uuid, uuid, uuid[]) to authenticated;

-- A coluna precisa ser do quadro do tipo do processo.
create function privado.etapa_do_processo(p_etapa uuid, p_tipo text) returns boolean
language sql stable set search_path = '' as $$
  select privado.etapa_valida(p_etapa, case p_tipo when 'judicial' then 'processos_judiciais' else 'processos_administrativos' end)
$$;
revoke execute on function privado.etapa_do_processo(uuid, text) from public, anon;
grant execute on function privado.etapa_do_processo(uuid, text) to authenticated;

alter table public.processos          enable row level security;
alter table public.processo_clientes  enable row level security;
alter table public.processo_historico enable row level security;
revoke all on public.processos, public.processo_clientes, public.processo_historico from anon;
revoke insert, update, delete on public.processo_clientes, public.processo_historico from authenticated;

create policy leitura on public.processos for select to authenticated
  using (privado.vejo_processo(escritorio_id, criado_por, responsavel_id, colaboradores));
create policy incluir on public.processos for insert to authenticated
  with check (escritorio_id = (select privado.meu_escritorio()) and criado_por = (select auth.uid())
              and privado.etapa_do_processo(etapa_id, tipo));
create policy alterar on public.processos for update to authenticated
  using (privado.vejo_processo(escritorio_id, criado_por, responsavel_id, colaboradores))
  with check (escritorio_id = (select privado.meu_escritorio()) and privado.etapa_do_processo(etapa_id, tipo));
create policy apagar on public.processos for delete to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and arquivado_em is not null
         and (criado_por = (select auth.uid()) or (select privado.sou_admin())));
-- O tipo não muda depois de criado (fica de fora da lista).
revoke update on public.processos from authenticated;
grant update (numero, titulo, responsavel_id, colaboradores, clientes, orgao, sistema, polo, area, meio, natureza, gratuidade,
  comarca, vara, classe, assunto, juiz, distribuicao, valor_causa, instancia, segredo, advogado_contrario, observacoes,
  etapa_id, etapa_ordem, arquivado_em, arquivado_por) on public.processos to authenticated;

-- Os clientes e o histórico seguem quem vê o processo.
create policy leitura on public.processo_clientes for select to authenticated
  using (exists (select 1 from public.processos p where p.id = processo_id));
create policy leitura on public.processo_historico for select to authenticated
  using (exists (select 1 from public.processos p where p.id = processo_id));

-- 5. Etiquetas: a mesma lista do escritório, ligada como nos outros módulos (20261101131705_etiquetas.sql).
create table public.processo_etiquetas (
  escritorio_id uuid not null default privado.meu_escritorio() references public.escritorios on delete cascade,
  processo_id   uuid not null references public.processos on delete cascade,
  etiqueta_id   uuid not null,
  primary key (processo_id, etiqueta_id),
  foreign key (etiqueta_id, escritorio_id) references public.etiquetas (id, escritorio_id) on delete cascade
);
create index processo_etiquetas_etiqueta on public.processo_etiquetas (etiqueta_id);
alter table public.processo_etiquetas enable row level security;
revoke all on public.processo_etiquetas from anon;
revoke update on public.processo_etiquetas from authenticated;
create policy leitura on public.processo_etiquetas for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and exists (select 1 from public.processos c where c.id = processo_id));
create policy incluir on public.processo_etiquetas for insert to authenticated
  with check (escritorio_id = (select privado.meu_escritorio()) and exists (select 1 from public.processos c where c.id = processo_id));
create policy apagar on public.processo_etiquetas for delete to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and exists (select 1 from public.processos c where c.id = processo_id));

-- 6. As opções que o administrador acrescenta às listas prontas de sistema, natureza e área.
create table public.processo_opcoes (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null default privado.meu_escritorio() references public.escritorios on delete cascade,
  campo         text not null check (campo in ('sistema', 'natureza', 'area')),
  valor         text not null check (btrim(valor) <> '' and length(valor) <= 120),
  criado_em     timestamptz not null default now()
);
create unique index processo_opcoes_unica on public.processo_opcoes (escritorio_id, campo, privado.sem_acento(btrim(valor)));
alter table public.processo_opcoes enable row level security;
revoke all on public.processo_opcoes from anon;
revoke update on public.processo_opcoes from authenticated;
create policy leitura on public.processo_opcoes for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio()));
create policy incluir on public.processo_opcoes for insert to authenticated
  with check (escritorio_id = (select privado.meu_escritorio()) and (select privado.sou_admin()));
create policy apagar on public.processo_opcoes for delete to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and (select privado.sou_admin()));

-- 7. Os quadros de cada escritório: grupos e colunas aprovados, em ordem. Primeira coluna e última são marcos.
create function privado.criar_quadros_de_processos(p_escritorio uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  q record; g record; c text; v_grupo uuid; v_ordem int; v_grupo_ordem int;
  v_total int; v_marco text;
begin
  for q in select * from (values
    ('processos_judiciais', '[
      {"nome": "Início", "colunas": ["Distribuído", "Pedido de habilitação", "Emendar a inicial", "Tutela provisória", "Aguardando citação"]},
      {"nome": "Conhecimento", "colunas": ["Audiência de conciliação", "Contestação/defesa", "Impugnação à contestação", "Cumprir intimação", "Provas/saneamento/perícia", "Audiência de instrução e julgamento", "Alegações finais/memoriais"]},
      {"nome": "Decisão", "colunas": ["Conclusos/aguardando sentença", "Sentença proferida", "Embargos de declaração", "Recolhimento de custas"]},
      {"nome": "Recursal", "colunas": ["Recorrer", "Contrarrazoar", "Agravar", "Aguardando julgamento", "Julgamento designado", "Aguardando trânsito em julgado"]},
      {"nome": "Cumprimento", "colunas": ["Iniciar cumprimento", "Impugnar cumprimento", "Pesquisas/penhora", "Liquidação", "RPV/precatório", "Alvará"]},
      {"nome": "Encerrado", "fechado": true, "colunas": ["Baixado/arquivado"]}
    ]'::jsonb),
    ('processos_administrativos', '[
      {"nome": "Protocolo", "colunas": ["Protocolado", "Publicado"]},
      {"nome": "Exigências e manifestações", "colunas": ["Exigência a cumprir", "Exigência cumprida", "Prazo de oposição", "Manifestar contra oposição", "Perícia médica", "Avaliação social"]},
      {"nome": "Análise", "colunas": ["Aguardando decisão"]},
      {"nome": "Decisão", "colunas": ["Deferido/concedido", "Indeferido", "Recurso administrativo", "Ajuizar ação"]},
      {"nome": "Concessão e vigência", "colunas": ["Pagamento da concessão", "Expedição do certificado", "Registro em vigor", "Retribuição anual", "Prorrogação", "Contra nulidade"]},
      {"nome": "Encerrado", "fechado": true, "colunas": ["Arquivado/baixado"]}
    ]'::jsonb)
  ) as t(modulo, grupos) loop
    continue when exists (select 1 from public.quadro_colunas where escritorio_id = p_escritorio and modulo = q.modulo);
    v_ordem := 0; v_grupo_ordem := 0;
    v_total := (select sum(jsonb_array_length(e -> 'colunas')) from jsonb_array_elements(q.grupos) e);
    for g in select e from jsonb_array_elements(q.grupos) e loop
      v_grupo_ordem := v_grupo_ordem + 1;
      insert into public.quadro_grupos (escritorio_id, modulo, nome, ordem, comeca_fechado)
      values (p_escritorio, q.modulo, g.e ->> 'nome', v_grupo_ordem, coalesce((g.e ->> 'fechado')::boolean, false))
      returning id into v_grupo;
      for c in select jsonb_array_elements_text(g.e -> 'colunas') loop
        v_ordem := v_ordem + 1;
        v_marco := case v_ordem when 1 then 'inicio' when v_total then 'concluido' end;
        insert into public.quadro_colunas (escritorio_id, modulo, nome, ordem, criado_por, marco, grupo_id)
        values (p_escritorio, q.modulo, c, v_ordem, null, v_marco, v_grupo);
      end loop;
    end loop;
  end loop;
end $$;
revoke execute on function privado.criar_quadros_de_processos(uuid) from public, anon, authenticated;

select privado.criar_quadros_de_processos(id) from public.escritorios;

-- Escritório novo já nasce com os dois quadros.
create function privado.quadros_do_escritorio_novo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform privado.criar_quadros_de_processos(new.id);
  return null;
end $$;
create trigger quadros_de_processos after insert on public.escritorios
  for each row execute function privado.quadros_do_escritorio_novo();

-- 8. O módulo ligado.
alter table public.escritorios alter column modulos set default '{"pessoas": true, "contratos": true, "demandas": true, "tarefas": true, "processos": true}';
update public.escritorios set modulos = modulos || '{"processos": true}' where not modulos ? 'processos';
