-- As parcelas e os recebimentos mais rápidos. A regra de quem vê continua a mesma (um administrador do escritório ou o responsável pelo
-- contrato), mas deixa de chamar privado.cuido_do_contrato uma vez por linha: o escritório, o "sou administrador" e a lista dos contratos
-- de que a pessoa é responsável são lidos uma vez por consulta. Com os 3.104 registros do histórico, cada lote de mil parcelas caiu de
-- 266 ms para 7 ms no banco. Só troca a expressão das regras: as colunas, as funções e a versão anterior do site continuam iguais.

alter policy leitura on public.contrato_parcelas
  using (escritorio_id = (select privado.meu_escritorio())
         and ((select privado.sou_admin()) or contrato_id in (select k.id from public.contratos k where k.responsavel_id = (select auth.uid()))));
alter policy alterar on public.contrato_parcelas
  using (escritorio_id = (select privado.meu_escritorio())
         and ((select privado.sou_admin()) or contrato_id in (select k.id from public.contratos k where k.responsavel_id = (select auth.uid()))))
  with check (escritorio_id = (select privado.meu_escritorio())
              and ((select privado.sou_admin()) or contrato_id in (select k.id from public.contratos k where k.responsavel_id = (select auth.uid()))));

alter policy leitura on public.financeiro_recebimentos
  using (escritorio_id = (select privado.meu_escritorio())
         and ((select privado.sou_admin()) or contrato_id in (select k.id from public.contratos k where k.responsavel_id = (select auth.uid()))));
