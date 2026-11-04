-- =====================================================================
-- Visibilidade dos contratos (#107)
--   O contrato passa a ser visto só por quem o criou, pelo responsável,
--   pelos participantes e pelos administradores do escritório. Regra
--   combinada em 29/10/2026. O indicador não entra: ele vê o que recebe
--   em Meus valores, não o contrato.
--
--   Seguem o contrato as tabelas ligadas a ele que ainda eram abertas ao
--   escritório: histórico, clientes e participantes. Comentários e
--   etiquetas já consultam o contrato pelas regras dele, e parcelas e
--   recebimentos continuam só de quem cuida do contrato (cuido_do_contrato).
--   Pessoas continua comum a todos. Na demanda e na tarefa fica a cópia do
--   número (contrato_codigo): quem está nelas vê que há um contrato ligado,
--   mas não consegue abri-lo.
--
--   Quem deixaria de ver o contrato com a própria alteração recebe erro (a
--   leitura confere também a linha nova), como nas demandas e nos processos:
--   um responsável que não criou o contrato não o passa a outro advogado
--   sem continuar nele; um administrador passa.
--
--   Só acrescenta: troca regras por outras mais fechadas. Nenhuma tabela,
--   coluna ou função muda, e a versão anterior do site continua funcionando:
--   quem não é administrador só passa a ver menos.
-- =====================================================================

-- A lista de participantes é lida da própria linha, e não de contrato_participantes: a regra de leitura
-- de lá consulta os contratos (daria recursão), e ela só é copiada depois de gravar. Quem grava só as
-- colunas antigas (a versão anterior do site) também entra aqui: o gatilho participantes monta a lista.
-- As consultas entre parênteses rodam uma vez por leitura, e não uma vez por contrato (como faria uma
-- função no estilo de vejo_processo): o quadro lê os contratos várias vezes ao abrir.
alter policy leitura on public.contratos
  using (escritorio_id = (select privado.meu_escritorio())
         and ((select privado.sou_admin())
              or (select auth.uid()) in (criado_por, responsavel_id)
              or participantes @> jsonb_build_array(jsonb_build_object('pessoa_id', (select privado.minha_pessoa())))));
-- A mesma regra. Sem ela, uma alteração sem filtro (que não passa pela regra de leitura) alcançaria os contratos alheios.
alter policy alterar on public.contratos
  using (escritorio_id = (select privado.meu_escritorio())
         and ((select privado.sou_admin())
              or (select auth.uid()) in (criado_por, responsavel_id)
              or participantes @> jsonb_build_array(jsonb_build_object('pessoa_id', (select privado.minha_pessoa())))));

-- O histórico, os clientes e os participantes seguem quem vê o contrato.
alter policy leitura on public.contrato_historico
  using (exists (select 1 from public.contratos k where k.id = contrato_id));
alter policy leitura on public.contrato_clientes
  using (exists (select 1 from public.contratos k where k.id = contrato_id));
alter policy leitura on public.contrato_participantes
  using (exists (select 1 from public.contratos k where k.id = contrato_id));
