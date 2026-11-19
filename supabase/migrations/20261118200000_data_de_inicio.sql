-- =====================================================================
-- Data de início de tarefas e demandas (#357)
--   O cartão mostra quando foi criado (o criado_em, fixo) e a data de início, que começa igual à da criação e pode ser mudada por
--   quem altera o cartão. O quadro e a tabela ordenam e filtram por ela.
--   Só acrescenta: uma coluna em tarefas e outra em demandas, e a permissão de mudá-la. Nenhuma coluna, função ou regra sai ou muda.
--   A versão anterior do site continua funcionando:
--   - ela não conhece a coluna: os cadastros que ela grava (sem data_inicio) ganham o valor padrão, o dia de hoje no horário de
--     Brasília, que é o dia do criado_em (os dois saem do mesmo now() da gravação);
--   - as consultas dela pedem as colunas pelo nome (supabase.ts) e não recebem a nova; as atualizações dela não a mencionam;
--   - o histórico do cartão (privado.historico_tarefa e privado.historico_demanda) já olha todas as colunas: a mudança da data de
--     início entra nele sozinha, como {"data_inicio": {"de": "2026-11-18", "para": "2026-11-25"}}, e as funções não precisam ser
--     recriadas (a versão anterior mostra o nome técnico do campo e a data como o banco guarda; a nova mostra "Data de início" e dd/mm/aaaa).
--   - not null: a coluna nasce com o valor padrão, as linhas que já existem são preenchidas antes da regra valer, e nenhum caminho
--     de gravação (site antigo, site novo, gatilhos que criam demandas e tarefas sozinhos) grava a data vazia: todos omitem a coluna
--     (e ficam com o padrão) ou mandam uma data. Por isso a regra não quebra o site antigo e garante que o cartão sempre tenha início.
-- =====================================================================

-- 1. A coluna, com o padrão: hoje, no horário de Brasília (como os outros "hoje" do banco, ex.: privado.gerar_avisos_de_prazo).
--    Nas linhas que já existem, o PostgreSQL guarda o padrão de agora sem reescrever a tabela; o passo 2 troca pelo dia da criação.
alter table public.tarefas  add column data_inicio date not null default (now() at time zone 'America/Sao_Paulo')::date;
alter table public.demandas add column data_inicio date not null default (now() at time zone 'America/Sao_Paulo')::date;

-- 2. As tarefas e demandas que já existem começam no dia em que foram criadas (no horário de Brasília). Os gatilhos ficam
--    desligados só durante este preenchimento: ele não é uma alteração feita por alguém, então não entra no histórico de cada cartão
--    nem na auditoria, e não muda o "atualizado em" (a ordem "Atualizados recentemente" continua a mesma). Ficam ligados de novo logo
--    em seguida, dentro da mesma migração (as restrições de chave estrangeira não são gatilhos de usuário e continuam valendo).
alter table public.tarefas disable trigger user;
update public.tarefas set data_inicio = (criado_em at time zone 'America/Sao_Paulo')::date;
alter table public.tarefas enable trigger user;
alter table public.demandas disable trigger user;
update public.demandas set data_inicio = (criado_em at time zone 'America/Sao_Paulo')::date;
alter table public.demandas enable trigger user;

-- 3. Quem altera o cartão pode mudar a data de início (as regras de quem altera, as políticas "alterar", não mudam). Quem cria já
--    pode gravá-la: a permissão de incluir vale para todas as colunas.
grant update (data_inicio) on public.tarefas to authenticated;
grant update (data_inicio) on public.demandas to authenticated;

-- 4. A ordem e o filtro pela data de início, dentro do escritório, nos cartões ativos (como o quadro e a tabela leem).
create index tarefas_data_inicio on public.tarefas (escritorio_id, data_inicio) where arquivado_em is null;
create index demandas_data_inicio on public.demandas (escritorio_id, data_inicio) where arquivado_em is null;
