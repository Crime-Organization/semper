## Context

Hoje o SEMPER tem 24 casos de Vitest em `app/src/regras/` (`pessoa`, `vinculos`, `contatosGoogle`), rodando em `npm run verificar` e na rotina de publicação (`.github/workflows/publicar.yml`). Eles têm nomes em português mas não seguem BDD: cada `it` junta várias verificações, sem Dado/Quando/Então. Não há teste de componente nem de navegador, e não há configuração de `test` no `vite.config.ts` (o Vitest usa o padrão: ambiente `node`, sem arquivo de preparação).

Pontos do código que pesam no desenho:

- A camada de dados é trocada pelo alias `@dados-impl` no `vite.config.ts`: `falso.ts` só no modo `falso`, `supabase.ts` em **todos** os outros, inclusive no modo `test` do Vitest. Um teste de componente que importe `SD` hoje falaria com o Supabase de verdade.
- `falso.ts` guarda o banco no `sessionStorage` e começa **com a sessão aberta** (`logado: true`). Uma aba nova do navegador começa com o banco zerado.
- `falso.ts` mexe em `window` ao ser importado, então só funciona em ambiente de navegador (jsdom ou Playwright).
- O quadro (`Kanban.tsx`) usa arrastar e soltar nativo do HTML5 (`draggable`, `onDragStart`, `onDragOver`).
- `consultarCNPJ` e `consultarCEP` chamam `fetch` direto para publica.cnpj.ws, BrasilAPI e ViaCEP.
- As datas de `util.ts` dependem do relógio e do fuso horário da máquina.

Depois desta mudança vem a troca das telas por componentes do design system, num ramo próprio. Estes testes são a rede de segurança dela, então precisam olhar o que a pessoa vê (papéis e nomes acessíveis), não classes CSS.

## Goals / Non-Goals

**Goals:**
- Um padrão BDD único e documentado para os três tipos de teste.
- Os testes atuais refatorados para o padrão sem perder nenhuma verificação.
- Testes unitários para as regras e a lógica pura de `ui/` que hoje não têm teste.
- Testes de componente para as peças comuns de `ui/` e de ponta a ponta para os fluxos principais.
- Tudo rodando na rotina de publicação, sem nunca tocar no Supabase de verdade.

**Non-Goals:**
- Testar o banco (RLS, funções e gatilhos de `banco/`). Isso pede um Supabase local (Supabase CLI) e fica para outra mudança.
- Meta mínima de cobertura que bloqueie a publicação.
- Testes visuais por captura de tela.
- Testar cada tela isolada com Testing Library: as telas ficam cobertas pelos testes de ponta a ponta, que sobrevivem à troca de componentes do design system.
- Mudar comportamento do produto.

## Decisions

### 1. BDD dentro do Vitest e do Playwright, sem Gherkin
O padrão fica nos próprios `describe`/`it`/`test` (nomes "quando …, então …" e comentários `// Dado`, `// Quando`, `// Então`), sem arquivos `.feature`.

- **Alternativas:** `@amiceli/vitest-cucumber` e `playwright-bdd`, que leem `.feature` em Gherkin.
- **Por quê:** Gherkin acrescenta uma camada de "passos" que precisa ser mantida em paralelo com o teste, e o ganho (gente que não programa escrevendo cenários) não existe hoje no projeto. Os cenários das specs já estão em QUANDO/ENTÃO e viram nomes de caso quase direto. Se um dia alguém de fora do código for escrever cenários, dá para migrar.

### 2. Três camadas, cada uma no seu lugar
| Camada | Ferramenta | Onde fica | Ambiente | Comando |
|---|---|---|---|---|
| Unitário | Vitest | ao lado do código (`*.test.ts`) | `node` | `npm run verificar` |
| Componente | Vitest + Testing Library | ao lado da peça (`*.test.tsx`) | `jsdom` | `npm run verificar` |
| Ponta a ponta | Playwright | `app/e2e/*.spec.ts` | Chromium | `npm run testar-telas` |

- O ambiente `jsdom` é escolhido por arquivo com o comentário `// @vitest-environment jsdom` no topo de cada `*.test.tsx`. **Alternativa:** `test.projects` com dois projetos no `vite.config.ts`; mais configuração para o mesmo resultado num projeto deste tamanho.
- O Vitest precisa ignorar `app/e2e/` (`test.exclude`), porque os `*.spec.ts` dali são do Playwright.
- Um arquivo de preparação (`app/src/testes/preparar.ts`) registra os comparadores do `@testing-library/jest-dom` e limpa a tela entre casos.

### 3. Testes nunca resolvem para o Supabase
O alias `@dados-impl` passa a apontar para `falso.ts` também no modo `test` (`mode === 'falso' || mode === 'test'`). Nos testes de componente, cada arquivo controla os dados com `vi.mock('../dados')` quando precisa de respostas específicas (por exemplo, o `BuscaPessoa`).

