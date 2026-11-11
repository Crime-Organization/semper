-- =====================================================================
-- Ligar demanda, tarefa, contrato e compromisso a um processo que já existe (#294)
--   Antes, o processo só se ligava ao nascer: da demanda (botão "Criar processo") ou da intimação (a tarefa). Agora quem pode
--   alterar o cartão liga um processo ativo em que está (o mesmo "estar no processo" de sempre) e desliga quando quiser.
--   - Demanda: a ligação já existia (processo_demandas, várias para várias). Ganha a regra de apagar. A ligada à mão grava o papel
--     "atua" (a demanda trabalha no processo); "originou" continua sendo a do processo que nasceu da demanda.
--   - Contrato: ligação nova, contrato_processos (vários processos por contrato), com escritorio_id e RLS. Liga e desliga quem altera
--     o contrato: quem é parte ou, na fase de adaptação, toda a equipe (é um dado sem valores). Lê quem vê o contrato ou o processo.
--   - Tarefa: o processo, que nascia com a tarefa e não mudava, passa a poder ser trocado e tirado. Trocar confere que a pessoa está
--     no processo ativo; a troca entra no histórico da tarefa.
--   - Compromisso: nada muda no banco (o cadastro já trocava o processo).
--   Para desligar, basta ver o processo (o processo arquivado também sai).
-- Só acrescenta: uma tabela, regras, uma permissão de coluna, uma função e um gatilho novos, e o histórico da tarefa com um campo a
-- mais. A versão anterior do site continua funcionando: ela não conhece a tabela nova e nunca muda o processo da tarefa.
-- =====================================================================

-- 1. Demanda e processo: desligar.
grant delete on public.processo_demandas to authenticated;
create policy apagar on public.processo_demandas for delete to authenticated
  using (escritorio_id = (select privado.meu_escritorio())
         and exists (select 1 from public.processos p where p.id = processo_id)
         and exists (select 1 from public.demandas d where d.id = demanda_id and privado.vejo_demanda(d.escritorio_id, d.criado_por, d.responsavel_id, d.colaboradores)));

-- 2. Contrato e processo.
-- Quem altera o contrato: a regra "alterar" da tabela (administradores, quem criou, o responsável e os participantes) e, na fase de
-- adaptação, toda a equipe.
create function privado.altero_o_contrato(p_contrato uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.contratos k
                 where k.id = p_contrato and k.escritorio_id = privado.meu_escritorio()
                   and (privado.sou_admin() or privado.equipe_edita_tudo() or auth.uid() in (k.criado_por, k.responsavel_id)
                        or k.participantes @> jsonb_build_array(jsonb_build_object('pessoa_id', privado.minha_pessoa()))))
$$;
revoke execute on function privado.altero_o_contrato(uuid) from public, anon;
grant execute on function privado.altero_o_contrato(uuid) to authenticated;

create table public.contrato_processos (
  escritorio_id uuid not null default privado.meu_escritorio() references public.escritorios on delete cascade,
  contrato_id   uuid not null references public.contratos on delete cascade,
  processo_id   uuid not null references public.processos on delete cascade,
  criado_por    uuid default auth.uid() references auth.users on delete set null,
  criado_em     timestamptz not null default now(),
  primary key (contrato_id, processo_id)
);
create index contrato_processos_processo on public.contrato_processos (processo_id);

alter table public.contrato_processos enable row level security;
revoke all on public.contrato_processos from anon;
revoke update on public.contrato_processos from authenticated;
create policy leitura on public.contrato_processos for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio())
         and (exists (select 1 from public.contratos_da_equipe k where k.id = contrato_id)
              or exists (select 1 from public.processos p where p.id = processo_id)));
create policy incluir on public.contrato_processos for insert to authenticated
  with check (escritorio_id = (select privado.meu_escritorio()) and criado_por = (select auth.uid())
              and privado.processo_ativo(processo_id, escritorio_id)
              and privado.altero_o_contrato(contrato_id));
create policy apagar on public.contrato_processos for delete to authenticated
  using (escritorio_id = (select privado.meu_escritorio())
         and exists (select 1 from public.processos p where p.id = processo_id)
         and privado.altero_o_contrato(contrato_id));

