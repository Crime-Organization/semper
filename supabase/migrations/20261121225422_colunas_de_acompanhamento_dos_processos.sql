-- =====================================================================
-- "Aguardando MP" e "Em acompanhamento" no quadro de Processos judiciais (#315)
--   Pedidas junto com os sistemas e polos criminais (#288, #289). Decisão do dono: entram depois das colunas de andamento e
--   antes das de encerramento. Ficam num grupo novo, "Acompanhamento", logo antes do grupo da coluna das concluídas
--   ("Encerrado"). As colunas-marco (a primeira e a das concluídas) não mudam.
--   - Escritório novo: nasce com elas (gatilho depois do que monta os quadros de processos).
--   - Escritório que já existe: ganha as que faltam uma vez, agora, sem mexer nos processos nem nas colunas e grupos dele.
--   - Coluna de mesmo nome ou parecido não se repete (privado.acrescentar_colunas_padrao, da #314); se o escritório já tem um
--     grupo "Acompanhamento", elas entram no fim dele.
--   As mesmas colunas estão em COLUNAS_NOVAS_DOS_PROCESSOS (app/src/regras/colunasPadrao.ts): mudou aqui, muda lá.
--   Só acrescenta (funções, um gatilho, um grupo e colunas). A versão anterior do site continua funcionando: são um grupo e
--   colunas comuns.
-- =====================================================================

create function privado.colunas_novas_dos_processos() returns jsonb
language sql immutable set search_path = '' as $$
  select '[
    {"nome": "Aguardando MP",
     "parecidos": ["Aguardando Ministério Público", "Aguardando manifestação do MP", "Aguardando manifestação do Ministério Público",
                   "Aguardando parecer do MP", "Aguardando parecer do Ministério Público"]},
    {"nome": "Em acompanhamento", "parecidos": ["Acompanhamento", "Acompanhando"]}
  ]'::jsonb
$$;
revoke execute on function privado.colunas_novas_dos_processos() from public, anon, authenticated;

-- O nome do grupo novo.
create function privado.grupo_novo_dos_processos() returns text
language sql immutable set search_path = '' as $$ select 'Acompanhamento'::text $$;
revoke execute on function privado.grupo_novo_dos_processos() from public, anon, authenticated;

-- Escritório novo. O nome do gatilho vem depois de "quadros_de_processos" (que monta o quadro) e antes de
-- "zz_grupos_depois_das_colunas" na ordem alfabética (o Postgres roda os gatilhos nessa ordem).
create function privado.colunas_novas_dos_processos_do_escritorio_novo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform privado.acrescentar_colunas_padrao(new.id, 'processos_judiciais', privado.colunas_novas_dos_processos(), null,
    privado.grupo_novo_dos_processos());
  return null;
end $$;
revoke execute on function privado.colunas_novas_dos_processos_do_escritorio_novo() from public, anon, authenticated;
create trigger zy_colunas_novas_dos_processos after insert on public.escritorios
  for each row execute function privado.colunas_novas_dos_processos_do_escritorio_novo();

-- Escritório que já existe: ganha as que faltam, uma vez.
select privado.acrescentar_colunas_padrao(e.id, 'processos_judiciais', privado.colunas_novas_dos_processos(), null,
  privado.grupo_novo_dos_processos())
from public.escritorios e;
