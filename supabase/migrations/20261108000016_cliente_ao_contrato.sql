-- Do cliente ao contrato, sem retrabalho (#269). Só acrescenta (marcos novos de coluna, colunas, uma coluna no contrato,
-- funções); a regra das demandas automáticas fica igual para quem já a usava, só mais completa. A versão anterior do
-- site continua funcionando.
--   1. Em Pessoas, as colunas "Em negociação" e "Contrato fechado" (marco contrato_fechado); em Contratos, o marco
--      aguardando_assinatura na coluna "Aguardando assinatura".
--   2. pessoa_fechar_contrato: a pessoa que chega a "Contrato fechado" ganha um contrato em "Aguardando assinatura",
--      com ela como cliente e o objeto "A definir" (todo contrato precisa de um objeto). Se ela já é cliente de um
--      contrato não arquivado (inclusive um feito à mão), não nasce outro: vale o que ela já tem.
--   3. No contrato, a conta de destino do dinheiro (PF ou PJ), sempre uma conta ativa do mesmo escritório; qualquer um
--      da equipe lê o nome das contas para escolher.
--   4. As demandas nascem dos objetos de verdade ("A definir" não vira demanda); no contrato assinado com "A definir",
--      os objetos que entram no lugar dele também viram demandas. Cada demanda ganha as tarefas do modelo de lista que tem
--      o mesmo nome do objeto, se houver. "A definir" também não entra nas sugestões de objetos do escritório.
--   5. O histórico do contrato mostra o nome da conta de destino.

-- 1. Os marcos novos.
alter table public.quadro_colunas drop constraint quadro_colunas_marco_check;
alter table public.quadro_colunas add constraint quadro_colunas_marco_check
  check (marco in ('assinado', 'inicio', 'concluido', 'contrato_fechado', 'aguardando_assinatura'));

