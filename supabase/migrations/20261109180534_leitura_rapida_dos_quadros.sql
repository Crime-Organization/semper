-- =====================================================================
-- Leitura rápida dos quadros (#278)
--   Com mais de mil cartões numa coluna, as buscas de tarefas, demandas e processos passavam do limite de 8 segundos do banco e a coluna
--   aparecia vazia. A regra de leitura chamava vejo_tarefa, vejo_demanda ou vejo_processo a cada cartão, e cada chamada confere de novo quem
--   é a pessoa, a sessão e as duas etapas.
--   As consultas entre parênteses rodam uma vez por leitura, como já é na regra dos contratos. Quem vê o quê não muda: as condições são as
--   mesmas das funções, que continuam valendo para alterar e para o que fica dentro do cartão.
--   Se uma dessas funções mudar, a regra de leitura precisa mudar junto (o teste leitura_rapida_dos_quadros confere os casos).
--   - Tarefas: entrar pela demanda ligada depende da outra tabela, então só esse caso continua conferindo cartão a cartão, e só quando há
--     demanda e nada mais deu acesso. A chave equipe_ve_tudo entra aqui porque, sem ela, essa conferência rodaria antes da regra equipe_ve_tudo.
--   Só acrescenta: nenhuma coluna, função ou regra sai. A versão anterior do site continua funcionando.
-- =====================================================================

alter policy leitura on public.demandas
  using (escritorio_id = (select privado.meu_escritorio())
         and ((select privado.sou_admin())
              or (select privado.equipe_edita_tudo())
              or (select auth.uid()) in (criado_por, responsavel_id)
              or (select auth.uid()) = any(colaboradores)));

alter policy leitura on public.processos
  using (escritorio_id = (select privado.meu_escritorio())
         and ((select privado.sou_admin())
              or (select privado.equipe_edita_tudo())
              or (select auth.uid()) in (criado_por, responsavel_id)
              or (select auth.uid()) = any(colaboradores)));

alter policy leitura on public.tarefas
  using (escritorio_id = (select privado.meu_escritorio())
         and ((select privado.sou_admin())
              or (select privado.equipe_edita_tudo())
              or (select privado.equipe_ve_tudo())
              or (select auth.uid()) in (criado_por, responsavel_id)
              or (select auth.uid()) = any(participantes)
              or (demanda_id is not null
                  and privado.vejo_tarefa(escritorio_id, criado_por, responsavel_id, participantes, demanda_id))));
