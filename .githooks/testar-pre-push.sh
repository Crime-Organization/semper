#!/usr/bin/env bash
# Teste das conferências antes do envio (#265), num repositório temporário: não toca no projeto nem no GitHub, e os comandos pesados são
# trocados por marcadores. Roda da raiz do projeto; na rotina do GitHub, é um passo do job de tipos e lint.
set -euo pipefail

gancho="$(cd "$(dirname "$0")" && pwd)/pre-push"
pasta="$(mktemp -d)"
trap 'rm -rf "$pasta"' EXIT

git init -q --bare -b main "$pasta/remoto.git"
git clone -q "$pasta/remoto.git" "$pasta/copia" 2> /dev/null
cd "$pasta/copia"
git config user.name 'Teste'
git config user.email 'teste@exemplo.test'
git config core.hooksPath "$pasta/ganchos"
mkdir "$pasta/ganchos"
git checkout -q -b main 2> /dev/null || true

marcador="$pasta/rodou"
export PRE_PUSH_VERIFICAR="echo verificar >> '$marcador'"
export PRE_PUSH_BANCO="echo banco >> '$marcador'"
export PRE_PUSH_DOCKER='true'

falhou() { echo "FALHOU: $1" >&2; exit 1; }
commit() { mkdir -p "$(dirname "$1")"; echo "$RANDOM" >> "$1"; git add -A; git commit -q -m "$2"; }
rodou() { [ -f "$marcador" ] && grep -q "$1" "$marcador"; }
recomecar() { rm -f "$marcador"; git reset -q --hard "${1:-origin/main}"; }

# A primeira versão do main entra sem o gancho, para os casos abaixo partirem de um main que já existe.
commit inicio.txt 'Começo'
git push -q origin main
cp "$gancho" "$pasta/ganchos/pre-push"
chmod +x "$pasta/ganchos/pre-push"

# Dado um commit, com ou sem número de tarefa, quando envia ao main, então confere os testes e aceita.
commit app/tela.txt 'Tela nova'
git push -q origin main 2> /dev/null || falhou 'um envio limpo foi recusado'
rodou verificar || falhou 'o envio ao main não rodou os testes'
if rodou banco; then falhou 'um envio sem banco rodou os testes do banco'; fi
recomecar

# Dado um teste falhando, quando envia ao main, então recusa.
commit app/tela.txt 'Tela com erro'
if PRE_PUSH_VERIFICAR='false' git push -q origin main 2> "$pasta/erro"; then falhou 'um envio com teste falhando foi aceito'; fi
grep -q 'falharam' "$pasta/erro" || falhou 'a recusa não explicou o teste falhando'
recomecar

# Dado um arquivo do banco, quando envia ao main, então roda também os testes do banco.
commit supabase/migrations/nova.sql 'Migração nova'
git push -q origin main 2> /dev/null || falhou 'um envio limpo com banco foi recusado'
rodou banco || falhou 'um envio com banco não rodou os testes do banco'
recomecar

# Dado um arquivo do banco com o Docker desligado, quando envia ao main, então recusa e explica.
commit supabase/migrations/outra.sql 'Outra migração'
if PRE_PUSH_DOCKER='false' git push -q origin main 2> "$pasta/erro"; then falhou 'um envio com banco foi aceito sem o Docker'; fi
grep -q 'Docker' "$pasta/erro" || falhou 'a recusa não citou o Docker'
if rodou banco; then falhou 'tentou rodar os testes do banco sem o Docker'; fi
recomecar

# Dado um teste do banco falhando, quando envia ao main, então recusa.
commit supabase/migrations/errada.sql 'Migração errada'
if PRE_PUSH_BANCO='false' git push -q origin main 2> "$pasta/erro"; then falhou 'um envio com teste do banco falhando foi aceito'; fi
grep -q 'testes do banco falharam' "$pasta/erro" || falhou 'a recusa não explicou o teste do banco falhando'
recomecar

# Dado outro ramo, quando envia, então nada é conferido.
git checkout -q -b outro-ramo
commit app/tela.txt 'Rascunho sem tarefa'
PRE_PUSH_VERIFICAR='false' git push -q origin outro-ramo 2> /dev/null || falhou 'um envio a outro ramo foi conferido'

echo 'Conferências antes do envio: todos os casos passaram.'
