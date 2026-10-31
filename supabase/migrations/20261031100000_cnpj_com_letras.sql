-- =====================================================================
-- CNPJ com letras (tarefa #160)
--   Desde julho de 2026 a Receita Federal emite CNPJ alfanumérico (IN RFB
--   2.229/2024): os 12 primeiros caracteres podem ser letras maiúsculas ou
--   números, e os 2 últimos continuam sendo os dígitos verificadores.
--   O documento da pessoa e o CNPJ do escritório passam a aceitar esse formato.
--   O CPF continua com 11 números. O site grava sempre sem pontuação e em
--   maiúsculas.
--   A regra só fica mais larga: tudo o que já estava gravado continua valendo,
--   e a versão anterior do site, que só grava números, continua funcionando.
-- =====================================================================

alter table public.pessoas drop constraint pessoas_documento_check;
alter table public.pessoas add constraint pessoas_documento_check
  check (documento ~ '^([0-9]{11}|[0-9A-Z]{12}[0-9]{2})$');

alter table public.escritorios drop constraint escritorios_cnpj_check;
alter table public.escritorios add constraint escritorios_cnpj_check
  check (cnpj is null or cnpj ~ '^[0-9A-Z]{12}[0-9]{2}$');
