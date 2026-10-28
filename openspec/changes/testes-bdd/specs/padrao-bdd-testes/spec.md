## ADDED Requirements

### Requirement: Estrutura BDD em todo teste
Todo teste do SEMPER (unitário, de componente e de ponta a ponta) SHALL seguir a mesma estrutura: o `describe` externo nomeia a funcionalidade, um `describe` interno opcional nomeia o contexto ("Dado …"), e cada `it` (ou `test`, no Playwright) descreve um só comportamento no formato "quando …, então …". O corpo do caso MUST separar as etapas com os comentários `// Dado`, `// Quando` e `// Então`; a etapa `// Dado` MAY ser omitida quando não há preparação.

#### Scenario: Caso escrito no padrão
- **WHEN** alguém abre qualquer arquivo `*.test.ts`, `*.test.tsx` ou `app/e2e/*.spec.ts`
- **THEN** cada caso tem um nome "quando …, então …" e o corpo dividido em `// Dado`, `// Quando` e `// Então`

#### Scenario: Contexto compartilhado
- **WHEN** vários comportamentos partem da mesma situação (por exemplo, "Dado um CPF com os dígitos certos")
- **THEN** eles ficam juntos num `describe` com esse contexto no nome, e a preparação comum fica em `beforeEach` ou numa função do arquivo

### Requirement: Um comportamento por caso
Cada caso de teste SHALL verificar um único comportamento. Verificações de comportamentos diferentes MUST ficar em casos separados, para que a falha aponte exatamente o que quebrou. Variações de entrada do mesmo comportamento SHALL usar `it.each` com uma tabela legível.

#### Scenario: Falha aponta o comportamento
- **WHEN** a validação do CNPJ quebra mas a do CPF continua certa
- **THEN** só o caso do CNPJ falha, e o nome dele diz qual comportamento parou de valer

#### Scenario: Variações do mesmo comportamento
- **WHEN** o mesmo comportamento precisa ser conferido com várias entradas (por exemplo, máscaras de CPF, CNPJ, telefone e data)
- **THEN** o caso usa `it.each` com uma linha por entrada e o valor aparece no nome de cada linha

### Requirement: Idioma e vocabulário
Os nomes de `describe`, `it` e `test` SHALL ser escritos em português, com o vocabulário que quem usa o SEMPER reconhece (pessoa, vínculo, convite, escritório), seguindo o idioma do restante do projeto.

#### Scenario: Nome legível para quem não programa
- **WHEN** o relatório do Vitest ou do Playwright lista os casos
- **THEN** cada linha se lê como uma frase em português sobre o comportamento do SEMPER, sem nomes de função no lugar da descrição

### Requirement: Convenção documentada
O padrão SHALL estar descrito num arquivo do repositório (`app/TESTES.md`), com um exemplo de cada tipo de teste e os comandos para rodá-los, e o `README.md` MUST apontar para ele.

#### Scenario: Novo teste segue o exemplo
- **WHEN** alguém vai escrever um teste novo
- **THEN** encontra em `app/TESTES.md` o padrão, um exemplo unitário, um de componente e um de ponta a ponta, e onde cada arquivo fica
