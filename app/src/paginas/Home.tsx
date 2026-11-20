// Página pública (semper.app.br): o SEMPER se apresenta a qualquer escritório (#380).
// A vitrine do farol, a mesma da tela de entrada, abre a página com o Início do SEMPER num celular, que sobe por trás do
// cartão-índice; o cartão, com as seções em linhas finas como no cartão de verdade, leva a cada módulo, que aparece com a tela
// real, capturada do banco fictício (só dados inventados). A ação principal é pedir uma demonstração: a conversa abre no e-mail
// (ou no WhatsApp, se a marca tiver o número). Quem chega por um link de convite ou de e-mail (?primeiro-acesso, ?token_hash,
// #access_token…) vai direto para /entrar/.
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate } from 'react-router';
import { TAMANHO_ESCRITORIO } from '../dados/limites';
import { MARCA } from '../marca';
import { conversaDoPedido, levaParaEntrada, mensagemDoPedido, TAMANHOS_DA_EQUIPE, type TamanhoDaEquipe } from '../regras/paginaPublica';
import { qualificacao } from '../regras/pessoa';
import { avisar } from '../ui/avisos';
import { Campo, Escolhas, estiloBotao, propsDoCampo } from '../ui/base';
import { Icone, type NomeIcone } from '../ui/Icone';
import { DURACAO_AVISO } from '../ui/tempos';
import { copiarTexto, useTitulo } from '../ui/util';
import './Home.css';

// Quem já entrou neste aparelho vê "Abrir o SEMPER" (a sessão fica guardada com esta chave pelo auth-js).
function temSessao() {
  try { return !!localStorage.getItem(`sb-${new URL(MARCA.supabaseUrl).hostname.split('.')[0]}-auth-token`); }
  catch { return false; }
}

const CANAIS = { whatsapp: MARCA.whatsapp, email: MARCA.emailContato };
const ONDE_ABRE = MARCA.whatsapp ? 'no WhatsApp' : 'no seu e-mail';

export default function Home() {
  if (levaParaEntrada(location.search, location.hash)) return <Navigate to={'/entrar/' + location.search + location.hash} replace />;
  return <Pagina />;
}

function Pagina() {
  useTitulo('Gestão para escritórios');
  useEntradas();
  return <div className="pub">
    <Topo />
    <main>
      <Vitrine />
      <Indice />
      <Inicio />
      <Pessoas />
      <DoContratoATarefa />
      <Checklists />
      <Processos />
      <AgendaEMensagens />
      <Documentos />
      <Recursos />
      <Seguranca />
      <Perguntas />
      <Demonstracao />
    </main>
    <Rodape />
  </div>;
}

/** A tela começa a assentar um pouco antes de chegar ao pé da janela (a fração da altura da janela que falta). */
const ANTES_DO_PE_DA_JANELA = '0px 0px -8% 0px';

