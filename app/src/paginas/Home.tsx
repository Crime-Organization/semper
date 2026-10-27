// Página inicial pública (semper.app.br): o SEMPER para escritórios que querem conhecê-lo.
// Direção visual: a pilha de pastas do escritório (design-taste-frontend, "one motif"); a ideia é a
// concordância da qualificação, que a pessoa troca no controle grande e vê reescrita pela função real do SEMPER.
// Quem chega por um link de convite ou de e-mail (?primeiro-acesso, ?token_hash, #access_token…) vai direto
// para a entrada, em /entrar/.
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent } from 'react';
import { Link, Navigate } from 'react-router';
import { MARCA } from '../marca';
import { qualificacao } from '../regras/pessoa';
import { mostrarTema, temaGuardado } from '../ui/tema';
import { useTitulo } from '../ui/util';
import imgQuadro from '../imagens/home/quadro.webp';
import imgTabela from '../imagens/home/tabela.webp';
import imgCartao from '../imagens/home/cartao.webp';
import imgEquipe from '../imagens/home/equipe.webp';
import imgCadastro from '../imagens/home/cadastro.webp';
import './Home.css';

// Parâmetros dos links do sistema (convite, e-mails, volta depois do login): esses vão para a entrada.
const DA_ENTRADA = ['primeiro-acesso', 'token_hash', 'nova-senha', 'recuperar', 'volta', 'desativado', 'cliente'];
const vaiParaEntrada = () => DA_ENTRADA.some(k => new URLSearchParams(location.search).has(k))
  || /access_token|convite=|error_description/.test(location.hash);

// Quem já entrou neste aparelho vê "Abrir o SEMPER" (a sessão fica guardada com esta chave pelo auth-js).
function temSessao() {
  try { return !!localStorage.getItem(`sb-${new URL(MARCA.supabaseUrl).hostname.split('.')[0]}-auth-token`); }
  catch { return false; }
}

function contato(texto: string) {
  if (MARCA.whatsapp) return { href: `https://wa.me/${MARCA.whatsapp}?text=${encodeURIComponent(texto)}`, rotulo: 'Falar no WhatsApp', novaAba: true };
  return { href: `mailto:${MARCA.emailContato}?subject=${encodeURIComponent('Quero conhecer o SEMPER')}&body=${encodeURIComponent(texto)}`, rotulo: 'Escrever para a gente', novaAba: false };
}
const CONTATO = contato('Olá! Quero conhecer o SEMPER para o meu escritório.');
const abaNova = (c: { novaAba: boolean }) => c.novaAba ? { target: '_blank', rel: 'noopener' } : {};

type Genero = 'f' | 'm';

export default function Home() {
  if (vaiParaEntrada()) return <Navigate to={'/entrar/' + location.search + location.hash} replace />;
  return <Pagina />;
}

function Pagina() {
  useTitulo('Gestão para escritórios de advocacia');
  useLayoutEffect(() => { mostrarTema('claro'); return () => mostrarTema(temaGuardado()); }, []);
  useEntradas();
  const [g, setG] = useState<Genero>('f');
  return <div className={'home campo-' + g}>
    <Abertura />
    <main>
      <Qualificacao g={g} setG={setG} />
      <Funciona />
      <Modulos />
      <Escritorio />
      <Perguntas />
      <Conhecer />
    </main>
    <Rodape />
  </div>;
}

