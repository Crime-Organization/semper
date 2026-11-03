-- =====================================================================
-- 014 · Colunas-marco nos quadros
--   Algumas colunas marcam um ponto do fluxo normal, e o sistema precisa
--   reconhecê-las mesmo que alguém as renomeie. Elas ganham um código fixo
--   em "marco":
--   - assinado: a coluna do contrato assinado (Contratos). Quando existir
--     o módulo Demandas (#45), é dela que saem as demandas automáticas.
--   - inicio e concluido: a primeira e a última coluna do fluxo (Demandas,
--     quando o módulo existir).
--   Coluna-marco pode ser renomeada e mudar de lugar, mas não pode ser
--   excluída nem criada à mão (só o banco cria).
--
--   Só acrescenta (a coluna "marco" e o índice) e aperta duas regras de
--   acesso das colunas. A versão anterior do site continua funcionando.
-- =====================================================================

alter table public.quadro_colunas add column marco text check (marco in ('assinado', 'inicio', 'concluido'));
-- Cada marco existe uma vez só em cada quadro de cada escritório.
create unique index quadro_colunas_marco_unico on public.quadro_colunas (escritorio_id, modulo, marco) where marco is not null;

-- Ninguém cria coluna-marco pela tela, e coluna-marco não se exclui. ("marco" já fica de fora do que se pode alterar.)
alter policy incluir on public.quadro_colunas
  with check (escritorio_id = (select privado.meu_escritorio()) and criado_por = (select auth.uid()) and marco is null);
alter policy apagar on public.quadro_colunas
  using (escritorio_id = (select privado.meu_escritorio()) and (select privado.sou_admin()) and marco is null);

-- Em cada escritório, a coluna "Assinado / em andamento" de Contratos vira a coluna-marco. Se ela não existir mais
-- (foi renomeada ou excluída), uma nova é criada depois de "Aguardando assinatura".
update public.quadro_colunas c set marco = 'assinado'
where c.modulo = 'contratos' and privado.sem_acento(btrim(c.nome)) = privado.sem_acento('Assinado / em andamento');

insert into public.quadro_colunas (escritorio_id, modulo, nome, ordem, criado_por, marco)
select e.id, 'contratos', 'Assinado / em andamento',
       coalesce((select max(ordem) from public.quadro_colunas where escritorio_id = e.id and modulo = 'contratos'
                 and privado.sem_acento(btrim(nome)) = privado.sem_acento('Aguardando assinatura')), 2) + 0.5,
       null, 'assinado'
from public.escritorios e
where not exists (select 1 from public.quadro_colunas c where c.escritorio_id = e.id and c.modulo = 'contratos' and c.marco = 'assinado')
  and not exists (select 1 from public.quadro_colunas c where c.escritorio_id = e.id and c.modulo = 'contratos'
                  and privado.sem_acento(btrim(c.nome)) = privado.sem_acento('Assinado / em andamento'));