-- As colunas de um escritório: acrescenta só o que falta (nome igual vira a coluna do marco).
create function privado.colunas_do_cliente_ao_contrato(p_escritorio uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_ordem numeric;
begin
  -- Pessoas: "Em negociação".
  if not exists (select 1 from public.quadro_colunas where escritorio_id = p_escritorio and modulo = 'pessoas' and privado.sem_acento(btrim(nome)) = privado.sem_acento('Em negociação')) then
    select coalesce(max(ordem), 0) + 1 into v_ordem from public.quadro_colunas where escritorio_id = p_escritorio and modulo = 'pessoas';
    insert into public.quadro_colunas (escritorio_id, modulo, nome, ordem, criado_por) values (p_escritorio, 'pessoas', 'Em negociação', v_ordem, null);
  end if;
  -- Pessoas: "Contrato fechado", com o marco.
  if not exists (select 1 from public.quadro_colunas where escritorio_id = p_escritorio and modulo = 'pessoas' and marco = 'contrato_fechado') then
    select id into v_id from public.quadro_colunas where escritorio_id = p_escritorio and modulo = 'pessoas' and privado.sem_acento(btrim(nome)) = privado.sem_acento('Contrato fechado');
    if v_id is not null then
      update public.quadro_colunas set marco = 'contrato_fechado' where id = v_id;
    else
      select coalesce(max(ordem), 0) + 1 into v_ordem from public.quadro_colunas where escritorio_id = p_escritorio and modulo = 'pessoas';
      insert into public.quadro_colunas (escritorio_id, modulo, nome, ordem, marco, criado_por) values (p_escritorio, 'pessoas', 'Contrato fechado', v_ordem, 'contrato_fechado', null);
    end if;
  end if;
  -- Contratos: "Aguardando assinatura", com o marco, antes da coluna do assinado.
  if not exists (select 1 from public.quadro_colunas where escritorio_id = p_escritorio and modulo = 'contratos' and marco = 'aguardando_assinatura') then
    select id into v_id from public.quadro_colunas where escritorio_id = p_escritorio and modulo = 'contratos' and privado.sem_acento(btrim(nome)) = privado.sem_acento('Aguardando assinatura');
    if v_id is not null then
      update public.quadro_colunas set marco = 'aguardando_assinatura' where id = v_id;
    else
      select coalesce((select ordem - 0.5 from public.quadro_colunas where escritorio_id = p_escritorio and modulo = 'contratos' and marco = 'assinado'),
                      (select coalesce(max(ordem), 0) + 1 from public.quadro_colunas where escritorio_id = p_escritorio and modulo = 'contratos')) into v_ordem;
      insert into public.quadro_colunas (escritorio_id, modulo, nome, ordem, marco, criado_por) values (p_escritorio, 'contratos', 'Aguardando assinatura', v_ordem, 'aguardando_assinatura', null);
    end if;
  end if;
end $$;
revoke execute on function privado.colunas_do_cliente_ao_contrato(uuid) from public, anon, authenticated;
select privado.colunas_do_cliente_ao_contrato(id) from public.escritorios;

create function privado.colunas_do_cliente_ao_contrato_no_escritorio_novo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform privado.colunas_do_cliente_ao_contrato(new.id);
  return null;
end $$;
create trigger colunas_do_cliente_ao_contrato after insert on public.escritorios
  for each row execute function privado.colunas_do_cliente_ao_contrato_no_escritorio_novo();

-- 2. O contrato que nasce do cliente fechado. O objeto "A definir" é só para o contrato existir: não vira demanda.
create table privado.contratos_do_cliente_fechado (
  pessoa_id   uuid primary key references public.pessoas on delete cascade,
  contrato_id uuid not null references public.contratos on delete cascade,
  em          timestamptz not null default now()
);
revoke all on privado.contratos_do_cliente_fechado from public, anon, authenticated;

-- Devolve {id, codigo, novo}: novo é false quando o contrato já tinha nascido antes (a tela avisa diferente).
create function public.pessoa_fechar_contrato(p_pessoa uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_escritorio uuid := privado.meu_escritorio(); v_resp uuid; v_etapa uuid; v_id uuid; v_codigo text;
begin
  -- A trava na pessoa faz duas chamadas ao mesmo tempo (o arraste no quadro e a troca no cartão, ou duas pessoas)
  -- esperarem uma pela outra: a segunda já acha o contrato da primeira.
  perform 1 from public.pessoas where id = p_pessoa and escritorio_id = v_escritorio for update;
  if not found then raise exception 'Pessoa não encontrada neste escritório.'; end if;
  if not coalesce((select (modulos ->> 'contratos')::boolean from public.escritorios where id = v_escritorio), false) then return null; end if;
  -- Um contrato só: se a pessoa já é cliente de um contrato não arquivado (o que nasceu dela aqui ou um feito à mão), é
  -- ele. Vale primeiro o que nasceu dela; depois, o mais recente.
  select k.id, k.codigo into v_id, v_codigo from public.contratos k
  left join privado.contratos_do_cliente_fechado c on c.pessoa_id = p_pessoa and c.contrato_id = k.id
  where k.escritorio_id = v_escritorio and p_pessoa = any(k.clientes) and k.arquivado_em is null
  order by (c.contrato_id is not null) desc, k.criado_em desc, k.id limit 1;
  if v_id is not null then return jsonb_build_object('id', v_id, 'codigo', v_codigo, 'novo', false); end if;
  -- O advogado responsável: quem moveu, se é advogado; se não, o primeiro advogado entre os responsáveis pela pessoa.
  select id into v_resp from public.perfis where id = auth.uid() and escritorio_id = v_escritorio and funcao = 'advogado' and ativo;
  if v_resp is null then
    select r.perfil_id into v_resp from public.pessoa_responsaveis r join public.perfis f on f.id = r.perfil_id
    where r.pessoa_id = p_pessoa and f.funcao = 'advogado' and f.ativo order by r.incluido_em, f.nome, f.id limit 1;
  end if;
  if v_resp is null then raise exception 'O contrato não nasceu: inclua um advogado entre os responsáveis por esta pessoa (no cartão dela) e mova de novo.'; end if;
  select id into v_etapa from public.quadro_colunas where escritorio_id = v_escritorio and modulo = 'contratos' and marco = 'aguardando_assinatura';
  insert into public.contratos (escritorio_id, cliente_id, clientes, responsavel_id, objetos, categoria, etapa_id, etapa_ordem, criado_por)
  values (v_escritorio, p_pessoa, array[p_pessoa], v_resp, array['A definir'], 'pro_labore', v_etapa, extract(epoch from clock_timestamp()), auth.uid())
  returning id, codigo into v_id, v_codigo;
  insert into privado.contratos_do_cliente_fechado (pessoa_id, contrato_id) values (p_pessoa, v_id)
  on conflict (pessoa_id) do update set contrato_id = excluded.contrato_id, em = now();
  return jsonb_build_object('id', v_id, 'codigo', v_codigo, 'novo', true);
end $$;
revoke execute on function public.pessoa_fechar_contrato(uuid) from public, anon;
grant execute on function public.pessoa_fechar_contrato(uuid) to authenticated;

-- 3. A conta de destino do dinheiro do contrato.
alter table public.contratos add column conta_destino_id uuid references public.financeiro_contas on delete set null;
grant insert (conta_destino_id), update (conta_destino_id) on public.contratos to authenticated;
comment on column public.contratos.conta_destino_id is 'Para qual conta do escritório (PF ou PJ) vai o dinheiro deste contrato: a sugerida ao lançar a entrada.';
-- A conta escolhida é uma conta ativa do mesmo escritório. A chave estrangeira sozinha aceitaria a conta de outro
-- escritório (ela não passa pelas regras RLS), e o histórico mostraria o nome dela. A mesma recusa vale para a conta que
-- não existe, sem dizer qual dos dois casos é. Arquivar a conta depois não mexe no contrato.
create function privado.conta_destino_do_escritorio() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.conta_destino_id is null or (tg_op = 'UPDATE' and new.conta_destino_id is not distinct from old.conta_destino_id) then return new; end if;
  if not exists (select 1 from public.financeiro_contas where id = new.conta_destino_id and escritorio_id = new.escritorio_id and arquivada_em is null) then
    raise exception 'Escolha uma conta ativa do escritório para o dinheiro deste contrato.';
  end if;
  return new;
end $$;
create trigger conta_destino before insert or update of conta_destino_id on public.contratos
  for each row execute function privado.conta_destino_do_escritorio();
-- O nome das contas, para quem não é administrador escolher a do contrato (o saldo e os lançamentos continuam só do administrador).
create function public.financeiro_contas_para_escolher() returns table (id uuid, nome text)
language sql stable security definer set search_path = '' as $$
  select c.id, c.nome from public.financeiro_contas c where c.escritorio_id = privado.meu_escritorio() and c.arquivada_em is null order by c.criado_em
$$;
revoke execute on function public.financeiro_contas_para_escolher() from public, anon;
grant execute on function public.financeiro_contas_para_escolher() to authenticated;

-- 4. As tarefas do modelo de uma demanda: o modelo de lista com o mesmo nome do objeto (sem acento e sem maiúsculas).
create function privado.tarefas_do_modelo(p_demanda uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare d public.demandas; v_itens text[]; v_inicio uuid; v_base double precision := extract(epoch from clock_timestamp());
begin
  select * into d from public.demandas where id = p_demanda;
  if d.id is null or d.objeto is null then return; end if;
  select itens into v_itens from public.lista_modelos
  where escritorio_id = d.escritorio_id and privado.sem_acento(lower(btrim(nome))) = privado.sem_acento(lower(btrim(d.objeto)))
  order by criado_em limit 1;
  if v_itens is null or cardinality(v_itens) = 0 then return; end if;
  select id into v_inicio from public.quadro_colunas where escritorio_id = d.escritorio_id and modulo = 'tarefas' and marco = 'inicio';
  insert into public.tarefas (escritorio_id, titulo, responsavel_id, pessoas, demanda_id, contrato_id, etapa_id, etapa_ordem, criado_por)
  -- 300: TAMANHO_TAREFA.titulo em limites.ts (o item do modelo pode ser maior).
  select d.escritorio_id, left(btrim(i.texto), 300), d.responsavel_id, d.clientes, d.id, d.contrato_id, v_inicio, v_base + i.n / 1000.0, coalesce(auth.uid(), d.criado_por)
  from unnest(v_itens) with ordinality as i(texto, n) where btrim(i.texto) <> '';
end $$;
revoke execute on function privado.tarefas_do_modelo(uuid) from public, anon, authenticated;

-- As demandas dos objetos de verdade. Igual à versão de 20261027000017_demandas.sql, mais:
--   - "A definir" não vira demanda, e o contrato só fica marcado (privado.contratos_com_demandas) quando tem objeto de verdade;
--   - no contrato assinado que tinha "A definir", os objetos que entram no lugar dele viram demandas (só esses: o objeto que
--     já virou demanda, e mesmo a demanda que foi excluída, não volta). Mexer nos objetos de um contrato assinado sem
--     "A definir" (corrigir um nome, por exemplo) continua sem criar demanda, como antes;
--   - cada demanda ganha as tarefas do modelo.
create or replace function privado.demandas_do_contrato() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_inicio uuid; v_base double precision := extract(epoch from clock_timestamp()); d record; v_objetos text[];
begin
  if tg_op = 'UPDATE' and new.etapa_id is not distinct from old.etapa_id and new.objetos is not distinct from old.objetos then return null; end if;
  if not exists (select 1 from public.quadro_colunas where id = new.etapa_id and marco = 'assinado') then return null; end if;
  select coalesce(array_agg(o.texto order by o.n), '{}') into v_objetos
  from unnest(new.objetos) with ordinality as o(texto, n) where privado.sem_acento(lower(btrim(o.texto))) <> 'a definir';
  if cardinality(v_objetos) = 0 then return null; end if;
  if tg_op = 'UPDATE' and new.etapa_id is not distinct from old.etapa_id then
    -- Só os objetos mudaram, num contrato que já estava assinado: vale apenas para o que entra no lugar do "A definir".
    if not exists (select 1 from unnest(old.objetos) o where privado.sem_acento(lower(btrim(o))) = 'a definir') then return null; end if;
    select coalesce(array_agg(x.texto order by x.n), '{}') into v_objetos
    from unnest(v_objetos) with ordinality as x(texto, n)
    where not exists (select 1 from unnest(old.objetos) o where privado.sem_acento(lower(btrim(o))) = privado.sem_acento(lower(btrim(x.texto))))
      and not exists (select 1 from public.demandas dd where dd.contrato_id = new.id
                      and privado.sem_acento(lower(btrim(dd.objeto))) = privado.sem_acento(lower(btrim(x.texto))));
    if cardinality(v_objetos) = 0 then return null; end if;
    insert into privado.contratos_com_demandas (contrato_id) values (new.id) on conflict do nothing;
  else
    -- O contrato chegou ao assinado: as demandas nascem uma vez só.
    insert into privado.contratos_com_demandas (contrato_id) values (new.id) on conflict do nothing;
    if not found then return null; end if;
  end if;
  select id into v_inicio from public.quadro_colunas
  where escritorio_id = new.escritorio_id and modulo = 'demandas' and marco = 'inicio';
  for d in
    insert into public.demandas (escritorio_id, titulo, responsavel_id, clientes, contrato_id, objeto, etapa_id, etapa_ordem, criado_por)
    select new.escritorio_id, o.texto, new.responsavel_id, new.clientes, new.id, o.texto, v_inicio, v_base + o.n / 1000.0,
           coalesce(auth.uid(), new.criado_por)
    from unnest(v_objetos) with ordinality as o(texto, n)
    returning id
  loop
    perform privado.tarefas_do_modelo(d.id);
  end loop;
  return null;
end $$;
drop trigger demandas_automaticas on public.contratos;
create trigger demandas_automaticas after insert or update of etapa_id, objetos on public.contratos
  for each row execute function privado.demandas_do_contrato();

-- As sugestões de objetos do escritório não guardam o "A definir". Igual à versão de 20261027000010_contrato_objetos.sql,
-- mais o filtro. (A sugestão "A definir" que alguém já tenha não some aqui: apagar fica para uma migração à parte.)
create or replace function privado.guardar_objetos() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.objeto_sugestoes (escritorio_id, descricao, criado_por)
  select new.escritorio_id, o, auth.uid() from unnest(new.objetos) o
  where privado.sem_acento(lower(btrim(o))) <> 'a definir'
  on conflict (escritorio_id, privado.sem_acento(btrim(descricao))) do nothing;
  return null;
end $$;

-- 5. O histórico do contrato mostra o nome da conta de destino (não o código dela). Igual à versão de
-- 20261027000013_contrato_clientes.sql, mais o caso da conta.
create or replace function privado.historico_contrato() returns trigger
language plpgsql security definer set search_path = '' as $$
declare a jsonb := '{}'; k text; vo jsonb := to_jsonb(old); vn jsonb := to_jsonb(new);
begin
  for k in select jsonb_object_keys(vn) loop
    continue when k in ('id', 'escritorio_id', 'numero', 'sigla', 'ano', 'codigo', 'cliente_nome', 'busca', 'etapa_ordem',
                        'arquivado_por', 'criado_por', 'criado_em', 'atualizado_por', 'atualizado_em', 'objetos',
                        'participante_id', 'participante_percentual', 'cliente_id');
    continue when vo -> k is not distinct from vn -> k;
    a := a || case
      when k = 'etapa_id' then jsonb_build_object('etapa', jsonb_build_object(
        'de', (select nome from public.quadro_colunas where id = old.etapa_id),
        'para', (select nome from public.quadro_colunas where id = new.etapa_id)))
      when k = 'responsavel_id' then jsonb_build_object(k, jsonb_build_object(
        'de', (select nome from public.perfis where id = old.responsavel_id),
        'para', (select nome from public.perfis where id = new.responsavel_id)))
      when k = 'indicador_id' then jsonb_build_object(k, jsonb_build_object(
        'de', (select nome from public.pessoas where id = old.indicador_id),
        'para', (select nome from public.pessoas where id = new.indicador_id)))
      when k = 'conta_destino_id' then jsonb_build_object(k, jsonb_build_object(
        'de', (select nome from public.financeiro_contas where id = old.conta_destino_id and escritorio_id = new.escritorio_id),
        'para', (select nome from public.financeiro_contas where id = new.conta_destino_id and escritorio_id = new.escritorio_id)))
      when k = 'clientes' then jsonb_build_object(k, jsonb_build_object(
        'de', privado.nomes_dos_clientes(old.clientes, ', '),
        'para', privado.nomes_dos_clientes(new.clientes, ', ')))
      when k = 'participantes' then jsonb_build_object(k, jsonb_build_object(
        'de', privado.participantes_legiveis(old.participantes),
        'para', privado.participantes_legiveis(new.participantes)))
      else jsonb_build_object(k, jsonb_build_object('de', vo -> k, 'para', vn -> k))
    end;
  end loop;
  if a <> '{}' then
    insert into public.contrato_historico (escritorio_id, contrato_id, alteracoes, feito_por)
    values (new.escritorio_id, new.id, a, auth.uid());
  end if;
  return null;
end $$;
