-- =====================================================================
-- Financeiro: as parcelas do contrato, o recebimento e os repasses (parte da tarefa #49)
--   - Sócios: uma lista com quem é sócio, desde quando e até quando. O recebimento usa quem era sócio na data dele, e guarda o
--     resultado: mudar a lista depois não muda o passado.
--   - Parcelas: nascem quando o contrato chega à coluna de assinado, todo mês no mesmo dia (ou no último, no mês mais curto), e
--     depois podem ser ajustadas à mão. Quota litis, sucumbência, pro bono e contrato sem valor não geram: lançam-se à mão. A conta
--     é a de parcelasDoContrato em app/src/regras/parcelas.ts. O "desconto" do contrato não entra na conta, como na tela do contrato.
--   - Recebimento: quem registra é o responsável pelo contrato ou um administrador. O banco refaz a divisão (a mesma conta de
--     dividirRecebimento em app/src/regras/financeiro.ts), porque a tela não pode decidir quanto cabe a cada um. Ele grava o DAS
--     usado e cria a entrada no caixa. O lançamento que nasce assim só muda por aqui (estornar), não pela tela do caixa.
--   - Repasses: o que o escritório deve ao responsável e ao sócio que indicou. Pagar cria a saída no caixa; só um administrador
--     paga. Quem recebe vê os seus. O terceiro que não é sócio recebe do responsável: fica só como informação no recebimento.
--   - Sócio responsável com tudo na conta da empresa não recebe a parte dele na hora: ela fica no escritório e conta para o lucro.
--   - Depois que o contrato tem parcelas, só um administrador muda o responsável e a divisão: é deles que saem o acesso e a conta.
--   - O nome de quem recebeu fica nos registros financeiros mesmo depois de excluir a pessoa: guarda por obrigação fiscal.
--   Só acrescenta (tabelas, funções e uma coluna). Com o módulo desligado, nada nasce sozinho: mover um contrato continua igual, a
--   versão anterior do site continua funcionando, e quem liga o módulo é uma pessoa, depois de conferir um mês inteiro.
-- =====================================================================

-- 1. O lançamento que nasce de um recebimento ou de um repasse só muda por lá.
alter table public.financeiro_lancamentos add column origem text check (origem in ('recebimento', 'repasse'));
alter policy incluir on public.financeiro_lancamentos
  with check (escritorio_id = (select privado.meu_escritorio()) and (select privado.sou_admin()) and criado_por = (select auth.uid())
              and categoria <> 'transferencia' and par_id is null and origem is null);

create function privado.lancamento_de_origem() returns trigger
language plpgsql set search_path = '' as $$
begin
  -- As funções abaixo rodam como o sistema; quem grava pela tela é "authenticated".
  if current_user = 'authenticated' then
    raise exception 'Este lançamento nasceu de um recebimento ou de um repasse: desfaça por lá.';
  end if;
  return new;
end $$;
create trigger de_origem before update on public.financeiro_lancamentos
  for each row when (old.origem is not null) execute function privado.lancamento_de_origem();

-- 2. Sócios
create table public.financeiro_socios (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null default privado.meu_escritorio() references public.escritorios on delete cascade,
  pessoa_id     uuid not null constraint financeiro_socios_pessoa_id_fkey references public.pessoas on delete restrict,
  desde         date not null check (desde between date '2000-01-01' and date '2100-12-31'),
  ate           date check (ate is null or ate between date '2000-01-01' and date '2100-12-31'),
  excluido_em   timestamptz,
  criado_por    uuid default auth.uid() references auth.users on delete set null,
  criado_em     timestamptz not null default now(),
  check (ate is null or ate >= desde)
);
create index financeiro_socios_pessoa on public.financeiro_socios (pessoa_id);

-- A pessoa é do escritório, e o mesmo sócio não tem dois períodos que se cruzam.
create function privado.conferir_socio() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.pessoas where id = new.pessoa_id and escritorio_id = new.escritorio_id) then
    raise exception 'Pessoa não encontrada neste escritório.';
  end if;
  if new.excluido_em is not null then return new; end if;
  perform pg_advisory_xact_lock(hashtext('financeiro_socio:' || new.pessoa_id));
  if exists (select 1 from public.financeiro_socios s
             where s.pessoa_id = new.pessoa_id and s.id <> new.id and s.excluido_em is null
               and s.desde <= coalesce(new.ate, date '2100-12-31') and coalesce(s.ate, date '2100-12-31') >= new.desde) then
    raise exception 'Esta pessoa já é sócia nesse período.';
  end if;
  return new;
end $$;
create trigger conferir before insert or update on public.financeiro_socios for each row execute function privado.conferir_socio();
create trigger auditoria after insert or update or delete on public.financeiro_socios for each row execute function privado.auditar();

-- Mudar a lista muda os recebimentos seguintes: fica registrado com os outros ajustes.
create function privado.ajuste_do_socio() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_nome text := (select nome from public.pessoas where id = new.pessoa_id);
  v_de text := case when tg_op = 'UPDATE' and old.excluido_em is null then privado.periodo_do_socio(old.desde, old.ate) end;
  v_para text := case when new.excluido_em is null then privado.periodo_do_socio(new.desde, new.ate) end;
begin
  if v_de is distinct from v_para then
    insert into public.financeiro_ajustes (escritorio_id, alteracoes, feito_por)
    values (new.escritorio_id, jsonb_build_object('Sócio: ' || v_nome, jsonb_build_object('de', v_de, 'para', v_para)), auth.uid());
  end if;
  return null;
end $$;
create function privado.periodo_do_socio(p_desde date, p_ate date) returns text
language sql immutable set search_path = '' as $$
  select 'desde ' || to_char(p_desde, 'DD/MM/YYYY') || coalesce(' até ' || to_char(p_ate, 'DD/MM/YYYY'), '')
$$;
create trigger ajuste after insert or update on public.financeiro_socios for each row execute function privado.ajuste_do_socio();

