-- =====================================================================
-- 009 · Contratos
--   O contrato liga o cliente (uma pessoa do cadastro) ao advogado
--   responsável e ao serviço contratado, com os honorários e a divisão
--   combinada (parte enviada ao escritório, participante e indicador).
--   Fica num quadro próprio, com colunas pela situação (em negociação,
--   aguardando assinatura, assinado...), editáveis como as de Pessoas.
--   O documento assinado continua na pasta do Drive: o contrato guarda
--   só o link.
--
--   Número do contrato (ex.: HE62-0163-2026), dado pelo banco ao criar.
--   Nunca muda, nem com a troca do responsável nem com a rescisão:
--   - sigla do responsável na criação: as duas primeiras letras do nome
--     e os dois dígitos verificadores do CPF (do cadastro dele em Pessoas);
--   - número sequencial do escritório (não recomeça a cada ano);
--   - ano em que o contrato foi criado.
--   Os contratos trazidos das planilhas guardam também o código antigo.
--
--   Só acrescenta: tabela e histórico novos, colunas do quadro de contratos
--   em cada escritório e o módulo ligado nos escritórios que já existem.
-- =====================================================================

create table public.contratos (
  id                      uuid primary key default gen_random_uuid(),
  escritorio_id           uuid not null default privado.meu_escritorio() references public.escritorios on delete cascade,
  -- número: dado pelo gatilho numerar (abaixo); ninguém altera depois
  numero                  integer not null check (numero > 0),
  sigla                   text not null check (sigla ~ '^[A-Z]{2}[0-9]{2}$'),
  ano                     integer not null check (ano between 2000 and 2999),
  codigo                  text not null check (codigo ~ '^[A-Z]{2}[0-9]{2}-[0-9]{4,}-[0-9]{4}$'),
  codigo_antigo           text check (codigo_antigo is null or (btrim(codigo_antigo) <> '' and length(codigo_antigo) <= 40)),
  -- partes
  cliente_id              uuid not null constraint contratos_cliente_id_fkey references public.pessoas on delete restrict,
  cliente_nome            text not null,         -- cópia do nome do cliente, para ordenar e buscar (gatilhos abaixo)
  responsavel_id          uuid not null references public.perfis on delete restrict,
  -- serviço e honorários
  servico                 text not null check (btrim(servico) <> '' and length(servico) <= 300),
  categoria               text not null check (categoria in ('pro_labore', 'quota_litis', 'sucumbencia', 'adiantamento_despesas', 'pro_bono')),
  valor                   numeric(14, 2) check (valor >= 0),
  entrada                 numeric(14, 2) check (entrada >= 0),
  parcelas                integer check (parcelas between 1 and 360),
  descontos               numeric(14, 2) check (descontos >= 0),
  assinado_em             date,
  primeiro_pagamento      date,
  -- divisão: parte enviada ao escritório (PJ) e quem mais recebe
  percentual_escritorio   integer check (percentual_escritorio in (20, 30, 100)),
  participante_id         uuid constraint contratos_participante_id_fkey references public.pessoas on delete restrict,
  participante_percentual numeric(5, 2) check (participante_percentual between 0 and 100),
  indicador_id            uuid constraint contratos_indicador_id_fkey references public.pessoas on delete restrict,
  indicador_percentual    numeric(5, 2) check (indicador_percentual between 0 and 100),
  documento_url           text check (documento_url is null or (documento_url ~ '^https?://' and length(documento_url) <= 500)),
  observacoes             text check (observacoes is null or length(observacoes) <= 4000),
  -- quadro (situação do contrato)
  etapa_id                uuid references public.quadro_colunas on delete set null,
  etapa_ordem             double precision,
  -- arquivo: só contratos arquivados podem ser excluídos
  arquivado_em            timestamptz,
  arquivado_por           uuid references auth.users on delete set null,
  criado_por              uuid default auth.uid() references auth.users on delete set null,
  criado_em               timestamptz not null default now(),
  atualizado_por          uuid references auth.users on delete set null,
  atualizado_em           timestamptz not null default now(),
  -- o número entra também só com os dígitos, para a busca por "0163/2026" achar
  busca                   text generated always as (privado.sem_acento(
                            codigo || ' ' || regexp_replace(codigo, '\D', '', 'g') || ' ' || coalesce(codigo_antigo, '') || ' ' ||
                            servico || ' ' || cliente_nome)) stored,
  constraint contratos_entrada_ate_valor   check (entrada is null or valor is null or entrada <= valor),
  constraint contratos_descontos_ate_valor check (descontos is null or valor is null or descontos <= valor),
  constraint contratos_percentuais         check (coalesce(participante_percentual, 0) + coalesce(indicador_percentual, 0) <= 100),
  constraint contratos_participante        check (participante_percentual is null or participante_id is not null),
  constraint contratos_indicador           check (indicador_percentual is null or indicador_id is not null),
  constraint contratos_pessoas_diferentes  check (participante_id is null or indicador_id is null or participante_id <> indicador_id),
  unique (escritorio_id, numero),
  unique (escritorio_id, codigo)
);
create index contratos_busca on public.contratos using gin (busca extensions.gin_trgm_ops);
create index contratos_etapa on public.contratos (escritorio_id, etapa_id, etapa_ordem);
create index contratos_etapa_id on public.contratos (etapa_id);
create index contratos_recentes on public.contratos (escritorio_id, atualizado_em desc);
create index contratos_cliente on public.contratos (cliente_id);
create index contratos_participante on public.contratos (participante_id);
create index contratos_indicador on public.contratos (indicador_id);
create index contratos_responsavel on public.contratos (responsavel_id);

