-- =====================================================================
-- Compromissos que se repetem: só muda a série quem muda as datas dela (#307, correção da revisão)
--   - "Esta e as seguintes" (mudar a data ou o horário, arquivar) e "gerar demanda N dias antes" valem para a série inteira: mudar a data
--     ou arquivar termina a série antiga, e a demanda é marcada na série e nasce em todas as datas. Antes, bastava mudar a data de onde se
--     chamava: quem estava numa data só (posto "só nesta") conseguia parar a repetição de todo mundo, e as datas seguintes que ele não muda
--     ficavam presas a uma série que já tinha terminado. Agora:
--       - compromisso_mudar_seguintes e compromisso_arquivar_seguintes recusam quando há, desta data em diante, uma data em aberto que quem
--         chama não muda (o administrador e a chave "equipe edita tudo" mudam todas, pela mesma privado.altero_o_compromisso);
--       - compromisso_gerar_demandas recusa quando há, de hoje em diante, uma data em aberto da série que quem chama não muda.
--     A recusa diz o que fazer: mudar só esta data, ou pedir a quem cuida da repetição. É a mesma mensagem do banco fictício (SEGUINTES_DE_OUTROS
--     e DEMANDA_NA_SERIE_DE_OUTROS em app/src/regras/repeticao.ts).
--   - O quadro e a tabela (public.no_quadro): só as datas em aberto procuram a próxima da série. A data realizada ou cancelada responde
--     "não" sem ler a série, e a arquivada, "sim", como antes. Antes, cada data, até as que já passaram, lia a série inteira: o custo crescia
--     ao quadrado com o tamanho da série. Um índice novo acha as datas ativas de cada série pela data.
--
--   Só acrescenta: uma função e um índice novos; quatro funções trocadas, com os mesmos nomes, parâmetros e respostas. As três de "esta e as
--   seguintes" e da demanda passam a recusar um caso a mais; no_quadro dá o mesmo resultado. A versão anterior do site continua funcionando:
--   ela chama as mesmas funções e mostra a recusa como qualquer erro do banco.
-- =====================================================================

-- 1. Quem chama muda todas as datas em aberto da série: as de uma vez em diante (p_vez_desde, a data que a regra deu) e as de um dia em
-- diante (p_dia_desde, a data do compromisso). Null não filtra.
create function privado.altero_as_datas_em_aberto(p_serie uuid, p_vez_desde date, p_dia_desde date) returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists (select 1 from public.compromissos x
                     where x.repeticao_id = p_serie
                       and (p_vez_desde is null or x.repeticao_data >= p_vez_desde) and (p_dia_desde is null or x.data >= p_dia_desde)
                       and privado.compromisso_em_aberto(x.etapa_id, x.arquivado_em) and not privado.altero_o_compromisso(x.id))
$$;
revoke execute on function privado.altero_as_datas_em_aberto(uuid, date, date) from public, anon, authenticated;

-- 2. Mudar esta e as seguintes: a de 20261122232804_compromissos_que_se_repetem.sql, com a recusa a quem não muda todas as seguintes.
CREATE OR REPLACE FUNCTION public.compromisso_mudar_seguintes(p_id uuid, p_data date, p_hora time without time zone DEFAULT NULL::time without time zone, p_hora_fim time without time zone DEFAULT NULL::time without time zone)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  c public.compromissos; r public.compromisso_repeticoes; v_ids uuid[]; v_nova public.compromisso_repeticoes; v_resta integer;
  v_i integer; v_data date;
begin
  select * into c from public.compromissos where id = p_id and escritorio_id = privado.meu_escritorio() for update;
  if c.id is null or not privado.altero_o_compromisso(p_id) then
    raise exception 'Você não tem permissão para fazer isso.' using errcode = '42501';
  end if;
  if c.repeticao_id is null then
    raise exception 'Este compromisso não se repete.';
  end if;
  select * into r from public.compromisso_repeticoes where id = c.repeticao_id for update;
  if not privado.altero_as_datas_em_aberto(c.repeticao_id, c.repeticao_data, null) then
    raise exception 'Há datas seguintes desta repetição que você não pode mudar. Mude só esta data ou peça a quem cuida da repetição.';
  end if;
  v_ids := privado.esta_e_as_seguintes(c);
  if p_data = c.data then
    update public.compromissos set hora = p_hora, hora_fim = p_hora_fim where id = any(v_ids);
    return cardinality(v_ids);
  end if;

  v_resta := r.vezes - privado.vez_da_data(r, c.repeticao_data);
  insert into public.compromisso_repeticoes (escritorio_id, frequencia, intervalo, inicio, ate, vezes, gerada_ate, criado_por)
  values (r.escritorio_id, r.frequencia, r.intervalo, p_data,
          case when r.ate is not null then greatest(r.ate, p_data) when v_resta < 2 then p_data end,
          case when v_resta >= 2 then v_resta end, p_data, auth.uid())
  returning * into v_nova;
  update public.compromisso_repeticoes set ate = c.repeticao_data - 1, vezes = null, atualizado_em = now() where id = r.id;

  for v_i in select g from generate_series(1, cardinality(v_ids)) g order by case when p_data > c.data then -g else g end loop
    v_data := privado.data_da_vez(p_data, r.frequencia, r.intervalo, v_i - 1);
    if (v_nova.ate is not null and v_data > v_nova.ate) or (v_nova.vezes is not null and v_i > v_nova.vezes) then
      update public.compromissos set arquivado_em = now(), arquivado_por = auth.uid() where id = v_ids[v_i];
    else
      update public.compromissos set data = v_data, hora = p_hora, hora_fim = p_hora_fim, repeticao_id = v_nova.id, repeticao_data = v_data
      where id = v_ids[v_i];
      update public.compromisso_repeticoes set gerada_ate = greatest(gerada_ate, v_data) where id = v_nova.id;
    end if;
  end loop;
  perform privado.gerar_repeticoes(v_nova.id, privado.hoje_da_agenda());
  return cardinality(v_ids);
end $function$;

-- 3. Arquivar esta e as seguintes: a de 20261122232804_compromissos_que_se_repetem.sql, com a mesma recusa.
CREATE OR REPLACE FUNCTION public.compromisso_arquivar_seguintes(p_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c public.compromissos; v_ids uuid[];
begin
  select * into c from public.compromissos where id = p_id and escritorio_id = privado.meu_escritorio() for update;
  if c.id is null or not privado.altero_o_compromisso(p_id) then
    raise exception 'Você não tem permissão para fazer isso.' using errcode = '42501';
  end if;
  if c.repeticao_id is null then
    raise exception 'Este compromisso não se repete.';
  end if;
  if not privado.altero_as_datas_em_aberto(c.repeticao_id, c.repeticao_data, null) then
    raise exception 'Há datas seguintes desta repetição que você não pode mudar. Mude só esta data ou peça a quem cuida da repetição.';
  end if;
  v_ids := privado.esta_e_as_seguintes(c);
  update public.compromisso_repeticoes set ate = c.repeticao_data - 1, vezes = null, atualizado_em = now() where id = c.repeticao_id;
  update public.compromissos set arquivado_em = now(), arquivado_por = auth.uid() where id = any(v_ids);
  return cardinality(v_ids);
end $function$;

-- 4. Gerar demanda N dias antes: a de 20261123000750_demandas_dos_compromissos.sql, recusando a quem não muda todas as datas em aberto de
-- hoje em diante (a marca vale para a série, e a demanda nasce em cada uma delas).
CREATE OR REPLACE FUNCTION public.compromisso_gerar_demandas(p_id uuid, p_dias integer)
 RETURNS uuid[]
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c public.compromissos;
begin
  select * into c from public.compromissos where id = p_id and escritorio_id = privado.meu_escritorio();
  if c.id is null or not privado.altero_o_compromisso(p_id) then
    raise exception 'Você não tem permissão para fazer isso.' using errcode = '42501';
  end if;
  if c.repeticao_id is null then
    raise exception 'Só o compromisso que se repete gera demanda.';
  end if;
  if p_dias is not null and not exists (select 1 from public.escritorios e where e.id = c.escritorio_id and e.modulos ->> 'demandas' = 'true') then
    raise exception 'O módulo Demandas não está ligado neste escritório.';
  end if;
  if not privado.altero_as_datas_em_aberto(c.repeticao_id, null, privado.hoje_da_agenda()) then
    raise exception 'Há datas desta repetição que você não pode mudar. Peça a quem cuida da repetição para marcar a demanda.';
  end if;
  update public.compromisso_repeticoes set demanda_dias_antes = p_dias, atualizado_em = now() where id = c.repeticao_id;
  if p_dias is null then return '{}'; end if;
  return privado.gerar_demandas_das_series(c.repeticao_id, privado.hoje_da_agenda());
end $function$;

-- 5. O quadro e a tabela: a de 20261122232804_compromissos_que_se_repetem.sql, com a saída antecipada (o "case" garante a ordem: só a
-- data em aberto lê a série).
CREATE OR REPLACE FUNCTION public.no_quadro(c public.compromissos)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select case
    when c.repeticao_id is null or c.arquivado_em is not null then true
    when not privado.compromisso_em_aberto(c.etapa_id, c.arquivado_em) then false
    else c.id = (
      select x.id from public.compromissos x
      where x.repeticao_id = c.repeticao_id and x.arquivado_em is null and privado.compromisso_em_aberto(x.etapa_id, x.arquivado_em)
      order by x.data < privado.hoje_da_agenda(), case when x.data >= privado.hoje_da_agenda() then x.data end, x.data desc, x.hora nulls first, x.id
      limit 1)
  end
$function$;

-- As datas ativas de cada série, pela data (as que no_quadro e a rotina leem).
create index compromissos_ativos_da_repeticao on public.compromissos (repeticao_id, data) where repeticao_id is not null and arquivado_em is null;
