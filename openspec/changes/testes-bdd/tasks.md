## 1. Preparação

- [x] 1.1 Criar o ramo `testes-bdd` a partir do `main`
- [x] 1.2 Instalar as dependências atuais (`npm install --prefix app`) e confirmar que `npm run verificar --prefix app` passa como está hoje
- [x] 1.3 Contar os `expect` de cada arquivo de teste atual e anotar os números (base para a conferência da refatoração)

## 2. Refatoração dos testes existentes para BDD

- [x] 2.1 Reescrever `app/src/regras/pessoa.test.ts`: um comportamento por `it`, nomes "quando …, então …", blocos `// Dado` / `// Quando` / `// Então`, `it.each` para variações (máscaras, telefones, datas)
- [x] 2.2 Reescrever `app/src/regras/vinculos.test.ts` no mesmo padrão
- [x] 2.3 Reescrever `app/src/regras/contatosGoogle.test.ts` no mesmo padrão, mantendo o leitor de CSV como ajudante do arquivo
- [x] 2.4 Conferir que nenhum `expect` foi perdido (contagem igual ou maior em cada arquivo), que `npm run verificar` passa e que o `git diff` só mexe em `*.test.ts`

## 3. Configuração dos testes

- [x] 3.1 Instalar `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom` e `@playwright/test` como dependências de desenvolvimento
- [x] 3.2 No `vite.config.ts`, apontar `@dados-impl` para `falso.ts` também no modo `test`, e criar o bloco `test` (arquivo de preparação, `exclude` de `e2e/`)
- [x] 3.3 Criar `app/src/testes/preparar.ts` (comparadores do jest-dom e limpeza entre casos)
- [x] 3.4 Fixar o fuso nos scripts de teste (`TZ=America/Sao_Paulo`) e acrescentar o script `testar-telas`
- [x] 3.5 Criar `app/playwright.config.ts` (Chromium, `webServer` com `npm run teste` na porta 8091, `retries` e `trace` na rotina, relatório HTML) e ignorar `playwright-report/` e `test-results/` no `.gitignore`

## 4. Testes unitários novos

- [x] 4.1 `regras/pessoa.test.ts`: casos para `fmtCPF`, `fmtCNPJ`, `fmtDocumento`, `fmtCEP`, `fmtData`, `emailValido`, `ehIndividual` e as demais funções de lógica ainda sem teste (certo e inválido/vazio)
- [x] 4.2 `regras/pessoa.test.ts`: `consultarCNPJ` e `consultarCEP` com `fetch` simulado (sucesso, 404, falha de rede, reserva do ViaCEP quando a BrasilAPI falha)
- [x] 4.3 `ui/util.test.ts`: `dataCurta`, `dataHora`, `relativo` (relógio fixo), `numero`, `normal`
- [x] 4.4 `ui/ordem.test.ts`: `dataDaOrdem` para cada ordem de data
- [x] 4.5 `ui/tema.test.ts` (jsdom): `temaAtual`, `temaGuardado`, `aplicarTema`/`definirTema` e o atributo no elemento raiz
- [x] 4.6 `ui/Avatar.test.ts`: `iniciais` (nome completo, nome só, vazio, `null`) e `corDe` estável para a mesma pessoa
- [x] 4.7 `ui/avisos.test.ts`: pilha de desfazer (`registrarDesfazer`, `desfazerUltimo` na ordem certa, `feito`)

## 5. Testes de componente

- [x] 5.1 `ui/Botoes.test.tsx`: `Botao` ocupado durante a ação (inclusive com erro) e `BotaoDuplo` (confirmação, segundo clique, volta em 4 s e ao perder o foco)
- [x] 5.2 `ui/janela.test.tsx`: `confirmar` (ação, cancelar, Esc) e `pedirTexto` (valor inicial, limite, devolução)
- [x] 5.3 `ui/avisos.tela.test.tsx`: aviso com "Desfazer" pelo botão e por Ctrl+Z
- [x] 5.4 `ui/Recolhivel.test.tsx` e `ui/Menu.test.tsx`: abrir e fechar por mouse e teclado, `aria-expanded`, Esc e clique fora
- [x] 5.5 `ui/BuscaPessoa.test.tsx`: busca com dados simulados e escolha de uma pessoa
- [x] 5.6 Onde um botão só tem ícone e o teste não o encontra pelo nome, acrescentar `aria-label` no componente (única mudança permitida no produto) (não foi preciso: todos os botões usados já tinham nome acessível)

## 6. Testes de ponta a ponta

- [x] 6.1 Criar `app/e2e/ajudantes.ts` (`sair`, abrir tela pela barra lateral) e anotar no topo de `falso.ts` que mudar a semente exige rodar `npm run testar-telas`
- [x] 6.2 `e2e/entrada.spec.ts`: página inicial → entrar → Início; rota protegida depois de sair; sair pelo menu
- [x] 6.3 `e2e/pessoas.spec.ts`: cadastrar pessoa física; CPF inválido; CPF repetido; buscar; trocar tabela/quadro e a escolha continuar valendo
- [x] 6.4 `e2e/quadro.spec.ts`: mover cartão entre colunas e continuar lá depois de recarregar
- [x] 6.5 `e2e/equipe.spec.ts`: dar acesso a uma pessoa, convite em "Convites pendentes" e cancelar
- [x] 6.6 `e2e/configuracoes.spec.ts`: mudar o nome do escritório e ver o nome novo na barra lateral
- [x] 6.7 Rodar `npm run testar-telas` três vezes seguidas sem falha (conferir que não há teste instável)

## 7. Rotina de publicação

- [x] 7.1 Conferir as rotinas atuais: o `main` já tem `verificar.yml` (envios e pull requests, sem publicar) e `publicar.yml` (só versões `vX.Y.Z`); não é preciso mudar gatilhos
- [x] 7.2 Acrescentar a instalação do Chromium (`npx playwright install --with-deps chromium`) e o passo `npm run testar-telas` antes de compilar, em `verificar.yml` e em `publicar.yml`
- [x] 7.3 Enviar `playwright-report/` como anexo da execução quando os testes de ponta a ponta falharem (`actions/upload-artifact`)
- [ ] 7.4 Abrir o pull request do ramo e confirmar que a rotina roda os três tipos de teste sem publicar

## 8. Documentação

- [x] 8.1 Escrever `app/TESTES.md`: o padrão BDD, um exemplo de cada tipo de teste, onde cada arquivo fica e os comandos
- [x] 8.2 Atualizar o `README.md`: apontar para `app/TESTES.md`, citar `npm run testar-telas` em "Testar no computador" e o passo novo em "Como vai ao ar"
