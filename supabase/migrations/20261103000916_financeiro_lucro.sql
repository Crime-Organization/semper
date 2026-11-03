-- =====================================================================
-- Financeiro: o lucro dos sócios (parte da tarefa #49)
--   A conta é a da aba Lucros do Caixa, confirmada pelo escritório em 02/11/2026:
--   - Como responsável: a parte do responsável (o líquido, menos o escritório e os terceiros) em cada recebimento com tudo na conta
--     da empresa. Abaixo disso, o sócio já ficou com a parte dele. A conta é a de parteDoSocio em app/src/regras/lucro.ts, feita na tela
--     a partir do que o recebimento guardou.
--   - Como indicador: os 10% do que o cliente pagou, que já são repasses (financeiro_repasses). Ficam em linhas separadas.
--   - Em aberto: o que acumulou menos o que já foi pago. Só a retirada aqui registrada conta como pagamento: o repasse entre contas
--     (da PJ para a PF) é transferência, não lucro.
--   Tudo isto só aparece para administradores: a leitura é a função financeiro_lucro, e quem é sócio em cada recebimento fica numa tabela
--   que ninguém lê direto.
--   Só acrescenta (tabelas, funções e um gatilho) e amplia uma regra: a coluna origem dos lançamentos passa a aceitar 'lucro'. A versão
--   anterior do site continua funcionando, e o módulo segue como estiver. A tela nova deixa de oferecer "Divisão de lucro" no lançamento à
--   mão. A recusa no banco fica para uma migração depois, porque a versão anterior ainda oferece essa categoria.
-- =====================================================================

-- 1. De qual sócio é cada recebimento: mudar o responsável ou a lista de sócios depois não muda o passado. Quem é responsável pelo contrato
-- lê o recebimento, mas não pode ver isto: fica à parte, e só as funções abaixo leem.
create table privado.socio_do_recebimento (
  recebimento_id uuid primary key references public.financeiro_recebimentos on delete cascade,
  escritorio_id  uuid not null references public.escritorios on delete cascade,
  pessoa_id      uuid not null constraint socio_do_recebimento_pessoa_id_fkey references public.pessoas on delete restrict,
  nome           text not null
);
create index socio_do_recebimento_escritorio on privado.socio_do_recebimento (escritorio_id, pessoa_id);
create index socio_do_recebimento_pessoa on privado.socio_do_recebimento (pessoa_id);
alter table privado.socio_do_recebimento enable row level security;
revoke all on privado.socio_do_recebimento from public, anon, authenticated;

create function privado.guardar_socio_do_recebimento() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into privado.socio_do_recebimento (recebimento_id, escritorio_id, pessoa_id, nome)
  select new.id, new.escritorio_id, f.pessoa_id, p.nome
  from public.perfis f join public.pessoas p on p.id = f.pessoa_id where f.id = new.responsavel_id;
  return null;
end $$;
revoke execute on function privado.guardar_socio_do_recebimento() from public, anon, authenticated;
create trigger socio_do_recebimento after insert on public.financeiro_recebimentos
  for each row when (new.responsavel_socio) execute function privado.guardar_socio_do_recebimento();

insert into privado.socio_do_recebimento (recebimento_id, escritorio_id, pessoa_id, nome)
select r.id, r.escritorio_id, f.pessoa_id, p.nome
from public.financeiro_recebimentos r join public.perfis f on f.id = r.responsavel_id join public.pessoas p on p.id = f.pessoa_id
where r.responsavel_socio;

-- 2. O lançamento da divisão de lucro nasce da retirada, para ficar no nome do sócio.
alter table public.financeiro_lancamentos drop constraint financeiro_lancamentos_origem_check;
alter table public.financeiro_lancamentos add constraint financeiro_lancamentos_origem_check check (origem in ('recebimento', 'repasse', 'lucro'));

create or replace function privado.lancamento_de_origem() returns trigger
language plpgsql set search_path = '' as $$
begin
  -- As funções abaixo rodam como o sistema; quem grava pela tela é "authenticated".
  if current_user = 'authenticated' then
    raise exception 'Este lançamento nasceu de um recebimento, de um repasse ou de uma divisão de lucro: desfaça por lá.';
  end if;
  return new;
end $$;

-- 3. O que cada sócio já retirou como lucro.
create table public.financeiro_retiradas (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references public.escritorios on delete cascade,
  pessoa_id     uuid not null constraint financeiro_retiradas_pessoa_id_fkey references public.pessoas on delete restrict,
  nome          text not null,
  conta_id      uuid not null references public.financeiro_contas,
  data          date not null,
  valor         bigint not null check (valor > 0),
  descricao     text not null,
  lancamento_id uuid not null references public.financeiro_lancamentos,
  excluido_em   timestamptz,
  criado_por    uuid references auth.users on delete set null,
  criado_em     timestamptz not null default now()
);
create index financeiro_retiradas_escritorio on public.financeiro_retiradas (escritorio_id, data desc) where excluido_em is null;
create index financeiro_retiradas_pessoa on public.financeiro_retiradas (pessoa_id);
create trigger auditoria after insert or update or delete on public.financeiro_retiradas for each row execute function privado.auditar();

alter table public.financeiro_retiradas enable row level security;
revoke all on public.financeiro_retiradas from anon;
revoke insert, update, delete on public.financeiro_retiradas from authenticated;
create policy leitura on public.financeiro_retiradas for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and (select privado.sou_admin()));