// As telas assentam no lugar ao entrar na tela, uma vez. Com movimento reduzido (ou sem IntersectionObserver), já estão lá.
function useEntradas() {
  useEffect(() => {
    const raiz = document.querySelector('.pub');
    if (!raiz || matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
    raiz.classList.add('com-entradas');
    const obs = new IntersectionObserver(itens => {
      for (const i of itens) if (i.isIntersecting) { i.target.classList.add('entrou'); obs.unobserve(i.target); }
    }, { rootMargin: ANTES_DO_PE_DA_JANELA });
    raiz.querySelectorAll('.pub-tela:not(.pub-vitrine-tela)').forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);
}

// ---------- as telas reais, nos dois temas ----------
const ARQUIVOS = import.meta.glob<string>('../imagens/apresentacao/*.{avif,webp}', { eager: true, import: 'default' });
/** Até esta largura a página está num celular: as telas largas dão lugar à mesma tela capturada num celular (o mesmo valor do CSS). */
const NO_CELULAR = '(max-width: 640px)';
type Medidas = readonly [largura: number, altura: number];
/**
 * As telas capturadas do banco fictício (só dados inventados), cada uma em "-claro" e "-escuro", em AVIF e em WebP (para quem não
 * abre AVIF): a "larga", capturada no computador, e a "celular", capturada num celular de 390px. Largura e altura dos arquivos.
 */
const TELAS = {
  inicio: { larga: [1800, 1140], celular: [780, 1688] },
  busca: { larga: [1080, 1010], celular: [716, 1624] },
  pessoas: { larga: [1347, 1067], celular: [780, 1412] },
  pessoa: { larga: [1400, 1522], celular: [780, 1656] },
  contrato: { celular: [780, 1652] },
  demandas: { celular: [780, 1412] },
  tarefas: { celular: [780, 1412] },
  checklist: { larga: [1334, 1314], celular: [780, 1448] },
  processos: { larga: [1362, 1026], celular: [780, 1560] },
  calendario: { larga: [1334, 1640], celular: [780, 1072] },
  agenda: { larga: [1362, 1190], celular: [780, 1560] },
  mensagens: { larga: [1362, 662], celular: [780, 1194] },
  anotacao: { larga: [2004, 1194], celular: [780, 1688] },
  equipe: { larga: [1354, 694] }
} as const satisfies Record<string, { larga?: Medidas; celular?: Medidas }>;
type NomeDaTela = keyof typeof TELAS;
const TEMAS = ['claro', 'escuro'] as const;
const arquivo = (nome: string, tema: string, formato: 'avif' | 'webp') => ARQUIVOS[`../imagens/apresentacao/${nome}-${tema}.${formato}`];

/**
 * A tela do tema que está na página: as duas vão no HTML, e o CSS mostra uma (a escondida nem é baixada). No celular, a tela
 * capturada no celular, quando há. "so" fixa uma das duas capturas em qualquer tamanho; sem a do celular, a tela larga some no
 * celular quando "soNoComputador".
 */
function Tela({ nome, alt, className, so, soNoComputador }: { nome: NomeDaTela; alt: string; className?: string; so?: 'celular'; soNoComputador?: boolean }) {
  const tela: { larga?: Medidas; celular?: Medidas } = TELAS[nome];
  const doCelular = so === 'celular' || !tela.larga;
  const [base, medidas] = doCelular ? [nome + '-celular', tela.celular!] : [nome, tela.larga!];
  const trocaNoCelular = !doCelular && tela.celular;
  const classes = ['pub-tela', doCelular ? 'pub-tela-celular' : '', soNoComputador ? 'pub-so-computador' : '', className].filter(Boolean).join(' ');
  return <figure className={classes}>
    {TEMAS.map(tema => <picture key={tema} className={'pub-so-' + tema}>
      {trocaNoCelular && <>
        <source media={NO_CELULAR} type="image/avif" srcSet={arquivo(nome + '-celular', tema, 'avif')} width={tela.celular![0]} height={tela.celular![1]} />
        <source media={NO_CELULAR} type="image/webp" srcSet={arquivo(nome + '-celular', tema, 'webp')} width={tela.celular![0]} height={tela.celular![1]} />
      </>}
      <source type="image/avif" srcSet={arquivo(base, tema, 'avif')} width={medidas[0]} height={medidas[1]} />
      <img src={arquivo(base, tema, 'webp')} alt={alt} width={medidas[0]} height={medidas[1]} loading="lazy" decoding="async" />
    </picture>)}
  </figure>;
}

/** O título de uma seção; o ponto verde fica só nos momentos principais (Processos e o pedido do fim). */
function Titulo({ id, children, grande = false }: { id: string; children: ReactNode; grande?: boolean }) {
  return <h2 id={id} className={grande ? 'pub-titulo pub-titulo-grande' : 'pub-titulo'}>{children}{grande && <span className="pub-ponto">.</span>}</h2>;
}

/** Os fatos de um módulo: o nome em negrito e o que ele faz. "emLinha": lado a lado, em colunas. */
function Fatos({ itens, emLinha = false }: { itens: readonly (readonly [string, string])[]; emLinha?: boolean }) {
  return <ul className={emLinha ? 'pub-fatos pub-fatos-em-linha' : 'pub-fatos'}>{itens.map(([nome, texto]) => <li key={nome}><b>{nome}</b> {texto}</li>)}</ul>;
}

// ---------- topo e vitrine ----------
const SECOES_DO_TOPO = [['#modulos', 'Módulos'], ['#seguranca', 'Segurança'], ['#perguntas', 'Perguntas']] as const;

function Topo() {
  const logado = temSessao();
  return <header className="pub-topo">
    <nav className="pub-topo-secoes" aria-label="Seções da página">
      {SECOES_DO_TOPO.map(([para, nome]) => <a key={para} href={para}>{nome}</a>)}
    </nav>
    <Link className="pub-entrar" to={logado ? '/inicio/' : '/entrar/'}>{logado ? 'Abrir o SEMPER' : 'Entrar'}</Link>
  </header>;
}

function Vitrine() {
  return <section className="pub-vitrine" aria-labelledby="t-semper">
    <img className="pub-farol" src={MARCA.fotoEntrada} alt="" width={1600} height={1066} fetchPriority="high" decoding="async" />
    <div className="pub-vitrine-texto">
      <h1 id="t-semper"><span className="pub-marca">SEMPER<span className="pub-ponto">.</span></span> <span className="pub-tese">Tudo do seu escritório num lugar só.</span></h1>
      <p className="pub-lead">Clientes, contratos, demandas, tarefas, prazos, agenda e documentos da equipe, no navegador do computador e do celular.
        Para escritórios de advocacia, de propriedade intelectual, núcleos de inovação e outros escritórios de serviços.</p>
      <PedidoDeDemonstracao />
    </div>
    <Tela nome="inicio" so="celular" className="pub-aparelho pub-vitrine-tela"
      alt="Início do SEMPER num celular: os prazos em atraso e os dos próximos dias de quem entrou, e a agenda de hoje" />
  </section>;
}

// ---------- o índice: um cartão do SEMPER, com as seções em linhas ----------
const LINHAS_DO_INDICE: readonly { para: string; nome: string; texto: string; icone: NomeIcone }[] = [
  { para: '#inicio', nome: 'Início', texto: 'O dia de cada pessoa, ao entrar', icone: 'inicio' },
  { para: '#pessoas', nome: 'Pessoas', texto: 'Clientes, partes e contatos', icone: 'pessoas' },
  { para: '#contratos', nome: 'Contratos', texto: 'Clientes, serviços e equipe de cada um', icone: 'contratos' },
  { para: '#demandas', nome: 'Demandas e tarefas', texto: 'Cada serviço com prazo e responsável', icone: 'demandas' },
  { para: '#checklists', nome: 'Checklists', texto: 'Listas numeradas e modelos prontos', icone: 'numerada' },
  { para: '#processos', nome: 'Processos e prazos', texto: 'Prazos em dias úteis, com os feriados', icone: 'processos' },
  { para: '#agenda', nome: 'Agenda', texto: 'Audiências, reuniões e compromissos', icone: 'calendario' },
  { para: '#mensagens', nome: 'Mensagens', texto: 'Menções, avisos de prazo e lembretes', icone: 'sino' },
  { para: '#documentos', nome: 'Documentos', texto: 'Anotações ligadas a cada cliente', icone: 'documentos' },
  { para: '#seguranca', nome: 'Equipe e segurança', texto: 'Acesso por convite, cada um no seu papel', icone: 'equipe' }
];

function Indice() {
  return <nav id="modulos" className="pub-indice" aria-labelledby="t-indice">
    <div className="pub-cartao">
      <div className="pub-cartao-cabeca">
        <h2 id="t-indice" className="pub-cartao-titulo">O que o SEMPER já faz</h2>
        <p>Tudo nesta lista funciona hoje. Escolha uma parte para ver a tela de verdade, com dados de exemplo.</p>
      </div>
      <ul className="pub-linhas">
        {LINHAS_DO_INDICE.map(l => <li key={l.para}>
          <a href={l.para}>
            <span className="pub-linha-icone"><Icone nome={l.icone} tam={20} /></span>
            <span className="pub-linha-nome">{l.nome}<small>{l.texto}</small></span>
            <span className="pub-linha-seta"><Icone nome="direita" /></span>
          </a>
        </li>)}
      </ul>
    </div>
  </nav>;
}

// ---------- os módulos ----------
function Inicio() {
  return <section id="inicio" className="pub-secao pub-inicio" aria-labelledby="t-inicio">
    <div className="pub-texto pub-texto-largo">
      <Titulo id="t-inicio">Início</Titulo>
      <p className="pub-frase">Ao entrar, cada pessoa vê o próprio dia: os prazos, a agenda e o que está em andamento.</p>
    </div>
    <div className="pub-montagem">
      <Tela nome="inicio" soNoComputador className="pub-janela" alt="Início do SEMPER: prazos em atraso e dos próximos dias, agenda de hoje, tarefas, demandas e processos da pessoa" />
      <Tela nome="busca" className="pub-flutua" alt="Busca geral do SEMPER com a palavra silva: uma pessoa, um processo, um contrato e duas demandas encontrados" />
    </div>
    <Fatos emLinha itens={[
      ['Prazos.', 'Os vencidos, os de hoje e os da semana, de tarefas, demandas e processos.'],
      ['Agenda e tarefas.', 'Os compromissos do dia e o que está em andamento, só com o que é da pessoa.'],
      ['Busca geral.', 'Do teclado (Ctrl+K), acha qualquer pessoa, contrato, demanda, processo ou anotação.']
    ]} />
  </section>;
}

function Pessoas() {
  return <section id="pessoas" className="pub-secao pub-pessoas" aria-labelledby="t-pessoas">
    <div className="pub-lado">
      <div className="pub-texto">
        <Titulo id="t-pessoas">Pessoas</Titulo>
        <p className="pub-frase">Cada cliente, parte e contato com tudo o que é dele.</p>
        <Fatos itens={[
          ['Quadro ou tabela.', 'As colunas são as etapas que o seu escritório escolhe; arraste o cartão de uma para outra.'],
          ['Cadastro rápido.', 'O CNPJ traz os dados da empresa e o CEP completa o endereço; o SEMPER avisa se a pessoa já está cadastrada.'],
          ['Vínculos.', 'Cônjuge, sócio, representante legal, quem indicou: cada vínculo aparece nas duas pessoas.'],
          ['O cartão reúne tudo.', 'Contratos, demandas, processos, tarefas, compromissos e anotações da pessoa, num lugar só.']
        ]} />
      </div>
      <Tela nome="pessoas" className="pub-janela pub-sangra" alt="Quadro de Pessoas do SEMPER, com as colunas das etapas do atendimento e os cartões de cada pessoa" />
    </div>
    <Qualificacao />
  </section>;
}

// A qualificação de verdade, escrita pela mesma função do SEMPER: a pessoa troca o gênero e vê o texto mudar.
type Genero = 'f' | 'm';
const NOMES: Record<Genero, string> = { f: 'Maria da Silva Exemplo', m: 'João da Silva Exemplo' };
// O CPF de exemplo tem os dígitos finais errados de propósito: não pode ser de ninguém.
const PESSOA_DE_EXEMPLO = {
  tipo: 'pf' as const, nacionalidade: 'brasileira', profissao: 'professor(a)', estado_civil: 'casado',
  documento: '52998224700', logradouro: 'Rua das Flores', numero: '10', bairro: 'Centro', municipio: 'São Paulo', uf: 'SP', cep: '01001000'
};
const textoDaQualificacao = (g: Genero) => qualificacao({ ...PESSOA_DE_EXEMPLO, nome: NOMES[g], genero: g });

// Marca as palavras que mudaram com o gênero (os dois textos têm o mesmo número de palavras).
function comDiferencas(g: Genero) {
  const a = textoDaQualificacao(g).split(/([\s,]+)/), b = textoDaQualificacao(g === 'f' ? 'm' : 'f').split(/([\s,]+)/);
  if (a.length !== b.length) return a.join('');
  return a.map((p, i) => p !== b[i] ? <mark key={i}>{p}</mark> : p);
}

function Qualificacao() {
  const [g, setG] = useState<Genero>('f');
  const [copiada, setCopiada] = useState(false);
  const texto = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (!copiada) return; const t = setTimeout(() => setCopiada(false), DURACAO_AVISO.ok); return () => clearTimeout(t); }, [copiada]);
  async function copiar() {
    if (await copiarTexto(textoDaQualificacao(g), texto.current)) { setCopiada(true); avisar('Qualificação copiada.'); }
    else avisar('Não deu para copiar. O texto ficou selecionado: copie com Ctrl+C.', 'erro');
  }
  return <div className="pub-qualificacao">
    <div className="pub-qual-demo">
      <h3>A qualificação pronta para a petição.</h3>
      <p>O SEMPER escreve a qualificação de cada parte com a concordância certa, para pessoa física, sociedade e empresário
        individual. Troque o gênero e veja o texto mudar.</p>
      <Escolhas rotulo="Gênero da pessoa">
        {(['f', 'm'] as const).map(v => <label key={v}>
          <input type="radio" name="genero-da-qualificacao" value={v} checked={g === v} onChange={() => setG(v)} />
          {v === 'f' ? 'Feminino' : 'Masculino'}
        </label>)}
      </Escolhas>
      <div className="pub-qual-caixa">
        <p ref={texto} className="pub-qual-texto" aria-live="polite"><span key={g} className="pub-qual-troca">{comDiferencas(g)}</span></p>
        <button type="button" className={estiloBotao({ forma: 'mini' })} onClick={copiar}>
          <Icone nome={copiada ? 'check' : 'copiar'} /> {copiada ? 'Copiada' : 'Copiar'}
        </button>
      </div>
    </div>
    <Tela nome="pessoa" className="pub-janela" alt="Cartão de uma pessoa no SEMPER, com as etiquetas, os responsáveis e a qualificação pronta para copiar" />
  </div>;
}

