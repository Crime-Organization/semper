-- =====================================================================
-- Propriedade intelectual: o processo com titular, inventor ou autor da criação não sai da área (#418)
--   O gatilho papel_so_da_pi (20261124135238_papeis_e_deferimento_da_pi.sql) confere o papel ao pôr a pessoa no processo. Faltava o
--   caminho inverso: mudar a área de um processo de propriedade intelectual para outra deixava esses papéis num processo que não é da
--   área. Agora o banco recusa a troca enquanto o processo tiver alguém com um desses papéis (a pessoa tira o papel antes).
--   Só a SAÍDA da área é conferida (a área de antes é de PI e a nova não é): um processo antigo que já estava fora da área com algum
--   desses papéis continua mudando de área como antes, sem travar. A área é comparada como em papel_so_da_pi (sem contar maiúsculas,
--   acentos e espaços nas pontas, como AREA_DA_PI em app/src/regras/propriedadeIntelectual.ts).
--   A frase é PAPEIS_DA_PI_NA_TROCA_DE_AREA, em app/src/regras/propriedadeIntelectual.ts (a mesma do banco fictício): mudou aqui, muda lá.
--   A função é security definer só para enxergar as pessoas do processo, e olha só as linhas do mesmo escritório do processo; o caminho
--   fixo (search_path vazio) não deixa outro esquema entrar no lugar.
--   Só acrescenta (uma função e um gatilho novos). A versão anterior do site continua funcionando: ela lê e grava a área como antes, e
--   a única troca recusada é a que deixaria esses papéis fora da área.
-- =====================================================================

create function privado.area_com_papeis_da_pi() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if privado.sem_acento(btrim(coalesce(old.area, ''))) = 'propriedade intelectual'
     and privado.sem_acento(btrim(coalesce(new.area, ''))) <> 'propriedade intelectual'
     and exists (select 1 from public.processo_partes pp
                 where pp.processo_id = new.id and pp.escritorio_id = new.escritorio_id
                   and pp.papel in ('titular', 'inventor', 'autor_da_criacao')) then
    raise exception 'Este processo tem titular, inventor ou autor da criação: tire essas pessoas do processo antes de mudar a área.';
  end if;
  return new;
end $$;
revoke execute on function privado.area_com_papeis_da_pi() from public, anon;
create trigger area_com_papeis_da_pi before update of area on public.processos
  for each row execute function privado.area_com_papeis_da_pi();
