-- =====================================================================
-- Compromisso ligado a tarefas, demandas e contratos, e o tipo Atendimento (#306)
--   - Tipo novo "atendimento", ao lado de reunião e audiência: como a reunião, precisa de título e de hora e não exige processo
--     (TIPOS_COMPROMISSO em app/src/regras/compromisso.ts).
--   - Ligações novas, de muitos para muitos: compromisso_ligacoes liga um compromisso a uma ou mais tarefas, demandas e contratos
--     (até 30 itens), como anotacao_ligacoes (20261117143714_anotacoes.sql). O processo continua na coluna processo_id do
--     compromisso, como sempre: os compromissos já ligados a um processo continuam ligados, sem mudar nada.
--   - Quem vê a ligação: quem vê o compromisso (o cartão do item só mostra os compromissos que a pessoa vê). Quem liga: quem pode
--     mudar o compromisso ativo (a regra "alterar" dele) e vê o item. Quem desliga: quem pode mudar o compromisso.
--   - Ligar e desligar entram no histórico do compromisso, com o código do item. A ligação guarda o código ao ligar (item_nome): quando o
--     item é excluído, ele já não existe no momento em que a ligação sai, e o histórico ainda diz qual era.
--   - Excluir o item tira a ligação (e o histórico registra o desligamento); excluir o compromisso também.
--
--   Só acrescenta: uma tabela, funções, gatilhos e regras novos, e a regra check do tipo mais larga (aceita um tipo a mais). A versão
--   anterior do site continua funcionando: ela não conhece a tabela nova. Só não sabe mostrar um compromisso do tipo novo, que só o
--   site novo cria.
-- =====================================================================

-- 1. O tipo Atendimento.
alter table public.compromissos drop constraint compromissos_tipo_check;
alter table public.compromissos add constraint compromissos_tipo_check check (tipo in ('audiencia', 'pericia', 'reuniao', 'atendimento', 'outro'));

-- 2. As ligações.
create table public.compromisso_ligacoes (
  id             bigint generated always as identity primary key,
  escritorio_id  uuid not null references public.escritorios on delete cascade,   -- o do compromisso (dado pelo gatilho)
  compromisso_id uuid not null references public.compromissos on delete cascade,
  tarefa_id      uuid references public.tarefas on delete cascade,
  demanda_id     uuid references public.demandas on delete cascade,
  contrato_id    uuid references public.contratos on delete cascade,
  item_nome      text,                                                             -- "Tarefa T1": dado pelo gatilho, para o histórico
  criado_por     uuid default auth.uid() references auth.users on delete set null,
  criado_em      timestamptz not null default now(),
  constraint compromisso_ligado_a_um_item check (num_nonnulls(tarefa_id, demanda_id, contrato_id) = 1),
  -- O mesmo item não se liga duas vezes ao mesmo compromisso (as linhas com a coluna vazia não se chocam).
  constraint compromisso_ligacoes_tarefa_unica   unique (compromisso_id, tarefa_id),
  constraint compromisso_ligacoes_demanda_unica  unique (compromisso_id, demanda_id),
  constraint compromisso_ligacoes_contrato_unico unique (compromisso_id, contrato_id)
);
-- O cartão de cada item acha os compromissos dele.
create index compromisso_ligacoes_tarefa   on public.compromisso_ligacoes (tarefa_id)   where tarefa_id is not null;
create index compromisso_ligacoes_demanda  on public.compromisso_ligacoes (demanda_id)  where demanda_id is not null;
create index compromisso_ligacoes_contrato on public.compromisso_ligacoes (contrato_id) where contrato_id is not null;

-- Quem pode mudar o compromisso (a regra "alterar" da tabela), com ele ativo: liga e desliga itens.
create function privado.altero_o_compromisso(p_compromisso uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.compromissos c
                 where c.id = p_compromisso and c.escritorio_id = privado.meu_escritorio() and c.arquivado_em is null
                   and privado.estou_no_compromisso(c.escritorio_id, c.criado_por, c.responsavel_id, c.participantes, c.processo_id, c.grupos))
$$;
revoke execute on function privado.altero_o_compromisso(uuid) from public, anon;
grant execute on function privado.altero_o_compromisso(uuid) to authenticated;

-- O código do item ligado, para o histórico.
create function privado.codigo_do_item_do_compromisso(l public.compromisso_ligacoes) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((select 'Tarefa ' || t.codigo from public.tarefas t where t.id = l.tarefa_id),
                  (select 'Demanda ' || d.codigo from public.demandas d where d.id = l.demanda_id),
                  (select 'Contrato ' || k.codigo from public.contratos k where k.id = l.contrato_id))
$$;
revoke execute on function privado.codigo_do_item_do_compromisso(public.compromisso_ligacoes) from public, anon, authenticated;

-- Antes de ligar: o escritório é o do compromisso, o item é do mesmo escritório, e o compromisso tem no máximo 30 itens. Só olha
-- o compromisso do escritório de quem liga (o de outro fica como se não existisse, e a regra de incluir recusa igual). Ligar de
-- novo um item que já está ligado não faz nada, se quem liga pode mudar o compromisso. A trava no compromisso faz duas ligações
-- ao mesmo tempo contarem certo.
create function privado.preparar_ligacao_do_compromisso() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_coluna text := case when new.tarefa_id is not null then 'tarefa_id' when new.demanda_id is not null then 'demanda_id'
                        when new.contrato_id is not null then 'contrato_id' end;
  v_tabela text := case v_coluna when 'tarefa_id' then 'tarefas' when 'demanda_id' then 'demandas' when 'contrato_id' then 'contratos' end;
  v_item uuid := coalesce(new.tarefa_id, new.demanda_id, new.contrato_id);
  v_ok boolean;
begin
  select c.escritorio_id into new.escritorio_id from public.compromissos c
  where c.id = new.compromisso_id and (auth.uid() is null or c.escritorio_id = privado.meu_escritorio()) for update;
  -- Sem compromisso ou sem exatamente um item, a chave estrangeira e a regra compromisso_ligado_a_um_item recusam depois.
  if new.escritorio_id is null or v_coluna is null or num_nonnulls(new.tarefa_id, new.demanda_id, new.contrato_id) <> 1 then
    return new;
  end if;
  execute format('select exists (select 1 from public.%I where id = $1 and escritorio_id = $2)', v_tabela) into v_ok using v_item, new.escritorio_id;
  if not v_ok then
    raise exception 'Item não encontrado neste escritório.';
  end if;
  execute format('select exists (select 1 from public.compromisso_ligacoes where compromisso_id = $1 and %I = $2)', v_coluna) into v_ok using new.compromisso_id, v_item;
  if v_ok and privado.altero_o_compromisso(new.compromisso_id) then
    return null;
  end if;
  if (select count(*) from public.compromisso_ligacoes l where l.compromisso_id = new.compromisso_id) >= 30 then
    raise exception 'Um compromisso pode ser ligado a no máximo 30 itens.';
  end if;
  new.item_nome := privado.codigo_do_item_do_compromisso(new);
  return new;
end $$;
revoke execute on function privado.preparar_ligacao_do_compromisso() from public, anon, authenticated;
create trigger preparar before insert on public.compromisso_ligacoes for each row execute function privado.preparar_ligacao_do_compromisso();

-- Depois de ligar ou desligar: entra no histórico do compromisso ("ligado": de nada para o item; "desligado": do item para nada).
-- Quando o compromisso inteiro sai, as ligações saem junto e não há mais histórico para escrever. Quando o item é excluído, ele já
-- saiu quando a ligação sai: vale o código guardado ao ligar.
create function privado.historico_da_ligacao_do_compromisso() returns trigger
language plpgsql security definer set search_path = '' as $$
declare l public.compromisso_ligacoes := case when tg_op = 'DELETE' then old else new end; v_item text;
begin
  if not exists (select 1 from public.compromissos c where c.id = l.compromisso_id) then
    return null;
  end if;
  v_item := coalesce(privado.codigo_do_item_do_compromisso(l), l.item_nome);
  insert into public.compromisso_historico (escritorio_id, compromisso_id, alteracoes, feito_por)
  values (l.escritorio_id, l.compromisso_id,
          jsonb_build_object('ligacao', case when tg_op = 'DELETE' then jsonb_build_object('de', v_item, 'para', null)
                                             else jsonb_build_object('de', null, 'para', v_item) end),
          auth.uid());
  return null;
end $$;
revoke execute on function privado.historico_da_ligacao_do_compromisso() from public, anon, authenticated;
create trigger historico after insert or delete on public.compromisso_ligacoes
  for each row execute function privado.historico_da_ligacao_do_compromisso();

-- 3. Quem vê e quem muda.
alter table public.compromisso_ligacoes enable row level security;
revoke all on public.compromisso_ligacoes from anon;
revoke select, update on public.compromisso_ligacoes from authenticated;
grant insert, delete on public.compromisso_ligacoes to authenticated;
-- O código guardado (item_nome) é só do histórico: quem vê o compromisso mas não vê o item não o lê por aqui.
grant select (id, escritorio_id, compromisso_id, tarefa_id, demanda_id, contrato_id, criado_por, criado_em) on public.compromisso_ligacoes to authenticated;

-- Lê quem vê o compromisso. Liga quem pode mudar o compromisso e vê o item (a consulta passa pelas regras da tabela do item; o
-- contrato, pela view contratos_da_equipe, que já diz quem o alcança). Desliga quem pode mudar o compromisso.
create policy leitura on public.compromisso_ligacoes for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and exists (select 1 from public.compromissos c where c.id = compromisso_id));
create policy incluir on public.compromisso_ligacoes for insert to authenticated
  with check (escritorio_id = (select privado.meu_escritorio()) and criado_por = (select auth.uid()) and privado.altero_o_compromisso(compromisso_id)
              and (tarefa_id is null or exists (select 1 from public.tarefas x where x.id = tarefa_id))
              and (demanda_id is null or exists (select 1 from public.demandas x where x.id = demanda_id))
              and (contrato_id is null or exists (select 1 from public.contratos_da_equipe x where x.id = contrato_id)));
create policy apagar on public.compromisso_ligacoes for delete to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and privado.altero_o_compromisso(compromisso_id));
