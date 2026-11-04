#!/usr/bin/env bash
# Copia o banco e grava um único arquivo criptografado (#77). Quem usa: a rotina .github/workflows/copia-do-banco.yml e o teste
# testar-restauracao.sh. O conteúdo nunca aparece na tela, e só a chave secreta, que fica fora do GitHub, abre o arquivo.
#
#   COPIA_BANCO_URL=... COPIA_CHAVE_PUBLICA=age1... supabase/copia/copiar.sh <pasta de destino>
set -euo pipefail

: "${COPIA_BANCO_URL:?Falta COPIA_BANCO_URL (o endereço do banco)}"
: "${COPIA_CHAVE_PUBLICA:?Falta COPIA_CHAVE_PUBLICA (a chave pública do age)}"
destino="${1:?Diga a pasta de destino}"
supabase="${SUPABASE:-supabase}"

# Sessões e códigos de uso único não entram: quem restaura precisa entrar de novo, e links antigos não voltam a valer.
SEM_COPIA='auth.sessions,auth.refresh_tokens,auth.mfa_amr_claims,auth.mfa_challenges,auth.one_time_tokens,auth.flow_state,auth.audit_log_entries,auth.schema_migrations'

pasta="$(mktemp -d)"
trap 'rm -rf "$pasta"' EXIT

$supabase db dump --remote="$COPIA_BANCO_URL" --schema public,privado -f "$pasta/estrutura.sql"
$supabase db dump --remote="$COPIA_BANCO_URL" --data-only --use-copy --schema public,privado,auth -x "$SEM_COPIA" -f "$pasta/dados.sql"

# Uma cópia vazia não pode passar por cópia boa: sem as tabelas principais, a rotina falha e o GitHub avisa.
for parte in '"public"."perfis"' '"public"."pessoas"' '"auth"."users"'; do
  grep -qF "$parte" "$pasta/dados.sql" || { echo "A cópia não trouxe $parte." >&2; exit 1; }
done

nome="semper-$(date -u +%Y-%m-%d-%H%M).tar.gz.age"
tar -czf - -C "$pasta" estrutura.sql dados.sql | age -r "$COPIA_CHAVE_PUBLICA" > "$destino/$nome"
echo "$nome"
