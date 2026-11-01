# Conversor da planilha do site para o SEMPER

Ferramenta de **migração**, usada uma vez (ou algumas vezes, até acertar): lê a planilha de cadastros que o formulário do
site preenche, junta os cadastros repetidos e grava o arquivo que a tela **Pessoas > ⋯ > Importar pessoas** do SEMPER lê.

Opcionalmente, lê também as exportações do Google Contatos: delas vêm telefones e e-mails a mais dos clientes e as provas
para juntar cadastros de mesmo nome (o CPF escrito na descrição, o aniversário). **Só os clientes da planilha do site vão
para o SEMPER**: contato que só existe no Google não sai.

## Por que fica aqui, e não em `src/regras/`

As regras do produto ficam em `src/regras/`. Esta pasta é uma exceção porque não é regra do produto: é a migração dos
dados antigos de um escritório, com as manias da planilha dele (datas como o Google mostra, zeros apagados do CPF e do CEP,
uma coluna de tipo de entidade para cada lista do formulário). Ela fica fora de `src/` para não ir para o site, mas usa as
regras do SEMPER (`src/regras/pessoa.ts`, `csv.ts`, `importacao.ts`) e é conferida pelo `npm run verificar` como o resto.

Os arquivos:

| Arquivo | O que faz |
|---|---|
| `planilhas.ts` | confere o cabeçalho das planilhas e numera as linhas (puro) |
| `telefones.ts` | separa e corrige os telefones de um texto livre (puro) |
| `nomes.ts` | compara nomes ("pode ser a mesma pessoa?") (puro) |
| `limpar.ts` | junta os cadastros repetidos e cruza com o Google (puro) |
| `decisoes.ts` | a lista para decidir e as decisões lidas de volta (puro) |
| `referencia.ts` | a referência de cada cliente (puro) |
| `paraSemper.ts` | cliente -> linha do modelo de importação do SEMPER (puro) |
| `ler.ts` | ler e gravar os arquivos |
| `converter.ts` | a linha de comando |

## 1. Baixar a planilha

No Google Planilhas, abra a planilha de cadastros, vá para a **aba do formulário** e use
**Arquivo > Fazer download > Valores separados por vírgula (.csv)**. Só a aba aberta é baixada.

Do Google Contatos (opcional): **Exportar > Google CSV**. Se houver mais de uma exportação (uma atual e outra antiga, por
exemplo), passe a atual primeiro: das seguintes só entram os contatos que não têm telefone, e-mail ou nome em comum com a
primeira.

Guarde tudo em `exportacoes/` (na raiz do repositório). Essa pasta é ignorada pelo Git: nada dela vai para o GitHub.

## 2. Rodar

Na raiz do repositório:

```bash
npm run converter-planilha --prefix app -- --site exportacoes/cadastros.csv --google exportacoes/contatos.csv
```

| Opção | O que é |
|---|---|
| `--site <csv>` | a planilha do site (obrigatória) |
| `--google <csv>` | exportação do Google Contatos; pode repetir (a primeira é a atual) |
| `--saida <pasta>` | onde gravar; padrão `exportacoes/importacao-semper/` |
| `--decisoes <csv>` | o `para-decidir.csv` com a coluna "Sua decisão" preenchida |
| `--lgpd <chave>` | base legal para todos (`contrato`, `processo`…); sem ela, vale a escolha da tela |
| `--hoje AAAA-MM-DD` | só para teste |

Os caminhos são relativos à pasta de onde o comando foi chamado. Sem `--site`, o comando mostra a ajuda.

O console só mostra **contagens** (quantas linhas, quantos clientes, quantos juntados, quantos pares para decidir…),
nunca nomes, documentos, telefones ou e-mails. No fim, ele lê o arquivo gerado do mesmo jeito que a tela de importação e
diz quantas linhas a tela recusaria (o esperado é nenhuma).

## 3. O que sai

- **`pessoas-para-o-semper.csv`**: o arquivo para importar no SEMPER, uma linha por cliente. Quando o mesmo cliente
  mandou o formulário mais de uma vez, valem os dados do envio mais recente, completados com os anteriores; o que os
  anteriores tinham de diferente vai para a observação ("Envio anterior — Logradouro: …"). A data de cadastro é a do
  primeiro envio. O que a tela de importação apagaria também vai para a observação: campos que não valem para o tipo
  do envio mais recente (o RG de quem passou a "somente contato", o CNPJ de quem passou a pessoa física), o texto
  inteiro de um campo maior que o tamanho da tela (o campo vai cortado) e o CEP de 7 algarismos fora de SP. A coluna
  "conferir" marca o que precisa de atenção: pode ser a mesma pessoa que outro cliente (até 5; o resto está no
  `para-decidir.csv`), o mesmo CPF/CNPJ válido em dois clientes (a tela pede para escolher quem fica com ele), cadastros
  juntados com CPF/CNPJ ou datas diferentes entre si, tipo de cadastro não reconhecido, observação cortada.
- **`para-decidir.csv`** (sempre gravado; só o cabeçalho quando não há pares): pares de clientes que **podem** ser a
  mesma pessoa, mas sem prova (mesmo nome sem CPF, data, telefone ou e-mail em comum; mesmo CPF com nomes
  diferentes…), um por par de clientes, com as referências que estão no `pessoas-para-o-semper.csv`. Até você decidir,
  ficam separados.
- **`conferencia.csv`**: cada cliente com as linhas da planilha do site, os contatos do Google que casaram
  (`arquivo:linha`) e como foi juntado.

## 4. Decidir os pares e rodar de novo

1. Abra `para-decidir.csv` no Excel e preencha a última coluna, **Sua decisão**: `sim` (é a mesma pessoa: junta) ou
   `não` (são pessoas diferentes). Pode deixar em branco o que não souber.
2. Salve como CSV e rode de novo com `--decisoes exportacoes/importacao-semper/para-decidir.csv`.
3. O conversor junta os pares "sim", regrava o `para-decidir.csv` com as decisões já dadas e conta quantas decisões
   aplicou e quantas ignorou (de pares que não existem mais, porque a planilha mudou). O "não" vale sobre o "sim": um
   "sim" que juntaria, em cadeia, dois clientes que você separou com "não" não é aplicado.

Cada cliente tem uma **referência** (`site-…`) que não muda entre uma execução e outra nem entre downloads da planilha:
é ela que liga a decisão ao par e que faz uma segunda importação completar o cadastro em vez de duplicar.

## 5. Dados de clientes (LGPD)

As planilhas de entrada e os três arquivos gerados têm **dados pessoais de clientes**. Deixe-os só em `exportacoes/`
(que o Git ignora), não os envie por e-mail ou chat e **apague-os depois de importar**. Os testes usam só dados
fictícios montados no código.
