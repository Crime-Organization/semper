-- =====================================================================
-- Tarefa: qualquer um que altera a tarefa liga a aprovação; só quem aprova a desliga (#313, correção da parte D)
--   Em 20261123013306_tarefa_aprovacao.sql, o banco recusava que quem executa (nem solicitante nem administrador) marcasse a caixa
--   "Precisa de aprovação" numa tarefa que ainda não a tinha, mas o lápis deixava a caixa livre: a pessoa marcava, salvava e recebia o
--   erro. Ligar a aprovação não dá a ninguém nada a mais (só faz a tarefa esperar quem a pediu), e por isso agora:
--   - na tarefa que ainda não precisa de aprovação, quem a altera pode marcar a caixa e trocar o solicitante (como o lápis mostra);
--   - na tarefa que já precisa de aprovação, só quem aprova (o solicitante de antes ou um administrador) desmarca a caixa ou troca o
--     solicitante (senão, quem executa se aprovaria).
--   O mesmo de conferirMudancaDaAprovacao em app/src/regras/aprovacaoDaTarefa.ts. O desvio para a coluna de aprovação é o de
--   20261123021438_tarefa_aprovacao_do_administrador.sql, sem mudança.
--
-- Só acrescenta: troca o corpo de uma função (o mesmo nome, os mesmos parâmetros e o mesmo gatilho). A versão anterior do site
-- continua funcionando: ela não conhece a caixa, e só recusa menos do que antes.
-- =====================================================================

CREATE OR REPLACE FUNCTION privado.aprovacao_da_tarefa()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_aprovacao uuid;
begin
  if tg_op = 'UPDATE' and old.precisa_aprovacao
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
