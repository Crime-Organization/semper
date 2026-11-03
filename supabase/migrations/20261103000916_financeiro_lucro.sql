-- =====================================================================
-- Financeiro: o lucro dos sócios (parte da tarefa #49)
--   A conta é a da aba Lucros do Caixa, confirmada pelo escritório em 02/11/2026:
--   - Como responsável: a parte do responsável (o líquido, menos o escritório e os terceiros) em cada recebimento com tudo na conta
--     da empresa. Abaixo disso, o sócio já ficou com a parte dele. A conta é a de parteDoSocio em app/src/regras/lucro.ts, feita na tela
--     a partir do que o recebimento guardou.
--   - Como indicador: os 10% do que o cliente pagou, que já são repasses (financeiro_repasses). Ficam em linhas separadas.
--   - Em aberto: o que acumulou menos o que já foi pago. Só a retirada aqui registrada conta como pagamento: o repasse entre contas
--     (da PJ para a PF) é transferência, não lucro.
--   Tudo isto só aparece para administradores.
--   Só acrescenta (uma tabela, colunas, funções e gatilhos) e amplia uma regra: a coluna origem dos lançamentos passa a aceitar 'lucro'.
--   A versão anterior do site continua funcionando, e o módulo segue como estiver.
-- =====================================================================

-- 1. O recebimento guarda de qual sócio ele é: mudar o responsável ou a lista de sócios depois não muda o passado.
alter table public.financeiro_recebimentos
  add column socio_pessoa_id uuid constraint financeiro_recebimentos_socio_pessoa_id_fkey references public.pessoas on delete restrict,
  add column socio_nome      text;
create index financeiro_recebimentos_socio on public.financeiro_recebimentos (socio_pessoa_id) where socio_pessoa_id is not null;

create function privado.socio_do_recebimento() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.responsavel_socio then
    select f.pessoa_id, p.nome into new.socio_pessoa_id, new.socio_nome
    from public.perfis f join public.pessoas p on p.id = f.pessoa_id where f.id = new.responsavel_id;
  end if;
  return new;
end $$;
revoke execute on function privado.socio_do_recebimento() from public, anon, authenticated;
create trigger socio_do_recebimento before insert on public.financeiro_recebimentos for each row execute function privado.socio_do_recebimento();

update public.financeiro_recebimentos r set socio_pessoa_id = f.pessoa_id, socio_nome = p.nome
from public.perfis f join public.pessoas p on p.id = f.pessoa_id
where r.responsavel_socio and r.socio_pessoa_id is null and f.id = r.responsavel_id;

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

create function privado.lucro_so_pela_retirada() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' or old.categoria <> new.categoria then
    raise exception 'A divisão de lucro é lançada na página Lucro dos sócios, para ficar no nome do sócio.';
  end if;
  return new;
end $$;
create trigger lucro_so_pela_retirada before insert or update on public.financeiro_lancamentos
  for each row when (current_user = 'authenticated' and new.categoria = 'divisao_lucro') execute function privado.lucro_so_pela_retirada();

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
     and not exists (select 1 from public.financeiro_recebimentos where socio_pessoa_id = p_pessoa and escritorio_id = v_escritorio and estornado_em is null) then
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
