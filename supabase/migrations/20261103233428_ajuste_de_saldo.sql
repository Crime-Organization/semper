-- =====================================================================
-- Financeiro: o ajuste de saldo no caixa (tarefa #241)
--   - O administrador iguala o saldo do sistema ao da conta no banco com um lançamento próprio, e depois audita a diferença.
--   - Duas categorias novas: ajuste_a_mais (entrada) e ajuste_a_menos (saída). As categorias são as de CATEGORIAS em
--     app/src/regras/caixa.ts.
--   - O saldo da conta muda como em qualquer lançamento (financeiro_saldo_antes soma tudo). DAS, lucro, repasses e contribuição de
--     sócio não leem os lançamentos: vêm dos recebimentos e das retiradas. Por isso o ajuste não entra neles, sem mudar nada lá.
--   - Quem pode lançar continua igual: só administradores, pelas regras RLS que já existem.
--   Só acrescenta: a regra da categoria é refeita para aceitar mais, e tudo o que já valia continua valendo.
-- =====================================================================
alter table public.financeiro_lancamentos drop constraint financeiro_lancamentos_check;
-- Cada categoria só serve para o seu tipo; a transferência tem uma ponta de cada.
alter table public.financeiro_lancamentos add constraint financeiro_lancamentos_check
  check ((categoria in ('recebimento', 'outra_entrada', 'ajuste_a_mais') and tipo = 'entrada')
      or (categoria in ('despesa', 'das', 'repasse', 'indicacao', 'divisao_lucro', 'ajuste_a_menos') and tipo = 'saida')
      or categoria = 'transferencia');