create function privado.era_socio(p_escritorio uuid, p_pessoa uuid, p_data date) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.financeiro_socios s
                 where s.escritorio_id = p_escritorio and s.pessoa_id = p_pessoa and s.excluido_em is null
                   and s.desde <= p_data and (s.ate is null or s.ate >= p_data))
$$;
revoke execute on function privado.era_socio(uuid, uuid, date) from public, anon, authenticated;

alter table public.financeiro_socios enable row level security;
revoke all on public.financeiro_socios from anon;
revoke update, delete on public.financeiro_socios from authenticated;
grant update (desde, ate, excluido_em) on public.financeiro_socios to authenticated;
create policy leitura on public.financeiro_socios for select to authenticated using (escritorio_id = (select privado.meu_escritorio()) and (select privado.sou_admin()));
create policy incluir on public.financeiro_socios for insert to authenticated with check (escritorio_id = (select privado.meu_escritorio()) and (select privado.sou_admin()) and criado_por = (select auth.uid()));
create policy alterar on public.financeiro_socios for update to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and (select privado.sou_admin()))
  with check (escritorio_id = (select privado.meu_escritorio()));

-- 3. Quem cuida do dinheiro de um contrato: um administrador ou o responsável por ele.
create function privado.cuido_do_contrato(p_contrato uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.contratos k
                 where k.id = p_contrato and k.escritorio_id = privado.meu_escritorio()
                   and (privado.sou_admin() or k.responsavel_id = auth.uid()))
$$;
revoke execute on function privado.cuido_do_contrato(uuid) from public, anon;
grant execute on function privado.cuido_do_contrato(uuid) to authenticated;

create function privado.minha_pessoa() returns uuid
language sql stable security definer set search_path = '' as $$
  select pessoa_id from public.perfis where id = auth.uid()
$$;
revoke execute on function privado.minha_pessoa() from public, anon;
grant execute on function privado.minha_pessoa() to authenticated;

-- Para os textos do histórico e do caixa.
create function privado.em_reais(p_centavos bigint) returns text
language sql immutable set search_path = '' as $$
  select 'R$ ' || translate(to_char(p_centavos / 100.0, 'FM999,999,999,999,990.00'), ',.', '.,')
$$;

-- 4. Parcelas
create table public.contrato_parcelas (
  id             uuid primary key default gen_random_uuid(),
  escritorio_id  uuid not null default privado.meu_escritorio() references public.escritorios on delete cascade,
  contrato_id    uuid not null references public.contratos on delete cascade,
  numero         integer not null check (numero > 0),
  vencimento     date not null check (vencimento between date '2000-01-01' and date '2200-12-31'),
  valor          bigint not null check (valor > 0 and valor <= 100000000000000),
  -- Preenchidos por financeiro_receber e limpos por financeiro_estornar.
  recebimento_id uuid,
  recebida_em    date,
  recebido       bigint,
  excluido_em    timestamptz,
  criado_por     uuid default auth.uid() references auth.users on delete set null,
  criado_em      timestamptz not null default now(),
  atualizado_por uuid references auth.users on delete set null,
  atualizado_em  timestamptz not null default now(),
  unique (contrato_id, numero)
);
create index contrato_parcelas_vencimento on public.contrato_parcelas (escritorio_id, vencimento) where excluido_em is null;

-- O escritório vem do contrato, e o número é o seguinte do contrato. A parcela recebida não muda, e a excluída fica como está.
create function privado.preparar_parcela() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.escritorio_id := (select escritorio_id from public.contratos where id = new.contrato_id);
    perform pg_advisory_xact_lock(hashtext('contrato_parcelas:' || new.contrato_id));
    new.numero := coalesce((select max(numero) from public.contrato_parcelas where contrato_id = new.contrato_id), 0) + 1;
    return new;
  end if;
  if new.excluido_em is not null then
    new.excluido_em := coalesce(old.excluido_em, now());
  end if;
  if old.recebimento_id is not null and ((new.vencimento, new.valor) is distinct from (old.vencimento, old.valor) or new.excluido_em is not null) then
    raise exception 'Esta parcela já foi recebida. Estorne o recebimento antes de mudar.';
  end if;
  if old.excluido_em is not null and new.excluido_em is not null and (new.vencimento, new.valor) is distinct from (old.vencimento, old.valor) then
    raise exception 'Esta parcela foi excluída.';
  end if;
  return new;
end $$;
create trigger preparar before insert or update on public.contrato_parcelas for each row execute function privado.preparar_parcela();
create trigger carimbo before update on public.contrato_parcelas for each row execute function privado.carimbar();
create trigger auditoria after insert or update or delete on public.contrato_parcelas for each row execute function privado.auditar();

-- O que acontece com cada parcela fica num histórico à parte, já como a pessoa lê. O do contrato é aberto a todo o escritório, e o
-- dinheiro só aparece para quem cuida do contrato.
create table public.contrato_parcelas_historico (
  id            bigint generated always as identity primary key,
  escritorio_id uuid not null references public.escritorios on delete cascade,
  contrato_id   uuid not null references public.contratos on delete cascade,
  alteracoes    jsonb not null,
  feito_por     uuid references auth.users on delete set null,
  em            timestamptz not null default now()
);
create index contrato_parcelas_historico_contrato on public.contrato_parcelas_historico (contrato_id, em desc);
alter table public.contrato_parcelas_historico enable row level security;
revoke all on public.contrato_parcelas_historico from anon;
revoke insert, update, delete on public.contrato_parcelas_historico from authenticated;
create policy leitura on public.contrato_parcelas_historico for select to authenticated using (privado.cuido_do_contrato(contrato_id));

