-- =====================================================================
-- Tarefa: o administrador que executa também passa pela aprovação (#313, correção da parte D)
--   Em 20261123013306_tarefa_aprovacao.sql, quem "aprova" (o solicitante ou qualquer administrador) concluía direto a tarefa que
--   precisa de aprovação. Como no escritório quem executa costuma ser advogado administrador, a aprovação de quem pediu nunca
--   acontecia. O critério da tarefa: quando o executor a conclui, ela vai para a coluna de aprovação até o solicitante aprovar ou
--   devolver. Agora:
--   - só o próprio solicitante (ou ninguém logado: uma rotina, a importação) leva a tarefa direto às concluídas;
--   - quem aprova (o solicitante ou um administrador) que a tira da coluna de aprovação para as concluídas a aprova (é o que
--     public.tarefa_aprovar faz, e também o arrastar no quadro);
--   - qualquer outra pessoa, administrador ou não, que a leva às concluídas a manda para a coluna de aprovação.
--   O mesmo de etapaComAprovacao em app/src/regras/aprovacaoDaTarefa.ts.
--
-- Só acrescenta: troca o corpo de uma função (o mesmo nome, os mesmos parâmetros e o mesmo gatilho). A versão anterior do site
-- continua funcionando: ela não conhece a caixa, e a tarefa dela que precisa de aprovação já ia para a coluna de aprovação.
-- =====================================================================

CREATE OR REPLACE FUNCTION privado.aprovacao_da_tarefa()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_aprovacao uuid;
begin
  if tg_op = 'UPDATE' and (old.precisa_aprovacao or new.precisa_aprovacao)
     and (new.precisa_aprovacao is distinct from old.precisa_aprovacao or new.solicitante_id is distinct from old.solicitante_id)
     and not privado.aprovo_a_tarefa(old.solicitante_id) then
    raise exception 'Só quem pediu a tarefa ou um administrador muda a aprovação ou o solicitante dela.';
  end if;
  select c.id into v_aprovacao from public.quadro_colunas c where c.escritorio_id = new.escritorio_id and c.de_aprovacao;
  if not new.precisa_aprovacao or (tg_op = 'UPDATE' and new.etapa_id is not distinct from old.etapa_id)
     or auth.uid() is null or auth.uid() = new.solicitante_id
     -- Quem aprova e a tira da coluna de aprovação: é a aprovação.
     or (tg_op = 'UPDATE' and old.etapa_id = v_aprovacao and privado.aprovo_a_tarefa(new.solicitante_id))
     or not exists (select 1 from public.quadro_colunas c where c.id = new.etapa_id and c.marco = 'concluido') then
    return new;
  end if;
  if v_aprovacao is not null then
    new.etapa_id := v_aprovacao;
  end if;
  return new;
end $function$;
