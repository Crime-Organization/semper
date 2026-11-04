---
description: Confere tudo antes de aplicar mudanças no banco de produção, explica o risco em português simples, pede confirmação e aplica
---

Use este roteiro sempre que for aplicar migrações no banco de produção. Você pode aplicar, mas **só depois de conferir tudo e receber um "sim"**. Nunca peça a senha do banco nem aceite que ela seja colada aqui. Se ela aparecer, avise a pessoa para trocá-la. Se o projeto não estiver ligado, peça que a pessoa rode `supabase link --project-ref uzafzwqjpxxiovfunxfm` no terminal dela, digitando a senha só lá.

Quem pede pode não ser programador e costuma aceitar o que você propõe sem entender. Por isso, o que protege são as conferências abaixo, não a confirmação da pessoa. Fale em português simples. Este roteiro só aplica migrações: nunca leia dados de clientes da produção.

## 1. Descubra o que falta aplicar

Rode `supabase migration list` contra a produção (`--remote` na versão 3 da CLI, confira em `--help`). O sistema vai pedir permissão para o comando. Compare a resposta com `supabase/migrations/`. Se não houver nada a aplicar, diga isso e pare.

## 2. Confira. Se qualquer item falhar, pare e não aplique

Diga qual item falhou e o que fazer para resolver.

1. **Cópia de hoje:** `gh run list --workflow copia-do-banco.yml --status success --limit 1 --json createdAt,databaseId` precisa mostrar uma execução de hoje, no horário de Brasília. Sem ela, peça para rodar Actions → Cópia do banco → Run workflow e espere terminar.
2. **Testes do banco:** com o Docker ligado, `supabase db reset --local --no-seed` e `supabase test db` precisam passar. Avise antes de rodar: o `reset` apaga o que estiver no banco local. Se a pessoa não puder perder esses dados, use `supabase migration up --local --include-all` no lugar dele.
3. **Só acrescenta:** nas migrações a aplicar, procure `drop table`, `drop column`, `rename`, `truncate`, `delete from` fora de função e `alter column … type`. Se achar, pare. Apagar ou renomear é uma decisão à parte: mostre o que seria perdido e peça que Ludimila veja antes.
4. **Ordem:** nenhuma migração a aplicar pode ter data anterior à última já aplicada. Se tiver, pare, porque o `db push` recusaria. Nunca use `--include-all` na produção sem antes conferir com Ludimila.
5. **Volume:** se a migração mexe em muitas linhas existentes ou se é uma importação, peça uma cópia nova, feita logo antes, mesmo que já exista uma de hoje.
6. **Ordem de publicação:** explique que o banco vem antes das funções do servidor e do site, e confira se há passos manuais na tarefa ligada.

## 3. Explique e pergunte

Só depois de tudo certo, rode `supabase db push --remote --dry-run`, que mostra o que seria aplicado sem aplicar nada, e mostre exatamente este formato, com as migrações reais:

> **Vou mudar o banco real, com dados de clientes.**
> **O que muda:** (em português simples, uma linha por migração, sem nome de tabela)
> **O que conferi:** cópia de hoje, testes do banco, nada é apagado, ordem certa.
> **Quem sente:** (o que muda para quem usa o sistema)
> **Se der errado:** dá para corrigir com outra mudança, mas dado estragado só volta pela cópia, perdendo o que entrou depois dela.
> **Você confirma?**

Espere um "sim" da pessoa. Silêncio ou resposta vaga não é confirmação. O "sim" vale só para estas migrações.

## 4. Aplique

Com o "sim", rode `supabase db push --remote --yes`. Depois, peça que a pessoa entre no sistema e confira se as listas aparecem. Se algo falhar no meio, pare, mostre o erro e não tente de novo por conta própria.

## 5. Registre

Comente na tarefa ligada, para Ludimila poder ler depois: o que foi aplicado, quando, o que foi conferido e a resposta da pessoa. Use `gh issue comment`. Nunca escreva senha nem dado de cliente nesse comentário.