create function privado.historico_parcela() returns trigger
language plpgsql security definer set search_path = '' as $$
declare a jsonb := '{}'; v_nome text := 'Parcela ' || new.numero;
begin
  if tg_op = 'INSERT' then
    a := jsonb_build_object(v_nome, jsonb_build_object('de', null, 'para', privado.em_reais(new.valor) || ', vence em ' || to_char(new.vencimento, 'DD/MM/YYYY')));
  else
    if new.valor is distinct from old.valor then
      a := a || jsonb_build_object(v_nome || ': valor', jsonb_build_object('de', privado.em_reais(old.valor), 'para', privado.em_reais(new.valor)));
    end if;
    if new.vencimento is distinct from old.vencimento then
      a := a || jsonb_build_object(v_nome || ': vencimento', jsonb_build_object('de', to_char(old.vencimento, 'DD/MM/YYYY'), 'para', to_char(new.vencimento, 'DD/MM/YYYY')));
    end if;
    if new.excluido_em is distinct from old.excluido_em then
      a := a || jsonb_build_object(v_nome, jsonb_build_object('de', null, 'para', case when new.excluido_em is null then 'Devolvida' else 'Excluída' end));
    end if;
    if new.recebimento_id is distinct from old.recebimento_id then
      a := a || jsonb_build_object(v_nome, jsonb_build_object('de', null, 'para', case when new.recebimento_id is null then 'Recebimento estornado'
        else 'Recebida em ' || to_char(new.recebida_em, 'DD/MM/YYYY') || ': ' || privado.em_reais(new.recebido) end));
    end if;
  end if;
  if a <> '{}' then
    insert into public.contrato_parcelas_historico (escritorio_id, contrato_id, alteracoes, feito_por) values (new.escritorio_id, new.contrato_id, a, auth.uid());
  end if;
  return null;
end $$;
create trigger historico after update on public.contrato_parcelas for each row execute function privado.historico_parcela();
-- As geradas de uma vez ficam numa linha só (gerar_parcelas, que roda como o sistema).
create trigger historico_nova after insert on public.contrato_parcelas
  for each row when (current_user = 'authenticated') execute function privado.historico_parcela();

alter table public.contrato_parcelas enable row level security;
revoke all on public.contrato_parcelas from anon;
revoke insert, update, delete on public.contrato_parcelas from authenticated;
grant insert (contrato_id, vencimento, valor, criado_por) on public.contrato_parcelas to authenticated;
grant update (vencimento, valor, excluido_em) on public.contrato_parcelas to authenticated;
create policy leitura on public.contrato_parcelas for select to authenticated using (privado.cuido_do_contrato(contrato_id));
create policy incluir on public.contrato_parcelas for insert to authenticated
  with check (escritorio_id = (select privado.meu_escritorio()) and privado.cuido_do_contrato(contrato_id) and criado_por = (select auth.uid()));
create policy alterar on public.contrato_parcelas for update to authenticated
  using (privado.cuido_do_contrato(contrato_id)) with check (privado.cuido_do_contrato(contrato_id));

-- As parcelas de um contrato: a mesma conta de parcelasDoContrato (regras/parcelas.ts). A entrada é a primeira parcela, o resto se
-- divide nas seguintes, e o que sobra da divisão vai na última: a soma é sempre o valor do contrato.
create function privado.gerar_parcelas(k public.contratos, p_hoje date) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_total bigint := round(coalesce(k.valor, 0) * 100);
  v_entrada bigint := least(round(coalesce(k.entrada, 0) * 100), v_total);
  v_resto bigint := v_total - v_entrada;
  v_n integer := greatest(coalesce(k.parcelas, 1), 1);
  v_primeiro date := coalesce(k.primeiro_pagamento, k.assinado_em, p_hoje);
  v_partes bigint; v_base bigint; v_quantas integer := 0;
begin
  if k.categoria in ('quota_litis', 'sucumbencia', 'pro_bono') or v_total <= 0 then return 0; end if;
  if v_primeiro not between date '2000-01-01' and date '2100-12-31' then return 0; end if;
  v_partes := least(case when v_entrada > 0 then case when v_resto > 0 then greatest(v_n - 1, 1) else 0 end else v_n end, v_resto);
  v_base := case when v_partes > 0 then v_resto / v_partes else 0 end;
  if v_entrada > 0 then
    insert into public.contrato_parcelas (contrato_id, vencimento, valor, criado_por)
    values (k.id, v_primeiro, v_entrada, coalesce(auth.uid(), k.criado_por));
    v_quantas := 1;
  end if;
  for i in 1 .. v_partes loop
    insert into public.contrato_parcelas (contrato_id, vencimento, valor, criado_por)
    values (k.id, (v_primeiro + make_interval(months => v_quantas))::date, case when i = v_partes then v_resto - v_base * (v_partes - 1) else v_base end, coalesce(auth.uid(), k.criado_por));
    v_quantas := v_quantas + 1;
  end loop;
  if v_quantas > 0 then
    insert into public.contrato_parcelas_historico (escritorio_id, contrato_id, alteracoes, feito_por)
    values (k.escritorio_id, k.id, jsonb_build_object('Parcelas', jsonb_build_object('de', null, 'para', v_quantas || ' geradas, somando ' || privado.em_reais(v_total))), auth.uid());
  end if;
  return v_quantas;
end $$;
revoke execute on function privado.gerar_parcelas(public.contratos, date) from public, anon, authenticated;

-- Nascem uma vez só, quando o contrato chega à coluna de assinado, e nunca por cima do que já foi lançado à mão. Com o módulo
-- desligado, nada acontece. O contrato já assinado quando o módulo é ligado não gera sozinho, nem se sair e voltar para a coluna.
create table privado.contratos_com_parcelas (
  contrato_id uuid primary key references public.contratos on delete cascade,
  em          timestamptz not null default now()
);
revoke all on privado.contratos_com_parcelas from public, anon, authenticated;

