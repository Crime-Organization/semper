## Overview

O SEMPER (semper.app.br) é a plataforma de gestão do escritório: contratos, demandas, tarefas, pessoas, compromissos, financeiro e o conteúdo do site. Ele herda o design da Braga Ferreira Educação, com uma diferença: **a cor de destaque é verde**, e não laranja.

O design tem duas faces bem separadas. A **vitrine** (telas de acesso) é editorial e escura: foto do farol em preto e branco, tipografia Lato 900 em caixa alta e gigante ("SEMPER."), blocos sobre `{colors.dark}`. A **área de trabalho** (painel, módulos, kanban, administração) é clara e silenciosa: barra lateral fixa de 264px em `{colors.soft}`, conteúdo sobre `{colors.bg}` e cartões brancos com borda fina, para que os dados do contrato ou da demanda sejam a coisa mais visível da tela.

A cor quase só aparece como sinal. Um único verde, `{colors.accent}` (#377D22), preenche o botão principal de cada tela, o ponto final dos títulos ("SEMPER**.**"), o foco dos campos e a marcação do item atual. Todo o resto é uma escala de cinzas quentes, levemente puxados para o amarelo, que vai do quase-preto `{colors.ink}` ao off-white `{colors.bg}`.

O ritmo de uma página interna é sempre o mesmo: olho (rótulo em caixa alta espaçada), título Lato 900 com tracking negativo, lead em cinza, e então seções com `h2.secao` e cartões.

**Key Characteristics:**
- Duas atmosferas: vitrine escura e fotográfica (`{colors.dark}` + farol em escala de cinza) e área de trabalho clara (`{colors.bg}` / `{colors.soft}` / branco).
- Uma só cor de ação: `{colors.accent}`, sempre com **texto branco** em peso 900. Nunca mais de um botão verde por área da tela.
- Lato em toda parte, de 300 (leads e frases editoriais) a 900 (títulos, botões principais, selos), com tracking negativo nos títulos (−.03em a −.05em) e positivo nos rótulos em caixa alta (.08em a .22em).
- Cinzas quentes em degraus (`{colors.ink}`, `{colors.text}`, `{colors.text2}`, `{colors.muted}`, `{colors.faint}`) para a hierarquia do texto.
- Botões, abas, selos e chips são pílulas (`{rounded.full}`). Cartões e caixas usam 12px, campos 8–10px.
- Quase sem sombra: a profundidade vem da borda de 1px (`{colors.line}` / `{colors.line2}`) e da troca de fundo. Sombra só no que flutua (gaveta, modal, cartão sendo arrastado no kanban, toast).
- Ponto final verde nos títulos editoriais.
- **Marca branca (SaaS):** nome, submarca, cores e logos vêm de `app/src/marca.ts` (`MARCA`). Cada escritório cliente troca só esse arquivo e as imagens de `app/src/imagens/` (ou, mais adiante, a configuração equivalente no banco), e nunca as telas.

## Colors

Fontes: `app/src/estilo.css` e `app/src/marca.ts`.

### Brand & Accent

A família verde substitui, papel por papel, a família laranja da Educação.

| Token | Hex | Substitui | Uso |
|---|---|---|---|
| `{colors.accent}` | #377D22 | #DA741B | Preenchimento do botão principal (`.btn.pri`), foco de campos, ponto final dos títulos sobre fundo claro, barra de progresso de destaque, contorno do item atual. Também é `MARCA.cores.destaque`. |
| `{colors.accent-hover}` | #2F6B1D | `brightness(.95)` | Hover e pressionado do botão principal. |
| `{colors.accent-bright}` | #5FAE3E | (o mesmo laranja) | Verde **sobre fundo escuro**: submarca "SEMPER" ao lado do logo, ponto final do título sobre a foto, inicial da `brand-mark`. Contraste de 6,4:1 sobre `{colors.dark}`. |
| `{colors.accent-ink}` | #2B6119 | #9D5313 | Verde como **texto sobre fundo claro**: links ("Esqueci minha senha"), rótulos de seção, submarca na barra lateral. Contraste de 7,1:1 sobre `{colors.bg}`. |
| `{colors.accent-deep}` | #1F4712 | #7A3E0C | Trecho "concluído" de barras e gráficos da mesma família (`--k-feita`). |
| `{colors.accent-tint}` | #EEF5EA | — | Fundo suave de destaque: linha selecionada, cartão em foco no kanban, realce de busca. |

**Sobre o verde:** o texto em cima de `{colors.accent}` é sempre **branco (#FFFFFF)**, com 5,1:1 de contraste. Essa regra é o inverso da Educação, onde o laranja levava texto escuro, porque o verde #377D22 é mais escuro que o laranja.

Contrastes conferidos (WCAG):

| Combinação | Razão | Nível |
|---|---|---|
| Branco sobre `{colors.accent}` | 5,1:1 | AA texto normal |
| `{colors.accent-ink}` sobre `{colors.bg}` | 7,1:1 | AAA |
| `{colors.accent}` sobre `{colors.bg}` | 4,9:1 | AA (ponto final, ícones, textos grandes) |
| `{colors.accent-bright}` sobre `{colors.dark}` | 6,4:1 | AA |
| `{colors.accent}` sobre `{colors.dark}` | 3,5:1 | Só elementos grandes. Sobre escuro, use `{colors.accent-bright}`. |

### Surface
- **Fundo** (`{colors.bg}` — #FBFBF9): fundo de todas as páginas e dos itens de lista em repouso.
- **Branco** (`{colors.white}` — #FFFFFF): cartões, campos, cartões do kanban, painéis laterais, botões secundários.
- **Suave** (`{colors.soft}` — #F5F5F2): barra lateral, trilho das abas, fundo das colunas do kanban, caixas de informação.
- **Papel da anotação** (`--fundo-da-anotacao` — #FAF6EA, borda `--borda-da-anotacao` — #ECE3CB; no escuro, #2A261C e #3D3727): o balão de cada anotação ligada, na coluna do cartão de um item (#360), para não se confundir com o balão dos comentários (`{colors.soft}`).
- **Escuro** (`{colors.dark}` — #1A1916): metade fotográfica das telas de acesso, botão escuro, aba ativa, toast. Também é `MARCA.cores.escuro`.
- **Cartão Escuro** (`{colors.card}` — #2C2A26): cartões e divisórias sobre fundo escuro.
- **Linhas:** `{colors.line}` (#EBEBE6) para bordas de cartões, divisórias e fundo do item de menu ativo. `{colors.line2}` (#DCDCD4) para bordas de botões, campos e cartões do kanban.
- **Véu** (`rgba(26,25,22,.45)`): fundo atrás de gavetas e modais.

### Text
- **Tinta** (`{colors.ink}` — #1A1916): títulos, texto de botões secundários e campos.
- **Texto** (`{colors.text}` — #3D3B36): corpo e rótulos de formulário.
- **Texto 2** (`{colors.text2}` — #57554F): leads e cabeçalhos de caixas.
- **Apagado** (`{colors.muted}` — #6B6A63): olhos, migalhas, dicas, cabeçalhos de tabela, item de menu inativo.
- **Fraco** (`{colors.faint}` — #8A8981): atalhos, botões desabilitados, linha legal.
- **Cinza Vitrine** (`{colors.gray}` — #A8A79F): texto secundário sobre `{colors.dark}`.
- **Sobre Escuro** (#FBFBF9 e #DCDCD4): títulos e leads em cima do escuro e da foto.

### Semantic
- **Ok / Ativo / Concluído** (`{colors.ok}` — #2E7D4F, fundo `{colors.ok-bg}` — #E8F4EC, texto `{colors.ok-ink}` — #1F5C38): selos "Ativo", "Pago", "Concluído". **Atenção:** esse verde é próximo do verde da marca. Por isso o estado "ok" aparece **só como selo** (fundo claro e texto escuro) e nunca como preenchimento sólido, para não se confundir com o botão principal.
- **Pendente / Em aberto** (fundo `{colors.warn-bg}` — #FFF4EA, texto `{colors.warn-ink}` — #7A3E0C): selos "Pendente", "Em aberto", "Aguardando documento", e aviso informativo.
- **Erro / Perigo** (`{colors.erro}` — #B42318, fundo `{colors.erro-bg}` — #FDECEA): avisos de erro, prazos vencidos, botões de excluir (`.mini.perigo`).
- **Arquivado** (fundo `{colors.soft}`, texto `{colors.muted}`, borda tracejada `{colors.line2}`): itens arquivados, que só então podem ser excluídos.

### Superfícies que se invertem
- **Superfície** (`{colors.superficie}` — #FFFFFF): fundo de cartões, campos, listas, cartões do kanban, painéis e janelas. Use sempre esta variável, nunca `#fff` direto.
- **Selecionado** (`{colors.sel}` — #1A1916, texto `{colors.sel-txt}` — #FFFFFF): aba ativa, selo escuro, papel do usuário e botão escuro (`.btn.esc`). No modo escuro inverte para claro com texto escuro.
- **Erro forte** (`{colors.erro-forte}` — #B42318) e **borda de erro** (`{colors.erro-borda}` — #F3C1BC): botão de exclusão confirmada e contorno dos botões de perigo.

## Dark Mode

O SEMPER segue o tema do aparelho (**Automático**). O usuário pode fixar **Claro** ou **Escuro** pelo botão "Tema" da barra lateral ou em Minha conta. A escolha fica no perfil e vale em qualquer aparelho. Tecnicamente: `@media (prefers-color-scheme: dark)` aplica a paleta escura, e `data-tema="claro"` ou `data-tema="escuro"` no `<html>` força um dos dois. A tela de login e os e-mails ficam sempre claros (o login já tem a metade escura fotográfica).

| Token | Claro | Escuro |
|---|---|---|
| `{colors.bg}` | #FBFBF9 | #131210 |
| `{colors.soft}` | #F5F5F2 | #1A1916 |
| `{colors.superficie}` | #FFFFFF | #22211D |
| `{colors.line}` / `{colors.line2}` | #EBEBE6 / #DCDCD4 | #2D2B27 / #3A3833 |
| `{colors.ink}` | #1A1916 | #F1EFE9 |
| `{colors.text}` / `{colors.text2}` | #3D3B36 / #57554F | #D8D6CE / #C2C0B7 |
| `{colors.muted}` / `{colors.faint}` | #6B6A63 / #8A8981 | #A6A49B / #8A887F |
| `{colors.dark}` (destaque, aviso, barra de lote) | #1A1916 | #262420, com borda #34322D |
| `{colors.sel}` / `{colors.sel-txt}` | #1A1916 / #FFFFFF | #ECEAE3 / #1A1916 |
| `{colors.accent}` (botão principal, texto branco) | #377D22 | #377D22 (igual) |
| `{colors.accent-ink}` (links e textos verdes) | #2B6119 | #8BD06A |
| `{colors.accent-tint}` | #EEF5EA | #1D2A17 |
| `{colors.ok-bg}` / `{colors.ok-ink}` | #E8F4EC / #1F5C38 | #15281C / #86D3A2 |
| `{colors.warn-bg}` / `{colors.warn-ink}` | #FFF4EA / #7A3E0C | #33240F / #F0B47E |
| `{colors.erro}` / `{colors.erro-bg}` | #B42318 / #FDECEA | #F28B78 / #3A1713 |

Regras:
- Toda cor nova entra como variável nos dois blocos (claro e escuro) do `estilo.css`. Cores fixas só para texto branco sobre fundos coloridos (verde, vermelho, avatares).
- Texto pequeno usa no mínimo `{colors.muted}`. `{colors.faint}` fica para bordas, estados desabilitados e textos grandes.
- Contraste conferido em todas as telas nos dois temas com `dev/contraste.js` (mínimo 4,5:1; 3:1 para textos grandes).

## Typography

### Font Family
**Lato** (Google Fonts, pesos 300, 400, 700 e 900, com itálico 400) é a única família, com a pilha `'Lato', system-ui, -apple-system, 'Segoe UI', sans-serif`. A hierarquia vem do contraste extremo de peso: 300 para frases editoriais e leads, 400 para leitura, 700 para navegação e botões secundários, 900 para títulos, botões principais e selos.

### Hierarchy

| Token | Size | Weight | Line Height | Letter Spacing | Use |
|---|---|---|---|---|---|
| `{typography.access-title}` | clamp(48px, 7vw, 104px) | 900 | .85 | −.035em | "SEMPER." na metade escura das telas de acesso |
| `{typography.page-title}` | clamp(32px, 4vw, 48px) | 900 | 1.05 | −.03em | `.titulo` das páginas internas |
| `{typography.stat}` | 32–40px | 900 | 1–1.1 | −.02em | Números de resumo (receita, contratos, prazos) |
| `{typography.panel-title}` | 24px | 900 | 1.2 | −.02em | Título de painel lateral e modal |
| `{typography.section}` | 22px | 900 | 1.2 | −.01em | `h2.secao` |
| `{typography.lead-hero}` | clamp(18px, 2vw, 24px) | 300 | 1.5 | 0 | Lead das telas de acesso |
| `{typography.lead}` | 17px | 400 | 1.6 | 0 | `.lead`, em `{colors.text2}` |
| `{typography.body}` | 16px | 400 | 1.65 | 0 | Textos corridos, anotações, publicações |
| `{typography.card-title}` | 15px | 700 | 1.35 | 0 | Título do cartão no kanban |
| `{typography.text-heading}` | 19 / 17 / 15px | 900 | 1.3 | −.01em | Títulos `#`, `##` e `###` dentro do texto formatado (h3, h4 e h5; variáveis `--texto-titulo-1` a `-3`), em `{colors.ink}`. No texto da anotação (editor ao vivo e texto de quem só lê), medidos a partir da letra da nota, todos acima dela: 1.6 / 1.35 / 1.15em (`--texto-nota-titulo-1` a `-3`) |
| `{typography.text-table}` | 14px | 400 / 800 | 1.5 | 0 | Tabelas dentro do texto formatado (variável `--texto-tabela`; o cabeçalho em 800, `{colors.ink}`) |
| `{typography.button}` | 15–16px | 700 / 900 | 1 | 0 | Botões (900 no principal) |
| `{typography.eyebrow}` | 13px | 700 | 1.4 | .2em | `.olho`, em caixa alta |
| `{typography.label-caps}` | 11–12px | 900 | 1.4 | .12–.18em | Cabeçalhos de coluna, selos, tags, em caixa alta |
| `{typography.caption}` | 12–13px | 400 / 700 | 1.5 | 0 | Dicas, metadados, datas, códigos |

### Principles
- O contraste de peso faz o trabalho: o mesmo bloco costuma juntar um título 900 e um lead 300.
- Caixa alta só em dois casos: títulos de impacto da vitrine (tracking negativo) e rótulos pequenos (tracking positivo largo). Nunca em texto corrido. Exceção: nomes e qualificações jurídicas, que o escritório registra em maiúsculas, aparecem como foram cadastrados.
- Números sempre com `font-variant-numeric: tabular-nums`: valores, datas, códigos de contrato (`HE62-DE74-001/24`), numeração de documentos (`000.001`).
- Medida de leitura: lead até ~620px. Publicações do CMS até ~720px.

## Layout

### Spacing System
- **Base unit:** 4px, quase sempre em passos de 8px nas peças maiores.
- **Tokens:** `{spacing.xxs}` 4px · `{spacing.xs}` 8px · `{spacing.sm}` 12px · `{spacing.md}` 16px · `{spacing.lg}` 24px · `{spacing.xl}` 32px · `{spacing.xxl}` 40px · `{spacing.huge}` 56–64px.
- Páginas internas usam `.conteudo` com padding `36px clamp(16px, 2vw, 32px) 64px`: no máximo 32px entre a barra lateral e o conteúdo e na direita. O espaço entre blocos é de 36px nas páginas de leitura (`.miolo`) e 20px nas páginas de módulo (`.miolo.largo`). Cartões têm padding de 24px, itens de lista 20px × 24px e cartões do kanban 12px × 14px.

### Grid & Container
- **Área de trabalho:** barra lateral de 264px + conteúdo. `.miolo` vai até 1040px em páginas de leitura e formulário. Tabelas e kanban usam a largura toda.
- **Telas de acesso:** duas metades iguais (foto escura | formulário com caixa de até 420px).

### Página de módulo (pessoas, contratos, demandas, tarefas, processos…)
Toda página de módulo é montada pelo componente comum **`<PaginaModulo>`** (em `app/src/ui/PaginaModulo.tsx`). Nunca escreva essa estrutura à mão numa página: o módulo só declara o conteúdo, e o desenho vem do componente e do `estilo.css`. Assim, toda mudança de layout feita uma vez vale para todos os módulos. A tela de Pessoas (`app/src/paginas/Pessoas.tsx`) é o modelo.

```tsx
<PaginaModulo titulo="Pessoas" contador="28 ativas"
  acao={{ rotulo: 'Nova pessoa', para: '/pessoas/nova/' }}
  busca={{ placeholder: 'Buscar nome, CPF/CNPJ, telefone…', aoBuscar: termo => ... }}
  filtros={[{ id: 'tipo', rotulo: 'Tipo', valor, aoMudar, opcoes: [['', 'Todos os tipos'], ['pf', 'Pessoa física']] }]}
  ordem={visao === 'tabela' ? useOrdem('pessoas', 'tabela') : undefined}
  mais={[{ rotulo: 'Exportar para o Google Contatos', icone: 'baixar', aoEscolher: exportar }]}
  visao={visao} aoTrocarVisao={setVisao} lote={selecionadas ? <>…</> : null}>
  {visao === 'kanban' ? <Kanban quadro={useColunas('pessoas', ctx)} … /> : <Tabela … />}
</PaginaModulo>
```

O quadro também é comum: `useColunas(modulo, ctx)` (em `app/src/ui/quadro/`) cuida das colunas (criar, ocultar, renomear, excluir, reordenar, permissões e desfazer) e `<Kanban>` desenha e arrasta os cartões. O módulo só diz como carregar, desenhar e mover os cartões.

**Ordenar.** No quadro, **cada coluna tem a sua ordem**, escolhida no topo do menu da coluna (⋯), inclusive na "Sem etapa": ordem manual (arrastando os cartões), mais novos primeiro, mais antigos primeiro, atualizados recentemente, nome A–Z e nome Z–A. A coluna fora da ordem manual mostra a ordem abaixo do título, e nas ordens por data os cartões dela mostram a data (`dataDaOrdem`). A escolha é de cada usuário e fica guardada por coluna (`useColunas`: `ordemDe` e `ordenar`). Na tabela, que é uma lista só, a ordem é escolhida em **Ordenar**, no painel do botão Filtros (`useOrdem(modulo, 'tabela')` em `app/src/ui/ordem.ts`), e a última coluna mostra a data de cadastro quando a ordem é por cadastro.

Estrutura, sempre nesta ordem:
1. **Cabeçalho numa linha só** (`.cabeca`), para a lista começar logo no alto: à esquerda o **título grande** (com o ponto verde) e o **contador** (`contador`, ex.: "28 ativas", já com a busca e os filtros); à direita a barra (`.barra-ferr`) e a **ação principal**. Não há linha de "olho" nem frase de explicação: o menu lateral já diz onde se está.
2. **Barra** (`.barra-ferr`): busca → botão **Filtros** (os filtros e a ordem num painel; o botão mostra quantos filtros estão fora do padrão, que é a primeira opção de cada um) → menu **⋯** (`mais`, ações sobre a lista inteira, como exportar; só aparece se o módulo tiver alguma) → troca **Tabela/Kanban**. Todos os controles com 42px de altura. O painel de Filtros, o menu ⋯ e o menu da coluna do quadro usam a mesma peça, `<MenuFlutuante>` (`app/src/ui/Menu.tsx`; com `painel`, clicar dentro não fecha).
3. **Área da visualização**: tabela, ou o quadro kanban (`.area-quadro`) preenchendo o resto da tela.
4. **Barra de ações em lote** (`.lote`): aparece quando há itens selecionados na tabela.

**Exportar.** A exportação leva a lista como ela está filtrada (busca, filtros e situação), gera o arquivo na própria tela (`baixarArquivo`, em `app/src/ui/util.ts`) e fica no menu ⋯, só para administradores. Em Pessoas: **Exportar para o Google Contatos**, no mesmo CSV que o Google exporta e importa (`app/src/regras/contatosGoogle.ts`), com ou sem a qualificação na descrição.

Comportamento conforme o espaço disponível. É sempre pelo tamanho real do conteúdo (container queries), nunca por contas em JavaScript nem por página:
- Conteúdo com 1080px ou menos (telas médias, zoom): a ação principal fica na linha do título e a barra desce para a linha de baixo, com a busca ocupando o que sobra.
- Conteúdo com 560px ou menos (zoom alto, celular): a ação principal vira um **botão redondo só com o "+"** na linha do título, e o nome dela continua como rótulo acessível e dica. A busca ocupa a largura toda; Filtros, ⋯ e Tabela/Kanban vêm abaixo.
- Com quadro kanban, a página vira uma coluna da altura da tela e o quadro ocupa o que sobra. A página não rola, só as colunas.

**Visão por data (agenda).** A visão `agenda` do `<PaginaModulo>` (Compromissos) mostra os itens por dia, semana ou mês (`paginas/agenda/VisaoPorData.tsx`, regras em `regras/agenda.ts`). A barra tem Anterior, Hoje e Próximo, o período por extenso e a troca Dia/Semana/Mês (`.abas`), que fica guardada para cada pessoa. A semana mostra sete colunas e, com 760px de conteúdo ou menos, vira uma lista de dias; o mês mostra semanas inteiras e, nesse mesmo espaço, só quantos itens cada dia tem. Sempre por container query. Hoje tem a borda e o fundo do verde. O compromisso tem a borda da esquerda verde; o prazo de demanda ou tarefa, só para consulta, é neutro e leva ao módulo de origem.

### Documentos (como o Obsidian)
A página Documentos (`paginas/Documentos.tsx`, pedidos de 18/11) continua montada pelo `<PaginaModulo>` (título, busca, filtros e ação principal), com duas colunas por baixo; a anotação abre na janela do cartão, como nos outros módulos:
- **Explorador**, à esquerda (`<ArvoreDePastas>` com `anotacoes`, em `ui/Pastas.tsx`): no alto, a barra de ícones Recolher a navegação (o ícone de painel lateral, como no Obsidian; separado das outras por um traço), Nova anotação, Nova pasta, Ordenar (nome, datas) e Recolher tudo; depois, "Todos os documentos", as pastas (a seta abre e fecha o que está dentro, o nome escolhe a pasta, o ⋯ cria, renomeia, move e apaga) e, dentro de cada pasta aberta, as subpastas e as anotações; as sem pasta ficam no primeiro nível. A anotação aberta tem o fundo `{colors.line}` (nunca verde), e as pastas do caminho até ela abrem sozinhas. A busca e os filtros da página valem também para ele. Ele lê até `ANOTACOES_NO_EXPLORADOR`; com mais, o pé diz "Mostrando N de T anotações" e como achar as outras.
  Recolhida (a escolha fica guardada para cada pessoa, `useNavegacaoRecolhida`), sobra só uma faixa estreita com o botão "Mostrar a navegação", e a tabela ocupa a largura toda.
- **Centro**: a tabela da pasta escolhida (`?pasta=`), com as arquivadas embaixo.
- **A anotação** (`?id=` no endereço; abrir e fechar trocam o endereço sem criar entrada no histórico, como nos outros módulos) abre no `<PainelCartao>` (`largo`, com o nome "Anotação"), ao lado ou no centro, como a pessoa escolhe nos outros cartões; a nova (`?nova=1`, #369) abre nessa mesma janela, em branco, com o cursor no título, e vai ao banco sozinha quando a pessoa escreve o título ou o texto (sem botão de salvar; a linha da gravação diz "Ainda não gravada" até lá, e o título vazio, ou o provisório com que ela vai ao banco quando a pessoa começa pelo texto, aparece como "Sem título", apagado, e abre vazio ao clicar); fechar sem escrever não grava nada, e a nova aberta de outra página (o "+" do cartão de um item, o da navegação) volta para lá ao fechar, como o Voltar. O conteúdo fica na medida de um documento (`--medida-documento`). No topo, numa linha só, o caminho "Pasta / Subpasta" (cada pedaço leva à pasta; o botão ao lado muda a pasta) e, à direita, a equipe em bolinhas; o ícone de etiqueta (`<BotaoDasEtiquetas>`, só o ícone, com o nome na dica; abre a mesma escolha da seção Etiquetas dos outros cartões) e o ⋯ (Mover para pasta, Duplicar, Baixar .md, Arquivar, Excluir) vão para junto dos botões da janela (`NoTopoDoCartao`), como os botões do topo dos outros cartões. Logo abaixo do topo, os selos das etiquetas escolhidas (`<SelosDasEtiquetas>`, cada um com o x para tirar; sem etiquetas, a linha não aparece). Depois, o título grande (`--texto-titulo-da-nota`), mudado ali mesmo, e o texto, **já na caixa de escrever** (`<EditorDeTexto>`), que é o editor ao vivo (`<EditorAoVivo>`, #364, como o do Obsidian: a formatação aparece enquanto se escreve, com os tamanhos e as cores do texto formatado, e os sinais do Markdown nunca aparecem, nem na linha do cursor, #368: o cursor pula por cima deles; o Backspace no começo de um item, de uma tarefa, de um título ou de uma citação tira a formatação da linha, e o Enter num item ou título vazio também; o B e o I com o cursor parado ligam ou desligam a marca para o que se digitar; um endereço colado, com http:// ou https://, nunca vira itálico nem negrito; a caixinha se marca com um clique, o link abre com Ctrl+clique, e o Enter numa lista já começa o item seguinte): sem borda nem moldura no foco (só o cursor verde, #367, também na anotação nova), do tamanho do texto, com a barra de formatação discreta (os botões dela, apagados, aparecem inteiros com o foco ou o mouse em cima; com o texto rolando, ela fica presa no alto de quem rola, com fundo sólido `{colors.superficie}`, e o texto passa por baixo dela sem aparecer por trás, sumindo aos poucos logo abaixo, como no pé; o fundo cobre também o espaço até o alto da janela, só sobre o texto: o título continua à vista. Ao lado, na janela estreita e no celular, ela se prende logo abaixo dos botões da janela (`--abaixo-dos-botoes-da-janela`, a mesma medida do "Expandir tudo" da coluna), que ficam por cima, clicáveis; no centro com a coluna, no alto do corpo. Escrevendo, o editor desconta a barra ao seguir o cursor, e a linha nunca fica escondida atrás dela, #373), salvando sozinho depois de uma pausa (`ESPERA_PARA_SALVAR`), ao sair da caixa e com Ctrl+S, e uma linha miúda à direita com "Salvando…", "Salvo" ou o erro, no pé da janela (veja abaixo). Não há modo de ler à parte (o livro saiu em 18/11): a formatação já está à vista enquanto se escreve. O texto grava com trava otimista: se outra pessoa o mudou depois que a anotação abriu, nada é gravado por cima, e um aviso no lugar oferece "Manter o meu texto" ou "Usar o texto gravado". Sair com algo por gravar, ou ainda gravando, espera a gravação; só se ela falhar, aparece a pergunta de sempre. O histórico junta as gravações seguidas do texto pela mesma pessoa numa linha só (`JUNTAR_TEXTO_NO_HISTORICO`). Quem só lê vê os selos das etiquetas (sem o ícone) e o texto formatado, sem caixa nem barra. Por último, **o pé da janela** (`.anotacao-pe`, #372, pedido de 19/11): a linha da gravação (o `<EditorDeTexto>` a põe ali com `lugarDaSituacao`) e, embaixo dela, o rodapé com o código e as datas, juntos, ao lado, no centro, na janela estreita e no celular, na anotação aberta e na nova. Com texto curto, a anotação estica até o fim de quem rola, e o pé fica encostado no fim da janela (a `--anotacao-pe-folga` embaixo dele), não logo abaixo do texto. Com texto longo, ele fica preso ao fim da janela (`position: sticky`, fundo `{colors.superficie}`) enquanto o texto rola por baixo, que some aos poucos logo acima dele (um esmaecido da altura de `--anotacao-vao`); no fim da rolagem, volta ao lugar dele, depois de tudo (ao lado e na janela estreita, depois das seções), sem cobrir o fim do texto. Escrevendo, o editor desconta a altura do pé ao seguir o cursor (`folgaEmbaixo`), e a linha que se escreve nunca fica escondida atrás dele. Quem só lê vê só o rodapé. Os outros cartões não mudam. **Sem lápis**: tudo na anotação se muda no próprio lugar. A anotação aberta usa a classe própria `.anotacao-aberta` (e `.anotacao-topo`, `.anotacao-titulo`): `.nota` é a da peça `<Nota>`, que vale no sistema todo.
- **Coluna da direita da janela no centro** (`.cartao-coluna`, com `<NaColunaDoCartao>`): "Comentários" (aberta), "Ligada a" e "Histórico de alterações" (recolhidas), todas recolhíveis e com o número mesmo fechadas, e o "Expandir tudo" / "Recolher tudo" (só o ícone, #366) no alto da coluna, à direita, logo abaixo dos botões da janela (as seções da coluna formam um grupo só delas). Ao lado e na janela estreita (900px ou menos, onde não há a coluna: `JANELA_ESTREITA`), elas ficam embaixo do texto, na mesma ordem, no grupo do cartão (`<GrupoDeSecoes proprio={false}>`: um "Expandir tudo" só, no alto do cartão, abre e fecha todas), e o rodapé vem por último, como nos outros cartões (#360). Trocar o formato da janela não perde nada do que se escrevia nelas. A anotação nova (#369) tem a mesma coluna desde que abre. A anotação não tem a seção "Anotações": a dela é "Ligada a".
- **Arrastar a anotação para uma pasta** (#370), no explorador: quem altera a anotação a arrasta até uma pasta, ou até a linha do alto, que durante o arrasto troca "Todos os documentos" por "Sem pasta" (soltar ali tira a anotação das pastas). A pasta de destino fica contornada em verde tracejado (`--accent`, o mesmo da coluna do quadro que recebe o cartão), com o fundo `{colors.soft}`; a pasta em que ela já está não se destaca. Na origem, a anotação fica apagada, e o título dela segue o ponteiro numa etiqueta flutuante (`.arrasto-fantasma`: `{colors.superficie}`, borda `{colors.line2}`, sombra Floating, no máximo `--largura-do-fantasma`). Com o mouse, o arrasto começa quando ele anda alguns pixels com o botão apertado (menos que isso é clique); com o dedo, ao segurar parado 0,4 s (`SEGURAR_PARA_ARRASTAR`), e antes disso mexer o dedo rola a lista. Perto da borda, a lista rola sozinha; Esc desiste. Ao soltar, o aviso no pé tem Desfazer. Pelo teclado (e para quem prefere), o ⋯ de cada anotação, e o ⋯ do cartão dela, têm "Mover para pasta", com a mesma janela de mover uma pasta. Quem só lê não arrasta e não vê o ⋯.
- Pelo tamanho do conteúdo (container queries): com 760px ou menos, o explorador vira uma gaveta (o botão "Pastas e anotações" no alto do centro, sombra Drawer), o botão de recolher a navegação some e tudo fica numa coluna só.

### Kanban (demandas)
O kanban segue o modelo do Trello, **não** o do Notion:
- O quadro ocupa a altura que sobra da janela, só pelo layout (`body.com-quadro`, `.area-quadro`), e rola **na horizontal** quando as colunas não cabem.
- Cada coluna tem largura fixa (272–296px), fundo `{colors.soft}`, `{rounded.lg}` e cabeçalho fixo (nome em `{typography.label-caps}` + contagem tabular).
- **A lista de cartões rola dentro da própria coluna** (`overflow-y: auto`), sem nunca empurrar a página para baixo. O botão "Adicionar cartão" fica fixo no pé da coluna.
- Cartão: branco, borda `{colors.line2}`, `{rounded.md}`, título em `{typography.card-title}`, metadados (código do contrato, responsável, prazo, contagem de checklist) em `{typography.caption}`. Arrastando, o cartão ganha a sombra Floating e leve rotação (1–2°), que somem assim que ele é solto.
- Coluna na ordem manual: uma barra verde mostra onde o cartão vai entrar. Coluna em outra ordem (nome, data): o cartão só entra nela vindo de outra coluna; a coluna inteira fica contornada em verde tracejado e o cartão entra no lugar que a ordem dela define. Dentro dela não dá para mudar a posição.
- Coluna e cartão nunca são preenchidos de verde. O verde aparece só no foco e no botão principal.

**Dois jeitos de arrastar.** O quadro (`<Kanban>`, `app/src/ui/quadro/`) usa o arrastar nativo do navegador, feito para o mouse, com a barra verde de onde o cartão entra. Para levar um item até um alvo com o mouse **e com o dedo** (como a anotação até a pasta, no explorador), use `useArrastar` e `FantasmaDoArrasto` (`app/src/ui/arrastar.tsx`): eles vão pelos eventos de ponteiro, marcam os alvos com `ATRIBUTO_DO_ALVO` e deixam quem usa dizer quais alvos aceitam o item. Junto, ofereça sempre o mesmo por um menu (o arrasto não tem teclado).

### Cartão (painel de detalhe de pessoa, contrato, demanda…)
Abre à direita, com até 560px, sobre um véu. O "X" fica preso ao topo por cima do conteúdo, sem ocupar largura.
- **Ações numa linha só**, logo abaixo do título: a principal em verde (ex.: "Atualizar cadastro") e as secundárias brancas. Quando o painel fica estreito (zoom, celular), as secundárias viram botões redondos só com o ícone, e o nome continua como dica. A medida é a largura do próprio painel (container queries), nunca uma conta em JavaScript.
- **Exclusão no topo do cartão arquivado:** o item arquivado troca Arquivar por Desarquivar (a caixa aberta) e o lápis pela lixeira, em vermelho, só para quem pode excluir. A lixeira abre uma janela de confirmação. O aviso tracejado logo abaixo das ações explica o que vale para aquele item.
- **Vínculos entre pessoas** (seção "Vínculos" do cartão de pessoa): cada vínculo aparece nas duas pessoas, com o rótulo do lado de cada uma ("Representante legal de" / "Representado(a) por"), e o nome da outra pessoa abre o cartão dela. Tipos padrão para todos os escritórios; master e administradores criam os do escritório. A quantidade aparece ao lado do título mesmo com a seção fechada (`contador` do `<Recolhivel>`).
- **Escolher alguém da equipe** para uma lista (participantes, colaboradores, responsáveis da pessoa) é sempre com `<EscolhaDaEquipe>` (`app/src/ui/EscolhaDaEquipe.tsx`): aparecem só os escolhidos, cada um com a bolinha e o "X" para tirar, e o botão "+ Adicionar…" abre uma busca só com quem da equipe ativa ainda pode entrar. Nunca a lista de caixas com o nome de todo o escritório. Quando cada escolhido precisa de um campo seu (os participantes do contrato, cada um com o seu %), a linha é da tela e a busca é a mesma, `<BuscaNaEquipe>` (`app/src/ui/BuscaNaEquipe.tsx`), como em `ParticipantesDoContrato` (#348).
- **Equipe no topo do cartão** (`<EquipeDoCartao>`, #132 e #356): o responsável à esquerda, o traço e as bolinhas dos participantes. O nome de cada um aparece na dica, ao passar o mouse e no foco do teclado (`propsDaDica`, em `ui/base`: o `title` do navegador não aparece no foco). É a única dica: o `<Avatar>` dentro da bolinha vai com `semDica`, para a do navegador (só o nome) não aparecer por cima de "Tirar Ana Souza". Clicar numa bolinha **não abre ficha nem menu** (pedido de 18/11): para quem pode alterar o cartão (as mesmas regras que mostram o lápis), a bolinha do responsável abre direto a busca para trocá-lo; sem responsável, ela aparece vazia e tracejada, com o ícone de pessoa, para escolher um; a de um participante o tira na hora (a dica diz "Tirar Ana Souza"; na própria, "Sair da tarefa (Ana Souza)"), com o aviso no pé da tela e o Desfazer, e o contorno dela no hover é o vermelho de tirar. Depois dos participantes vem a bolinha tracejada com "+" (a mesma `<BuscaNaEquipe>`, com `bolinha`), que abre a busca num painel e põe a pessoa na hora. A busca mostra **só os nomes**, um embaixo do outro, alinhados à esquerda. Com a lista cheia, sem mais ninguém na equipe ou enquanto uma mudança grava, as bolinhas ficam desligadas com o motivo na dica (a do responsável, sem outra pessoa para assumir, diz só isso, sem "clique para trocar"), mas continuam no Tab (`aria-disabled`), e uma mudança espera a outra terminar. Quem só lê vê as bolinhas com o nome na dica, sem ação. No contrato (`<EquipeDoContratoNoTopo>`, regras em `regras/equipeDoContrato.ts`), cada participante tem o seu % da divisão: o "+" põe a pessoa com 0% (o % continua sendo mudado em Editar); a dica da bolinha mostra o % ("Tirar Ana Souza · 10%"; na própria, "Sair do contrato (Ana Souza · 10%)"); a busca do responsável mostra só os advogados que constam nos contratos. O contrato não tem a saída que pergunta antes: a bolinha com que a pessoa sairia dele sem poder (não é administradora nem o cadastrou) já vem desligada, com o motivo na dica (`impedeTirar` e `impedeTrocar`), em vez de oferecer uma ação que seria recusada.
- **Etiquetas no cartão** (`<SecaoEtiquetas>`): sempre a mesma seção, com o título "Etiquetas", o "+" redondo logo na frente (abre a escolha, onde também se cria uma etiqueta) e os selos coloridos embaixo, cada um com o x para tirar. A anotação (aberta e nova) é a exceção, como no Obsidian: sem a seção, o ícone de etiqueta no topo abre a mesma escolha (`<BotaoDasEtiquetas>`) e os selos ficam numa linha entre o topo e o título (`<SelosDasEtiquetas>`). Nenhum cartão inventa outra forma.
- **Escolher uma pessoa do cadastro** num formulário é sempre com `<BuscaPessoa>` (`app/src/ui/BuscaPessoa.tsx`): busca por nome, CPF/CNPJ ou telefone, lista de achados (com o motivo quando alguém não pode ser escolhido) e a pessoa escolhida com "Trocar".
- **Ligar, no cartão, um item que já existe** (#341): embaixo da lista de cada seção de itens ligados, "Ligar … existente" e, ao lado, "+ Novo …" quando a seção também cria (`<AcoesDosLigados>`, em `app/src/ui/ItensLigados.tsx`). O botão abre uma busca por cima do que vem abaixo (`<LigarExistente>`; com a busca e os textos de cada módulo, `<LigarDoModulo>`, em `app/src/ui/LigarDoModulo.tsx`), inclusive para pôr uma pessoa do cadastro nos clientes ou nas pessoas do item. A busca só oferece itens ativos que a pessoa pode alterar e que ainda não estão ligados; o achado que não pode ser escolhido aparece desabilitado, com o motivo, e a lista do cartão cheia desabilita o botão, com o motivo ao lado. Esc fecha só a busca; Enter escolhe o primeiro achado; as setas andam pela lista. No cartão só para ler (ou arquivado), nada disso aparece. O "+ Novo …" e o "+" do título da seção (`novo=` do `<Recolhivel>`) seguem as mesmas condições do "Ligar … existente": também somem quando a lista está cheia ou o item já tem o seu único ligado (#376). Eles abrem o cadastro com a origem no endereço (`?tarefa=`, `?demanda=`, `?processo=`…); o cadastro diz de onde o item nasce (`<Aviso tipo="info">` no topo), já vem com o que a origem tem (clientes, contrato, processo) e, ao salvar, liga o item novo e volta ao cartão de origem, com ele na seção e o contador em dia. Se a ligação falhar depois de gravar, o item fica (salvar de novo o duplicaria) e um aviso diz qual ligação faltou; só a falha que pode passar (a rede, o banco) sugere "Ligue pelo cartão", e a recusa de uma regra diz só o motivo (`regras/nascerLigado.ts`). O que já se sabe que impede a ligação (a tarefa de outro contrato, a tarefa da demanda já num contrato) aparece num aviso antes de salvar; aí o item nasce sem a ligação e o cadastro abre o cartão dele, e não o da origem. A origem arquivada (um link antigo) não vale: o aviso do topo diz isso, e o cadastro não herda nem liga nada. Vindo de uma demanda, o cadastro de contrato avisa que, ao assinar, os objetos ainda viram demandas além dela.
- **Coluna da direita do cartão** (#360, todos os cartões com `<PainelCartao>`: Pessoas, Processos, Contratos, Demandas, Tarefas e Agenda): com o cartão no centro, a coluna (`.cartao-coluna`, com `<NaColunaDoCartao>`) tem, nesta ordem, "Comentários" (`<SecaoComentarios>`, aberta de início, sem guardar a escolha), "Anotações" (`<AnotacoesDoCartao>`) e "Histórico de alterações" (recolhidas; a escolha fica guardada com chaves novas, `<módulo>.coluna.anotacoes` e `<módulo>.coluna.historico`, e não as do corpo do cartão de antes: na coluna, as duas começam recolhidas para todos), cada uma recolhível e com o número mesmo fechada, e o "Expandir tudo" / "Recolher tudo" no alto dela abrange as seções da coluna (três; no processo, quatro; é o grupo só delas). O histórico não fica mais no corpo do cartão. No processo (#362), a coluna tem quatro seções: "Comentários", "Andamentos" (a linha do tempo, recolhida, chave `processos.coluna.andamentos`), "Anotações" e "Histórico de alterações"; quem só lê o processo também comenta. Com o cartão ao lado e na janela estreita, não há a coluna: as seções dela (no processo, também os andamentos) ficam no pé do cartão, na mesma ordem, antes do rodapé, no grupo do cartão, e o "Expandir tudo" do alto do cartão abre e fecha também essas seções (um botão só). Na seção "Anotações", cada anotação ligada aparece **como um comentário** (`.anotacoes-na-coluna`, com a mesma peça do comentário, `<ComoComentario>` em `app/src/ui/ComoComentario.tsx`, e a mesma bolinha, `BOLINHA_DO_COMENTARIO`): a bolinha e o nome de quem a escreveu ("Sem autor" quando ninguém está marcado; "Usuário removido" quando saiu da equipe), "Atualizada há …" e o código e, num balão de papel creme com borda fina (`--fundo-da-anotacao`, `--borda-da-anotacao`; nunca verde nem o `{colors.soft}` dos comentários), o título com o ícone de documento e o começo do texto, sem os sinais do Markdown (`inicioDaAnotacao`, até `INICIO_DA_ANOTACAO`: 3 linhas e 220 caracteres, com "…" quando continua). O item todo é o link que abre a anotação em Documentos; para o leitor de tela, ele se chama "Abrir a anotação <título>", e quem escreveu, quando e o começo do texto vão na descrição (`aria-describedby`). No hover, a borda do balão fica verde. O texto das anotações só é lido com a seção aberta (`anotacoesDoItemComTexto`); para o número, com ela fechada, a leitura é leve, sem o texto (`anotacoesDoItem`).
- **Seções longas recolhem** com `<Recolhivel>` (`app/src/ui/Recolhivel.tsx`): título clicável com a seta na ponta direita e uma linha fina acima. O conteúdo só é carregado quando a seção está aberta. Com `preferencia`, a escolha de cada usuário fica guardada (Dados do cadastro e Histórico). As informações sigilosas sempre começam fechadas: cada abertura fica registrada (LGPD) e o conteúdo não fica à vista de quem passa.
- **Expandir tudo / Recolher tudo** (`<GrupoDeSecoes>`, em `Recolhivel.tsx`, #366): um botão redondo **só com o ícone** das duas setas (para baixo, abre todas; para cima, fecha todas), igual aos botões redondos do cartão (`.cartao-botao`: a mesma cor, o mesmo hover e o mesmo tamanho de ícone, `ICONE_DO_TOPO`), sem texto à vista. O nome ("Expandir tudo" ou "Recolher tudo") muda com o estado e vai no `aria-label`, com `aria-expanded`, e na dica, ao passar o mouse e no foco do teclado (`propsDaDica`); na tela de toque (`@media (hover: none)`), a dica só aparece no foco do teclado, para não ficar parada por cima da primeira seção depois do toque. O alvo do clique tem `--alvo-de-toque` (44px), um pouco maior que o desenho. Fica logo acima da primeira seção, encostado à direita, com o vão de sempre entre botões redondos (`--botao-redondo-vao`) até ela, no cartão e na anotação (que tem o vão dela, `--anotacao-vao`); vale para o corpo dos cartões de todos os módulos e para a coluna da direita da janela no centro, onde fica no alto da coluna, logo abaixo dos botões da janela (o formato e o X; `--abaixo-dos-botoes-da-janela`, em `estilo.css`), sem disputar a linha deles.
- **Checklists** (seção "Checklists" do cartão da demanda e da tarefa, `ListasDoCartao`, #358; no código e no banco, "listas"): o nome de cada checklist e o texto de cada item se renomeiam com um clique, ali mesmo (`<TituloEditavel>` com `nivel={4}` e `nivel="texto"` e a dica "Clique para renomear"); no mouse, o cursor de texto, o fundo `{colors.soft}` e o contorno `{colors.line2}` mostram isso. O "⋯" de cada checklist e item (mover, excluir, data de entrega, salvar como modelo) aparece no mouse e no foco, fica à vista enquanto o menu está aberto e sempre na tela de toque (`@media (hover: none)`). "Adicionar checklist" cria em branco ou a partir de um modelo; a página **Modelos de checklist** fica no menu ⋯ de Demandas, no de Tarefas e no de Contratos.
- **Checklists com grupos** (#309, `paginas/listas/`: `<ArvoreDoChecklist>`, a mesma peça no cartão da demanda, da tarefa e do contrato e no editor de modelos; regras em `regras/gruposDaLista.ts`): os itens ficam em grupos e subgrupos numerados, até 3 níveis (1. Documentos pessoais › 1.1 RG; 2. Benefício › 2.1 Aposentadoria por idade › 2.1.1 CNIS; `NIVEIS_DO_CHECKLIST`). Cada checklist recomeça no 1.; sem grupos, os itens ficam 1., 2., 3. O número (`.lista-numero`) vem antes do texto, em `{colors.muted}`, com algarismos de mesma largura e um espaço fixo (`--largura-do-numero`), para os textos de um nível começarem juntos; nunca é guardado (muda sozinho ao mover ou excluir). A cabeça do grupo tem, no lugar da caixa de marcar, a seta que abre e fecha (com o número dentro do mesmo botão, em negrito `{colors.ink}`; o alvo do dedo é o `--alvo-de-toque`), o nome em negrito (renomeia com um clique), a contagem sempre à vista, também fechado ("1 de 2 feitos" em `.nota`; com tudo feito, `<Selo tipo="ok">`) e o ⋯, que aparece só no mouse e no foco da própria cabeça. Cada nível recua `--recuo-do-checklist` (`--recuo-do-checklist-estreito` com o checklist até 480px: a consulta é de container, pelo `.cartao-painel` e `.cartao-corpo` no cartão e pelo `.modelo` e `.modelo-arvore` na página de modelos). Todo grupo começa aberto. No fim de cada grupo aberto, "Adicionar item" (`.mini` discreto: sem borda e com a letra `{colors.muted}` até o mouse ou o foco, com o "+" na coluna das caixas) abre o campo de item novo do grupo (Enter cria e deixa o campo aberto; Esc fecha só o campo, sem fechar o cartão). No pé do checklist, ao lado de "Adicionar", o mini "+ Grupo" cria um grupo no fim e leva o foco ao campo dele. O ⋯ do item tem Data de entrega (só no cartão), Subir, Descer, Mover para grupo (a mesma janela de "Mover para pasta", `escolherNaJanela`; só aparece quando há outro grupo para onde ir) e Excluir item; o do grupo, Adicionar subgrupo, Subir, Descer, Mover para grupo e Excluir grupo (com confirmação que diz quantos subgrupos e itens vão junto). Depois de mover, o foco fica no ⋯ do que mudou e o aviso do pé diz o número novo ('"RG" agora é 2.1.'); depois de excluir, vai ao ⋯ de cima (ou ao nome do checklist). Colar várias linhas no campo de item novo cria um item por linha; se a maioria começa com número (1., 2.1), um aviso pergunta "Usar esses números como grupos" ou "Manter como itens". Os níveis da lista colada contam a partir do grupo onde ela entra: se passaria de 3, nada é criado, o aviso continua e o pé da tela diz por quê. Quem só lê (ou com o cartão arquivado) vê os grupos, os números e as contagens e abre e fecha os grupos, sem ⋯, campos nem botões de acrescentar. No editor de modelos, a mesma árvore sem as caixas (o item guarda o lugar delas), em memória até "Salvar modelo" (com um item escrito e não adicionado num campo, o salvar não grava e o pé da tela pede Enter ou Adicionar, ou que se apague o texto); o modelo em edição ocupa a linha toda da grade, e o que passa dos limites (grupos, itens, níveis) aparece num aviso e trava o salvar. O cartão de cada modelo mostra a árvore numerada, só para ler, e "N itens em G grupos".
- **Andamentos do processo** (#362, `paginas/processo/Andamentos.tsx`, na coluna da direita do cartão no centro; ao lado e na janela estreita, no pé do cartão): os andamentos, dos mais novos aos mais antigos, numa **linha do tempo** (`.acomp-lista.linha-do-tempo`): cada caixa (borda `{colors.line}`, fundo `--superficie`) tem à esquerda uma bolinha vazada (borda `{colors.gray}`) na altura da primeira linha, ligada à da caixa de baixo por um traço `{colors.line2}` (a última caixa não tem traço); as medidas ficam em `--recuo-da-linha-do-tempo`, `--bolinha-da-linha-do-tempo`, `--traco-da-linha-do-tempo`, `--topo-da-bolinha` e `--vao-da-linha-do-tempo`. No topo da caixa, o **tipo** num selo cinza (`<Selo tipo="arq">`: o tipo da lista pronta, ou, nos andamentos de antes, o tipo de sempre), a data em negrito e o selo "A tratar" da intimação; os selos quebram de linha sem empurrar o **"⋯"** (`.andamento-mais`, do tamanho `--botao-da-linha`), que fica à direita do topo com "Mudar" e "Excluir" (`<MenuFlutuante>`; excluir não pede confirmação, porque o aviso tem o Desfazer). Como o dos checklists, o "⋯" aparece no mouse e no foco do teclado, fica à vista com o menu aberto e sempre na tela de toque; quem só lê o processo (ou com ele arquivado) não o vê. Os botões da intimação (Tarefa, Criar tarefa, Lançar prazo, Não precisa de tarefa) continuam no pé da caixa. No formulário, o campo "Tipo" oferece a lista pronta (`CATEGORIAS_DE_ANDAMENTO` em `regras/andamentos.ts`, a mesma para todos os escritórios: Despacho, Decisão, Sentença, Intimação, Petição, Audiência) e é obrigatório: o andamento novo abre em "Escolha o tipo" (opção desativada) e não é lançado sem um dos seis. Só ao mudar um andamento de antes sem tipo da lista (perícia ou andamento comum) a lista mostra também o tipo que ele já tem, com o mesmo nome da caixa ("Perícia", "Andamento"), para ele não mudar sem querer (`escolhasDoFormulario`). A audiência e a perícia têm a data e a hora num campo só (`CampoDataHora`, #299) e o local.

### Responsive Strategy

| Name | Width | Key Changes |
|---|---|---|
| Wide | ≥ 1280px | Conteúdo cheio |
| Desktop | 901–1279px | Barra lateral fixa + conteúdo |
| Tablet | ≤ 900px | A barra lateral vira gaveta com `.topo-cel`, e o kanban mantém a rolagem horizontal com colunas de 85vw |
| Narrow | ≤ 820px | As telas de acesso empilham (a foto vira uma faixa de 260px, sem o lead) |
| Mobile | ≤ 640px | Formulários em uma coluna, ações empilhadas (botão principal em largura total) |

- Alvo mínimo de 44px em controles; campos de login com 48px.
- Margens laterais sempre com `max(16px, env(safe-area-inset-*))`.
- Tabelas rolam na horizontal dentro de `.tabela`.

### Image Behavior
Uma única fotografia de marca, `app/src/imagens/farol.webp` (já em escala de cinza e compactada), sempre em escala de cinza (`grayscale(1)`) e escurecida com `brightness(.45–.55)` quando há texto por cima. Não há fotos coloridas nem ilustrações. Os ícones são traço fino (stroke 1.4–2) em `currentColor`.

## Elevation & Depth

| Level | Treatment | Use |
|---|---|---|
| Flat | Sem sombra, borda 1px `{colors.line}` ou `{colors.line2}` | Cartões, listas, campos, tabelas, colunas e cartões do kanban em repouso |
| Drawer | `--sombra-gaveta` (`8px 0 30px rgba(0,0,0,.15)`; mais forte no escuro), com o véu `--veu` atrás | Barra lateral e explorador de Documentos abertos como gaveta |
| Sheet | `-12px 0 40px rgba(0,0,0,.18)` + véu | Painel de detalhe (contrato, demanda) sobreposto no celular |
| Floating | `0 12px 36px rgba(0,0,0,.28)` | Modal, toast, cartão sendo arrastado |

## Shapes

| Token | Value | Use |
|---|---|---|
| `{rounded.sm}` | 6px | Itens de menu lateral, botões de formatação |
| `{rounded.md}` | 8–10px | Campos, selects, avisos, cartões do kanban, toast |
| `{rounded.lg}` | 12px | Cartões, colunas do kanban, tabelas, modais |
| `{rounded.full}` | 999px | Todos os botões, abas, selos, tags, barras de progresso, avatares |

## Components

### Navigation
- **`sidebar-app`:** 264px, fundo `{colors.soft}`, fixa na altura da tela. Topo com `brand-mark`, itens de menu e, no rodapé, nome do usuário e `role-pill`.
- **`brand-mark`:** quadrado escuro de 28px com a inicial em `{colors.accent-bright}` + nome do escritório, com a submarca "SEMPER" em `{colors.accent-ink}`.
- **`nav-item`:** 36px, `{rounded.sm}`, 14px `{colors.text}`. Hover e ativo com fundo `{colors.line}` (o ativo em 700 `{colors.ink}`). **Nunca verde.**
- **`role-pill`:** pílula de 11px / 900 / .08em em caixa alta, escura para Master, `{colors.line2}` para os demais perfis.
- **Novidades** (`ui/Novidades.tsx`, #353): primeiro item do rodapé da barra lateral, com o foguete. Enquanto há versão que a pessoa não viu, um ponto de 8px em `{colors.accent}` na ponta direita (`.nav-ponto`), que some ao abrir. No celular, onde a barra lateral é uma gaveta fechada, o mesmo botão fica também à direita da barra do topo, só com o ícone e o ponto no canto de cima; abrir por um apaga o ponto dos dois. A lista abre numa janela larga (`janela({ larga: true })`, até 640px, só o corpo rola): cada versão com o número num selo sem caixa alta e a data por extenso à direita, e cada novidade com o título em 900, o texto e a linha "onde achar" em `{colors.muted}`, com a seta que dobra.

### Buttons
- **`button-primary`** (`.btn.pri`): fundo `{colors.accent}`, **texto branco** 900, `{rounded.full}`, 44px (48px nas telas de acesso). Hover em `{colors.accent-hover}`.
- **`button-secondary`** (`.btn`): fundo branco, borda 1px `{colors.line2}`, texto `{colors.ink}` 15px / 700.
- **`button-dark`** (`.btn.esc`): fundo `{colors.dark}`, texto branco, para "Salvar" e confirmações neutras.
- **`button-mini`:** 34px para ações de linha. A variante `perigo` tem borda #F3C1BC e texto `{colors.erro}`.
- **`text-link`** (`.link`): `{colors.accent-ink}` 14px / 700 com sublinhado de 1px.

### Cards & Containers
- **`card`** (`.cartao`): branco, borda `{colors.line}`, `{rounded.lg}`, padding 24px, sem sombra.
- **`empty-state`** (`.vazio`): borda tracejada `{colors.line2}`, `{rounded.lg}`, texto `{colors.muted}`.
- **`alert`** (`.aviso`): `erro`, `ok` e `info` com as cores semânticas.
- **`status-chip`** (`.selo`): 26–30px, `{rounded.full}`, 12px / 900 em caixa alta, nas variantes ok / pendente / erro / arquivado.
- **`link-chip`:** pílula de vínculo entre módulos (ex.: "Contrato HE62-DE74-001/24"), branca com borda `{colors.line2}` e o código em tabular-nums.

### Inputs & Forms
- **`text-input`:** 48px nas telas de acesso, 44px no app, `{rounded.md}`, borda `{colors.line2}`. Foco com contorno de 2px `{colors.accent}` e borda transparente.
- **Escrever na anotação, sem moldura** (#367, pedido de 19/11): o título e o texto da anotação (aberta e nova) não ganham contorno nem fio verde no foco; como numa folha, só o cursor `{colors.accent}` mostra onde se escreve. O texto é o editor ao vivo (`<EditorAoVivo>`, hoje só da anotação): a peça tira o contorno do `:focus-visible` da área de escrever, também no lugar do texto enquanto o editor carrega. O título é o `<TituloEditavel>` comum, sem contorno só dentro de `.anotacao-titulo`. Os outros campos do sistema, inclusive os títulos mudados no lugar nos outros cartões e nos checklists, continuam com o contorno de 2px `{colors.accent}`: neles a moldura é o sinal de que o título virou campo.
- **Seções e campos** (#359): em todo formulário de cadastro ou de edição, a hierarquia é **título da seção > rótulo do campo > dica**. A seção é sempre `<SecaoDoFormulario>`: o título em 900 (no cadastro por etapas, h2 de 24–30px abaixo do h1 da página; no lápis do cartão e na Nova entrada do Financeiro, h3 em `--texto-titulo-1`, 19px, abaixo do h2 do cartão), o rótulo do campo em 15px / 700 e a dica em 13px `{colors.muted}`. Os campos da seção ficam juntos embaixo do título, recuados `--recuo-dos-campos` (16px) e com um fio de 1px `{colors.line2}` à esquerda: o recuo, e não uma caixa, porque o lápis já fica dentro do cartão (caixa dentro de caixa pesa e se confunde com estado). No lápis (e na janela do usuário em Equipe e acessos, também dentro de `.edicao-cartao`), uma linha `{colors.line}` e espaço separam uma seção da outra. As etapas da importação de pessoas também são `<SecaoDoFormulario>`, com o foco no título a cada etapa (`focoNoTitulo`). Um grupo de pessoas dentro de uma seção (Responsável, Colaboradores, Clientes) é feito de **campos**, nunca de subtítulos.
- **Campo de vários itens:** o rótulo vai **no plural** ("Clientes", "Colaboradores", "Participantes", "Pessoas ligadas", "Telefones", "E-mails"), uma vez só, sobre as linhas (`<CampoDeVarios>`; as listas prontas `<EscolhaDaEquipe>`, `<EscolhaDeProcessos>` e os participantes do contrato são feitas com ele). Cada linha tem o próprio nome só para o leitor de tela ("Cliente 2", "Telefone 2"; com uma linha só, "Cliente"), e o botão de tirar diz qual ("Tirar o telefone 2"); as linhas apontam para a dica e o erro do grupo, e ao tirar uma linha o foco vai ao grupo (`useFocoNoGrupo`). Listas de várias linhas com colunas (`<LinhasRepetidas>`, no Perfil profissional) seguem o mesmo plural ("Inscrições na OAB", "Formações", "Experiências"). Campo de um item só fica no singular ("Responsável", "Processo").
- **`segmented-tabs`** (`.abas`): trilho `{colors.soft}`, `{rounded.full}`, aba ativa preenchida de `{colors.dark}` com texto branco.
- **`markdown-editor`** (CMS): campo livre com barra de formatação de 26px e visualização ao lado.

### Signature Components
- **`access-wordmark`:** "SEMPER." em `{typography.access-title}`, com o ponto em `{colors.accent-bright}`, sobre a foto do farol.
- **`green-period`:** títulos editoriais terminam com "." verde (`{colors.accent}` no claro, `{colors.accent-bright}` no escuro).
- **`toast`:** fixo embaixo ao centro, `{colors.dark}`, `{rounded.md}`, sombra Floating.

### Em código (`app/src/ui/base/`)

As peças acima existem como componentes React. Cada um gera o mesmo HTML e as mesmas classes descritas aqui, com as cores e os tamanhos de `estilo.css`. Telas novas usam os componentes, e não escrevem as classes à mão; as telas antigas passam para eles aos poucos, sem mudar a aparência.

| Peça | Componente | Exemplo |
|---|---|---|
| Botões (`.btn`, `.pri`, `.esc`, `.perigo`, `.btn-sm`, `.mini`, `.link`) | `Botao` e `BotaoDuplo` (em `ui/Botoes.tsx`), `BotaoLink`, `estiloBotao()` | `<Botao variante="principal">Salvar</Botao>` · `<BotaoDuplo forma="mini" variante="perigo" …>` · `<BotaoLink to="/pessoas/nova/" variante="principal">` |
| Pergunta de formulário (`.pergunta`, `.req`, `.dica`, `.msg-erro`) | `Campo` com `propsDoCampo()`; `depois` para o que vem após o erro (ex.: o resultado de uma busca) | `<Campo rotulo="CPF" para="cpf" obrigatorio erro={erro}><input {...propsDoCampo('cpf', { erro })} /></Campo>` |
| Grupo de opções (`.pergunta` + `.escolhas`) | `Escolhas`, com `dica` e `arranjo` (`coluna-unica`, `multipla`) | `<Escolhas rotulo="Gênero" obrigatorio>…rádios…</Escolhas>` |
| Seção de formulário (`.etapa` + `.etapa-campos`) | `SecaoDoFormulario`, com `texto` (a frase do cadastro por etapas), `nivel` (2 no cadastro, 3 no lápis do cartão) e `focoNoTitulo` (uma ref, quando o título recebe o foco ao trocar de etapa) | `<SecaoDoFormulario titulo="Pessoas" nivel={3}>…campos…</SecaoDoFormulario>` |
| Campo de vários itens (`.pergunta` com grupo) | `CampoDeVarios`, rótulo no plural; cada linha com o nome só para o leitor de tela. Com `id`, as linhas apontam para o rótulo, a dica e o erro (`idsDoCampoDeVarios(id)`); com `grupo` (a ref de `useFocoNoGrupo()`), o grupo recebe o foco ao tirar uma linha (`focarNoGrupo()`) | `<CampoDeVarios rotulo="Clientes" obrigatorio erro={erro}>…linhas…</CampoDeVarios>` |
| Data e hora (`.campo-data-e-hora` + `.campo-quando`) | `CampoDataHora` (#299), dentro de `Campo` com `propsDoCampo()`: a data (o `CampoData`, com o calendário pequeno no computador e o do aparelho no celular) e a hora numa caixa só, com um fio entre as duas; escolhido o dia no calendário, o foco vai para a hora. A hora tem o próprio nome (`rotuloDaHora`, "Hora"), `horaObrigatoria` e `horaComErro`; o `Campo` mostra as mensagens das partes juntas (`errosJuntos`, em regras/campoData.ts). `junto` põe um botão do mesmo campo ao lado, que desce para a linha de baixo na tela estreita. Vale para todo cadastro com data e hora (tarefa, demanda, compromisso, andamento de audiência e perícia) e para as datas que se mudam no próprio cartão (`discreto`, no tamanho de cartão: o prazo e a data do compromisso, #361) | `<CampoDataHora {...propsDoCampo('prazo', { dica: true, erro })} valor={prazo} aoMudar={…} hora={hora} aoMudarHora={…} junto={<BotaoDoLembrete …/>} />` |
| Lembrete do prazo (`.botao-do-lembrete`) | `BotaoDoLembrete` (#299): o sino e o que foi escolhido ("1 hora antes", "Sem lembrete"); abre as opções num `<MenuFlutuante>` (na hora, 30 minutos, 1 hora, 1 dia antes e, separado, Sem lembrete), com a nota de quem recebe. Escolhido, o sino fica `{colors.accent-ink}` e o texto `{colors.ink}` (nunca fundo verde); sem prazo e sem lembrete, fica desligado (`aria-disabled`: continua no Tab, e o leitor de tela lê o motivo; a dica do prazo diz que o sino vem com o prazo) | `<BotaoDoLembrete valor={lembrete} prazo={prazo} aoMudar={…} />` |
| `alert` (`.aviso`) | `Aviso` | `<Aviso tipo="erro">{mensagem}</Aviso>` |
| `status-chip` (`.selo`) | `Selo` | `<Selo tipo="pend">Pendente</Selo>` |
| `card` (`.cartao`) | `Cartao` | `<Cartao>…</Cartao>` |
| Título de seção (`h2.secao`) | `TituloSecao` | `<TituloSecao>Usuários</TituloSecao>` |
| Nota e dica (`.nota`, `.dica`) | `Nota`, `Dica` | `<Nota>Quem faz parte da equipe…</Nota>` |
| Carregando (`.carregando`) | `Carregando` | `<Carregando />` |
| `empty-state` (`.vazio`) | `Vazio` | `<Vazio>Nenhum convite pendente.</Vazio>` |
| Texto que já abre para escrever e salva sozinho (a anotação) | `EditorDeTexto`, com `controle` (gravar antes de sair); sem `aoSalvar`, só o texto formatado | `<EditorDeTexto texto={a.texto} aoSalvar={gravar} controle={editor} />` |
| Dica no foco e no hover de um botão pequeno (as bolinhas da equipe) | `propsDaDica` (`[data-dica]` em `estilo.css`) | `<button aria-label="Tirar Ana" {...propsDaDica('Tirar Ana')}>` |

Além da aparência, os componentes cuidam da acessibilidade: o `Campo` liga o rótulo, a dica e o erro ao campo (`aria-invalid`, `aria-describedby`) e anuncia o erro; o `Aviso` de erro é anunciado como alerta; o `Carregando`, como status. Os testes de `ui/base/base.test.tsx` garantem que as classes geradas são as desta seção.

Os formulários de Configurações ainda usam outra marcação (`.campo-form`, `.com-erro`, `.erro-campo`). Unificar com o `Campo` muda a aparência deles e fica para a migração das telas.

## Do's and Don'ts

### Do
- Use `{colors.accent}` só para a ação principal e para sinais de foco ou posição, sempre com texto branco em peso 900.
- Sobre fundo escuro, use `{colors.accent-bright}`. Para verde em texto sobre fundo claro, use `{colors.accent-ink}`.
- Combine o botão verde com um `button-secondary` branco de borda fina.
- Construa a hierarquia com o contraste de peso da Lato e com os degraus de cinza quente.
- Termine títulos editoriais com o ponto final verde.
- Mantenha cada coluna do kanban com rolagem própria, no estilo do Trello.
- Mostre o estado trocando o preenchimento (branco → `{colors.soft}` → `{colors.dark}`), não elevando.
- Busque nome, cores e logos em `window.MARCA`, nunca fixos no HTML.

### Don't
- Não ponha texto escuro sobre o verde, nem use o verde em fundos grandes.
- Não use dois botões verdes na mesma área da tela.
- Não use o verde semântico `{colors.ok}` como preenchimento sólido, porque ele se confunde com o botão principal. Use-o só em selos.
- Não use preto puro (#000) nem cinzas frios.
- Não adicione sombras em cartões, listas ou colunas. Sombra é só para o que flutua.
- Não use cantos retos em botões, nem cantos de pílula em cartões.
- Não deixe listas crescerem infinitamente na página, como no Notion.
- Não coloque fotos coloridas nem ilustrações.
- Não escreva texto corrido em caixa alta.
