-- =====================================================================
-- LGPD: esquecer a pessoa também na cópia dos recebimentos excluídos (#412)
--   Ao excluir um contrato (#284), o dinheiro dele fica numa cópia escondida, public.financeiro_excluidos, com o nome dos clientes
--   (cliente_nome, "A; B") e, na cópia das linhas (copia), os nomes de quem recebia parte (participantes, indicador, sócio) e as
--   descrições do Caixa ("Recebimento: A; B (código, parcela 1)", "Repasse a C: ..."). Até aqui, excluir a pessoa (LGPD) deixava o
--   nome dela lá.
--   Agora, ao excluir a pessoa, o nome dela vira "pessoa excluída" nessa cópia, como no histórico dos contratos e dos processos:
--   - pelo código: nos itens da cópia que apontam para ela (id ou pessoa_id), o "nome" (pega também o nome antigo, de antes de uma
--     troca de nome);
--   - pelo nome: em cliente_nome e em todo texto da cópia, quando o nome aparece inteiro, no lugar em que o Financeiro o escreve
--     (sozinho, numa lista "A; B", depois de "Recebimento: " ou "Repasse a ", antes de " (código, parcela N)"). Outro nome que só
--     começa igual ("Ana Lima Souza", ao esquecer "Ana Lima") não muda.
--   Valores, datas, contas, códigos e ids continuam: a conta do escritório fecha, e o administrador ainda confere ou relança à mão.
--   Só o escritório da pessoa muda.
--
-- Só acrescenta (duas funções e um gatilho novos). A versão anterior do site continua funcionando: ela não lê esta tabela, e o
-- gatilho só roda na exclusão da pessoa, que não muda.
-- =====================================================================

-- O nome inteiro, onde o Financeiro o escreve. Os caracteres especiais do nome são escapados, como em privado.esquecer_pessoa.
create function privado.nome_no_financeiro(p_nome text) returns text
language sql immutable set search_path = '' as $$
  select '(?<=^|; |: |Repasse a )' || regexp_replace(p_nome, '([.*+?^${}()|\[\]\\])', '\\\1', 'g')
      || '(?=; | \([^()]*, parcela [0-9]+\)|: |$)'
$$;
revoke execute on function privado.nome_no_financeiro(text) from public, anon, authenticated;

-- A cópia sem a pessoa: o "nome" de cada item que aponta para ela (id ou pessoa_id) e o nome dela em todo texto (p_padrao, de
-- privado.nome_no_financeiro). O resto fica como está.
create function privado.copia_sem_a_pessoa(p_j jsonb, p_id uuid, p_padrao text) returns jsonb
language plpgsql immutable set search_path = '' as $$
begin
  return case jsonb_typeof(p_j)
    when 'string' then to_jsonb(regexp_replace(p_j #>> '{}', p_padrao, 'pessoa excluída', 'g'))
    when 'array' then coalesce((select jsonb_agg(privado.copia_sem_a_pessoa(e, p_id, p_padrao) order by i)
                                  from jsonb_array_elements(p_j) with ordinality x(e, i)), '[]'::jsonb)
    when 'object' then coalesce((select jsonb_object_agg(k, case
                                   when k = 'nome' and p_id::text in (p_j ->> 'id', p_j ->> 'pessoa_id') then to_jsonb('pessoa excluída'::text)
                                   else privado.copia_sem_a_pessoa(v, p_id, p_padrao) end)
                                   from jsonb_each(p_j) e(k, v)), '{}'::jsonb)
    else p_j end;
end $$;
revoke execute on function privado.copia_sem_a_pessoa(jsonb, uuid, text) from public, anon, authenticated;

-- Ao excluir a pessoa: só as linhas do escritório dela em que o nome ou o código aparecem.
create function privado.esquecer_pessoa_nos_excluidos() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_padrao text := privado.nome_no_financeiro(old.nome);
  v_nome_na_copia text := substr(to_jsonb(old.nome)::text, 2, length(to_jsonb(old.nome)::text) - 2);   -- o nome como o jsonb o escreve
begin
  update public.financeiro_excluidos x
     set cliente_nome = regexp_replace(x.cliente_nome, v_padrao, 'pessoa excluída', 'g'),
         copia = privado.copia_sem_a_pessoa(x.copia, old.id, v_padrao)
   where x.escritorio_id = old.escritorio_id
     and (x.cliente_nome ~ v_padrao or strpos(x.copia::text, v_nome_na_copia) > 0 or strpos(x.copia::text, old.id::text) > 0);
  return null;
end $$;
revoke execute on function privado.esquecer_pessoa_nos_excluidos() from public, anon, authenticated;
create trigger esquecer_nos_excluidos after delete on public.pessoas
  for each row execute function privado.esquecer_pessoa_nos_excluidos();
