-- =====================================================================
-- Documentos, primeiro passo: anotações em Markdown ligadas a qualquer item (#303)
--   - Uma anotação tem título, texto (Markdown), um responsável e participantes (com quem foi compartilhada), sempre da equipe.
--   - Liga-se a pessoas, processos, contratos, demandas, tarefas e compromissos (até 50 itens), e aparece no cartão de cada um.
--   - Quem vê, dentro do escritório: os administradores, quem criou, o responsável, os participantes, toda a equipe com a chave
--     "equipe_ve_tudo" ou "equipe_edita_tudo", e quem vê algum item ligado a ela (processo, contrato, demanda, tarefa ou compromisso),
--     pelas regras de cada módulo. Quem vê só pelo item ligado só lê.
--   - A ligação a uma pessoa não abre a anotação: todo o escritório vê todas as pessoas, e isso tornaria pública qualquer
--     anotação sobre um cliente.
--   - Quem altera (e liga, desliga, arquiva): os administradores, a equipe com "equipe_edita_tudo", quem criou, o responsável e os
--     participantes. Excluir de vez: só anotação arquivada, por quem criou ou por um administrador, como nos outros módulos.
--   - Ligar a um item exige poder alterar a anotação e ver o item. Ligar de novo o mesmo item não faz nada.
--   Os tamanhos são os de TAMANHO_ANOTACAO e ITENS_DA_ANOTACAO em app/src/dados/limites.ts.
--
--   Só acrescenta (tabelas, funções, gatilhos e regras novos, a chave "anotacoes" em escritorios.modulos, e o caso "anotacoes" em
--   public.cartao_sair, que continua igual para os outros módulos). Nenhuma tabela ou coluna existente muda, e a versão anterior do
--   site continua funcionando: ela não conhece as anotações.
-- =====================================================================

-- 1. A anotação
create table public.anotacoes (
  id             uuid primary key default gen_random_uuid(),
  escritorio_id  uuid not null default privado.meu_escritorio() references public.escritorios on delete cascade,
  codigo         text not null,                  -- dado pelo gatilho codigo (curto e aleatório)
  titulo         text not null check (btrim(titulo) <> '' and length(titulo) <= 300),
  texto          text not null default '' check (length(texto) <= 20000),   -- Markdown
  responsavel_id uuid not null references public.perfis on delete restrict,
  participantes  uuid[] not null default '{}' check (cardinality(participantes) <= 20),   -- perfis da equipe (com quem foi compartilhada)
  -- Os módulos dos itens ligados, em ordem alfabética e sem repetir, para a lista e o filtro "Ligada a" sem juntar tabelas.
  -- Só o gatilho das ligações escreve aqui (fica fora do grant insert e do grant update).
  ligada_a       text[] not null default '{}',
  -- arquivo: só anotações arquivadas podem ser excluídas
  arquivado_em   timestamptz,
  arquivado_por  uuid references auth.users on delete set null,
  criado_por     uuid default auth.uid() references auth.users on delete set null,
  criado_em      timestamptz not null default now(),
  atualizado_por uuid references auth.users on delete set null,
  atualizado_em  timestamptz not null default now(),
  busca          text generated always as (privado.sem_acento(codigo || ' ' || titulo || ' ' || texto)) stored,
  unique (escritorio_id, codigo)
);
create index anotacoes_recentes on public.anotacoes (escritorio_id, criado_em desc);
create index anotacoes_responsavel on public.anotacoes (responsavel_id);
-- A busca acha pedaços de palavra no meio do texto (como nas pessoas e nos contratos).
create index anotacoes_busca on public.anotacoes using gin (busca extensions.gin_trgm_ops);

create trigger codigo before insert on public.anotacoes for each row execute function privado.gerar_codigo();

-- Confere e arruma a anotação antes de gravar: título sem espaços nas pontas; responsável e participantes da equipe ativa do
-- escritório, sem repetir e sem o responsável entre os participantes. Confere só quem está entrando: quem já estava e saiu da
-- equipe não trava as outras alterações (padrão de 20261109144041_sair_do_cartao.sql).
create function privado.preparar_anotacao() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v uuid[] := '{}'; x uuid;
begin
  new.titulo := btrim(new.titulo);
  new.texto := coalesce(new.texto, '');
  if (tg_op = 'INSERT' or new.responsavel_id is distinct from old.responsavel_id)
     and not exists (select 1 from public.perfis where id = new.responsavel_id and escritorio_id = new.escritorio_id and ativo) then
    raise exception 'O responsável precisa ser alguém da equipe do escritório.';
  end if;
  foreach x in array new.participantes loop
    continue when x is null or x = any(v) or x = new.responsavel_id;
    if (tg_op = 'INSERT' or x <> all(old.participantes))
       and not exists (select 1 from public.perfis where id = x and escritorio_id = new.escritorio_id and ativo) then
      raise exception 'O participante precisa ser alguém da equipe do escritório.';
    end if;
    v := v || x;
  end loop;
  new.participantes := v;
  return new;
end $$;
create trigger preparar before insert or update of titulo, texto, responsavel_id, participantes
  on public.anotacoes for each row execute function privado.preparar_anotacao();
-- A lista dos módulos ligados é uma cópia mantida pelo gatilho das ligações: não conta como alteração da anotação.
create trigger carimbo before update on public.anotacoes
  for each row when (old.ligada_a is not distinct from new.ligada_a)
  execute function privado.carimbar();

-- 2. Histórico: o que mudou, campo a campo, com os nomes.
create table public.anotacao_historico (
  id            bigint generated always as identity primary key,
  escritorio_id uuid not null references public.escritorios on delete cascade,
  anotacao_id   uuid not null references public.anotacoes on delete cascade,
  alteracoes    jsonb not null,                  -- {"campo": {"de": ..., "para": ...}}
  feito_por     uuid references auth.users on delete set null,
  em            timestamptz not null default now()
);
create index anotacao_historico_anotacao on public.anotacao_historico (anotacao_id, em desc);

-- O texto entra como {"de": null, "para": null} (a tela mostra "Texto alterado"): copiar até 20 mil caracteres a cada edição
-- encheria o histórico, e o texto antigo continuaria legível para quem vê a anotação depois de alguém apagar um trecho.
create function privado.historico_anotacao() returns trigger
language plpgsql security definer set search_path = '' as $$
declare a jsonb := '{}'; k text; vo jsonb := to_jsonb(old); vn jsonb := to_jsonb(new);
begin
  for k in select jsonb_object_keys(vn) loop
    continue when k in ('id', 'escritorio_id', 'codigo', 'busca', 'ligada_a', 'arquivado_por', 'criado_por', 'criado_em', 'atualizado_por', 'atualizado_em');
    continue when vo -> k is not distinct from vn -> k;
    a := a || case k
      when 'texto' then jsonb_build_object(k, jsonb_build_object('de', null, 'para', null))
      when 'responsavel_id' then jsonb_build_object(k, jsonb_build_object(
        'de', (select nome from public.perfis where id = old.responsavel_id),
        'para', (select nome from public.perfis where id = new.responsavel_id)))
      when 'participantes' then jsonb_build_object(k, jsonb_build_object(
        'de', privado.nomes_da_equipe(old.participantes), 'para', privado.nomes_da_equipe(new.participantes)))
      else jsonb_build_object(k, jsonb_build_object('de', vo -> k, 'para', vn -> k))
    end;
  end loop;
  if a <> '{}' then
    insert into public.anotacao_historico (escritorio_id, anotacao_id, alteracoes, feito_por)
    values (new.escritorio_id, new.id, a, auth.uid());
  end if;
  return null;
end $$;
create trigger historico after update on public.anotacoes for each row execute function privado.historico_anotacao();
create trigger auditoria after insert or update or delete on public.anotacoes for each row execute function privado.auditar();

-- 3. As ligações: uma coluna por módulo, com um item só por linha (como os comentários). Assim cada ligação tem a chave
--    estrangeira do item: excluir um processo, contrato, demanda, tarefa ou compromisso tira a ligação; uma pessoa ligada a uma
--    anotação não pode ser excluída (como nos compromissos), para a anotação não perder de quem fala sem ninguém ver.
create table public.anotacao_ligacoes (
  id             bigint generated always as identity primary key,
  escritorio_id  uuid not null references public.escritorios on delete cascade,   -- o da anotação (dado pelo gatilho)
  anotacao_id    uuid not null references public.anotacoes on delete cascade,
  pessoa_id      uuid references public.pessoas on delete restrict,
  processo_id    uuid references public.processos on delete cascade,
  contrato_id    uuid references public.contratos on delete cascade,
  demanda_id     uuid references public.demandas on delete cascade,
  tarefa_id      uuid references public.tarefas on delete cascade,
  compromisso_id uuid references public.compromissos on delete cascade,
  criado_por     uuid default auth.uid() references auth.users on delete set null,
  criado_em      timestamptz not null default now(),
  constraint ligacao_a_um_item check (num_nonnulls(pessoa_id, processo_id, contrato_id, demanda_id, tarefa_id, compromisso_id) = 1),
  -- O mesmo item não se liga duas vezes à mesma anotação. São restrições únicas inteiras, e não índices parciais, para o
  -- "insert ... on conflict (anotacao_id, X_id) do nothing" do app achar a regra; as linhas com a coluna vazia não se chocam.
  constraint anotacao_ligacoes_pessoa_unica      unique (anotacao_id, pessoa_id),
  constraint anotacao_ligacoes_processo_unico    unique (anotacao_id, processo_id),
  constraint anotacao_ligacoes_contrato_unico    unique (anotacao_id, contrato_id),
  constraint anotacao_ligacoes_demanda_unica     unique (anotacao_id, demanda_id),
  constraint anotacao_ligacoes_tarefa_unica      unique (anotacao_id, tarefa_id),
  constraint anotacao_ligacoes_compromisso_unico unique (anotacao_id, compromisso_id)
);
-- O cartão de cada item acha as anotações dele.
create index anotacao_ligacoes_pessoa      on public.anotacao_ligacoes (pessoa_id)      where pessoa_id is not null;
create index anotacao_ligacoes_processo    on public.anotacao_ligacoes (processo_id)    where processo_id is not null;
create index anotacao_ligacoes_contrato    on public.anotacao_ligacoes (contrato_id)    where contrato_id is not null;
create index anotacao_ligacoes_demanda     on public.anotacao_ligacoes (demanda_id)     where demanda_id is not null;
create index anotacao_ligacoes_tarefa      on public.anotacao_ligacoes (tarefa_id)      where tarefa_id is not null;
create index anotacao_ligacoes_compromisso on public.anotacao_ligacoes (compromisso_id) where compromisso_id is not null;

-- Antes de ligar: o escritório é o da anotação, o item é do mesmo escritório, e a anotação tem no máximo 50 itens.
-- Só olha a anotação do escritório de quem liga: a de outro escritório fica como se não existisse (a regra de incluir recusa
-- igual), para o banco não dizer a ninguém de fora se uma anotação, ou um item, existe aqui, nem travar a linha dela.
-- Ligar de novo um item que já está ligado não faz nada (a linha é descartada sem erro), se quem liga pode alterar a anotação;
-- quem não pode segue para a regra de incluir, que recusa. A trava na anotação faz duas ligações ao mesmo tempo contarem certo.
create function privado.preparar_ligacao_da_anotacao() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_coluna text := case when new.pessoa_id is not null then 'pessoa_id' when new.processo_id is not null then 'processo_id'
                        when new.contrato_id is not null then 'contrato_id' when new.demanda_id is not null then 'demanda_id'
                        when new.tarefa_id is not null then 'tarefa_id' when new.compromisso_id is not null then 'compromisso_id' end;
  v_tabela text := case v_coluna when 'pessoa_id' then 'pessoas' when 'processo_id' then 'processos' when 'contrato_id' then 'contratos'
                        when 'demanda_id' then 'demandas' when 'tarefa_id' then 'tarefas' when 'compromisso_id' then 'compromissos' end;
  v_item uuid := coalesce(new.pessoa_id, new.processo_id, new.contrato_id, new.demanda_id, new.tarefa_id, new.compromisso_id);
  v_ok boolean;
begin
  select a.escritorio_id into new.escritorio_id from public.anotacoes a
  where a.id = new.anotacao_id and (auth.uid() is null or a.escritorio_id = privado.meu_escritorio()) for update;
  -- Sem anotação ou sem exatamente um item, a chave estrangeira e a regra ligacao_a_um_item recusam depois.
  if new.escritorio_id is null or v_coluna is null or num_nonnulls(new.pessoa_id, new.processo_id, new.contrato_id, new.demanda_id, new.tarefa_id, new.compromisso_id) <> 1 then
    return new;
  end if;
  execute format('select exists (select 1 from public.%I where id = $1 and escritorio_id = $2)', v_tabela) into v_ok using v_item, new.escritorio_id;
  if not v_ok then
    raise exception 'Item não encontrado neste escritório.';
  end if;
  execute format('select exists (select 1 from public.anotacao_ligacoes where anotacao_id = $1 and %I = $2)', v_coluna) into v_ok using new.anotacao_id, v_item;
  if v_ok and privado.altero_a_anotacao(new.anotacao_id) then
    return null;
  end if;
  if (select count(*) from public.anotacao_ligacoes l where l.anotacao_id = new.anotacao_id) >= 50 then
    raise exception 'Uma anotação pode ser ligada a no máximo 50 itens.';
  end if;
  return new;
end $$;

-- Depois de ligar ou desligar (também quando o item é excluído): refaz a lista dos módulos ligados na anotação.
create function privado.ligada_a_da_anotacao() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_anotacao uuid := case when tg_op = 'DELETE' then old.anotacao_id else new.anotacao_id end; v text[];
begin
  select coalesce(array_agg(distinct m order by m), '{}') into v
  from public.anotacao_ligacoes l
  cross join lateral (values (case when l.pessoa_id is not null then 'pessoas' when l.processo_id is not null then 'processos'
                                   when l.contrato_id is not null then 'contratos' when l.demanda_id is not null then 'demandas'
                                   when l.tarefa_id is not null then 'tarefas' when l.compromisso_id is not null then 'compromissos' end)) x(m)
  where l.anotacao_id = v_anotacao;
  update public.anotacoes a set ligada_a = v where a.id = v_anotacao and a.ligada_a is distinct from v;
  return null;
end $$;

create trigger preparar before insert on public.anotacao_ligacoes for each row execute function privado.preparar_ligacao_da_anotacao();
create trigger ligada_a after insert or delete on public.anotacao_ligacoes for each row execute function privado.ligada_a_da_anotacao();

-- 4. Quem vê e quem altera.
-- A anotação abre para quem vê algum item ligado a ela (menos pessoas), pelas regras de cada módulo. Lê as ligações e os itens
-- sem passar pelas regras deles (security definer): a regra de leitura das ligações consulta as anotações, e daria recursão.
-- Por isso as regras de cada módulo estão escritas aqui: vejo_processo, vejo_demanda, vejo_tarefa, participo_do_compromisso com a
-- Agenda geral, e a regra de leitura dos contratos (20261104150227_visibilidade_dos_contratos.sql), com a menção. Se uma delas
-- mudar, esta muda junto. A chave "equipe_ve_tudo" não entra aqui: com ela, a regra de leitura já abre todas as anotações.
-- Devolve de uma vez todas as anotações que quem está logado alcança pelos itens: a regra de leitura a chama uma vez por consulta,
-- e não uma vez por anotação (a contagem da página Documentos passa por todas as anotações do escritório; veja a #278).
create function privado.anotacoes_pelos_itens() returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct l.anotacao_id), '{}')
    from public.anotacao_ligacoes l
    left join public.processos p on p.id = l.processo_id
    left join public.demandas d on d.id = l.demanda_id
    left join public.tarefas t on t.id = l.tarefa_id
    left join public.compromissos c on c.id = l.compromisso_id
    left join public.contratos k on k.id = l.contrato_id
    where l.escritorio_id = privado.meu_escritorio()
      and ((p.id is not null and privado.vejo_processo(p.escritorio_id, p.criado_por, p.responsavel_id, p.colaboradores))
        or (d.id is not null and privado.vejo_demanda(d.escritorio_id, d.criado_por, d.responsavel_id, d.colaboradores))
        or (t.id is not null and privado.vejo_tarefa(t.escritorio_id, t.criado_por, t.responsavel_id, t.participantes, t.demanda_id))
        or (c.id is not null and ((c.geral and c.escritorio_id = privado.meu_escritorio())
                                  or privado.participo_do_compromisso(c.escritorio_id, c.criado_por, c.responsavel_id, c.participantes, c.processo_id)))
        or (k.id is not null and k.escritorio_id = privado.meu_escritorio()
            and (privado.sou_admin()
                 or auth.uid() in (k.criado_por, k.responsavel_id)
                 or k.participantes @> jsonb_build_array(jsonb_build_object('pessoa_id', privado.minha_pessoa()))
                 or k.id = any (privado.contratos_em_que_me_mencionaram()))))