create function privado.parcelas_do_contrato_assinado() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.etapa_id is not distinct from old.etapa_id then return null; end if;
  if not exists (select 1 from public.quadro_colunas where id = new.etapa_id and marco = 'assinado') then return null; end if;
  if not coalesce((select (modulos ->> 'financeiro')::boolean from public.escritorios where id = new.escritorio_id), false) then return null; end if;
  insert into privado.contratos_com_parcelas (contrato_id) values (new.id) on conflict do nothing;
  if not found then return null; end if;
  if exists (select 1 from public.contrato_parcelas where contrato_id = new.id and excluido_em is null) then return null; end if;
  perform privado.gerar_parcelas(new, (now() at time zone 'America/Sao_Paulo')::date);
  return null;
end $$;
create trigger parcelas_automaticas after insert or update of etapa_id on public.contratos
  for each row execute function privado.parcelas_do_contrato_assinado();

-- O contrato que já passou da assinatura: tem a data dela, ou está na coluna de assinado ou numa depois dela.
create function privado.contrato_ja_assinado(k public.contratos) returns boolean
language sql stable security definer set search_path = '' as $$
  select k.assinado_em is not null or exists (
    select 1 from public.quadro_colunas c
    join public.quadro_colunas a on a.escritorio_id = c.escritorio_id and a.modulo = 'contratos' and a.marco = 'assinado'
    where c.id = k.etapa_id and c.ordem >= a.ordem)
$$;
revoke execute on function privado.contrato_ja_assinado(public.contratos) from public, anon, authenticated;

create function privado.marcar_contratos_ao_ligar() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into privado.contratos_com_parcelas (contrato_id)
  select k.id from public.contratos k where k.escritorio_id = new.id and privado.contrato_ja_assinado(k)
  on conflict do nothing;
  return null;
end $$;
create trigger financeiro_ligado after update of modulos on public.escritorios for each row
  when (coalesce((old.modulos ->> 'financeiro')::boolean, false) = false and coalesce((new.modulos ->> 'financeiro')::boolean, false))
  execute function privado.marcar_contratos_ao_ligar();

-- O contrato assinado antes de ligar o módulo, ou o que ficou sem parcelas, gera por aqui.
create function public.contrato_gerar_parcelas(p_contrato uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare k public.contratos;
begin
  if not privado.cuido_do_contrato(p_contrato) then raise exception 'Só o responsável pelo contrato ou um administrador gera as parcelas.' using errcode = '42501'; end if;
  select * into k from public.contratos where id = p_contrato for update;
  if not privado.contrato_ja_assinado(k) then raise exception 'Este contrato ainda não foi assinado. As parcelas nascem na coluna de assinado.'; end if;
  if exists (select 1 from public.contrato_parcelas where contrato_id = p_contrato and excluido_em is null) then
    raise exception 'Este contrato já tem parcelas.';
  end if;
  insert into privado.contratos_com_parcelas (contrato_id) values (p_contrato) on conflict do nothing;
  return privado.gerar_parcelas(k, (now() at time zone 'America/Sao_Paulo')::date);
end $$;
revoke execute on function public.contrato_gerar_parcelas(uuid) from public, anon;
grant execute on function public.contrato_gerar_parcelas(uuid) to authenticated;

-- Depois que há parcelas, o responsável e a divisão só mudam por um administrador: é deles que saem o acesso às parcelas e a conta de
-- cada recebimento. Antes disso, só o próprio responsável passa o contrato adiante. Com o módulo desligado, tudo continua como antes.
-- As funções do sistema (esquecer uma pessoa, por exemplo) não passam por aqui.
create function privado.trava_da_divisao() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_tem_parcelas boolean;
begin
  if privado.sou_admin() or not coalesce((select (modulos ->> 'financeiro')::boolean from public.escritorios where id = new.escritorio_id), false) then return new; end if;
  v_tem_parcelas := exists (select 1 from public.contrato_parcelas where contrato_id = new.id and excluido_em is null);
  if new.responsavel_id is distinct from old.responsavel_id then
    if old.responsavel_id is distinct from auth.uid() then raise exception 'Só um administrador ou o responsável atual troca o responsável do contrato.'; end if;
    if v_tem_parcelas then raise exception 'Este contrato tem parcelas: só um administrador troca o responsável.'; end if;
  end if;
  if v_tem_parcelas and (new.percentual_escritorio, new.indicador_id, new.indicador_percentual, new.participantes, new.participante_id, new.participante_percentual)
     is distinct from (old.percentual_escritorio, old.indicador_id, old.indicador_percentual, old.participantes, old.participante_id, old.participante_percentual) then
    raise exception 'Este contrato tem parcelas: só um administrador muda a divisão.';
  end if;
  return new;
end $$;
create trigger trava_da_divisao before update on public.contratos
  for each row when (current_user = 'authenticated') execute function privado.trava_da_divisao();

-- 5. Recebimentos
create table public.financeiro_recebimentos (
  id                 uuid primary key default gen_random_uuid(),
  escritorio_id      uuid not null references public.escritorios on delete cascade,
  parcela_id         uuid not null constraint financeiro_recebimentos_parcela_id_fkey references public.contrato_parcelas,
  contrato_id        uuid not null references public.contratos,
  responsavel_id     uuid references public.perfis on delete set null,
  conta_id           uuid not null references public.financeiro_contas,
  data               date not null,
  valor              bigint not null check (valor > 0),
  taxa_maquina       bigint not null check (taxa_maquina >= 0),
  -- O DAS, a parte na conta e se o responsável era sócio ficam guardados: mudar depois não muda o que já foi recebido.
  aliquota_das       numeric(5, 2) not null,
  parte_na_conta     integer not null check (parte_na_conta in (20, 30, 100)),
  responsavel_socio  boolean not null,
  na_conta           bigint not null,
  ficou_com_advogado bigint not null,
  das                bigint not null,
  liquido            bigint not null,
  escritorio         bigint not null,
  responsavel_recebe bigint not null,
  responsavel_fica   bigint not null,
  escritorio_final   bigint not null,
  contribuicao_socio bigint not null,
  terceiros          jsonb not null,
  socio_indicador    jsonb,
  lancamento_id      uuid not null references public.financeiro_lancamentos,
  lancamento_taxa_id uuid references public.financeiro_lancamentos,
  estornado_em       timestamptz,
  estornado_por      uuid references auth.users on delete set null,
  criado_por         uuid references auth.users on delete set null,
  criado_em          timestamptz not null default now()
);
create unique index financeiro_recebimentos_um_por_parcela on public.financeiro_recebimentos (parcela_id) where estornado_em is null;
create index financeiro_recebimentos_contrato on public.financeiro_recebimentos (contrato_id);
alter table public.contrato_parcelas add foreign key (recebimento_id) references public.financeiro_recebimentos on delete set null;
create trigger auditoria after insert or update or delete on public.financeiro_recebimentos for each row execute function privado.auditar();

alter table public.financeiro_recebimentos enable row level security;
revoke all on public.financeiro_recebimentos from anon;
revoke insert, update, delete on public.financeiro_recebimentos from authenticated;
create policy leitura on public.financeiro_recebimentos for select to authenticated using (privado.cuido_do_contrato(contrato_id));

-- 6. Repasses: o que o escritório deve ao responsável e ao sócio que indicou.
create table public.financeiro_repasses (
  id             uuid primary key default gen_random_uuid(),
  escritorio_id  uuid not null references public.escritorios on delete cascade,
  recebimento_id uuid not null references public.financeiro_recebimentos,
  tipo           text not null check (tipo in ('responsavel', 'socio_indicador')),
  perfil_id      uuid references public.perfis on delete set null,
  pessoa_id      uuid constraint financeiro_repasses_pessoa_id_fkey references public.pessoas on delete restrict,
  nome           text not null,
  descricao      text not null,
  valor          bigint not null check (valor > 0),
  conta_sugerida uuid references public.financeiro_contas,
  conta_paga     uuid references public.financeiro_contas,
  pago_em        date,
  lancamento_id  uuid references public.financeiro_lancamentos,
  cancelado_em   timestamptz,
  criado_em      timestamptz not null default now()
);
create index financeiro_repasses_escritorio on public.financeiro_repasses (escritorio_id, criado_em desc) where cancelado_em is null;
create index financeiro_repasses_recebimento on public.financeiro_repasses (recebimento_id);
create trigger auditoria after insert or update or delete on public.financeiro_repasses for each row execute function privado.auditar();

alter table public.financeiro_repasses enable row level security;
revoke all on public.financeiro_repasses from anon;
revoke insert, update, delete on public.financeiro_repasses from authenticated;
create policy leitura on public.financeiro_repasses for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio())
         and ((select privado.sou_admin()) or perfil_id = (select auth.uid()) or pessoa_id = (select privado.minha_pessoa())));