-- 3. Tarefa e processo: trocar e tirar.
grant update (processo_id) on public.tarefas to authenticated;

-- Roda com a permissão de quem grava. Ao trocar, só entra um processo ativo do escritório em que a pessoa está (sem ninguém logado,
-- como numa importação feita pelo banco, basta ser do escritório).
create function privado.conferir_troca_do_processo_da_tarefa() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.processo_id is not null and new.processo_id is distinct from old.processo_id
     and (not exists (select 1 from public.processos p where p.id = new.processo_id and p.escritorio_id = new.escritorio_id)
          or (auth.uid() is not null and not privado.processo_ativo(new.processo_id, new.escritorio_id))) then
    raise exception 'Processo não encontrado neste escritório.';
  end if;
  return new;
end $$;
create trigger conferir_troca_do_processo before update of processo_id on public.tarefas
  for each row execute function privado.conferir_troca_do_processo_da_tarefa();

-- O histórico da tarefa é a função de 20261102125539_andamentos_e_prazos.sql, agora com o processo (pelo número; sem número, o código).
create function privado.nome_do_processo_no_historico(p_processo uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(nullif(p.numero, ''), p.codigo) from public.processos p where p.id = p_processo
$$;
revoke execute on function privado.nome_do_processo_no_historico(uuid) from public, anon;

create or replace function privado.historico_tarefa() returns trigger
language plpgsql security definer set search_path = '' as $$
declare a jsonb := '{}'; k text; vo jsonb := to_jsonb(old); vn jsonb := to_jsonb(new);
begin
  for k in select jsonb_object_keys(vn) loop
    continue when k in ('id', 'escritorio_id', 'codigo', 'pessoa_nome', 'demanda_codigo', 'contrato_codigo', 'busca', 'etapa_ordem',
                        'arquivado_por', 'criado_por', 'criado_em', 'atualizado_por', 'atualizado_em', 'concluida_em');
    continue when vo -> k is not distinct from vn -> k;
    -- O processo excluído tira a ligação sozinho (on delete set null): sem nome dos dois lados, não há o que mostrar.
    continue when k = 'processo_id' and new.processo_id is null and privado.nome_do_processo_no_historico(old.processo_id) is null;
    a := a || case k
      when 'etapa_id' then jsonb_build_object('etapa', jsonb_build_object(
        'de', (select nome from public.quadro_colunas where id = old.etapa_id),
        'para', (select nome from public.quadro_colunas where id = new.etapa_id)))
      when 'responsavel_id' then jsonb_build_object(k, jsonb_build_object(
        'de', (select nome from public.perfis where id = old.responsavel_id),
        'para', (select nome from public.perfis where id = new.responsavel_id)))
      when 'participantes' then jsonb_build_object(k, jsonb_build_object(
        'de', privado.nomes_da_equipe(old.participantes), 'para', privado.nomes_da_equipe(new.participantes)))
      when 'pessoas' then jsonb_build_object(k, jsonb_build_object(
        'de', privado.nomes_dos_clientes(old.pessoas, ', '), 'para', privado.nomes_dos_clientes(new.pessoas, ', ')))
      when 'demanda_id' then jsonb_build_object('demanda', jsonb_build_object('de', old.demanda_codigo, 'para', new.demanda_codigo))
      when 'contrato_id' then jsonb_build_object('contrato', jsonb_build_object('de', old.contrato_codigo, 'para', new.contrato_codigo))
      when 'processo_id' then jsonb_build_object('processo', jsonb_build_object(
        'de', privado.nome_do_processo_no_historico(old.processo_id), 'para', privado.nome_do_processo_no_historico(new.processo_id)))
      else jsonb_build_object(k, jsonb_build_object('de', vo -> k, 'para', vn -> k))
    end;
  end loop;
  if a <> '{}' then
    insert into public.tarefa_historico (escritorio_id, tarefa_id, alteracoes, feito_por)
    values (new.escritorio_id, new.id, a, auth.uid());
  end if;
  return null;
end $$;