$$;
revoke execute on function privado.anotacoes_pelos_itens() from public, anon;
grant execute on function privado.anotacoes_pelos_itens() to authenticated;

-- Quem pode alterar a anotação (e ligar e desligar itens): ela é do meu escritório, não está arquivada, e sou administrador, a
-- equipe edita tudo, ou eu a criei, sou o responsável ou um participante. Quem só vê pelo item ligado não entra.
create function privado.altero_a_anotacao(p_anotacao uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.anotacoes a
    where a.id = p_anotacao and a.escritorio_id = privado.meu_escritorio() and a.arquivado_em is null
      and (privado.sou_admin() or privado.equipe_edita_tudo() or auth.uid() in (a.criado_por, a.responsavel_id) or auth.uid() = any(a.participantes))
  )
$$;
revoke execute on function privado.altero_a_anotacao(uuid) from public, anon;
grant execute on function privado.altero_a_anotacao(uuid) to authenticated;

alter table public.anotacoes          enable row level security;
alter table public.anotacao_historico enable row level security;
alter table public.anotacao_ligacoes  enable row level security;
revoke all on public.anotacoes, public.anotacao_historico, public.anotacao_ligacoes from anon;
revoke insert, update, delete on public.anotacao_historico from authenticated;
revoke update on public.anotacao_ligacoes from authenticated;