function DoContratoATarefa() {
  return <section id="contratos" className="pub-secao pub-cadeia" aria-labelledby="t-cadeia">
    <div className="pub-texto pub-texto-largo">
      <Titulo id="t-cadeia">Contratos, demandas e tarefas</Titulo>
      <p className="pub-frase">Do contrato assinado à tarefa do dia, sem digitar duas vezes.</p>
    </div>
    <ol className="pub-passos">
      <li>
        <h3>O contrato reúne tudo</h3>
        <p>Os clientes, os serviços contratados, a equipe e o número do contrato, com a sigla do responsável.</p>
        <Tela nome="contrato" className="pub-janela" alt="Cartão de um contrato no SEMPER, assinado, com a etiqueta, o checklist e as duas demandas que nasceram dele" />
      </li>
      <li id="demandas">
        <h3>Cada serviço vira uma demanda</h3>
        <p>Assinado o contrato, cada serviço vira uma demanda, com responsável, equipe, prazo, comentários e histórico.</p>
        <Tela nome="demandas" className="pub-janela" alt="Coluna Fazendo do quadro de Demandas do SEMPER, com três demandas, o cliente e o prazo de cada uma" />
      </li>
      <li>
        <h3>Cada demanda tem as suas tarefas</h3>
        <p>Tarefas com prazo e hora, lembrete, participantes e o cronômetro do tempo trabalhado em cada uma.</p>
        <Tela nome="tarefas" className="pub-janela" alt="Quadro de Tarefas do SEMPER, com os prazos de cada tarefa e um vencido destacado em vermelho" />
      </li>
    </ol>
  </section>;
}

