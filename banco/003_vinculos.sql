-- =====================================================================
-- 003 · Vínculos entre pessoas
--   Uma pessoa liga-se a outra por um tipo de vínculo (cônjuge, sócio,
--   representante legal...). Cada vínculo vale nos dois sentidos: "João é
--   representante legal da Padaria" aparece na Padaria como "representada
--   por João". Os tipos padrão valem para todos os escritórios (escritorio_id
--   nulo); master e administradores podem acrescentar os do seu escritório.
--   Cada vínculo incluído ou retirado entra no histórico das duas pessoas
--   e no registro de ações (LGPD).
-- =====================================================================

create table public.vinculo_tipos (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid default privado.meu_escritorio() references public.escritorios on delete cascade,  -- nulo: tipo padrão
  nome          text not null check (btrim(nome) <> '' and length(nome) <= 60),      -- como aparece em quem "faz" o vínculo
  inverso       text not null check (btrim(inverso) <> '' and length(inverso) <= 60), -- como aparece na outra pessoa (igual ao nome se for simétrico)
  ordem         integer not null default 500,
  criado_por    uuid default auth.uid() references auth.users on delete set null,
  criado_em     timestamptz not null default now()
);
create unique index vinculo_tipos_unico on public.vinculo_tipos
  (coalesce(escritorio_id, '00000000-0000-0000-0000-000000000000'), privado.sem_acento(btrim(nome)), privado.sem_acento(btrim(inverso)));

create table public.pessoa_vinculos (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null default privado.meu_escritorio() references public.escritorios on delete cascade,
  pessoa_de     uuid not null references public.pessoas on delete cascade,
  pessoa_para   uuid not null references public.pessoas on delete cascade,
  tipo_id       uuid not null references public.vinculo_tipos on delete restrict,
  descricao     text check (descricao is null or length(descricao) <= 300),
  criado_por    uuid default auth.uid() references auth.users on delete set null,
  criado_em     timestamptz not null default now(),
  check (pessoa_de <> pessoa_para)
);
-- O mesmo vínculo entre as mesmas duas pessoas só uma vez, em qualquer sentido.
create unique index pessoa_vinculos_unico on public.pessoa_vinculos
  (least(pessoa_de, pessoa_para), greatest(pessoa_de, pessoa_para), tipo_id);
create index pessoa_vinculos_de on public.pessoa_vinculos (pessoa_de);
create index pessoa_vinculos_para on public.pessoa_vinculos (pessoa_para);
create index pessoa_vinculos_tipo on public.pessoa_vinculos (tipo_id);

-- Histórico das duas pessoas. Quando o vínculo some porque uma delas foi excluída,
-- só a que continua existindo recebe o registro.
create function privado.historico_vinculo() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v public.pessoa_vinculos := case when tg_op = 'DELETE' then old else new end;
  t public.vinculo_tipos;
  nome_de text; nome_para text; obs text;
begin
  select * into t from public.vinculo_tipos where id = v.tipo_id;
  select nome into nome_de from public.pessoas where id = v.pessoa_de;
  select nome into nome_para from public.pessoas where id = v.pessoa_para;
  obs := coalesce(' (' || v.descricao || ')', '');
  if nome_de is not null then
    insert into public.pessoa_historico (escritorio_id, pessoa_id, alteracoes, feito_por)
    values (v.escritorio_id, v.pessoa_de, jsonb_build_object('vinculo', jsonb_build_object(
      'de',   case when tg_op = 'DELETE' then t.nome || ' ' || coalesce(nome_para, 'pessoa excluída') || obs end,
      'para', case when tg_op = 'INSERT' then t.nome || ' ' || nome_para || obs end)), auth.uid());
  end if;
  if nome_para is not null then
    insert into public.pessoa_historico (escritorio_id, pessoa_id, alteracoes, feito_por)
    values (v.escritorio_id, v.pessoa_para, jsonb_build_object('vinculo', jsonb_build_object(
      'de',   case when tg_op = 'DELETE' then t.inverso || ' ' || coalesce(nome_de, 'pessoa excluída') || obs end,
      'para', case when tg_op = 'INSERT' then t.inverso || ' ' || nome_de || obs end)), auth.uid());
  end if;
  return null;
end $$;
create trigger historico after insert or delete on public.pessoa_vinculos for each row execute function privado.historico_vinculo();
create trigger auditoria after insert or delete on public.pessoa_vinculos for each row execute function privado.auditar();
create trigger auditoria after insert or update or delete on public.vinculo_tipos for each row execute function privado.auditar();

-- Regras de acesso: tudo dentro do próprio escritório. Os tipos padrão são só leitura.
alter table public.vinculo_tipos   enable row level security;
alter table public.pessoa_vinculos enable row level security;
revoke all on public.vinculo_tipos, public.pessoa_vinculos from anon;

create policy leitura on public.vinculo_tipos for select to authenticated
  using (escritorio_id is null or escritorio_id = (select privado.meu_escritorio()));
create policy incluir on public.vinculo_tipos for insert to authenticated
  with check (escritorio_id = (select privado.meu_escritorio()) and (select privado.sou_admin()) and criado_por = (select auth.uid()));
create policy alterar on public.vinculo_tipos for update to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and (select privado.sou_admin()))
  with check (escritorio_id = (select privado.meu_escritorio()));
create policy apagar on public.vinculo_tipos for delete to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and (select privado.sou_admin()));
revoke update on public.vinculo_tipos from authenticated;
grant update (nome, inverso, ordem) on public.vinculo_tipos to authenticated;

create policy leitura on public.pessoa_vinculos for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio()));
create policy incluir on public.pessoa_vinculos for insert to authenticated
  with check (escritorio_id = (select privado.meu_escritorio()) and criado_por = (select auth.uid())
    and exists (select 1 from public.pessoas p where p.id = pessoa_de and p.escritorio_id = (select privado.meu_escritorio()))
    and exists (select 1 from public.pessoas p where p.id = pessoa_para and p.escritorio_id = (select privado.meu_escritorio()))
    and exists (select 1 from public.vinculo_tipos t where t.id = tipo_id
                and (t.escritorio_id is null or t.escritorio_id = (select privado.meu_escritorio()))));
create policy apagar on public.pessoa_vinculos for delete to authenticated
  using (escritorio_id = (select privado.meu_escritorio()));
revoke update on public.pessoa_vinculos from authenticated;

-- Tipos padrão (valem para todos os escritórios).
insert into public.vinculo_tipos (escritorio_id, nome, inverso, ordem) values
  (null, 'Cônjuge', 'Cônjuge', 10),
  (null, 'Companheiro(a)', 'Companheiro(a)', 20),
  (null, 'Pai/mãe de', 'Filho(a) de', 30),
  (null, 'Irmão(ã) de', 'Irmão(ã) de', 40),
  (null, 'Sócio(a) de', 'Tem como sócio(a)', 50),
  (null, 'Representante legal de', 'Representado(a) por', 60),
  (null, 'Procurador(a) de', 'Tem como procurador(a)', 70),
  (null, 'Funcionário(a) de', 'Empregador(a) de', 80),
  (null, 'Contador(a) de', 'Tem como contador(a)', 90),
  (null, 'Indicou', 'Indicado(a) por', 100),
  (null, 'Outro', 'Outro', 1000);
