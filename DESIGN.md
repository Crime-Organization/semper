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

### Kanban (demandas)
O kanban segue o modelo do Trello, **não** o do Notion:
- O quadro ocupa a altura que sobra da janela, só pelo layout (`body.com-quadro`, `.area-quadro`), e rola **na horizontal** quando as colunas não cabem.
- Cada coluna tem largura fixa (272–296px), fundo `{colors.soft}`, `{rounded.lg}` e cabeçalho fixo (nome em `{typography.label-caps}` + contagem tabular).
- **A lista de cartões rola dentro da própria coluna** (`overflow-y: auto`), sem nunca empurrar a página para baixo. O botão "Adicionar cartão" fica fixo no pé da coluna.
- Cartão: branco, borda `{colors.line2}`, `{rounded.md}`, título em `{typography.card-title}`, metadados (código do contrato, responsável, prazo, contagem de checklist) em `{typography.caption}`. Arrastando, o cartão ganha a sombra Floating e leve rotação (1–2°), que somem assim que ele é solto.
- Coluna na ordem manual: uma barra verde mostra onde o cartão vai entrar. Coluna em outra ordem (nome, data): o cartão só entra nela vindo de outra coluna; a coluna inteira fica contornada em verde tracejado e o cartão entra no lugar que a ordem dela define. Dentro dela não dá para mudar a posição.
- Coluna e cartão nunca são preenchidos de verde. O verde aparece só no foco e no botão principal.

### Cartão (painel de detalhe de pessoa, contrato, demanda…)
Abre à direita, com até 560px, sobre um véu. O "X" fica preso ao topo por cima do conteúdo, sem ocupar largura.
- **Ações numa linha só**, logo abaixo do título: a principal em verde (ex.: "Atualizar cadastro") e as secundárias brancas. Quando o painel fica estreito (zoom, celular), as secundárias viram botões redondos só com o ícone, e o nome continua como dica. A medida é a largura do próprio painel (container queries), nunca uma conta em JavaScript.
- **Exclusão fora da linha de ações:** só aparece em itens arquivados, num aviso tracejado logo abaixo das ações, com o botão sob o texto. Ao pedir confirmação, o botão cresce para a direita e o segundo clique cai no mesmo lugar.
- **Vínculos entre pessoas** (seção "Vínculos" do cartão de pessoa): cada vínculo aparece nas duas pessoas, com o rótulo do lado de cada uma ("Representante legal de" / "Representado(a) por"), e o nome da outra pessoa abre o cartão dela. Tipos padrão para todos os escritórios; master e administradores criam os do escritório. A quantidade aparece ao lado do título mesmo com a seção fechada (`contador` do `<Recolhivel>`).
- **Escolher uma pessoa do cadastro** é sempre com `<BuscaPessoa>` (`app/src/ui/BuscaPessoa.tsx`): busca por nome, CPF/CNPJ ou telefone, lista de achados (com o motivo quando alguém não pode ser escolhido) e a pessoa escolhida com "Trocar".
- **Seções longas recolhem** com `<Recolhivel>` (`app/src/ui/Recolhivel.tsx`): título clicável com a seta na ponta direita e uma linha fina acima. O conteúdo só é carregado quando a seção está aberta. Com `preferencia`, a escolha de cada usuário fica guardada (Dados do cadastro e Histórico). As informações sigilosas sempre começam fechadas: cada abertura fica registrada (LGPD) e o conteúdo não fica à vista de quem passa.

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
| Drawer | `8px 0 30px rgba(0,0,0,.15)` | Barra lateral aberta como gaveta |
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
| `alert` (`.aviso`) | `Aviso` | `<Aviso tipo="erro">{mensagem}</Aviso>` |
| `status-chip` (`.selo`) | `Selo` | `<Selo tipo="pend">Pendente</Selo>` |
| `card` (`.cartao`) | `Cartao` | `<Cartao>…</Cartao>` |
| Título de seção (`h2.secao`) | `TituloSecao` | `<TituloSecao>Usuários</TituloSecao>` |
| Nota e dica (`.nota`, `.dica`) | `Nota`, `Dica` | `<Nota>Quem faz parte da equipe…</Nota>` |
| Carregando (`.carregando`) | `Carregando` | `<Carregando />` |
| `empty-state` (`.vazio`) | `Vazio` | `<Vazio>Nenhum convite pendente.</Vazio>` |

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
