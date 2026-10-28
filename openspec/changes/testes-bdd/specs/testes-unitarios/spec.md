## ADDED Requirements

### Requirement: Refatoração dos testes existentes sem perda
Os arquivos `pessoa.test.ts`, `vinculos.test.ts` e `contatosGoogle.test.ts` SHALL ser reescritos no padrão BDD antes de qualquer teste novo. Toda verificação (`expect`) que existe hoje MUST continuar existindo depois da refatoração, com a mesma entrada e o mesmo resultado esperado, e os testes refatorados MUST passar sem nenhuma mudança no código de `regras/`.

#### Scenario: Nenhuma verificação perdida
- **WHEN** a refatoração termina
- **THEN** cada `expect` da versão anterior tem um equivalente na nova, e o número de verificações é igual ou maior

#### Scenario: Refatoração não toca o produto
- **WHEN** os testes refatorados rodam com `npm run verificar`
- **THEN** todos passam e o `git diff` não mostra mudanças em arquivos de `app/src/regras/` que não sejam `*.test.ts`

### Requirement: Regras de cadastro cobertas
Cada função exportada de `app/src/regras/` que tem lógica (formatação, validação, conversão, consulta) SHALL ter pelo menos um caso para o caminho certo e um para a entrada inválida ou vazia. Constantes de lista (`TIPOS`, `UFS`, `CAMPOS` e semelhantes) estão fora desta exigência.

#### Scenario: Formatação de documentos e endereço
- **WHEN** `fmtCPF`, `fmtCNPJ`, `fmtDocumento` e `fmtCEP` recebem números crus, números já formatados e texto vazio
- **THEN** devolvem o formato brasileiro nos dois primeiros casos e não quebram no vazio

#### Scenario: Validação de e-mail
- **WHEN** `emailValido` recebe um endereço bem formado e outros sem arroba, sem domínio ou com espaço
- **THEN** aceita só o bem formado

#### Scenario: Consulta de CNPJ e CEP sem rede de verdade
- **WHEN** `consultarCNPJ` e `consultarCEP` rodam com o `fetch` simulado devolvendo sucesso, "não encontrado" e falha de rede
- **THEN** o sucesso vira os campos do cadastro, e os outros casos dão o erro em português que a tela mostra, sem nenhuma chamada a servidores externos durante o teste

#### Scenario: Reserva de CEP
- **WHEN** a BrasilAPI falha e o ViaCEP responde
- **THEN** `consultarCEP` devolve o endereço vindo do ViaCEP

### Requirement: Lógica pura da interface coberta
As funções sem tela de `app/src/ui/` SHALL ter testes unitários: as datas e números de `util.ts` (`dataCurta`, `dataHora`, `relativo`, `numero`, `normal`), a ordenação de `ordem.ts` (`dataDaOrdem`), a escolha de tema de `tema.ts` (`temaAtual`, `temaGuardado`, `aplicarTema`), `iniciais` e `corDe` de `Avatar.tsx`, e a pilha de desfazer de `avisos.tsx` (`registrarDesfazer`, `desfazerUltimo`, `feito`).

#### Scenario: Data relativa com relógio fixo
- **WHEN** `relativo` recebe datas de agora há pouco, de ontem e de meses atrás, com o relógio do teste parado num instante conhecido
- **THEN** devolve o texto em português esperado para cada uma, e o resultado não depende do dia em que o teste roda

#### Scenario: Desfazer a última ação
- **WHEN** duas ações são registradas e `desfazerUltimo` é chamado uma vez
- **THEN** só a segunda ação é desfeita, e uma nova chamada desfaz a primeira

#### Scenario: Tema guardado
- **WHEN** o tema "escuro" é definido e a página é lida de novo
- **THEN** `temaGuardado` devolve "escuro" e o elemento raiz tem o atributo de tema certo

#### Scenario: Iniciais do avatar
- **WHEN** `iniciais` recebe um nome completo, um nome só, texto vazio e `null`
- **THEN** devolve as iniciais esperadas e nunca quebra

### Requirement: Testes unitários na rotina de publicação
Os testes unitários SHALL continuar rodando em `npm run verificar` e, por ele, na rotina de publicação. Se algum falhar, a publicação MUST parar como já acontece hoje.

#### Scenario: Teste falhando bloqueia a publicação
- **WHEN** um teste unitário falha num envio ao `main`, num pull request ou na publicação de uma versão
- **THEN** a rotina para no passo "Conferir tipos e testes", nenhuma versão vai ao ar e o site no ar continua como estava