-- Último número dado em cada escritório, guardado à parte: um número nunca se repete, nem quando o
-- contrato mais recente é excluído. Só o gatilho abaixo mexe aqui (o site não enxerga o esquema privado).
create table privado.contrato_numeracao (
  escritorio_id uuid primary key references public.escritorios on delete cascade,
  ultimo        integer not null check (ultimo > 0)
);
revoke all on privado.contrato_numeracao from public, anon, authenticated;

-- Número do contrato novo. A linha do escritório fica travada até o fim da gravação: dois contratos
-- criados ao mesmo tempo recebem números seguidos.
create function privado.numerar_contrato() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_nome text; v_cpf text;
begin
  select f.nome, p.documento into v_nome, v_cpf
  from public.perfis f left join public.pessoas p on p.id = f.pessoa_id
  where f.id = new.responsavel_id and f.escritorio_id = new.escritorio_id;
  if v_nome is null then raise exception 'Escolha o advogado responsável.'; end if;
  new.sigla := upper(left(regexp_replace(privado.sem_acento(v_nome), '[^a-z]', '', 'g'), 2)) || right(coalesce(v_cpf, ''), 2);
  if coalesce(v_cpf, '') !~ '^[0-9]{11}$' or new.sigla !~ '^[A-Z]{2}[0-9]{2}$' then
    raise exception 'Cadastre o CPF de % em Pessoas para gerar o número do contrato.', v_nome;
  end if;
  insert into privado.contrato_numeracao as n (escritorio_id, ultimo) values (new.escritorio_id, 1)
  on conflict (escritorio_id) do update set ultimo = n.ultimo + 1
  returning ultimo into new.numero;
  new.ano := extract(year from now() at time zone 'America/Sao_Paulo')::integer;
  new.codigo := new.sigla || '-' || lpad(new.numero::text, greatest(4, length(new.numero::text)), '0') || '-' || new.ano;
  return new;
end $$;
create trigger numerar before insert on public.contratos for each row execute function privado.numerar_contrato();

-- Nome do cliente copiado no contrato; acompanha a troca de cliente e a mudança do nome no cadastro.
create function privado.contrato_cliente_nome() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.cliente_nome := (select nome from public.pessoas where id = new.cliente_id and escritorio_id = new.escritorio_id);
  if new.cliente_nome is null then raise exception 'Escolha o cliente.'; end if;
  return new;
end $$;
create trigger cliente_nome before insert or update of cliente_id on public.contratos
  for each row execute function privado.contrato_cliente_nome();