-- 7. A divisão: a mesma conta de dividirRecebimento (regras/financeiro.ts). Valores em centavos.
create function privado.parte(p_centavos bigint, p_percentual numeric) returns bigint
language sql immutable set search_path = '' as $$
  select round(p_centavos * round(p_percentual * 100) / 10000.0)::bigint
$$;

create function privado.dividir_recebimento(p_valor bigint, p_parte integer, p_com_das boolean, p_aliquota numeric, p_taxa bigint,
                                            p_terceiros jsonb, p_socio_indicador boolean, p_responsavel_socio boolean) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare
  v_integral boolean := p_parte = 100;
  v_na_conta bigint;
  v_das bigint; v_taxa bigint := case when p_com_das then p_taxa else 0 end;
  v_socio bigint := case when p_socio_indicador then privado.parte(p_valor, 10) else 0 end;
  v_liquido bigint; v_escritorio bigint; v_recebe bigint := 0; v_fica bigint; v_ficou bigint := 0; v_soma bigint := 0; v_contribuicao bigint := 0;
  v_saida jsonb := '[]'; t jsonb; v_cada bigint; v_pct numeric; v_total_pct numeric := 0;
begin
  if p_valor is null or p_valor <= 0 then raise exception 'Informe o valor recebido.'; end if;
  if p_taxa is null or p_taxa < 0 then raise exception 'A taxa da máquina precisa ser um valor em reais.'; end if;
  if p_taxa > p_valor then raise exception 'A taxa da máquina não pode ser maior que o valor recebido.'; end if;
  if p_parte is null or p_parte not in (20, 30, 100) then raise exception 'Escolha quanto vai para a conta da empresa: 20%%, 30%% ou 100%%.'; end if;
  if p_aliquota is null or p_aliquota not between 0 and 100 then raise exception 'O DAS precisa ser um percentual de 0 a 100, com até duas casas.'; end if;
  for t in select x from jsonb_array_elements(p_terceiros) x loop
    v_total_pct := v_total_pct + (t ->> 'percentual')::numeric;
  end loop;
  if v_total_pct + 20 > 100 then raise exception 'A soma dos percentuais passa do que há para dividir.'; end if;

  v_na_conta := case when v_integral then p_valor else privado.parte(p_valor, p_parte) end;
  if v_na_conta <= 0 then raise exception 'O valor é pequeno demais para dividir.'; end if;
  v_das := case when p_com_das then privado.parte(v_na_conta, p_aliquota) else 0 end;

  if v_integral then
    if v_taxa + v_das > v_na_conta then raise exception 'A taxa da máquina e o DAS passam do que entrou na conta.'; end if;
    v_liquido := v_na_conta - v_das - v_taxa;
    if p_responsavel_socio then
      -- O sócio não recebe a parte dele na hora. Os terceiros seguem recebendo pelas mãos dele.
      for t in select x from jsonb_array_elements(p_terceiros) x loop
        v_cada := privado.parte(v_liquido, (t ->> 'percentual')::numeric);
        v_soma := v_soma + v_cada;
        v_saida := v_saida || jsonb_build_array(t || jsonb_build_object('valor', v_cada));
      end loop;
      v_recebe := v_soma; v_escritorio := v_liquido - v_soma; v_fica := 0; v_contribuicao := v_escritorio;
    else
      v_pct := case when jsonb_array_length(p_terceiros) > 0 then 20 else 30 end;
      v_escritorio := privado.parte(v_liquido, v_pct);
      v_recebe := v_liquido - v_escritorio;
      for t in select x from jsonb_array_elements(p_terceiros) x loop
        v_cada := privado.parte(v_liquido, (t ->> 'percentual')::numeric);
        v_soma := v_soma + v_cada;
        v_saida := v_saida || jsonb_build_array(t || jsonb_build_object('valor', v_cada));
      end loop;
      -- Com tudo dividido entre os terceiros, o arredondamento pode pedir centavos a mais: saem do último.
      if v_soma > v_recebe then
        v_saida := jsonb_set(v_saida, array[(jsonb_array_length(v_saida) - 1)::text, 'valor'],
                             to_jsonb((v_saida -> (jsonb_array_length(v_saida) - 1) ->> 'valor')::bigint - (v_soma - v_recebe)));
        v_soma := v_recebe;
      end if;
      v_fica := v_recebe - v_soma;
    end if;
  else
    v_ficou := p_valor - v_na_conta - v_taxa;
    if v_ficou < 0 then raise exception 'A taxa da máquina passa do que ficou com o advogado.'; end if;
    v_liquido := p_valor - v_das - v_taxa;
    for t in select x from jsonb_array_elements(p_terceiros) x loop
      v_cada := privado.parte(v_liquido, (t ->> 'percentual')::numeric);
      v_soma := v_soma + v_cada;
      v_saida := v_saida || jsonb_build_array(t || jsonb_build_object('valor', v_cada));
    end loop;
    if v_soma > v_ficou then raise exception 'Os repasses passam do que ficou com o advogado.'; end if;
    v_escritorio := v_na_conta - v_das;
    v_fica := v_ficou - v_soma;
  end if;

  return jsonb_build_object('na_conta', v_na_conta, 'ficou_com_advogado', v_ficou, 'das', v_das, 'taxa_maquina', v_taxa, 'liquido', v_liquido,
    'escritorio', v_escritorio, 'responsavel_recebe', v_recebe, 'responsavel_fica', v_fica, 'terceiros', v_saida, 'socio_indicador', v_socio,
    'escritorio_final', v_escritorio - v_socio, 'contribuicao_socio', v_contribuicao);