function Checklists() {
  return <section id="checklists" className="pub-secao pub-checklists" aria-labelledby="t-checklists">
    <Tela nome="checklist" className="pub-janela" alt="Checklist de um pedido de registro de marca no SEMPER, com grupos e subgrupos numerados e a contagem do que já foi feito" />
    <div className="pub-texto">
      <Titulo id="t-checklists">Checklists</Titulo>
      <p className="pub-frase">O passo a passo de cada serviço, conferido item por item.</p>
      <Fatos itens={[
        ['Grupos numerados.', 'Grupos e subgrupos em 1, 1.1 e 1.1.1, com a contagem do que já foi feito.'],
        ['Modelos prontos.', 'Salve uma lista como modelo e use de novo na próxima demanda do mesmo tipo.'],
        ['Lista colada.', 'Cole uma lista inteira de uma vez; os números viram grupos.'],
        ['Onde precisa.', 'No contrato, na demanda e na tarefa.']
      ]} />
    </div>
  </section>;
}

function Processos() {
  return <section id="processos" className="pub-secao pub-faixa" aria-labelledby="t-processos">
    <div className="pub-texto pub-texto-largo">
      <Titulo id="t-processos" grande>Processos e prazos</Titulo>
      <p className="pub-frase">Os prazos contados certo, com os feriados de cada órgão.</p>
    </div>
    <div className="pub-par">
      <div>
        <Tela nome="processos" className="pub-janela" alt="Painel de Processos do SEMPER: prazos dos próximos 15 dias e as audiências e perícias marcadas" />
        <Fatos itens={[
          ['Judiciais e administrativos.', 'Inclusive os do INPI, num quadro por fase. No judicial, o número é conferido no padrão do CNJ.'],
          ['Intimação que vira tarefa.', 'E um painel com os prazos dos próximos 15 dias, as audiências e as perícias.']
        ]} />
      </div>
      <div>
        <Tela nome="calendario" className="pub-janela" alt="Calculadora de prazo do SEMPER, contando dias úteis e mostrando os feriados e fins de semana que ficaram de fora" />
        <Fatos itens={[
          ['Dias úteis ou corridos.', 'A calculadora pula feriados, recesso e suspensões e mostra os dias que ficaram de fora.'],
          ['Calendário do escritório.', 'Os feriados nacionais já vêm; o escritório acrescenta os do seu tribunal ou órgão.']
        ]} />
      </div>
    </div>
  </section>;
}