create function privado.nome_do_cliente_nos_contratos() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.contratos set cliente_nome = new.nome where cliente_id = new.id and cliente_nome is distinct from new.nome;
  return null;
end $$;
create trigger nome_nos_contratos after update of nome on public.pessoas
  for each row when (old.nome is distinct from new.nome) execute function privado.nome_do_cliente_nos_contratos();

-- A cópia do nome do cliente não conta como alteração do contrato.
create trigger carimbo before update on public.contratos
  for each row when (old.cliente_nome is not distinct from new.cliente_nome) execute function privado.carimbar();

-- ---------------------------------------------------------------------
-- Histórico: o que mudou, campo a campo. Das pessoas, do responsável e
-- da coluna, guarda o nome (o id não diz nada a quem lê).
-- ---------------------------------------------------------------------
create table public.contrato_historico (
  id            bigint generated always as identity primary key,
  escritorio_id uuid not null references public.escritorios on delete cascade,
  contrato_id   uuid not null references public.contratos on delete cascade,
  alteracoes    jsonb not null,                  -- {"campo": {"de": ..., "para": ...}}
  feito_por     uuid references auth.users on delete set null,
  em            timestamptz not null default now()
);
create index contrato_historico_contrato on public.contrato_historico (contrato_id, em desc);

create function privado.historico_contrato() returns trigger
language plpgsql security definer set search_path = '' as $$
declare a jsonb := '{}'; k text; vo jsonb := to_jsonb(old); vn jsonb := to_jsonb(new);
begin
  for k in select jsonb_object_keys(vn) loop
    continue when k in ('id', 'escritorio_id', 'numero', 'sigla', 'ano', 'codigo', 'cliente_nome', 'busca', 'etapa_ordem',
                        'arquivado_por', 'criado_por', 'criado_em', 'atualizado_por', 'atualizado_em');
    continue when vo -> k is not distinct from vn -> k;
    a := a || case
      when k = 'etapa_id' then jsonb_build_object('etapa', jsonb_build_object(
        'de', (select nome from public.quadro_colunas where id = old.etapa_id),
        'para', (select nome from public.quadro_colunas where id = new.etapa_id)))
      when k = 'responsavel_id' then jsonb_build_object(k, jsonb_build_object(
        'de', (select nome from public.perfis where id = old.responsavel_id),
        'para', (select nome from public.perfis where id = new.responsavel_id)))
      when k in ('cliente_id', 'participante_id', 'indicador_id') then jsonb_build_object(k, jsonb_build_object(
        'de', (select nome from public.pessoas where id = (vo ->> k)::uuid),
        'para', (select nome from public.pessoas where id = (vn ->> k)::uuid)))
      else jsonb_build_object(k, jsonb_build_object('de', vo -> k, 'para', vn -> k))
    end;
  end loop;
  if a <> '{}' then
    insert into public.contrato_historico (escritorio_id, contrato_id, alteracoes, feito_por)
    values (new.escritorio_id, new.id, a, auth.uid());
  end if;
  return null;
end $$;
create trigger historico after update on public.contratos for each row execute function privado.historico_contrato();
create trigger auditoria after insert or update or delete on public.contratos for each row execute function privado.auditar();

-- LGPD: ao excluir uma pessoa, o nome dela sai do histórico dos contratos em que já esteve
-- (como participante ou indicador retirado, por exemplo).
create function privado.esquecer_pessoa_nos_contratos() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.contrato_historico h
  set alteracoes = (
    select jsonb_object_agg(e.k, case
      when e.k in ('cliente_id', 'participante_id', 'indicador_id') then jsonb_build_object(
        'de',   case when e.v ->> 'de' = old.nome then to_jsonb('pessoa excluída'::text) else e.v -> 'de' end,
        'para', case when e.v ->> 'para' = old.nome then to_jsonb('pessoa excluída'::text) else e.v -> 'para' end)
      else e.v end)
    from jsonb_each(h.alteracoes) e(k, v))
  where h.escritorio_id = old.escritorio_id
    and exists (select 1 from jsonb_each(h.alteracoes) e(k, v)
                where e.k in ('cliente_id', 'participante_id', 'indicador_id') and old.nome in (e.v ->> 'de', e.v ->> 'para'));
  return null;