end $$;
revoke execute on function privado.dividir_recebimento(bigint, integer, boolean, numeric, bigint, jsonb, boolean, boolean) from public, anon, authenticated;

-- Quem entra na divisão de um contrato numa data: os terceiros (só os que têm percentual), o sócio que indicou e se o responsável é sócio.
create function privado.partes_do_recebimento(k public.contratos, p_data date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_terceiros jsonb;
  v_indicador_socio boolean := k.indicador_id is not null and privado.era_socio(k.escritorio_id, k.indicador_id, p_data);
  v_pessoa_resp uuid := (select pessoa_id from public.perfis where id = k.responsavel_id);
begin
  select coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'nome', q.nome, 'percentual', q.percentual) order by q.ordem), '[]') into v_terceiros
  from (
    select (e.x ->> 'pessoa_id')::uuid as id, p.nome, (e.x ->> 'percentual')::numeric as percentual, e.n as ordem
    from jsonb_array_elements(k.participantes) with ordinality as e(x, n)
    join public.pessoas p on p.id = (e.x ->> 'pessoa_id')::uuid
    where coalesce((e.x ->> 'percentual')::numeric, 0) > 0
    union all
    select k.indicador_id, p.nome, k.indicador_percentual, 1000
    from public.pessoas p
    where p.id = k.indicador_id and not v_indicador_socio and coalesce(k.indicador_percentual, 0) > 0
  ) q;
  return jsonb_build_object(
    'terceiros', v_terceiros,
    'socio_indicador', case when v_indicador_socio then (select jsonb_build_object('id', p.id, 'nome', p.nome) from public.pessoas p where p.id = k.indicador_id) end,
    'responsavel_socio', v_pessoa_resp is not null and privado.era_socio(k.escritorio_id, v_pessoa_resp, p_data));
end $$;
revoke execute on function privado.partes_do_recebimento(public.contratos, date) from public, anon, authenticated;

-- O DAS que vale numa data: o do mês ou, sem ele, o último lançado antes.
create function privado.das_na_data(p_escritorio uuid, p_data date) returns public.financeiro_das
language sql stable security definer set search_path = '' as $$
  select * from public.financeiro_das where escritorio_id = p_escritorio and mes <= to_char(p_data, 'YYYY-MM') order by mes desc limit 1
$$;
revoke execute on function privado.das_na_data(uuid, date) from public, anon, authenticated;

-- 8. O que a tela precisa para mostrar a divisão enquanto se digita. Quem não é administrador não lê o caixa: vê só o nome das contas.
create function public.financeiro_para_receber(p_parcela uuid, p_data date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare p public.contrato_parcelas; k public.contratos; d public.financeiro_das;
begin
  select * into p from public.contrato_parcelas where id = p_parcela;
  if p.id is null or not privado.cuido_do_contrato(p.contrato_id) then raise exception 'Só o responsável pelo contrato ou um administrador registra o recebimento.' using errcode = '42501'; end if;
  select * into k from public.contratos where id = p.contrato_id;
  if k.percentual_escritorio is null then raise exception 'O contrato não diz quanto vai para a conta da empresa. Preencha em "Atualizar contrato".'; end if;
  d := privado.das_na_data(k.escritorio_id, p_data);
  return privado.partes_do_recebimento(k, p_data) || jsonb_build_object(
    'parte_na_conta', k.percentual_escritorio,
    'contas', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'nome', c.nome, 'tem_das', c.tem_das) order by c.criado_em), '[]')
               from public.financeiro_contas c where c.escritorio_id = k.escritorio_id and c.arquivada_em is null),
    'das', case when d.mes is null then '[]'::jsonb else jsonb_build_array(jsonb_build_object('mes', d.mes, 'aliquota', d.aliquota)) end);
