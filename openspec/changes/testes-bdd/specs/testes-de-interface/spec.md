## ADDED Requirements

### Requirement: Testes de componente das peças comuns
As peças de `app/src/ui/` usadas por várias telas SHALL ter testes de componente que as montam isoladas e interagem como uma pessoa faria (clique, teclado, digitação), encontrando os elementos pelo papel e pelo nome acessível, nunca por classe CSS ou estrutura do HTML.

#### Scenario: Botão ocupado durante a ação
- **WHEN** o `Botao` é clicado e a ação dele ainda não terminou
- **THEN** ele fica desativado e mostra o `ocupadoTexto`, e volta ao normal quando a ação termina, inclusive se ela der erro

#### Scenario: Exclusão em dois cliques
- **WHEN** o `BotaoDuplo` recebe um clique
- **THEN** mostra o texto de confirmação sem executar nada; um segundo clique executa a ação; sem o segundo clique, ele volta ao estado inicial depois de 4 segundos ou quando perde o foco

#### Scenario: Janela de confirmação
- **WHEN** `confirmar` abre uma janela e a pessoa escolhe a ação, cancela ou aperta Esc
- **THEN** a promessa resolve com o valor da ação escolhida, ou com `null` ao cancelar ou apertar Esc

#### Scenario: Pedir texto
- **WHEN** `pedirTexto` abre com um valor inicial e um limite de caracteres
- **THEN** o campo vem preenchido, não aceita mais que o limite, e confirmar devolve o texto digitado

#### Scenario: Aviso com desfazer
- **WHEN** `feito` mostra um aviso com desfazer e a pessoa clica em "Desfazer" ou aperta Ctrl+Z
- **THEN** a ação de desfazer roda uma vez e o aviso some

#### Scenario: Busca de pessoa
- **WHEN** a pessoa digita parte de um nome no `BuscaPessoa`
- **THEN** a lista mostra as pessoas encontradas pela camada de dados simulada, e escolher uma chama `aoEscolher` com ela

#### Scenario: Seção recolhível e menu flutuante
- **WHEN** a pessoa abre e fecha um `Recolhivel` e um `MenuFlutuante` com o mouse e com o teclado
- **THEN** o conteúdo aparece e some, o `aria-expanded` do `Recolhivel` acompanha, e o menu fecha com Esc (devolvendo o foco ao botão que o abriu) ou com clique fora

### Requirement: Testes de ponta a ponta dos fluxos principais
Os fluxos principais SHALL ter testes no navegador (Playwright) rodando contra o banco fictício (`vite --mode falso`), nunca contra o Supabase. Cada teste MUST começar com o banco fictício zerado (o banco fictício começa com sessão aberta), para não depender da ordem em que os testes rodam.

#### Scenario: Página inicial e entrada
- **WHEN** alguém sem sessão abre `/`, segue para "Entrar" e entra com e-mail e senha
- **THEN** a tela de entrada aparece e, depois de entrar, a pessoa chega ao Início (`/inicio`)

#### Scenario: Rota protegida sem sessão
- **WHEN** alguém que saiu abre `/pessoas` direto
- **THEN** é levado à tela de entrada

#### Scenario: Cadastrar pessoa física
- **WHEN** a pessoa abre "Nova pessoa", escolhe pessoa física, preenche nome e um CPF válido e salva
- **THEN** a pessoa nova aparece na lista de Pessoas com o nome em maiúsculas e o CPF formatado

#### Scenario: CPF inválido ou repetido
- **WHEN** a pessoa digita um CPF com dígito errado, ou o CPF de alguém que já está cadastrado
- **THEN** o formulário mostra o aviso correspondente e não salva

#### Scenario: Buscar e filtrar pessoas
- **WHEN** a pessoa busca por parte do nome na tela Pessoas e troca entre tabela e quadro
- **THEN** só os cadastros que batem aparecem, e a escolha da visão continua valendo ao voltar à tela

#### Scenario: Mover cartão no quadro
- **WHEN** a pessoa arrasta um cartão de uma coluna para outra no quadro de Pessoas
- **THEN** o cartão fica na coluna nova depois de recarregar a página

#### Scenario: Dar acesso a uma pessoa da equipe
- **WHEN** um administrador usa "Dar acesso a uma pessoa" em Equipe e libera o acesso
- **THEN** o convite aparece em "Convites pendentes" e pode ser cancelado

#### Scenario: Dados do escritório
- **WHEN** um administrador muda o nome do escritório em Configurações e salva
- **THEN** o nome novo aparece na barra lateral

#### Scenario: Sair
- **WHEN** a pessoa sai pelo menu
- **THEN** volta à tela de entrada, e abrir `/inicio` de novo pede para entrar

### Requirement: Testes de interface na rotina de publicação
Os testes de componente SHALL rodar junto com os unitários em `npm run verificar`. Os de ponta a ponta SHALL ter um comando próprio (`npm run testar-telas`) e MUST rodar antes de compilar tanto na conferência de cada envio e pull request (`verificar.yml`) quanto na publicação de uma versão (`publicar.yml`); se falharem, nada é publicado e o relatório do Playwright fica disponível como anexo da execução no GitHub.

#### Scenario: Fluxo quebrado bloqueia a publicação
- **WHEN** um teste de ponta a ponta falha na publicação de uma versão (ou na conferência de um pull request)
- **THEN** a rotina para antes de compilar, nenhuma versão vai ao ar, o site no ar continua como estava, e o relatório com o passo que falhou pode ser baixado na página da execução

#### Scenario: Rodar no computador
- **WHEN** alguém roda `npm run testar-telas --prefix app` com as dependências instaladas
- **THEN** o Playwright sobe o banco fictício sozinho, roda os fluxos e encerra o servidor no fim
