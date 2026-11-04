#!/usr/bin/env bash
# Teste da cópia de segurança (#77), num banco local já ligado (`supabase db start`), com dados inventados: copia, confere que o arquivo
# está criptografado, apaga tudo, restaura e confere que os dados e as regras de acesso voltaram. Roda da raiz do projeto; na rotina
# do GitHub, é um passo do job do banco. Ao terminar, o banco local fica com os dados inventados: `supabase db reset --local --no-seed`.
set -euo pipefail

aqui="$(dirname "$0")"
supabase="${SUPABASE:-supabase}"
conteiner="${COPIA_CONTEINER:-supabase_db_semper}"
porta="$(awk '/^\[db\]/{ativo=1} ativo && /^port/{print $3; exit}' supabase/config.toml)"
banco() { docker exec -i "$conteiner" psql -U postgres -d postgres -X -q -A -t -v ON_ERROR_STOP=1 "$@"; }
falhou() { echo "FALHOU: $1" >&2; exit 1; }

# Linhas e conteúdo de cada tabela dos dados, para comparar antes e depois. As tabelas fora da cópia não entram.
retrato() {
  banco <<'SQL'
select format('select %L, count(*), md5(coalesce(string_agg(t::text, %L order by t::text), %L)) from %I.%I t', schemaname || '.' || tablename, ',', '', schemaname, tablename)
  from pg_tables where schemaname in ('public', 'privado') or (schemaname = 'auth' and tablename in ('users', 'identities', 'mfa_factors'))
  order by schemaname, tablename
\gexec
SQL
}

pasta="$(mktemp -d)"
trap 'rm -rf "$pasta"' EXIT
mkdir "$pasta/copias"

age-keygen -o "$pasta/chave.txt" 2> /dev/null
publica="$(age-keygen -y "$pasta/chave.txt")"

banco < "$aqui/dados_ficticios.sql"
retrato > "$pasta/antes.txt"

nome="$(COPIA_BANCO_URL="postgresql://postgres:postgres@127.0.0.1:$porta/postgres" COPIA_CHAVE_PUBLICA="$publica" "$aqui/copiar.sh" "$pasta/copias" | tail -1)"
arquivo="$pasta/copias/$nome"
[ -s "$arquivo" ] || falhou "o arquivo da cópia não foi criado"
if grep -qaF 'MARCA-FICTICIA' "$arquivo"; then falhou "o arquivo da cópia tem dados legíveis"; fi

# Com outra chave, a cópia não abre.
age-keygen -o "$pasta/outra.txt" 2> /dev/null
if age -d -i "$pasta/outra.txt" < "$arquivo" > /dev/null 2>&1; then falhou "outra chave abriu a cópia"; fi

$supabase db reset --local --no-seed > /dev/null 2>&1
[ "$(banco -c "select count(*) from public.pessoas")" = "0" ] || falhou "o banco não ficou vazio antes de restaurar"

"$aqui/restaurar-local.sh" "$arquivo" "$pasta/chave.txt" "$conteiner"

retrato > "$pasta/depois.txt"
diff "$pasta/antes.txt" "$pasta/depois.txt" > /dev/null || { echo "Tabelas diferentes depois de restaurar:" >&2; diff "$pasta/antes.txt" "$pasta/depois.txt" | cut -d'|' -f1 >&2 || true; falhou "os dados não voltaram iguais"; }

# Sessões ficam fora da cópia: a de antes não vale mais.
[ "$(banco -c "select count(*) from auth.sessions")" = "0" ] || falhou "a cópia trouxe sessões"

# Regras de acesso: com uma sessão nova, cada escritório vê só o que é dele; sem sessão, ninguém vê nada.
banco -c "insert into auth.sessions (id, user_id, created_at, updated_at) values ('50000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', now(), now())"
veja() {
  banco <<SQL | tail -1
begin;
select set_config('request.jwt.claims', jsonb_build_object('sub', 'a0000000-0000-0000-0000-000000000001', 'role', 'authenticated', 'aal', 'aal1', 'session_id', '$1')::text, true);
set local role authenticated;
select count(*) from public.pessoas where id in ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002');
rollback;
SQL
}
[ "$(veja 50000000-0000-0000-0000-000000000002)" = "1" ] || falhou "a regra de acesso não mostrou só a pessoa do escritório"
[ "$(veja 50000000-0000-0000-0000-000000000001)" = "0" ] || falhou "uma sessão de antes da cópia continuou valendo"

# A numeração continua de onde parou: uma linha nova não pode repetir o número de uma linha restaurada.
banco -c "insert into public.auditoria (escritorio_id, tabela, registro_id, acao, resumo) values ('e0000000-0000-0000-0000-000000000001', 'pessoas', 'x', 'alteracao', '{}')" || falhou "a numeração não voltou"

echo "Cópia e restauração: tudo certo."