function AgendaEMensagens() {
  return <div className="pub-secao pub-dupla">
    <section id="agenda" aria-labelledby="t-agenda">
      <Titulo id="t-agenda">Agenda</Titulo>
      <p className="pub-frase">Audiências, reuniões e os prazos do dia, em ordem.</p>
      <Tela nome="agenda" className="pub-janela" alt="Agenda do SEMPER no dia de hoje: os prazos de duas tarefas, a reunião de equipe, uma perícia, uma audiência e um atendimento" />
      <p>Por dia, semana ou mês, com a agenda geral do escritório, ligada ao processo e às pessoas, com participantes e lembrete.</p>
    </section>
    <section id="mensagens" aria-labelledby="t-mensagens">
      <Titulo id="t-mensagens">Mensagens</Titulo>
      <p className="pub-frase">Um lugar só para tudo o que pede a sua atenção.</p>
      <Tela nome="mensagens" className="pub-janela" alt="Caixa de Mensagens do SEMPER, com avisos de compromisso e de prazo e a menção de uma colega num comentário" />
      <p>Quando alguém cita você com @ num comentário, quando um prazo chega, quando incluem você num item ou pedem para participar.</p>
    </section>
  </div>;
}

function Documentos() {
  return <section id="documentos" className="pub-secao pub-documentos" aria-labelledby="t-documentos">
    <div className="pub-texto pub-texto-largo">
      <Titulo id="t-documentos">Documentos</Titulo>
      <p className="pub-frase">As anotações do escritório, ligadas a quem e ao que elas se referem.</p>
    </div>
    <Tela nome="anotacao" className="pub-janela" alt="Anotação aberta no SEMPER: um roteiro de primeira reunião com títulos, caixinhas marcadas e lista numerada; ao lado, o comentário de uma colega e a anotação ligada a uma pessoa, um contrato e uma demanda" />
    <Fatos emLinha itens={[
      ['Escreva e veja.', 'Títulos, listas, caixinhas e negrito aparecem formatados enquanto você escreve, e tudo se salva sozinho.'],
      ['Pastas e etiquetas.', 'Pastas e subpastas, com arrastar, e etiquetas coloridas.'],
      ['Ligadas.', 'A anotação aparece no cartão da pessoa, do contrato, da demanda ou do processo; dela, você cria a tarefa já ligada.']
    ]} />
  </section>;
}

