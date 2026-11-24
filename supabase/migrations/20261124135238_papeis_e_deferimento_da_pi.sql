-- =====================================================================
-- Propriedade intelectual: papéis só nos processos da área e a publicação do deferimento da marca (#418)
--   1. Titular, inventor e autor da criação (os papéis da migração 20261123003604_propriedade_intelectual.sql) só entram nos
--      processos cuja área do direito é "Propriedade intelectual" (sem contar maiúsculas nem acentos, como AREA_DA_PI em
--      app/src/regras/propriedadeIntelectual.ts). Até aqui só a tela limitava. É um gatilho, e não uma regra check, para não
--      travar as linhas que já existem: ele confere só a pessoa que entra no processo (as linhas de processo_partes não se alteram,
--      só se incluem e se excluem).
--   2. O processo de marca ganha a data da publicação do deferimento na Revista da Propriedade Industrial (RPI). Dela o cartão
--      conta o prazo de 60 dias úteis, mais 30 dias úteis extras, até a concessão ser informada (regras/propriedadeIntelectual.ts;
--      nada disso é gravado). Como os outros campos de PI, a data é só do processo administrativo: no judicial, o gatilho
--      judicial_sem_protecao (20261124050100_processo_judicial_do_administrativo.sql) passa a deixá-la vazia também.
--   A coluna nova é do processo, que já tem escritorio_id e as regras RLS: quem vê o processo vê a data; quem o altera, muda. O
--   histórico do processo registra a coluna nova sozinho (o gatilho historico_processo compara todas as colunas).
--   Só acrescenta (uma coluna opcional, um gatilho novo e a função do gatilho de antes trocada por outra que faz o mesmo e mais um
--   campo). A versão anterior do site continua funcionando: ela não lê nem grava a coluna nova, que nasce vazia, e já só oferecia
--   titular, inventor e autor da criação nos processos de propriedade intelectual.
-- =====================================================================

-- ---------- 1. Titular, inventor e autor da criação só na propriedade intelectual ----------
-- A recusa é a de PAPEL_SO_DA_PI, em app/src/regras/propriedadeIntelectual.ts (a mesma do banco fictício): mudou aqui, muda lá.
create function privado.papel_so_da_pi() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.papel in ('titular', 'inventor', 'autor_da_criacao')
     and not exists (select 1 from public.processos p
                     where p.id = new.processo_id and p.escritorio_id = new.escritorio_id
                       and privado.sem_acento(btrim(coalesce(p.area, ''))) = 'propriedade intelectual') then
    raise exception 'Titular, inventor e autor da criação só existem nos processos de propriedade intelectual.';
  end if;
  return new;
end $$;
revoke execute on function privado.papel_so_da_pi() from public, anon;
create trigger papel_so_da_pi before insert on public.processo_partes
  for each row execute function privado.papel_so_da_pi();

-- ---------- 2. A publicação do deferimento da marca ----------
alter table public.processos add column deferimento date;
grant update (deferimento) on public.processos to authenticated;

-- O judicial não guarda os campos de PI (#425), agora com a data do deferimento: o que vier fica vazio, sem recusar.
create or replace function privado.judicial_sem_protecao() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.protecao := null; new.deposito := null; new.concessao := null; new.publicacao := null; new.criacao := null;
  new.apresentacao_marca := null; new.natureza_marca := null; new.classes_nice := '{}'; new.especificacao := null;
  new.variacoes := null; new.linguagem := null; new.deferimento := null;
  return new;
end $$;