-- 4. Pagar cria a saída no caixa; desfazer esconde as duas coisas; restaurar devolve como estava.
create function public.financeiro_pagar_lucro(p_pessoa uuid, p_conta uuid, p_data date, p_valor bigint, p_descricao text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_escritorio uuid := privado.meu_escritorio(); v_nome text; v_descricao text := btrim(coalesce(p_descricao, '')); v_lancamento uuid; v_id uuid;
begin
  if not privado.sou_admin() then raise exception 'Só um administrador mexe no caixa.' using errcode = '42501'; end if;
  select nome into v_nome from public.pessoas where id = p_pessoa and escritorio_id = v_escritorio;
  if v_nome is null then raise exception 'Pessoa não encontrada neste escritório.'; end if;
  -- Quem saiu da lista de sócios ainda recebe o que acumulou.
  if not exists (select 1 from public.financeiro_socios where pessoa_id = p_pessoa and escritorio_id = v_escritorio and excluido_em is null)
     and not exists (select 1 from privado.socio_do_recebimento s join public.financeiro_recebimentos r on r.id = s.recebimento_id
                     where s.pessoa_id = p_pessoa and s.escritorio_id = v_escritorio and r.estornado_em is null) then
    raise exception 'Esta pessoa não é sócia. Só sócios recebem lucro.';
  end if;
  if not exists (select 1 from public.financeiro_contas where id = p_conta and escritorio_id = v_escritorio) then raise exception 'Conta não encontrada neste escritório.'; end if;
  if v_descricao = '' then v_descricao := 'Divisão de lucro a ' || v_nome; end if;
  insert into public.financeiro_lancamentos (escritorio_id, conta_id, data, tipo, categoria, valor, descricao, origem, criado_por)
  values (v_escritorio, p_conta, p_data, 'saida', 'divisao_lucro', p_valor, left(v_descricao, 300), 'lucro', auth.uid())
  returning id into v_lancamento;
  insert into public.financeiro_retiradas (escritorio_id, pessoa_id, nome, conta_id, data, valor, descricao, lancamento_id, criado_por)
  values (v_escritorio, p_pessoa, v_nome, p_conta, p_data, p_valor, left(v_descricao, 300), v_lancamento, auth.uid())
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.financeiro_pagar_lucro(uuid, uuid, date, bigint, text) from public, anon;
grant execute on function public.financeiro_pagar_lucro(uuid, uuid, date, bigint, text) to authenticated;

create function public.financeiro_desfazer_lucro(p_retirada uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.financeiro_retiradas;
begin
  if not privado.sou_admin() then raise exception 'Só um administrador mexe no caixa.' using errcode = '42501'; end if;
  select * into r from public.financeiro_retiradas where id = p_retirada and escritorio_id = privado.meu_escritorio() for update;
  if r.id is null then raise exception 'Retirada não encontrada neste escritório.'; end if;
  if r.excluido_em is not null then return; end if;
  update public.financeiro_lancamentos set excluido_em = now() where id = r.lancamento_id;
  update public.financeiro_retiradas set excluido_em = now() where id = r.id;
end $$;
revoke execute on function public.financeiro_desfazer_lucro(uuid) from public, anon;
grant execute on function public.financeiro_desfazer_lucro(uuid) to authenticated;

create function public.financeiro_restaurar_lucro(p_retirada uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.financeiro_retiradas;
begin
  if not privado.sou_admin() then raise exception 'Só um administrador mexe no caixa.' using errcode = '42501'; end if;
  select * into r from public.financeiro_retiradas where id = p_retirada and escritorio_id = privado.meu_escritorio() for update;
  if r.id is null then raise exception 'Retirada não encontrada neste escritório.'; end if;
  if r.excluido_em is null then return; end if;
  update public.financeiro_lancamentos set excluido_em = null where id = r.lancamento_id;
  update public.financeiro_retiradas set excluido_em = null where id = r.id;
end $$;
revoke execute on function public.financeiro_restaurar_lucro(uuid) from public, anon;
grant execute on function public.financeiro_restaurar_lucro(uuid) to authenticated;

-- 5. O que a página de lucro precisa, sem o que foi estornado ou desfeito. A conta é feita na tela (regras/lucro.ts).
create function public.financeiro_lucro() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_escritorio uuid := privado.meu_escritorio();
begin
  if not privado.sou_admin() then raise exception 'Só um administrador vê o lucro dos sócios.' using errcode = '42501'; end if;
  return jsonb_build_object(
    'recebimentos', coalesce((
      select jsonb_agg(jsonb_build_object('data', r.data, 'pessoa_id', s.pessoa_id, 'nome', s.nome, 'liquido', r.liquido, 'terceiros', r.terceiros) order by r.data, r.id)
      from privado.socio_do_recebimento s join public.financeiro_recebimentos r on r.id = s.recebimento_id
      where s.escritorio_id = v_escritorio and r.estornado_em is null and r.parte_na_conta = 100), '[]'::jsonb),
    'indicacoes', coalesce((
      select jsonb_agg(jsonb_build_object('data', r.data, 'pessoa_id', x.pessoa_id, 'nome', x.nome, 'valor', x.valor, 'pago_em', x.pago_em) order by r.data, x.id)
      from public.financeiro_repasses x join public.financeiro_recebimentos r on r.id = x.recebimento_id
      where x.escritorio_id = v_escritorio and x.tipo = 'socio_indicador' and x.cancelado_em is null and x.pessoa_id is not null), '[]'::jsonb),
    'retiradas', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'pessoa_id', t.pessoa_id, 'nome', t.nome, 'conta_id', t.conta_id, 'data', t.data, 'valor', t.valor, 'descricao', t.descricao) order by t.data, t.id)
      from public.financeiro_retiradas t
      where t.escritorio_id = v_escritorio and t.excluido_em is null), '[]'::jsonb));
end $$;
revoke execute on function public.financeiro_lucro() from public, anon;
grant execute on function public.financeiro_lucro() to authenticated;