-- As consultas entre parênteses rodam uma vez por leitura, e não uma vez por anotação (como nos quadros, #278).
create policy leitura on public.anotacoes for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio())
         and ((select privado.sou_admin()) or (select privado.equipe_ve_tudo()) or (select privado.equipe_edita_tudo())
              or (select auth.uid()) in (criado_por, responsavel_id) or (select auth.uid()) = any(participantes)
              or id = any ((select privado.anotacoes_pelos_itens())::uuid[])));
create policy incluir on public.anotacoes for insert to authenticated
  with check (escritorio_id = (select privado.meu_escritorio()) and criado_por = (select auth.uid()));
-- Sem a regra de "não arquivada": quem altera também desarquiva.
create policy alterar on public.anotacoes for update to authenticated
  using (escritorio_id = (select privado.meu_escritorio())
         and ((select privado.sou_admin()) or (select privado.equipe_edita_tudo())
              or (select auth.uid()) in (criado_por, responsavel_id) or (select auth.uid()) = any(participantes)))
  with check (escritorio_id = (select privado.meu_escritorio()));
create policy apagar on public.anotacoes for delete to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and arquivado_em is not null
         and (criado_por = (select auth.uid()) or (select privado.sou_admin())));
-- Ao criar e ao alterar, só as colunas que a pessoa escreve: o escritório, o código, a lista dos módulos ligados, o arquivo e as
-- datas vêm do banco (uma anotação nunca nasce arquivada, com datas escolhidas ou dizendo estar ligada ao que não está).
revoke insert, update on public.anotacoes from authenticated;
grant insert (id, titulo, texto, responsavel_id, participantes, criado_por) on public.anotacoes to authenticated;
grant update (titulo, texto, responsavel_id, participantes, arquivado_em, arquivado_por) on public.anotacoes to authenticated;

