#!/usr/bin/env bash
# Abre uma cópia (copiar.sh) e carrega os dados num banco LOCAL, para testar a restauração (#77). Só fala com um contêiner do Docker
# neste computador, nunca com a produção: ele esvazia as tabelas antes de carregar. Rode antes `supabase db reset --local --no-seed`.
#
#   supabase/copia/restaurar-local.sh <arquivo .age> <arquivo da chave secreta> [contêiner, por padrão supabase_db_semper]
set -euo pipefail

arquivo="${1:?Diga o arquivo da cópia}"
chave="${2:?Diga o arquivo da chave secreta}"
conteiner="${3:-supabase_db_semper}"

pasta="$(mktemp -d)"
trap 'rm -rf "$pasta"' EXIT
age -d -i "$chave" < "$arquivo" | tar -xzf - -C "$pasta"

# As migrações já põem algumas linhas (sugestões de quadro, por exemplo): saem, para a cópia voltar exatamente como era.
docker exec -i "$conteiner" psql -U postgres -d postgres -X -q -v ON_ERROR_STOP=1 <<'SQL'
do $$
declare v_tabelas text;
begin
  select string_agg(format('%I.%I', schemaname, tablename), ', ') into v_tabelas
    from pg_tables where schemaname in ('public', 'privado');
  execute 'truncate ' || v_tabelas || ' cascade';
  delete from auth.users;
end $$;
SQL
docker exec -i "$conteiner" psql -U postgres -d postgres -X -q -v ON_ERROR_STOP=1 < "$pasta/dados.sql" > /dev/null
