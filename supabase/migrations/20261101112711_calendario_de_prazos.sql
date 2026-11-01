-- =====================================================================
-- Calendário de feriados e suspensões, para a contagem dos prazos (tarefa #174)
--   Os feriados nacionais, o recesso forense, os "de praxe" (Carnaval, Sexta-feira Santa, Corpus Christi) e os
--   da Justiça Federal não ficam no banco: saem prontos das regras (app/src/regras/prazos.ts), para qualquer ano.
--   Aqui fica só o que é de cada escritório:
--   - os órgãos em que ele atua (TJMG, TRF6, INPI…), com a contagem padrão dos prazos e o que cada um segue
--     (o recesso forense, os feriados de praxe, os feriados da Justiça Federal);
--   - os dias sem expediente que o escritório lança: feriados estaduais e municipais e as suspensões de cada
--     tribunal (portarias), para um órgão ou para todos (orgao_id vazio).
--   - Todos do escritório consultam; só os administradores mudam.
--   - Um órgão de outro escritório nunca entra num dia lançado (a chave inclui o escritório).
--   - Lançar de novo o mesmo dia para o mesmo órgão substitui o motivo e o tipo (não duplica).
--   Os tamanhos e os anos são os de app/src/dados/limites.ts (TAMANHO_ORGAO, TAMANHO_DIA, ANOS_DO_CALENDARIO).
--   Só acrescenta (duas tabelas, um gatilho e regras novos). A versão anterior do site continua funcionando.
-- =====================================================================

-- 1. Órgãos em que o escritório atua
create table public.orgaos (
  id              uuid primary key default gen_random_uuid(),
  escritorio_id   uuid not null default privado.meu_escritorio() references public.escritorios on delete cascade,
  sigla           text not null check (btrim(sigla) <> '' and length(sigla) <= 20),
  nome            text check (length(nome) <= 120),
  contagem_padrao text not null default 'corridos' check (contagem_padrao in ('corridos', 'uteis')),
  recesso         boolean not null default false,
  praxe           boolean not null default false,
  justica_federal boolean not null default false,
  criado_em       timestamptz not null default now(),
  unique (id, escritorio_id)
);
create unique index orgaos_sigla_unica on public.orgaos (escritorio_id, upper(btrim(sigla)));

-- Sigla em maiúsculas, sem espaços nas pontas; nome vazio vira nulo.
create function privado.preparar_orgao() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.sigla := upper(btrim(new.sigla));
  new.nome := nullif(btrim(new.nome), '');
  return new;
end $$;
create trigger preparar before insert or update on public.orgaos for each row execute function privado.preparar_orgao();

alter table public.orgaos enable row level security;
revoke all on public.orgaos from anon;
revoke update on public.orgaos from authenticated;
grant update (sigla, nome, contagem_padrao, recesso, praxe, justica_federal) on public.orgaos to authenticated;

create policy leitura on public.orgaos for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio()));
create policy incluir on public.orgaos for insert to authenticated
  with check (escritorio_id = (select privado.meu_escritorio()) and (select privado.sou_admin()));
create policy alterar on public.orgaos for update to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and (select privado.sou_admin()))
  with check (escritorio_id = (select privado.meu_escritorio()));
create policy apagar on public.orgaos for delete to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and (select privado.sou_admin()));

-- 2. Dias sem expediente lançados pelo escritório (orgao_id vazio: valem para todos os órgãos)
create table public.dias_sem_expediente (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null default privado.meu_escritorio() references public.escritorios on delete cascade,
  data          date not null check (data between date '2000-01-01' and date '2100-12-31'),
  motivo        text not null check (btrim(motivo) <> '' and length(motivo) <= 120),
  tipo          text not null check (tipo in ('feriado', 'suspensao', 'suspensao_com_expediente')),
  orgao_id      uuid,
  criado_por    uuid default auth.uid() references auth.users on delete set null,
  criado_em     timestamptz not null default now(),
  foreign key (orgao_id, escritorio_id) references public.orgaos (id, escritorio_id) on delete cascade,
  constraint dias_sem_expediente_unico unique nulls not distinct (escritorio_id, data, orgao_id)
);
create index dias_sem_expediente_orgao on public.dias_sem_expediente (orgao_id) where orgao_id is not null;

alter table public.dias_sem_expediente enable row level security;
revoke all on public.dias_sem_expediente from anon;
revoke update on public.dias_sem_expediente from authenticated;
-- Lançar de novo (insert … on conflict do update) regrava as colunas enviadas: data, motivo, tipo e órgão.
grant update (data, motivo, tipo, orgao_id) on public.dias_sem_expediente to authenticated;

create policy leitura on public.dias_sem_expediente for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio()));
create policy incluir on public.dias_sem_expediente for insert to authenticated
  with check (escritorio_id = (select privado.meu_escritorio()) and (select privado.sou_admin()) and criado_por = (select auth.uid()));
create policy alterar on public.dias_sem_expediente for update to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and (select privado.sou_admin()))
  with check (escritorio_id = (select privado.meu_escritorio()));
create policy apagar on public.dias_sem_expediente for delete to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and (select privado.sou_admin()));