end $$;
revoke execute on function public.financeiro_para_receber(uuid, date) from public, anon;
grant execute on function public.financeiro_para_receber(uuid, date) to authenticated;

-- 9. Receber: refaz a divisão, cria a entrada no caixa (e a saída da taxa, quando ela sai da conta), o recebimento e os repasses.
create function public.financeiro_receber(p_parcela uuid, p_data date, p_valor bigint, p_conta uuid, p_taxa bigint) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  p public.contrato_parcelas; k public.contratos; c public.financeiro_contas; d public.financeiro_das;
  v_partes jsonb; v_div jsonb; v_aliquota numeric := 0; v_desc text; v_entrada uuid; v_saida_taxa uuid; v_id uuid; v_recebe bigint; v_socio bigint;
begin
  select * into p from public.contrato_parcelas where id = p_parcela for update;
  if p.id is null or not privado.cuido_do_contrato(p.contrato_id) then raise exception 'Só o responsável pelo contrato ou um administrador registra o recebimento.' using errcode = '42501'; end if;
  if p.excluido_em is not null then raise exception 'Esta parcela foi excluída.'; end if;
  if p.recebimento_id is not null then raise exception 'Esta parcela já foi recebida.'; end if;
  select * into k from public.contratos where id = p.contrato_id;
  if k.percentual_escritorio is null then raise exception 'O contrato não diz quanto vai para a conta da empresa. Preencha em "Atualizar contrato".'; end if;
  select * into c from public.financeiro_contas where id = p_conta and escritorio_id = k.escritorio_id;
  if c.id is null then raise exception 'Conta não encontrada neste escritório.'; end if;
  if c.tem_das then
    d := privado.das_na_data(k.escritorio_id, p_data);
    if d.mes is null then raise exception 'Nenhum DAS lançado até este mês. Peça a um administrador para lançar.'; end if;
    v_aliquota := d.aliquota;
  end if;
  v_partes := privado.partes_do_recebimento(k, p_data);
  v_div := privado.dividir_recebimento(p_valor, k.percentual_escritorio, c.tem_das, v_aliquota, p_taxa, v_partes -> 'terceiros',
                                       jsonb_typeof(v_partes -> 'socio_indicador') = 'object', (v_partes ->> 'responsavel_socio')::boolean);
  v_desc := left(k.cliente_nome, 200) || ' (' || k.codigo || ', parcela ' || p.numero || ')';

  insert into public.financeiro_lancamentos (escritorio_id, conta_id, data, tipo, categoria, valor, descricao, origem, criado_por)
  values (k.escritorio_id, p_conta, p_data, 'entrada', 'recebimento', (v_div ->> 'na_conta')::bigint, 'Recebimento: ' || v_desc, 'recebimento', auth.uid())
  returning id into v_entrada;
  -- Abaixo da parte integral, a taxa é do advogado e não passa pela conta.
  if k.percentual_escritorio = 100 and (v_div ->> 'taxa_maquina')::bigint > 0 then
    insert into public.financeiro_lancamentos (escritorio_id, conta_id, data, tipo, categoria, valor, descricao, origem, criado_por)
    values (k.escritorio_id, p_conta, p_data, 'saida', 'despesa', (v_div ->> 'taxa_maquina')::bigint, 'Taxa da máquina: ' || v_desc, 'recebimento', auth.uid())
    returning id into v_saida_taxa;
  end if;

  insert into public.financeiro_recebimentos (escritorio_id, parcela_id, contrato_id, responsavel_id, conta_id, data, valor, taxa_maquina, aliquota_das, parte_na_conta, responsavel_socio,
    na_conta, ficou_com_advogado, das, liquido, escritorio, responsavel_recebe, responsavel_fica, escritorio_final, contribuicao_socio, terceiros, socio_indicador, lancamento_id, lancamento_taxa_id, criado_por)
  values (k.escritorio_id, p.id, k.id, k.responsavel_id, p_conta, p_data, p_valor, (v_div ->> 'taxa_maquina')::bigint, v_aliquota, k.percentual_escritorio, (v_partes ->> 'responsavel_socio')::boolean,
    (v_div ->> 'na_conta')::bigint, (v_div ->> 'ficou_com_advogado')::bigint, (v_div ->> 'das')::bigint, (v_div ->> 'liquido')::bigint, (v_div ->> 'escritorio')::bigint,
    (v_div ->> 'responsavel_recebe')::bigint, (v_div ->> 'responsavel_fica')::bigint, (v_div ->> 'escritorio_final')::bigint, (v_div ->> 'contribuicao_socio')::bigint,
    v_div -> 'terceiros', case when (v_div ->> 'socio_indicador')::bigint > 0 then (v_partes -> 'socio_indicador') || jsonb_build_object('valor', (v_div ->> 'socio_indicador')::bigint) end, v_entrada, v_saida_taxa, auth.uid())
  returning id into v_id;

  v_recebe := (v_div ->> 'responsavel_recebe')::bigint;
  if v_recebe > 0 then
    insert into public.financeiro_repasses (escritorio_id, recebimento_id, tipo, perfil_id, nome, descricao, valor, conta_sugerida)
    select k.escritorio_id, v_id, 'responsavel', f.id, f.nome, v_desc, v_recebe, p_conta from public.perfis f where f.id = k.responsavel_id;
  end if;
  v_socio := (v_div ->> 'socio_indicador')::bigint;
  if v_socio > 0 then
    insert into public.financeiro_repasses (escritorio_id, recebimento_id, tipo, pessoa_id, nome, descricao, valor, conta_sugerida)
    values (k.escritorio_id, v_id, 'socio_indicador', (v_partes #>> '{socio_indicador,id}')::uuid, v_partes #>> '{socio_indicador,nome}', v_desc, v_socio, p_conta);
  end if;

  update public.contrato_parcelas set recebimento_id = v_id, recebida_em = p_data, recebido = p_valor where id = p.id;
  return v_id;
end $$;
revoke execute on function public.financeiro_receber(uuid, date, bigint, uuid, bigint) from public, anon;
grant execute on function public.financeiro_receber(uuid, date, bigint, uuid, bigint) to authenticated;

-- 10. Estornar esconde tudo o que o recebimento criou; restaurar devolve como estava. Repasse já pago precisa ser desfeito antes.
create function public.financeiro_estornar(p_recebimento uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.financeiro_recebimentos;
begin
  select * into r from public.financeiro_recebimentos where id = p_recebimento for update;
  if r.id is null or not privado.cuido_do_contrato(r.contrato_id) then raise exception 'Só o responsável pelo contrato ou um administrador estorna o recebimento.' using errcode = '42501'; end if;
  if r.estornado_em is not null then raise exception 'Este recebimento já foi estornado.'; end if;
  -- Trava os repasses antes de olhar: quem está pagando agora termina primeiro, e o pagamento aparece aqui.
  perform 1 from public.financeiro_repasses where recebimento_id = r.id for update;
  if exists (select 1 from public.financeiro_repasses where recebimento_id = r.id and pago_em is not null) then
    raise exception 'Há repasse já pago deste recebimento. Peça a um administrador para desfazer o pagamento antes.';
  end if;
  update public.financeiro_recebimentos set estornado_em = now(), estornado_por = auth.uid() where id = r.id;
  update public.financeiro_repasses set cancelado_em = now() where recebimento_id = r.id;
  update public.financeiro_lancamentos set excluido_em = now() where id in (r.lancamento_id, r.lancamento_taxa_id);
  update public.contrato_parcelas set recebimento_id = null, recebida_em = null, recebido = null where id = r.parcela_id;
end $$;
revoke execute on function public.financeiro_estornar(uuid) from public, anon;
grant execute on function public.financeiro_estornar(uuid) to authenticated;

create function public.financeiro_restaurar_recebimento(p_recebimento uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.financeiro_recebimentos; p public.contrato_parcelas;
begin
  select * into r from public.financeiro_recebimentos where id = p_recebimento for update;
  if r.id is null or not privado.cuido_do_contrato(r.contrato_id) then raise exception 'Só o responsável pelo contrato ou um administrador desfaz o estorno.' using errcode = '42501'; end if;
  if r.estornado_em is null then return; end if;
  select * into p from public.contrato_parcelas where id = r.parcela_id for update;
  if p.excluido_em is not null then raise exception 'Esta parcela foi excluída.'; end if;
  if p.recebimento_id is not null then raise exception 'Esta parcela já foi recebida de novo.'; end if;
  update public.financeiro_recebimentos set estornado_em = null, estornado_por = null where id = r.id;
  update public.financeiro_repasses set cancelado_em = null where recebimento_id = r.id;
  update public.financeiro_lancamentos set excluido_em = null where id in (r.lancamento_id, r.lancamento_taxa_id);
  update public.contrato_parcelas set recebimento_id = r.id, recebida_em = r.data, recebido = r.valor where id = r.parcela_id;
end $$;
revoke execute on function public.financeiro_restaurar_recebimento(uuid) from public, anon;
grant execute on function public.financeiro_restaurar_recebimento(uuid) to authenticated;

-- 11. Pagar um repasse cria a saída no caixa; desfazer esconde a saída. Só um administrador mexe no caixa.
create function public.financeiro_pagar_repasse(p_repasse uuid, p_conta uuid, p_data date) returns uuid
language plpgsql security definer set search_path = '' as $$
declare r public.financeiro_repasses; v_lancamento uuid;
begin
  if not privado.sou_admin() then raise exception 'Só um administrador mexe no caixa.' using errcode = '42501'; end if;
  select * into r from public.financeiro_repasses where id = p_repasse and escritorio_id = privado.meu_escritorio() for update;
  if r.id is null then raise exception 'Repasse não encontrado neste escritório.'; end if;
  if r.cancelado_em is not null then raise exception 'O recebimento deste repasse foi estornado.'; end if;
  if r.pago_em is not null then raise exception 'Este repasse já foi pago.'; end if;
  if not exists (select 1 from public.financeiro_contas where id = p_conta and escritorio_id = r.escritorio_id) then raise exception 'Conta não encontrada neste escritório.'; end if;
  insert into public.financeiro_lancamentos (escritorio_id, conta_id, data, tipo, categoria, valor, descricao, origem, criado_por)
  values (r.escritorio_id, p_conta, p_data, 'saida', case r.tipo when 'responsavel' then 'repasse' else 'indicacao' end, r.valor,
          left('Repasse a ' || r.nome || ': ' || r.descricao, 300), 'repasse', auth.uid())
  returning id into v_lancamento;
  update public.financeiro_repasses set pago_em = p_data, conta_paga = p_conta, lancamento_id = v_lancamento where id = r.id;
  return v_lancamento;
end $$;
revoke execute on function public.financeiro_pagar_repasse(uuid, uuid, date) from public, anon;
grant execute on function public.financeiro_pagar_repasse(uuid, uuid, date) to authenticated;

create function public.financeiro_desfazer_pagamento(p_repasse uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.financeiro_repasses;
begin
  if not privado.sou_admin() then raise exception 'Só um administrador mexe no caixa.' using errcode = '42501'; end if;
  select * into r from public.financeiro_repasses where id = p_repasse and escritorio_id = privado.meu_escritorio() for update;
  if r.id is null then raise exception 'Repasse não encontrado neste escritório.'; end if;
  if r.pago_em is null then return; end if;
  update public.financeiro_lancamentos set excluido_em = now() where id = r.lancamento_id;
  update public.financeiro_repasses set pago_em = null, conta_paga = null, lancamento_id = null where id = r.id;
end $$;
revoke execute on function public.financeiro_desfazer_pagamento(uuid) from public, anon;
grant execute on function public.financeiro_desfazer_pagamento(uuid) to authenticated;
