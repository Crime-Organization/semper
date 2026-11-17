-- =====================================================================
-- Polo do cliente nos processos criminais (#289)
--   O "Polo do cliente" aceitava só autor, réu e terceiro. Passa a aceitar também vítima, investigado (no inquérito) e
--   apenado (na execução da pena), para todos os escritórios, no processo judicial e no administrativo.
--   Só amplia a lista: os processos gravados continuam valendo, e a versão anterior do site continua funcionando (ela
--   só grava os três valores de antes, que seguem aceitos). Um valor fora da lista continua recusado.
--   O nome da regra é o que o Postgres deu à regra da coluna em 20261101155218_processos.sql. Se ela tiver outro nome,
--   a migração para no "drop" e nada muda.
-- =====================================================================

alter table public.processos drop constraint processos_polo_check;
alter table public.processos add constraint processos_polo_check
  check (polo in ('autor', 'reu', 'terceiro', 'vitima', 'investigado', 'apenado'));