- **Alternativa:** só `vi.mock` em cada arquivo, sem mexer no alias. Rejeitada: um arquivo que esqueça o mock chamaria o Supabase de verdade sem nenhum erro.

### 4. Tempo, fuso e rede sob controle
- Relógio: `vi.useFakeTimers()` + `vi.setSystemTime()` nos testes de `relativo`, `dataCurta`, `dataHora`, `BotaoDuplo` (4 s) e avisos.
- Fuso: os scripts de teste rodam com `TZ=America/Sao_Paulo`, para que o resultado seja o mesmo no Mac e no Ubuntu da rotina.
- Rede: `vi.stubGlobal('fetch', …)` nos testes de `consultarCNPJ`/`consultarCEP`, com respostas de sucesso, 404 e falha. Nenhum teste unitário ou de componente acessa a internet.

### 5. Playwright contra o banco fictício
- `playwright.config.ts` sobe o servidor com `webServer: npm run teste` (porta 8091) e o reaproveita se já estiver no ar no computador (`reuseExistingServer` fora da rotina).
- Só Chromium. Cada teste roda num contexto novo do navegador, então o `sessionStorage` (e o banco fictício) começa zerado sem código extra.
- Como o banco fictício começa logado, os testes que precisam de "sem sessão" saem pela própria interface antes (um ajudante `sair(page)` em `app/e2e/ajudantes.ts`).
- Elementos são achados por `getByRole`, `getByLabel` e `getByText`, nunca por classe CSS.
- Sem page objects: os fluxos são poucos e curtos. Só ajudantes pequenos em `ajudantes.ts`.
- Na rotina: `retries: 1`, rastro (`trace`) na primeira repetição, e o relatório HTML enviado como anexo da execução.

### 6. Ordem de execução: refatorar antes de criar
Primeiro os três arquivos atuais são reescritos, um por vez, conferindo que o número de `expect` não diminuiu e que `npm run verificar` passa sem mexer em `regras/`. Só então entram as dependências novas e os testes novos. Isso separa claramente "mudei a forma" de "acrescentei cobertura".

### 7. Ramo
O trabalho fica num ramo próprio (`testes-bdd`), que entra no `main` antes do ramo do design system, para que a troca de componentes já nasça com a rede de testes no lugar.

## Risks / Trade-offs

- [Arrastar e soltar nativo é instável no Playwright] → Usar `locator.dragTo()` no Chromium; se falhar de forma intermitente, um ajudante que dispara `dragstart`/`dragover`/`drop` com o mesmo `DataTransfer`.
- [Os testes de ponta a ponta dependem das pessoas e colunas da semente de `falso.ts`] → Os testes usam os registros da semente pelo nome; mudar a semente passa a exigir rodar `npm run testar-telas`. Isso fica anotado no topo de `falso.ts`.
- [Botões só com ícone não têm nome acessível] → Acrescentar `aria-label` (ou o `title` que já existe) nesses botões. É a única mudança permitida no código do produto, e não muda nada visualmente.
- [A publicação fica mais lenta (instalar o Chromium + rodar os fluxos)] → Cache do npm já existe; instalar só o Chromium. Estimativa: +1 a 2 minutos.
- [Testes de componente acoplados ao HTML interno quebrariam na troca pelo design system] → Proibido buscar por classe ou estrutura; só por papel, nome e texto. A troca de componentes deve manter os nomes acessíveis.
- [Fuso por variável de ambiente no script não funciona no Windows] → Aceito: o projeto roda no Mac e no Ubuntu. Se precisar, `cross-env`.

## Migration Plan

1. Ramo `testes-bdd` a partir do `main`.
2. Refatoração dos três arquivos atuais (sem dependências novas). A publicação continua igual.
3. Dependências e configuração do Vitest (alias, jsdom, preparação, TZ). Testes unitários e de componente novos.
4. Playwright, fluxos de ponta a ponta e `npm run testar-telas`.
5. Passos novos nas duas rotinas. Durante a mudança, o `main` passou a ter duas rotinas (commit 834fc75, "Publicação por versão"): `verificar.yml`, que roda a cada envio ao `main` e a cada pull request e não publica nada, e `publicar.yml`, que só põe no ar uma versão `vX.Y.Z`. Os testes de ponta a ponta entram nas duas, logo depois de "Conferir tipos e testes": em `verificar.yml` para conferir cada pull request, e em `publicar.yml` para que nenhuma versão vá ao ar com um fluxo quebrado. Não é preciso mexer nos gatilhos nem acrescentar condição ao passo de publicação.
6. Reverter é tirar o passo da rotina; os testes não mudam o site publicado.

## Open Questions

- Nenhuma que bloqueie. Meta de cobertura e testes do banco com Supabase local ficam para mudanças próprias.
