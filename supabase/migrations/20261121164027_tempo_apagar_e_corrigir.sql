-- =====================================================================
-- Tempo nas tarefas: apagar e corrigir os registros (#400)
--   Pedido do dono (21/11/2026): cada pessoa apaga e corrige os próprios
--   registros de tempo; os administradores, os de qualquer um do
--   escritório. Corrigir é mudar a duração e/ou o dia, sempre com o motivo.
--   Apagar, corrigir e devolver um registro apagado (o Desfazer) ficam no
--   histórico da tarefa, sem a duração: quem não é administrador nunca vê
--   o tempo dos outros, e o histórico é de todos que veem a tarefa.
--
--   Como a tela pede a correção: muda segundos e/ou inicio, diz o motivo
--   (motivo_da_correcao) e manda corrigido_em (qualquer instante novo; o
--   banco põe o de agora e quem corrigiu). Sem corrigido_em novo, a mudança
--   é a do cronômetro, com as regras de sempre (só o dono, só cresce, só o
--   período recente, nunca o ajuste).
--
--   Só acrescenta: três colunas (vazias nos registros de hoje), as
--   permissões de apagar e de mudar o dia e o motivo, duas regras (RLS),
--   o gatilho do histórico e a função de devolver. A função que confere a
--   mudança é trocada por outra que, sem correção, faz o mesmo que antes.
--   A versão anterior do site continua funcionando: ela só grava os
--   segundos do próprio período, como sempre.
-- =====================================================================

-- ---------------------------------------------------------------------
-- A última correção do registro: quando, quem e por quê.
-- ---------------------------------------------------------------------
alter table public.tarefa_tempos
  add column corrigido_em       timestamptz,
  add column corrigido_por      uuid references public.perfis on delete set null,
  add column motivo_da_correcao text;
-- O motivo da correção: obrigatório nela, até TAMANHO_MOTIVO (300) caracteres, como o do ajuste.
alter table public.tarefa_tempos add constraint tempo_corrigido
  check (motivo_da_correcao is null or (btrim(motivo_da_correcao) <> '' and length(motivo_da_correcao) <= 300));

-- ---------------------------------------------------------------------
-- O que cada mudança pode fazer.
-- ---------------------------------------------------------------------
create or replace function privado.conferir_tempo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- A correção (corrigido_em novo): a duração e/ou o dia, com o motivo. Quem pode, a regra "corrigir" decide (o dono ou um
  -- administrador do escritório). Os limites da duração são os da tabela (tempo_contado e tempo_ajustado).
  if new.corrigido_em is distinct from old.corrigido_em then
    if btrim(coalesce(new.motivo_da_correcao, '')) = '' then
      raise exception 'Diga o motivo da correção (ele fica no histórico da tarefa).';
    end if;
    if new.inicio > now() + interval '1 day' then raise exception 'O dia do registro não pode ser depois de hoje.'; end if;
    new.corrigido_em := now();
    new.corrigido_por := auth.uid();
    return new;
  end if;
  -- Sem correção, o dia e o motivo não mudam.
  if new.inicio is distinct from old.inicio or new.motivo_da_correcao is distinct from old.motivo_da_correcao then
    raise exception 'Para mudar o dia do registro, corrija-o com o motivo.';
  end if;
  -- O cronômetro: só o dono grava o próprio período contado, que só cresce, e só enquanto é recente.
  if new.segundos is distinct from old.segundos then
    if old.ajuste or old.perfil_id is distinct from auth.uid() then
      raise exception 'Só quem contou o tempo grava o cronômetro: para mudar um registro, corrija-o com o motivo.';
    end if;
    if new.segundos < old.segundos then raise exception 'O tempo contado não diminui: para corrigir, faça um ajuste.'; end if;
    if old.criado_em < now() - interval '1 day' then raise exception 'Este período já foi fechado: para corrigir, faça um ajuste.'; end if;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- O histórico da tarefa: apagar e corrigir um registro, sem a duração.
-- ---------------------------------------------------------------------
-- O registro como aparece no histórico: "o tempo contado de Ana, de 20/11/2026" (o dia no horário de Brasília).
create function privado.registro_de_tempo_no_historico(p_perfil uuid, p_ajuste boolean, p_inicio timestamptz) returns text
language sql stable security definer set search_path = '' as $$
  select format('%s de %s, de %s',
    case when p_ajuste then 'o ajuste de tempo' else 'o tempo contado' end,
    coalesce((select nome from public.perfis where id = p_perfil), 'usuário removido'),
    to_char(p_inicio at time zone 'America/Sao_Paulo', 'DD/MM/YYYY'))
$$;
revoke execute on function privado.registro_de_tempo_no_historico(uuid, boolean, timestamptz) from public, anon;

create function privado.historico_do_tempo() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_texto text;
begin
  if tg_op = 'UPDATE' and new.corrigido_em is not distinct from old.corrigido_em then return null; end if;
  -- A tarefa (ou o escritório) apagada leva os registros junto: aí não há histórico a escrever.
  if not exists (select 1 from public.tarefas t where t.id = old.tarefa_id) then return null; end if;
  if tg_op = 'DELETE' then
    v_texto := 'Apagado ' || privado.registro_de_tempo_no_historico(old.perfil_id, old.ajuste, old.inicio);
  else
    v_texto := 'Corrigido ' || privado.registro_de_tempo_no_historico(old.perfil_id, old.ajuste, old.inicio)
      || case when (old.inicio at time zone 'America/Sao_Paulo')::date <> (new.inicio at time zone 'America/Sao_Paulo')::date
              then ', que passou para ' || to_char(new.inicio at time zone 'America/Sao_Paulo', 'DD/MM/YYYY') else '' end
      || '. Motivo: ' || btrim(new.motivo_da_correcao);
  end if;
  insert into public.tarefa_historico (escritorio_id, tarefa_id, alteracoes, feito_por)
  values (old.escritorio_id, old.tarefa_id, jsonb_build_object('tempo', jsonb_build_object('de', null, 'para', v_texto)), auth.uid());
  return null;
end $$;
create trigger historico after update or delete on public.tarefa_tempos
  for each row execute function privado.historico_do_tempo();

-- ---------------------------------------------------------------------
-- Quem apaga e corrige: o dono do registro e os administradores do
-- escritório (as regras de antes continuam valendo para o cronômetro).
-- ---------------------------------------------------------------------
grant update (inicio, motivo_da_correcao, corrigido_em) on public.tarefa_tempos to authenticated;
grant delete on public.tarefa_tempos to authenticated;

create policy corrigir on public.tarefa_tempos for update to authenticated
  using (escritorio_id = (select privado.meu_escritorio())
         and (perfil_id = (select auth.uid()) or (select privado.sou_admin()))
         and exists (select 1 from public.tarefas t where t.id = tarefa_id))
  with check (escritorio_id = (select privado.meu_escritorio())
              and (perfil_id = (select auth.uid()) or (select privado.sou_admin())));
create policy apagar on public.tarefa_tempos for delete to authenticated
  using (escritorio_id = (select privado.meu_escritorio())
         and (perfil_id = (select auth.uid()) or (select privado.sou_admin()))
         and exists (select 1 from public.tarefas t where t.id = tarefa_id));

-- ---------------------------------------------------------------------
-- Devolver um registro apagado (o Desfazer da tela): o mesmo registro, com
-- o dono, o dia, a duração e o motivo de antes. O dono devolve o próprio,
-- numa tarefa em que está; o administrador, o de qualquer um do escritório.
-- ---------------------------------------------------------------------
create function public.tempo_devolver(p_tarefa uuid, p_perfil uuid, p_inicio timestamptz, p_segundos integer, p_ajuste boolean, p_motivo text)
returns bigint
language plpgsql security definer set search_path = '' as $$
declare v_escritorio uuid := privado.meu_escritorio(); v_id bigint;
begin
  if v_escritorio is null or not (privado.sou_admin() or (p_perfil is not null and p_perfil = auth.uid())) then
    raise exception 'Só quem registrou o tempo, ou um administrador, devolve o registro.';
  end if;
  if not exists (select 1 from public.tarefas t where t.id = p_tarefa
                 and (privado.sou_admin() and t.escritorio_id = v_escritorio
                      or privado.estou_na_tarefa(t.escritorio_id, t.criado_por, t.responsavel_id, t.participantes, t.demanda_id, t.grupos))) then
    raise exception 'Tarefa não encontrada.';
  end if;
  if p_perfil is not null and not exists (select 1 from public.perfis where id = p_perfil and escritorio_id = v_escritorio) then
    raise exception 'Usuário não encontrado.';
  end if;
  insert into public.tarefa_tempos (escritorio_id, tarefa_id, perfil_id, inicio, segundos, ajuste, motivo)
  values (v_escritorio, p_tarefa, p_perfil, p_inicio, p_segundos, p_ajuste, case when p_ajuste then p_motivo end)
  returning id into v_id;
  insert into public.tarefa_historico (escritorio_id, tarefa_id, alteracoes, feito_por)
  values (v_escritorio, p_tarefa, jsonb_build_object('tempo', jsonb_build_object('de', null,
    'para', 'Devolvido ' || privado.registro_de_tempo_no_historico(p_perfil, p_ajuste, p_inicio))), auth.uid());
  return v_id;
end $$;
revoke execute on function public.tempo_devolver(uuid, uuid, timestamptz, integer, boolean, text) from public, anon;
grant execute on function public.tempo_devolver(uuid, uuid, timestamptz, integer, boolean, text) to authenticated;