-- O histórico segue quem vê a anotação.
create policy leitura on public.anotacao_historico for select to authenticated
  using (exists (select 1 from public.anotacoes a where a.id = anotacao_id));

-- As ligações: lê quem vê a anotação. Liga quem pode alterar a anotação e vê o item (a consulta passa pelas regras da tabela do
-- item; o contrato, pela view contratos_da_equipe, que já diz quem o alcança). Desliga quem pode alterar a anotação.
create policy leitura on public.anotacao_ligacoes for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and exists (select 1 from public.anotacoes a where a.id = anotacao_id));
create policy incluir on public.anotacao_ligacoes for insert to authenticated
  with check (escritorio_id = (select privado.meu_escritorio()) and criado_por = (select auth.uid()) and privado.altero_a_anotacao(anotacao_id)
              and (pessoa_id is null or exists (select 1 from public.pessoas x where x.id = pessoa_id))
              and (processo_id is null or exists (select 1 from public.processos x where x.id = processo_id))
              and (contrato_id is null or exists (select 1 from public.contratos_da_equipe x where x.id = contrato_id))
              and (demanda_id is null or exists (select 1 from public.demandas x where x.id = demanda_id))
              and (tarefa_id is null or exists (select 1 from public.tarefas x where x.id = tarefa_id))
              and (compromisso_id is null or exists (select 1 from public.compromissos x where x.id = compromisso_id)));