// ---------- o que faz diferença ----------
const RECURSOS: readonly { nome: string; texto: string; icone: NomeIcone }[] = [
  { nome: 'Desfaz com Ctrl+Z', texto: 'Arquivou ou moveu um cartão sem querer: o aviso no pé da tela tem o botão Desfazer. Excluir pede confirmação, porque é definitivo.', icone: 'voltar' },
  { nome: 'Cria já ligado', texto: 'Do cartão de um cliente, de uma demanda ou de uma anotação, crie o contrato, a tarefa ou o processo já ligado a ele.', icone: 'vinculo' },
  { nome: 'Comentários com @', texto: 'Chame alguém da equipe pelo nome no comentário; a pessoa recebe o aviso em Mensagens.', icone: 'comentario' },
  { nome: 'Histórico de alterações', texto: 'Cada cartão mostra quem mudou o quê, e quando.', icone: 'relogio' },
  { nome: 'Do jeito do escritório', texto: 'As etapas dos quadros, os modelos de checklist, os órgãos e os feriados são do seu escritório.', icone: 'configuracoes' },
  { nome: 'Só o que serve', texto: 'Cada escritório usa só os módulos de que precisa; quem não lida com processos não vê processos.', icone: 'kanban' },
  { nome: 'Seus clientes para dentro', texto: 'A lista de pessoas entra por uma planilha, conferida antes de gravar, e sai para o Google Contatos.', icone: 'subir' },
  { nome: 'Sempre melhorando', texto: 'Cada novidade aparece no botão Novidades, com onde achar, sem instalar nada.', icone: 'foguete' }
];

function Recursos() {
  return <section id="recursos" className="pub-secao pub-recursos" aria-labelledby="t-recursos">
    <div className="pub-recursos-celular">
      <Tela nome="pessoa" so="celular" soNoComputador className="pub-aparelho" alt="Cartão de uma pessoa aberto no SEMPER num celular, com as etiquetas, os responsáveis e a qualificação" />
    </div>
    <div>
      <Titulo id="t-recursos">O que faz diferença no dia a dia</Titulo>
      <p className="pub-frase">No navegador do computador e do celular, sem instalar nada, no tema claro ou escuro.</p>
      <ul className="pub-recursos-lista">
        {RECURSOS.map(r => <li key={r.nome}>
          <span className="pub-recurso-icone"><Icone nome={r.icone} tam={20} /></span>
          <div><h3>{r.nome}</h3><p>{r.texto}</p></div>
        </li>)}
      </ul>
    </div>
  </section>;
}

