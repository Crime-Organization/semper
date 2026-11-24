-- =====================================================================
-- LGPD: esquecer a pessoa também na cópia dos recebimentos excluídos (#412)
--   Ao excluir um contrato (#284), o dinheiro dele fica numa cópia escondida, public.financeiro_excluidos, com o nome dos clientes
--   (cliente_nome, "A; B") e, na cópia das linhas (copia), os nomes de quem recebia parte (participantes, indicador, sócio) e as
--   descrições do Caixa ("Recebimento: A; B (código, parcela 1)", "Repasse a C: ...", "Correção do recebimento de A; B (código):
--   motivo"). Até aqui, excluir a pessoa (LGPD) deixava o nome dela lá.
--   Agora, ao excluir a pessoa, o nome dela vira "pessoa excluída" nessa cópia, como no histórico dos contratos e dos processos:
--   - os nomes dela: o atual e os antigos que a cópia guarda nos itens que apontam para ela (id ou pessoa_id), de antes de uma troca
--     de nome (também em outras linhas do escritório);
--   - pelo código: nos itens da cópia que apontam para ela, o "nome";
--   - pelo nome, em cliente_nome e em todo texto da cópia, quando um dos nomes dela aparece inteiro no lugar em que o Financeiro o
--     escreve (sozinho, numa lista "A; B", depois de "Recebimento: ", "Repasse a " ou "Correção do recebimento de ", antes de
--     " (código, parcela N)" ou de " (código): "). Outro nome que só começa igual ("Ana Lima Souza", ao esquecer "Ana Lima") não muda;
--   - no motivo de uma correção (texto livre), o nome inteiro em qualquer lugar, entre o que não é letra nem número;
--   - nas descrições cortadas pelo Financeiro (a lista de clientes em 200 letras, a descrição do Caixa em 300): o sufixo cortado
--     depois do nome ("ANA LIMA (AA11-00") e o pedaço do nome no ponto do corte ("...; ANA LI (código, parcela 1)", "...; ANA LI" no
--     fim), quando o pedaço não é o nome inteiro de outra pessoa da mesma linha.
--   Valores, datas, contas, códigos e ids continuam: a conta do escritório fecha, e o administrador ainda confere ou relança à mão.
--   Só o escritório da pessoa muda.
--   Limites conhecidos: um nome antigo de cliente que não está em item nenhum da cópia (o cliente trocou de nome depois do recebimento,
--   ou depois da exclusão do contrato) não é achado, porque a cópia não guarda o código dos clientes; no motivo, só o nome escrito
--   igual (mesmas maiúsculas e acentos); e um pedaço cortado igual ao nome inteiro de outra pessoa da linha fica.
--
-- Só acrescenta (funções e um gatilho novos). A versão anterior do site continua funcionando: ela não lê esta tabela, e o gatilho só
-- roda na exclusão da pessoa, que não muda.
-- =====================================================================

-- Os textos como alternativas de uma expressão regular, os mais longos primeiro, com os caracteres especiais escapados (como em
-- privado.esquecer_pessoa). Nulo quando não há texto.
create function privado.alternativas_regex(p_textos text[]) returns text
language sql immutable set search_path = '' as $$
  select string_agg(regexp_replace(t, '([.*+?^${}()|\[\]\\])', '\\\1', 'g'), '|' order by char_length(t) desc, t)
    from (select distinct t from unnest(p_textos) t where coalesce(t, '') <> '') x
$$;
revoke execute on function privado.alternativas_regex(text[]) from public, anon, authenticated;

-- Um dos nomes inteiro, onde o Financeiro o escreve (veja o começo). O sufixo pode ter sido cortado no fim do texto.
create function privado.nome_no_financeiro(p_nomes text[]) returns text
language sql immutable set search_path = '' as $$
  select '(?<=^|; |: |Repasse a |Correção do recebimento de )(?:' || privado.alternativas_regex(p_nomes) || ')'
      || '(?=; |: | \([^()]*, parcela [0-9]+\)| \([^()]*\): | \([^()]*$| ?$)'
$$;
revoke execute on function privado.nome_no_financeiro(text[]) from public, anon, authenticated;

-- Um dos nomes inteiro no motivo de uma correção, entre o que não é letra nem número; não quando é o começo do nome de outra pessoa
-- da linha (p_conhecidos), como "ANA LIMA" em "ANA LIMA SOUZA".
create function privado.nome_no_motivo(p_nomes text[], p_conhecidos text[]) returns text
language sql immutable set search_path = '' as $$
  select '(?<![0-9A-Za-zÀ-ÖØ-öø-ÿ])(?:' || string_agg(privado.alternativas_regex(array[n])
           || coalesce('(?!' || (select privado.alternativas_regex(array_agg(substr(c, char_length(n) + 1)))
                                   from unnest(p_conhecidos) c where starts_with(c, n) and c <> n) || ')', ''),
           '|' order by char_length(n) desc, n)
      || ')(?![0-9A-Za-zÀ-ÖØ-öø-ÿ])'
    from (select distinct n from unnest(p_nomes) n where coalesce(n, '') <> '') x
$$;
revoke execute on function privado.nome_no_motivo(text[], text[]) from public, anon, authenticated;

-- O pedaço de um dos nomes no ponto em que o Financeiro corta: antes de " (código, parcela N)" (a lista cortada em 200 letras) ou no
-- fim do texto (a descrição cortada em 300). Um pedaço que é o nome inteiro de outra pessoa da linha (p_conhecidos) fica. Nulo se
-- não sobra pedaço.
create function privado.pedaco_do_nome(p_nomes text[], p_conhecidos text[]) returns text
language sql immutable set search_path = '' as $$
  select '(?<=^|; |: |Repasse a |Correção do recebimento de )(?:' || a || ')(?= \([^()]*, parcela [0-9]+\)|$)'
    from (select privado.alternativas_regex(array_agg(left(n, i))) a
            from unnest(p_nomes) n, generate_series(1, char_length(n) - 1) i
           where left(n, i) <> all(coalesce(p_conhecidos, '{}'))) x
   where a is not null
$$;
revoke execute on function privado.pedaco_do_nome(text[], text[]) from public, anon, authenticated;

-- Uma descrição do Financeiro sem a pessoa: o nome inteiro onde o Financeiro o escreve, o nome no motivo da correção e o pedaço
-- cortado. Os padrões vêm das funções acima.
create function privado.descricao_sem_a_pessoa(p_t text, p_padrao text, p_motivo text, p_pedaco text) returns text
language plpgsql immutable set search_path = '' as $$
declare
  v_t text := regexp_replace(p_t, p_padrao, 'pessoa excluída', 'g');
  m text[] := regexp_match(v_t, '^(Correção do recebimento de .*? \([^()]*\): )(.*)$');
begin
  if m is not null then v_t := m[1] || regexp_replace(m[2], p_motivo, 'pessoa excluída', 'g'); end if;
  return coalesce(regexp_replace(v_t, p_pedaco, 'pessoa excluída', 'g'), v_t);
end $$;
revoke execute on function privado.descricao_sem_a_pessoa(text, text, text, text) from public, anon, authenticated;

-- A cópia sem a pessoa: o "nome" de cada item que aponta para ela (id ou pessoa_id), as descrições (descricao_sem_a_pessoa) e o
-- nome inteiro em todo outro texto (p_padrao). O resto fica como está.
create function privado.copia_sem_a_pessoa(p_j jsonb, p_id uuid, p_padrao text, p_motivo text, p_pedaco text, p_chave text default null)
returns jsonb language plpgsql immutable set search_path = '' as $$
begin
  return case jsonb_typeof(p_j)
    when 'string' then to_jsonb(case when p_chave = 'descricao' then privado.descricao_sem_a_pessoa(p_j #>> '{}', p_padrao, p_motivo, p_pedaco)
                                     else regexp_replace(p_j #>> '{}', p_padrao, 'pessoa excluída', 'g') end)
    when 'array' then coalesce((select jsonb_agg(privado.copia_sem_a_pessoa(e, p_id, p_padrao, p_motivo, p_pedaco) order by i)
                                  from jsonb_array_elements(p_j) with ordinality x(e, i)), '[]'::jsonb)
    when 'object' then coalesce((select jsonb_object_agg(k, case
                                   when k = 'nome' and p_id::text in (p_j ->> 'id', p_j ->> 'pessoa_id') then to_jsonb('pessoa excluída'::text)
                                   else privado.copia_sem_a_pessoa(v, p_id, p_padrao, p_motivo, p_pedaco, k) end)
                                   from jsonb_each(p_j) e(k, v)), '{}'::jsonb)
    else p_j end;
end $$;
revoke execute on function privado.copia_sem_a_pessoa(jsonb, uuid, text, text, text, text) from public, anon, authenticated;

-- Ao excluir a pessoa: só as linhas do escritório dela, e só as que mudam.
create function privado.esquecer_pessoa_nos_excluidos() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_nomes text[];
  v_padrao text;
begin
  -- Os nomes dela: o atual e os antigos, dos itens da cópia que apontam para ela.
  select array_agg(distinct n) into v_nomes from (
    select old.nome n
    union
    select jsonb_path_query(x.copia, 'lax $.** ? (@.id == $id || @.pessoa_id == $id).nome', jsonb_build_object('id', old.id::text)) #>> '{}'
      from public.financeiro_excluidos x where x.escritorio_id = old.escritorio_id) t
   where coalesce(n, '') <> '';
  if v_nomes is null then return null; end if;
  v_padrao := privado.nome_no_financeiro(v_nomes);

  update public.financeiro_excluidos x
     set cliente_nome = n.cliente_nome, copia = n.copia
    from (select y.id, regexp_replace(y.cliente_nome, v_padrao, 'pessoa excluída', 'g') cliente_nome,
                 privado.copia_sem_a_pessoa(y.copia, old.id, v_padrao, privado.nome_no_motivo(v_nomes, k.conhecidos),
                                            privado.pedaco_do_nome(v_nomes, k.conhecidos)) copia
            from public.financeiro_excluidos y
            -- Os nomes inteiros das outras pessoas da linha: os clientes e todo "nome" da cópia.
            cross join lateral (select coalesce(array_agg(distinct c), '{}') conhecidos from (
                select unnest(string_to_array(y.cliente_nome, '; ')) c
                union
                select jsonb_path_query(y.copia, 'lax $.**.nome') #>> '{}') c0
               where c <> all(v_nomes)) k
           where y.escritorio_id = old.escritorio_id) n
   where x.id = n.id and (x.cliente_nome, x.copia) is distinct from (n.cliente_nome, n.copia);
  return null;
end $$;
revoke execute on function privado.esquecer_pessoa_nos_excluidos() from public, anon, authenticated;
create trigger esquecer_nos_excluidos after delete on public.pessoas
  for each row execute function privado.esquecer_pessoa_nos_excluidos();