create policy apagar on public.anotacao_ligacoes for delete to authenticated
  using (privado.altero_a_anotacao(anotacao_id));

-- 5. Sair da anotação (padrão da #276): a regra de leitura confere também a linha nova, então quem só vê a anotação por estar nela não
--    grava a alteração que o tira dela. Este é o caminho para sair, o mesmo dos outros cartões: tira só quem chama dos participantes
--    (o responsável passa a anotação a outra pessoa antes), e a saída entra no histórico pelo gatilho de sempre. A função continua
--    igual para tarefas, demandas, processos e compromissos; só ganha as anotações.
create or replace function public.cartao_sair(p_modulo text, p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_eu uuid := auth.uid();
  v_escritorio uuid := privado.meu_escritorio();
  v_coluna text := case p_modulo when 'tarefas' then 'participantes' when 'compromissos' then 'participantes' when 'anotacoes' then 'participantes'
                                 when 'demandas' then 'colaboradores' when 'processos' then 'colaboradores' end;
  v_linhas integer;
begin
  if v_coluna is null or v_escritorio is null then
    raise exception 'Você não tem permissão para fazer isso.';
  end if;
  execute format('update public.%I set %I = array_remove(%I, $1) where id = $2 and escritorio_id = $3 and $1 = any(%I)', p_modulo, v_coluna, v_coluna, v_coluna)
    using v_eu, p_id, v_escritorio;
  get diagnostics v_linhas = row_count;
  if v_linhas = 0 then
    raise exception 'Você não está entre as pessoas deste cartão.';
  end if;
end $$;

-- 6. O módulo ligado.
alter table public.escritorios alter column modulos set default '{"pessoas": true, "contratos": true, "demandas": true, "tarefas": true, "processos": true, "compromissos": true, "anotacoes": true}';
update public.escritorios set modulos = modulos || '{"anotacoes": true}' where not modulos ? 'anotacoes';