// ---------- segurança e LGPD ----------
/** O que o registro de ações guarda: a mesma frase em Segurança e na pergunta da LGPD. */
const REGISTRO_DE_ACOES = 'mostra quem incluiu, alterou ou excluiu cadastros, contratos, demandas, tarefas e processos, quem abriu as informações sigilosas e quem exportou ou importou dados';

function Seguranca() {
  return <section id="seguranca" className="pub-secao pub-faixa-suave" aria-labelledby="t-seguranca">
    <div className="pub-texto pub-texto-largo">
      <Titulo id="t-seguranca">Os dados do escritório, protegidos</Titulo>
      <p className="pub-frase">Os dados dos seus clientes são a parte mais importante do SEMPER.</p>
    </div>
    <div className="pub-seguranca-grade">
      <Fatos itens={[
        ['Cada escritório separado.', 'Um escritório nunca vê os dados de outro. O banco de dados fica em servidores em São Paulo.'],
        ['Acesso só por convite.', 'O administrador libera cada pessoa com um link pessoal, válido por 7 dias; desativar corta o acesso na hora.'],
        ['Verificação em duas etapas.', 'A entrada pode pedir o código de um aplicativo no celular, além da senha.'],
        ['Cada um no seu papel.', 'Os clientes são de todo o escritório; contratos, demandas, tarefas e processos aparecem para quem está neles, e os administradores veem todos. As informações sigilosas de um cliente aparecem só para quem foi liberado.'],
        ['Registro de ações.', REGISTRO_DE_ACOES[0].toUpperCase() + REGISTRO_DE_ACOES.slice(1) + '.'],
        ['LGPD.', 'Cada cadastro guarda a base legal do tratamento, e ao excluir uma pessoa o nome dela sai também do histórico.']
      ]} />
      <Tela nome="equipe" soNoComputador className="pub-janela" alt="Usuários da equipe no SEMPER, cada um com a função e o papel: master, administrador ou usuário" />
    </div>
  </section>;
}

// ---------- perguntas ----------
const PERGUNTAS: readonly (readonly [string, string])[] = [
  ['Preciso instalar alguma coisa?', 'Não. O SEMPER funciona no navegador, no computador e no celular. Cada pessoa da equipe entra com o próprio e-mail e senha.'],
  ['Serve para o meu tipo de escritório?', 'Pessoas, contratos, demandas, tarefas, checklists, documentos, agenda e mensagens servem a qualquer escritório de serviços. Processos são para quem trabalha com o Judiciário ou com órgãos como o INPI, e o módulo só aparece para quem usa. A qualificação das partes e a calculadora de prazos ficam à mão de todos.'],
  ['Quem vê os dados dos meus clientes?', 'Só a equipe do seu escritório. Cada escritório fica separado, cada pessoa da equipe tem um papel, e as informações sigilosas de um cliente aparecem só para quem você liberar.'],
  ['Onde os dados ficam guardados?', 'O banco de dados fica em servidores em São Paulo, com regras de acesso para cada escritório e para cada papel da equipe.'],
  ['Como o SEMPER ajuda com a LGPD?', `Cada cadastro guarda a base legal do tratamento, o registro de ações ${REGISTRO_DE_ACOES}, e ao excluir uma pessoa o nome dela sai também do histórico.`],
  ['Como a equipe passa a usar?', 'O administrador libera o acesso de cada pessoa com um link pessoal, válido por 7 dias. Cada um cria a própria senha e pode ligar a verificação em duas etapas.'],
  ['Dá para trazer os clientes que já tenho?', 'Sim. A lista de pessoas entra por uma planilha, com uma conferência antes de gravar. E sai num arquivo pronto para o Google Contatos, com ou sem a qualificação.'],
  ['O que ainda está por vir?', 'O portal do cliente, em que o cliente acompanha o que é dele, está em preparação. Quem já usa recebe cada novidade no mesmo endereço, sem instalar nada.'],
  ['Como conheço o SEMPER?', `Peça uma demonstração: escreva o nome do escritório no fim desta página e a conversa abre ${ONDE_ABRE}. A gente mostra o sistema funcionando.`]
];