// As partes de cada seção chegam na ordem de leitura ao entrar na tela, uma vez. Com movimento reduzido
// (ou sem IntersectionObserver), tudo já aparece.
function useEntradas() {
  useEffect(() => {
    const raiz = document.querySelector('.home');
    if (!raiz || matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
    raiz.querySelectorAll('main > section, footer').forEach(s =>
      s.querySelectorAll<HTMLElement>('[data-entra]').forEach((el, i) => el.style.setProperty('--d', Math.min(i, 6) * 80 + 'ms')));
    raiz.classList.add('com-entradas');
    const obs = new IntersectionObserver(itens => {
      for (const i of itens) if (i.isIntersecting) { i.target.classList.add('entrou'); obs.unobserve(i.target); }
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    raiz.querySelectorAll('[data-entra]').forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);
}

// ---------- abertura: o nome e a pilha de pastas ----------
const PASTAS = [
  { id: 'perguntas', nome: 'Perguntas' },
  { id: 'escritorio', nome: 'O escritório' },
  { id: 'modulos', nome: 'Módulos' },
  { id: 'funciona', nome: 'O que já funciona' }
];

function Abertura() {
  const logado = temSessao();
  return <header className="h-abertura">
    <div className="h-topo">
      <h1><span>SEMPER<b className="h-ponto">.</b></span></h1>
      <Link className="h-entrar" to={logado ? '/inicio/' : '/entrar/'}>{logado ? 'Abrir o SEMPER' : 'Entrar'}</Link>
    </div>
    <p className="h-frase">Gestão para escritórios de advocacia: clientes, atendimento e equipe num só lugar, com a qualificação de cada parte pronta para a petição.</p>
    <nav className="h-pastas" aria-label="Seções da página">
      {PASTAS.map((p, i) => <a key={p.id} href={'#' + p.id} className={'h-pasta p' + (i + 1)} style={{ '--i': i } as CSSProperties}>
        <span className="h-aba">{p.nome}</span>
      </a>)}
      <div className="h-pasta h-frente" style={{ '--i': PASTAS.length } as CSSProperties}>
        <a className="h-aba" href="#qualificacao">Qualificação</a>
        <div className="h-frente-acoes">
          <a className="h-botao h-botao-claro" href={CONTATO.href} {...abaNova(CONTATO)}>{CONTATO.rotulo}</a>
          <a className="h-ver" href="#qualificacao">Ver como funciona</a>
        </div>
      </div>
    </nav>
  </header>;
}

// ---------- qualificação: o controle grande ----------
const NOMES = { f: 'Maria da Silva Exemplo', m: 'João da Silva Exemplo' };
const BASE = {
  tipo: 'pf' as const, nacionalidade: 'brasileira', profissao: 'professor(a)', estado_civil: 'casado',
  documento: '52998224725', logradouro: 'Rua das Flores', numero: '10', bairro: 'Centro',
  municipio: 'Montes Claros', uf: 'MG', cep: '39400121'
};
const texto = (g: Genero) => qualificacao({ ...BASE, nome: NOMES[g], genero: g });

// Marca as palavras que mudaram com o gênero (os dois textos têm o mesmo número de palavras).
function comDiferencas(g: Genero) {
  const a = texto(g).split(/([\s,]+)/), b = texto(g === 'f' ? 'm' : 'f').split(/([\s,]+)/);
  if (a.length !== b.length) return a.join('');
  return a.map((p, i) => p !== b[i] ? <mark key={i}>{p}</mark> : p);
}

function Qualificacao({ g, setG }: { g: Genero; setG: (g: Genero) => void }) {
  const [copiada, setCopiada] = useState(false);
  useEffect(() => { if (!copiada) return; const t = setTimeout(() => setCopiada(false), 2000); return () => clearTimeout(t); }, [copiada]);
  const copiar = () => navigator.clipboard?.writeText(texto(g)).then(() => setCopiada(true), () => {});
  const setas = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    const novo = g === 'f' ? 'm' : 'f';
    setG(novo);
    e.currentTarget.querySelector<HTMLElement>(`[data-g="${novo}"]`)?.focus();
  };
  return <section id="qualificacao" className="h-qual" aria-labelledby="t-qual">
    <div className="h-qual-texto">
      <h2 id="t-qual" className="h-l" data-entra>{g === 'f' ? 'Inscrita' : 'Inscrito'} no CPF.</h2>
      <p data-entra>O SEMPER escreve a qualificação de cada parte no padrão das petições, com a concordância certa para pessoa física, sociedade e empresário individual. Troque o gênero e veja o texto mudar.</p>
    </div>
    <div className="h-genero" data-ui data-g={g} role="radiogroup" aria-label="Gênero da pessoa" onKeyDown={setas} data-entra>
      {(['f', 'm'] as Genero[]).map(v => <button key={v} type="button" role="radio" data-g={v} aria-checked={g === v}
        tabIndex={g === v ? 0 : -1} onClick={() => setG(v)}>{v === 'f' ? 'Feminino' : 'Masculino'}</button>)}
    </div>
    <div className="h-qual-caixa" data-ui data-entra>
      <div className="h-qual-cabeca">
        <h3>Qualificação</h3>
        <button type="button" className="h-mini" onClick={copiar}>{copiada ? 'Copiada' : 'Copiar'}</button>
      </div>
      <p key={g} className="h-qual-gerada" aria-live="polite">{comDiferencas(g)}</p>
    </div>
    <figure className="h-qual-foto" data-entra="foto">
      <img src={imgCartao} alt="Cartão de uma pessoa no SEMPER, com os dados do cadastro e a qualificação pronta para copiar" width={1440} height={900} loading="lazy" />
      <figcaption>No SEMPER, a qualificação fica no cartão de cada pessoa, pronta para copiar para a peça.</figcaption>
    </figure>
  </section>;
}

// ---------- o que já funciona: frases com chave ----------
const CAPACIDADES = [
  { frase: 'Preenche o cadastro pelo CNPJ e pelo CEP.', efeito: 'Razão social, nome fantasia, porte, sócios e endereço vêm da Receita Federal; o CEP completa rua, bairro e cidade.', ligada: true,
    img: imgCadastro, alt: 'Cadastro de pessoa do SEMPER, com a escolha entre pessoa física, pessoa jurídica ou somente contato' },
  { frase: 'Avisa quando o cliente já está cadastrado.', efeito: 'Confere o CPF ou o CNPJ e os telefones, até o celular antigo sem o 9, antes de você salvar um cadastro repetido.', ligada: false },
  { frase: 'Organiza o atendimento em 18 etapas.', efeito: 'Do primeiro contato à pesquisa de satisfação, num quadro em que os cartões se arrastam de uma etapa para outra.', ligada: true,
    img: imgQuadro, alt: 'Quadro de atendimento do SEMPER, com as colunas das etapas e os cartões dos clientes' },
  { frase: 'Liga as pessoas que se relacionam.', efeito: 'São 11 tipos de vínculo, como cônjuge, sócio e representante legal; o representante entra sozinho na qualificação da empresa.', ligada: false },
  { frase: 'Desfaz qualquer ação com Ctrl+Z.', efeito: 'Arquivou, moveu ou excluiu sem querer: a ação volta como estava, mesmo depois de trocar de tela.', ligada: false }
];

function Funciona() {
  const [ligadas, setLigadas] = useState(() => CAPACIDADES.map(c => c.ligada));
  return <section id="funciona" className="h-funciona" aria-labelledby="t-funciona">
    <h2 id="t-funciona" className="h-l" data-entra>O que já funciona.</h2>
    <ul>
      {CAPACIDADES.map((c, i) => {
        const on = ligadas[i];
        return <li key={c.frase} className={'h-faixa f' + (i + 1) + (on ? ' ligada' : '')} data-entra>
          <h3 className="h-faixa-frase">{c.frase}</h3>
          <button type="button" role="switch" aria-checked={on} aria-label={c.frase} className="h-chave"
            onClick={() => setLigadas(l => l.map((x, j) => j === i ? !x : x))}><span /></button>
          {on && <div className="h-faixa-mais">
            <p>{c.efeito}</p>
            {c.img && <img src={c.img} alt={c.alt} width={1440} height={900} loading="lazy" />}
          </div>}
        </li>;
      })}
    </ul>
  </section>;
}

// ---------- módulos: um por linha, com a tela ao lado ----------
const MODULOS = [
  { nome: 'Pessoas', pronto: true, texto: 'Clientes, partes e contatos, em quadro ou em tabela, com busca, filtros e a qualificação pronta.',
    img: imgTabela, alt: 'Tela Pessoas do SEMPER: a lista de clientes com telefone, município, etapa e responsáveis' },
  { nome: 'Atendimento', pronto: true, texto: 'As 18 etapas do atendimento, do primeiro contato à pesquisa de satisfação, num quadro só.',
    img: imgQuadro, alt: 'Quadro de atendimento do SEMPER, com as colunas das etapas' },
  { nome: 'Equipe', pronto: true, texto: 'Os acessos de cada pessoa, os papéis e o registro de ações do escritório.',
    img: imgEquipe, alt: 'Tela Equipe e acessos do SEMPER, com usuários, papéis, convites e o registro de ações' },
  { nome: 'Contratos', pronto: false, texto: 'O centro de tudo: cada contrato reúne as partes, as demandas e os documentos.' },
  { nome: 'Demandas', pronto: false, texto: 'Os objetos de cada contrato, com as tarefas e um quadro de etapas.' },
  { nome: 'Agenda', pronto: false, texto: 'Os compromissos e os prazos da equipe.' },
  { nome: 'Processos', pronto: false, texto: 'Os processos de cada cliente, com prazos e andamentos.' },
  { nome: 'Financeiro', pronto: false, texto: 'Honorários, recebimentos e cobranças de cada contrato.' },
  { nome: 'Portal do cliente', pronto: false, texto: 'O cliente acompanha as próprias demandas, quando o advogado liberar.' }
];

function Modulos() {
  const [atual, setAtual] = useState(0);
  const [apontando, setApontando] = useState(false);
  const raiz = useRef<HTMLDivElement>(null), quadro = useRef<HTMLDivElement>(null);
  // A tela fica na altura da linha apontada e acompanha a linha, nunca o ponteiro; começa na primeira.
  function mostrar(i: number, linha: HTMLElement) {
    const r = raiz.current, q = quadro.current;
    if (!r || !q || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const y = Math.min(r.offsetHeight - q.offsetHeight, Math.max(0, linha.offsetTop + linha.offsetHeight / 2 - q.offsetHeight / 2));
    q.style.transform = `translateY(${y}px)`;
    setAtual(i);
    setApontando(true);
  }
  return <section id="modulos" className="h-modulos" aria-labelledby="t-modulos">
    <h2 id="t-modulos" className="h-l" data-entra>Os módulos.</h2>
    <div className="h-indice" ref={raiz} onPointerLeave={() => setApontando(false)}>
      <ul className={apontando ? 'apontando' : ''}>
        {MODULOS.map((m, i) => <li key={m.nome} className={'h-linha' + (m.pronto ? ' pronto' : '') + (atual === i ? ' atual' : '')}
          onPointerEnter={e => mostrar(i, e.currentTarget)} data-entra>
          {m.img && <img className="h-linha-foto" src={m.img} alt={m.alt} width={1440} height={900} loading="lazy" />}
          <h3 className="h-linha-nome">{m.nome}</h3>
          <p className="h-linha-texto"><b>{m.pronto ? 'Já funciona.' : 'Em breve.'}</b> {m.texto}</p>
        </li>)}
      </ul>
      <div ref={quadro} className={'h-quadro' + (MODULOS[atual].img ? '' : ' sem-foto')} aria-hidden="true">
        {MODULOS.map((m, i) => m.img
          ? <img key={m.nome} src={m.img} alt="" width={1440} height={900} loading="lazy" className={atual === i ? 'visivel' : ''} />
          : <span key={m.nome} className={'h-quadro-nome' + (atual === i ? ' visivel' : '')}>{m.nome}<b className="h-ponto">.</b></span>)}
      </div>
    </div>
  </section>;
}

// ---------- o escritório: painel escuro com o farol ----------
function Escritorio() {
  return <section id="escritorio" className="h-escritorio" aria-labelledby="t-escritorio">
    <div className="h-painel">
      <div className="h-painel-texto">
        <h2 id="t-escritorio" className="h-l" data-entra>Feito dentro de um escritório.</h2>
        <div className="h-painel-bloco" data-entra>
          <h3 className="h-m">Nasceu na Braga Ferreira</h3>
          <p>O SEMPER foi criado no dia a dia da Braga Ferreira, um escritório de advocacia em {MARCA.cidade}, a partir do cadastro dos clientes, do atendimento e das peças que saem dele. Hoje é um sistema próprio, feito para qualquer escritório.</p>
        </div>
        <div className="h-painel-bloco" data-entra>
          <h3 className="h-m">Os dados ficam protegidos</h3>
          <p>Cada escritório vê só os próprios dados, guardados em servidores em São Paulo. A entrada pode pedir o código do celular, e o registro de ações mostra quem incluiu, alterou, leu ou exportou cada informação.</p>
        </div>
        <a className="h-botao" href={CONTATO.href} {...abaNova(CONTATO)} data-entra>{CONTATO.rotulo}</a>
      </div>
      <figure className="h-farol" data-entra="foto">
        <img src={MARCA.fotoEntrada} alt="Farol em preto e branco, a imagem da marca SEMPER" width={1600} height={1066} loading="lazy" />
      </figure>
    </div>
  </section>;
}

// ---------- perguntas ----------
const PERGUNTAS = [
  ['Preciso instalar alguma coisa?', 'Não. O SEMPER funciona no navegador, no computador e no celular. Cada pessoa da equipe entra com o próprio e-mail e senha.'],
  ['Quem vê os dados dos meus clientes?', 'Só a equipe do seu escritório. Cada escritório fica isolado no banco de dados, cada pessoa da equipe tem um papel, e as informações sigilosas de um cliente aparecem só para quem você liberar.'],
  ['Onde os dados ficam guardados?', 'Em servidores no Brasil, em São Paulo, num banco de dados com regras de acesso para cada escritório e para cada papel da equipe.'],
  ['Como o SEMPER ajuda com a LGPD?', 'Cada cadastro guarda a base legal do tratamento, o registro de ações mostra quem incluiu, alterou, leu ou exportou dados, e ao excluir uma pessoa o nome dela sai também do histórico.'],
  ['Como a equipe passa a usar?', 'O administrador libera o acesso de cada pessoa com um link pessoal, válido por 7 dias. Cada um cria a própria senha e pode ativar a verificação em duas etapas com um aplicativo no celular.'],
  ['Dá para levar os clientes para o celular?', 'Sim. A lista de clientes sai num arquivo pronto para o Google Contatos, com ou sem a qualificação na descrição, e cada exportação fica registrada.'],
  ['E os módulos que ainda não estão prontos?', 'Contratos, demandas, agenda, processos, financeiro e o portal do cliente estão em construção. Quem já usa recebe cada um no mesmo endereço, sem instalar nada.'],
  ['Quanto custa?', `Fale com a gente${MARCA.whatsapp ? ' pelo WhatsApp' : ''}: explicamos como funciona a contratação para o tamanho do seu escritório.`]
];

function Perguntas() {
  return <section id="perguntas" className="h-perguntas" aria-labelledby="t-perguntas">
    <h2 id="t-perguntas" className="h-l" data-entra>Perguntas frequentes.</h2>
    <div className="h-respostas">
      {PERGUNTAS.map(([q, r], i) => <details key={q} name="perguntas" open={i === 0} data-entra>
        <summary><span>{q}</span><i aria-hidden="true" /></summary>
        <p>{r}</p>
      </details>)}
    </div>
  </section>;
}

// ---------- conhecer: o primeiro passo, já aberto ----------
const EQUIPES = ['até 5 pessoas', 'mais de 5 pessoas'];

function Conhecer() {
  const [nome, setNome] = useState('');
  const [equipe, setEquipe] = useState(EQUIPES[0]);
  const campo = useRef<HTMLInputElement>(null);
  function enviar(e: FormEvent) {
    e.preventDefault();
    const n = nome.trim();
    if (!n) { campo.current?.focus(); return; }
    const c = contato(`Olá! Quero conhecer o SEMPER para o escritório ${n} (equipe de ${equipe}).`);
    if (c.novaAba) window.open(c.href, '_blank', 'noopener'); else location.href = c.href;
  }
  return <section id="conhecer" className="h-conhecer" aria-labelledby="t-conhecer">
    <div className="h-conhecer-texto">
      <h2 id="t-conhecer" className="h-l" data-entra>Conheça o SEMPER.</h2>
      <p data-entra>Escreva o nome do escritório e a conversa abre {MARCA.whatsapp ? 'no WhatsApp' : 'no seu e-mail'} já com essas informações. A gente responde e mostra o sistema funcionando.</p>
    </div>
    <form className="h-dialogo" data-ui onSubmit={enviar} data-entra>
      <h3>Conhecer o SEMPER</h3>
      <label>Nome do escritório
        <input ref={campo} value={nome} onChange={e => setNome(e.target.value)} maxLength={120} required placeholder="Silva & Souza Advogados" autoComplete="organization" />
      </label>
      <fieldset>
        <legend>Tamanho da equipe</legend>
        <div className="h-escolha">
          {EQUIPES.map(v => <label key={v}>
            <input type="radio" name="equipe" value={v} checked={equipe === v} onChange={() => setEquipe(v)} />
            <span>{v[0].toUpperCase() + v.slice(1)}</span>
          </label>)}
        </div>
      </fieldset>
      <button type="submit" className="h-botao h-botao-escuro">{CONTATO.rotulo}</button>
    </form>
  </section>;
}

// ---------- rodapé: a marca construída em blocos, como abas de pasta ----------
// Desenho em unidades do viewBox (1300 x 360): seis blocos de letra e um mais estreito para o ponto.
const BLOCOS = [['S', 1], ['E', .74], ['M', .9], ['P', .62], ['E', .84], ['R', .7], ['.', .4]] as const;
const B_ALT = 360, B_VAO = 12, B_LARG = (1300 - 6 * B_VAO) / 6.55;

function Rodape() {
  let x = 0;
  return <footer className="h-rodape">
    <svg className="h-blocos" viewBox={`0 0 1300 ${B_ALT}`} role="img" aria-label="SEMPER">
      {BLOCOS.map(([l, alt], i) => {
        const larg = l === '.' ? B_LARG * .55 : B_LARG, h = B_ALT * alt, x0 = x;
        x += larg + B_VAO;
        return <g key={i} className={'b' + (i + 1)} data-entra>
          <rect x={x0} y={B_ALT - h} width={larg} height={h + 24} rx={16} />
          <text x={x0 + 18} y={B_ALT - 18}>{l}</text>
        </g>;
      })}
    </svg>
    <div className="h-rodape-links">
      <nav aria-labelledby="r-semper"><h2 id="r-semper">O SEMPER</h2><a href="#qualificacao">Qualificação</a><a href="#funciona">O que já funciona</a><a href="#modulos">Módulos</a><a href="#perguntas">Perguntas</a></nav>
      <nav aria-labelledby="r-acesso"><h2 id="r-acesso">Acesso</h2><Link to="/entrar/">Entrar</Link><Link to="/entrar/?primeiro-acesso">Primeiro acesso</Link></nav>
      <nav aria-labelledby="r-contato"><h2 id="r-contato">Contato</h2><a href={CONTATO.href} {...abaNova(CONTATO)}>{MARCA.whatsapp ? 'WhatsApp' : MARCA.emailContato}</a></nav>
      <div className="h-rodape-lugar"><h2>Onde</h2><p>{MARCA.cidade}</p><p>semper.app.br</p></div>
    </div>
    <div className="h-rodape-fim">
      <p>© {new Date().getFullYear()} SEMPER</p>
      <Link className="h-botao h-botao-pequeno" to="/entrar/">Entrar</Link>
    </div>
  </footer>;
}
