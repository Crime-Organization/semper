-- =====================================================================
-- Compromisso que se repete: as datas novas copiam a última data EM ABERTO da série (#417)
--   Antes, cada data nova (privado.gerar_repeticoes, a de 20261123000750_demandas_dos_compromissos.sql) copiava a última data não
--   arquivada, mesmo que ela estivesse Realizada ou Cancelada. Mas o "esta e as seguintes" (compromisso_mudar_seguintes e
--   compromisso_mudar_campos_seguintes) só muda as datas em aberto: com a última data cancelada, a rotina diária criava a seguinte com o
--   título, o local, a equipe, as pessoas e o horário de antes da mudança. Agora o modelo é a última data em aberto
--   (privado.compromisso_em_aberto); sem nenhuma em aberto, a última não arquivada, como antes. O resto da função não muda.
--
--   Só acrescenta: a mesma função, com a mesma assinatura e as mesmas permissões, trocada (create or replace). A versão anterior do site
--   continua funcionando: ela não chama esta função (quem chama são as funções do banco e a rotina diária).
-- =====================================================================

CREATE OR REPLACE FUNCTION privado.gerar_repeticoes(p_serie uuid, p_hoje date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  r public.compromisso_repeticoes; m public.compromissos; v record; v_id uuid; v_sala uuid; v_etapa uuid; v_ultima date;
  v_ids uuid[] := '{}'; v_sem_sala date[] := '{}';
begin
  select * into r from public.compromisso_repeticoes where id = p_serie for update;
  -- O modelo: a última data em aberto; sem nenhuma, a última não arquivada.
  select * into m from public.compromissos c where c.repeticao_id = r.id and c.arquivado_em is null
  order by privado.compromisso_em_aberto(c.etapa_id, c.arquivado_em) desc, c.repeticao_data desc limit 1;
  if r.id is null or m.id is null then
    return jsonb_build_object('ids', '[]'::jsonb, 'sem_sala', '[]'::jsonb);
  end if;
  select q.id into v_etapa from public.quadro_colunas q
  where q.escritorio_id = r.escritorio_id and q.modulo = 'compromissos' and q.marco = 'inicio' order by q.ordem limit 1;
  v_ultima := r.gerada_ate;
  for v in select * from privado.vezes_para_gerar(r, p_hoje) loop
    v_sala := m.sala_id;
    if v_sala is not null and not privado.sala_livre(v_sala, v.data, m.hora, m.hora_fim) then
      v_sala := null;
      v_sem_sala := v_sem_sala || v.data;
    end if;
    insert into public.compromissos (escritorio_id, tipo, titulo, data, hora, hora_fim, modalidade, local, observacoes, geral, responsavel_id,
                                     participantes, pessoas, processo_id, grupos, sala_id, etapa_id, etapa_ordem, criado_por, repeticao_id, repeticao_data)
    values (m.escritorio_id, m.tipo, m.titulo, v.data, m.hora, m.hora_fim, m.modalidade, m.local, m.observacoes, m.geral, m.responsavel_id,
            -- quem saiu da equipe não entra nas datas novas
            array(select x from unnest(m.participantes) x where exists (select 1 from public.perfis p where p.id = x and p.escritorio_id = m.escritorio_id)),
            m.pessoas, m.processo_id, m.grupos, v_sala, v_etapa, extract(epoch from clock_timestamp()), coalesce(r.criado_por, m.criado_por), r.id, v.data)
    returning id into v_id;
    insert into public.compromisso_ligacoes (compromisso_id, tarefa_id, demanda_id, contrato_id, criado_por)
    select v_id, l.tarefa_id, l.demanda_id, l.contrato_id, l.criado_por from public.compromisso_ligacoes l
    where l.compromisso_id = m.id
      and not exists (select 1 from public.compromissos x where x.demanda_gerada_id is not null and x.demanda_gerada_id = l.demanda_id)
    order by l.id;
    insert into public.compromisso_etiquetas (escritorio_id, compromisso_id, etiqueta_id)
    select e.escritorio_id, v_id, e.etiqueta_id from public.compromisso_etiquetas e where e.compromisso_id = m.id;
    v_ids := v_ids || v_id;
    v_ultima := v.data;
  end loop;
  update public.compromisso_repeticoes set gerada_ate = v_ultima, atualizado_em = now() where id = r.id and gerada_ate is distinct from v_ultima;
  return jsonb_build_object('ids', to_jsonb(v_ids), 'sem_sala', to_jsonb(v_sem_sala));
end $function$;