end $$;
create trigger esquecer_nos_contratos after delete on public.pessoas
  for each row execute function privado.esquecer_pessoa_nos_contratos();

-- ---------------------------------------------------------------------
-- Regras de acesso (RLS): contratos comuns ao escritório. Excluir só o
-- que estiver arquivado (quem criou ou administrador). O número, a sigla
-- e o ano não podem ser alterados.
-- ---------------------------------------------------------------------
-- O cliente, o participante, o indicador e o responsável precisam ser do mesmo escritório.
create function privado.partes_do_escritorio(p_cliente uuid, p_responsavel uuid, p_participante uuid, p_indicador uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.perfis f where f.id = p_responsavel and f.escritorio_id = privado.meu_escritorio())
     and not exists (
       select 1 from unnest(array[p_cliente, p_participante, p_indicador]) x
       where x is not null
         and not exists (select 1 from public.pessoas p where p.id = x and p.escritorio_id = privado.meu_escritorio()))
$$;
revoke execute on function privado.partes_do_escritorio(uuid, uuid, uuid, uuid) from public, anon;
grant execute on function privado.partes_do_escritorio(uuid, uuid, uuid, uuid) to authenticated;

alter table public.contratos          enable row level security;
alter table public.contrato_historico enable row level security;
revoke all on public.contratos, public.contrato_historico from anon;
revoke insert, update, delete on public.contrato_historico from authenticated;

create policy leitura on public.contratos for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio()));
create policy incluir on public.contratos for insert to authenticated
  with check (escritorio_id = (select privado.meu_escritorio()) and criado_por = (select auth.uid())
              and privado.etapa_valida(etapa_id, 'contratos')
              and privado.partes_do_escritorio(cliente_id, responsavel_id, participante_id, indicador_id));
create policy alterar on public.contratos for update to authenticated
  using (escritorio_id = (select privado.meu_escritorio()))
  with check (escritorio_id = (select privado.meu_escritorio()) and privado.etapa_valida(etapa_id, 'contratos')
              and privado.partes_do_escritorio(cliente_id, responsavel_id, participante_id, indicador_id));
create policy apagar on public.contratos for delete to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and arquivado_em is not null
         and (criado_por = (select auth.uid()) or (select privado.sou_admin())));
revoke update on public.contratos from authenticated;
grant update (codigo_antigo, cliente_id, responsavel_id, servico, categoria, valor, entrada, parcelas, descontos,
  assinado_em, primeiro_pagamento, percentual_escritorio, participante_id, participante_percentual, indicador_id,
  indicador_percentual, documento_url, observacoes, etapa_id, etapa_ordem, arquivado_em, arquivado_por) on public.contratos to authenticated;

create policy leitura on public.contrato_historico for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio()));

-- ---------------------------------------------------------------------
-- Quadro de contratos: colunas pela situação, em cada escritório, e o
-- módulo ligado (como os demais, só o dono da plataforma liga e desliga).
-- ---------------------------------------------------------------------
insert into public.quadro_sugestoes (modulo, nome, ordem) values
  ('contratos', 'Em negociação', 1), ('contratos', 'Aguardando assinatura', 2), ('contratos', 'Assinado / em andamento', 3),
  ('contratos', 'Encerrado', 4), ('contratos', 'Rescindido', 5)
on conflict do nothing;

insert into public.quadro_colunas (escritorio_id, modulo, nome, ordem, criado_por)
select e.id, s.modulo, s.nome, s.ordem, null
from public.escritorios e cross join public.quadro_sugestoes s
where s.modulo = 'contratos'
  and not exists (select 1 from public.quadro_colunas c where c.escritorio_id = e.id and c.modulo = 'contratos');

alter table public.escritorios alter column modulos set default '{"pessoas": true, "contratos": true}';
update public.escritorios set modulos = modulos || '{"contratos": true}' where not modulos ? 'contratos';