function Perguntas() {
  return <section id="perguntas" className="pub-secao pub-perguntas" aria-labelledby="t-perguntas">
    <Titulo id="t-perguntas">Perguntas frequentes</Titulo>
    <div className="pub-respostas">
      {PERGUNTAS.map(([pergunta, resposta], i) => <details key={pergunta} name="perguntas" open={i === 0}>
        <summary><span>{pergunta}</span><Icone nome="abaixo" /></summary>
        <p>{resposta}</p>
      </details>)}
    </div>
  </section>;
}

// ---------- o pedido de demonstração: no alto (só o nome) e no fim (com o tamanho da equipe) ----------
function PedidoDeDemonstracao({ completo = false }: { completo?: boolean }) {
  const prefixo = completo ? 'pedido-fim' : 'pedido-alto';
  const [nome, setNome] = useState('');
  const [equipe, setEquipe] = useState<TamanhoDaEquipe>(TAMANHOS_DA_EQUIPE[0]);
  const [erro, setErro] = useState('');
  const campo = useRef<HTMLInputElement>(null);
  function enviar(e: FormEvent) {
    e.preventDefault();
    if (!nome.trim()) { setErro('Escreva o nome do escritório.'); campo.current?.focus(); return; }
    setErro('');
    const conversa = conversaDoPedido(CANAIS, mensagemDoPedido(nome, completo ? equipe : undefined));
    if (conversa.novaAba) window.open(conversa.endereco, '_blank', 'noopener');
    else window.open(conversa.endereco, '_self');
  }
  const para = prefixo + '-nome';
  return <form className={'pub-pedido' + (completo ? ' completo' : '')} onSubmit={enviar} noValidate {...(completo ? { 'aria-labelledby': 't-demonstracao' } : { 'aria-label': 'Pedir uma demonstração' })}>
    <div className="pub-pedido-linha">
      <Campo rotulo="Nome do escritório" para={para} obrigatorio erro={erro}>
        <input ref={campo} type="text" {...propsDoCampo(para, { erro })} value={nome} onChange={e => { setNome(e.target.value); if (erro) setErro(''); }}
          maxLength={TAMANHO_ESCRITORIO.nome} autoComplete="organization" />
      </Campo>
      {!completo && <button type="submit" className={estiloBotao({ variante: 'principal' }, 'pub-pedir')}>Pedir uma demonstração</button>}
    </div>
    {completo && <Escolhas rotulo="Tamanho da equipe">
      {TAMANHOS_DA_EQUIPE.map(v => <label key={v}>
        <input type="radio" name={prefixo + '-equipe'} value={v} checked={equipe === v} onChange={() => setEquipe(v)} />
        {v[0].toUpperCase() + v.slice(1)}
      </label>)}
    </Escolhas>}
    {completo && <button type="submit" className={estiloBotao({ variante: 'principal' }, 'pub-pedir')}>Pedir uma demonstração</button>}
    <p className="pub-pedido-nota">A conversa abre {ONDE_ABRE}, já com o nome do escritório. A gente responde e mostra o SEMPER funcionando.</p>
  </form>;
}

function Demonstracao() {
  return <section id="demonstracao" className="pub-secao pub-faixa pub-demonstracao" aria-labelledby="t-demonstracao">
    <div className="pub-demonstracao-texto">
      <Titulo id="t-demonstracao" grande>Peça uma demonstração</Titulo>
      <p className="pub-frase">Mostramos o SEMPER funcionando, com o jeito de trabalhar do seu escritório.</p>
    </div>
    <PedidoDeDemonstracao completo />
  </section>;
}

// ---------- rodapé ----------
function Rodape() {
  return <footer className="pub-rodape">
    <p className="pub-rodape-marca" aria-hidden="true">SEMPER<span className="pub-ponto">.</span></p>
    <div className="pub-rodape-links">
      <nav aria-labelledby="r-semper"><h2 id="r-semper">O SEMPER</h2>
        <a href="#modulos">Módulos</a><a href="#seguranca">Segurança</a><a href="#perguntas">Perguntas</a><a href="#demonstracao">Pedir uma demonstração</a>
      </nav>
      <nav aria-labelledby="r-acesso"><h2 id="r-acesso">Acesso</h2><Link to="/entrar/">Entrar</Link><Link to="/entrar/?primeiro-acesso">Primeiro acesso</Link></nav>
      <div><h2>Contato</h2><a href={`mailto:${MARCA.emailContato}`}>{MARCA.emailContato}</a></div>
    </div>
    <p className="pub-rodape-fim">© {new Date().getFullYear()} SEMPER · semper.app.br</p>
  </footer>;
}
