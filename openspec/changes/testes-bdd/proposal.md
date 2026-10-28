## Why

Os testes de hoje cobrem só `app/src/regras/` (24 casos em 3 arquivos) e não seguem BDD: cada `it` mistura várias verificações sem relação entre si (CPF, CNPJ e dígitos repetidos no mesmo caso), sem a estrutura Dado/Quando/Então, e quando um falha não fica claro qual comportamento quebrou. As telas, as peças de `app/src/ui/` e os fluxos (entrar, cadastrar pessoa, convidar para a equipe) não têm teste nenhum. Como o próximo passo é trocar a marcação das telas por componentes de um design system, é preciso uma rede de testes de interface **antes**, para provar que nada mudou para quem usa.

## What Changes

- Adotar um padrão BDD único para todos os testes do SEMPER, em português: `describe` nomeia a funcionalidade ou o contexto, cada `it` descreve um só comportamento ("quando…, então…") e o corpo segue os blocos Dado / Quando / Então.
- Refatorar os três arquivos atuais (`pessoa.test.ts`, `vinculos.test.ts`, `contatosGoogle.test.ts`) para esse padrão, sem perder nenhuma verificação que existe hoje.
- Criar testes unitários para o que ainda não tem: as funções de `regras/` sem teste (`fmtCPF`, `fmtCNPJ`, `fmtCEP`, `fmtData`, `emailValido`, `ehIndividual`, `consultarCNPJ`, `consultarCEP` com a rede simulada…) e a lógica pura de `ui/` (`util.ts`, `ordem.ts`, `tema.ts`, iniciais e cor do `Avatar`, a pilha de desfazer de `avisos.tsx`).
- Criar testes de componente (React Testing Library) para as peças comuns: `Botao`, `BotaoDuplo`, `janela`/`confirmar`/`pedirTexto`, `Avisos` com desfazer, `Recolhivel`, `MenuFlutuante`, `BuscaPessoa`.
- Criar testes de ponta a ponta no navegador (Playwright) dos fluxos principais, rodando contra o banco fictício (`npm run teste`), sem tocar no Supabase.
- Incluir os testes de ponta a ponta na rotina de publicação: se falharem, nada é publicado.

## Capabilities

### New Capabilities
- `padrao-bdd-testes`: a convenção de escrita dos testes (nomes, estrutura Dado/Quando/Então, um comportamento por caso, idioma) que todo teste novo ou refatorado segue.
- `testes-unitarios`: cobertura das regras de cadastro e da lógica pura da interface, incluindo a refatoração dos testes existentes.
- `testes-de-interface`: testes de componente das peças de `ui/` e testes de ponta a ponta dos fluxos principais, e a sua entrada na rotina de publicação.

### Modified Capabilities
<!-- Nenhuma: openspec/specs/ ainda está vazio. -->

## Impact

- **Código de teste:** `app/src/regras/*.test.ts` (refatorados), novos `*.test.ts(x)` ao lado do código em `app/src/regras/` e `app/src/ui/`, e uma pasta nova `app/e2e/` para o Playwright.
- **Dependências de desenvolvimento novas:** `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom` e `@playwright/test`. Nada muda nas dependências do site publicado.
- **Configuração:** `vite.config.ts` (bloco `test` do Vitest: ambiente por arquivo, arquivo de preparação), `playwright.config.ts` novo, scripts novos no `package.json`.
- **Publicação:** `.github/workflows/publicar.yml` ganha a instalação do navegador e o passo dos testes de ponta a ponta; a publicação fica cerca de 1 a 2 minutos mais lenta.
- **Código do produto:** nenhuma mudança de comportamento. Pode ser preciso acrescentar rótulos acessíveis (`aria-label`) onde um botão só tem ícone, para que o teste o encontre pelo papel e pelo nome.
- **Fora do escopo:** testes do banco (regras RLS e funções SQL de `banco/`), meta mínima de cobertura, testes visuais por captura de tela e o próprio design system (vem depois, em outro ramo, usando esta rede de testes).
