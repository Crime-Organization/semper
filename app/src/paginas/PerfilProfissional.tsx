// Perfil profissional de alguém da equipe: a base das páginas da equipe no site do escritório (o CMS), do currículo e
// da importação do Lattes. Aparece em "Minha conta" (o próprio) e, para administradores, em Equipe (o de qualquer um).
// "Aparecer no site" e a ordem na página da equipe, só administradores mudam.
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { SD, type CamposDoPerfil } from '../dados';
import { LINHAS_DO_PERFIL, ORDEM_NO_SITE_MAXIMA, TAMANHO_PERFIL } from '../dados/limites';
import { camposDoPerfil, errosDoPerfil, limparPerfil, type ErrosDoPerfil } from '../regras/perfilProfissional';
import { UFS } from '../regras/pessoa';
import { falha, feito } from '../ui/avisos';
import { Aviso, Carregando, estiloBotao, naGrade, Nota, type TamanhoNaGrade } from '../ui/base';
import { LinhasRepetidas } from '../ui/base/LinhasRepetidas';
import { dataHora } from '../ui/util';

/** Campos de texto simples do perfil (os outros são listas ou do site). */
type CampoDeTexto = 'nome_exibicao' | 'cargo' | 'bio_curta' | 'biografia' | 'lattes' | 'email_publico' | 'telefone_publico' | 'linkedin';
/** Listas de textos simples, uma linha por texto. */
type ListaDeTextos = 'areas' | 'idiomas' | 'associacoes';
/** Como cada lista de textos aparece: o rótulo, o nome de cada linha e o artigo dele. */
const LISTAS_DE_TEXTOS: Record<ListaDeTextos, { rotulo: string; item: string; artigo: 'a' | 'o' }> = {
  areas: { rotulo: 'Áreas de atuação', item: 'área', artigo: 'a' },
  idiomas: { rotulo: 'Idiomas', item: 'idioma', artigo: 'o' },
  associacoes: { rotulo: 'Associações', item: 'associação', artigo: 'a' }
};

interface Props {
  perfilId: string;
  /** Nome do cadastro, que vai ao site quando o nome de exibição fica vazio. */
  nome: string;
  /** Administrador: pode ligar "aparecer no site" e mudar a ordem. */
  podePublicar: boolean;
}

export function FormularioDoPerfil({ perfilId, nome, podePublicar }: Props) {
  const [campos, setCampos] = useState<CamposDoPerfil | string | null>(null);
  const [atualizado, setAtualizado] = useState<string | null>(null);
  const [erros, setErros] = useState<ErrosDoPerfil>({});
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    setCampos(null);
    SD.perfilProfissional(perfilId)
      .then(p => { setCampos(camposDoPerfil(p)); setAtualizado(p.atualizado_em); })
      .catch(e => setCampos((e as Error).message));
  }, [perfilId]);

  if (campos === null) return <Carregando />;
  if (typeof campos === 'string') return <Aviso tipo="erro">{campos}</Aviso>;
  const c = campos;
  const mudar = <K extends keyof CamposDoPerfil>(campo: K, valor: CamposDoPerfil[K]) => {
    setCampos({ ...c, [campo]: valor });
    if (erros[campo]) setErros(({ [campo]: _resolvido, ...resto }) => resto);
  };

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const achados = errosDoPerfil(c);
    setErros(achados);
    const [primeiro] = Object.values(achados);
    if (primeiro) return falha(new Error(primeiro));
    const limpo = limparPerfil(c), antes = camposDoPerfil(await SD.perfilProfissional(perfilId));
    setOcupado(true);
    try {
      await SD.perfilProfissionalSalvar(perfilId, limpo);
      setCampos(limpo); setAtualizado(new Date().toISOString());
      feito('Perfil profissional salvo.', 'alteração do perfil profissional', async () => {
        await SD.perfilProfissionalSalvar(perfilId, antes);
        setCampos(antes);
      });
    } catch (err) { falha(err); }
    setOcupado(false);
  }

  // Cada campo diz quantas das 12 colunas ocupa (veja .grade-form em estilo.css), como em Configurações.
  const texto = (campo: CampoDeTexto, rotulo: string, maximo: number, opcoes: { dica?: string; tam?: TamanhoNaGrade; longo?: boolean; tipo?: string } = {}) => {
    const id = 'perfil-' + campo, erro = erros[campo];
    const props = {
      id, value: c[campo], maxLength: maximo, 'aria-invalid': !!erro, 'aria-describedby': erro ? id + '-erro' : undefined,
      onChange: (e: { target: { value: string } }) => mudar(campo, e.target.value)
    };
    return <div className={'campo-form' + (erro ? ' com-erro' : '')} style={naGrade(opcoes.tam)}>
      <label htmlFor={id}>{rotulo}{opcoes.dica && <small> {opcoes.dica}</small>}</label>
      {opcoes.longo ? <textarea rows={maximo > TAMANHO_PERFIL.bio_curta ? 8 : 3} {...props} /> : <input type={opcoes.tipo ?? 'text'} {...props} />}
      {erro && <span className="erro-campo" id={id + '-erro'}>{erro}</span>}
    </div>;
  };
  const textos = (campo: ListaDeTextos, dica?: ReactNode) => {
    const { rotulo, item, artigo } = LISTAS_DE_TEXTOS[campo];
    return <LinhasRepetidas rotulo={rotulo} dica={dica} erro={erros[campo]} item={item} artigo={artigo} maximo={LINHAS_DO_PERFIL}
      linhas={c[campo].map(t => ({ texto: t }))} nova={{ texto: '' }} colunas={[{ campo: 'texto', rotulo, maximo: TAMANHO_PERFIL.item }]}
      aoMudar={l => mudar(campo, l.map(x => x.texto))} />;
  };

  return <form className="config campos perfil-profissional" noValidate onSubmit={salvar}>
    <section className="cartao form-grade" aria-labelledby="tPerfApres">
      <h3 className="perfil-bloco" id="tPerfApres">Apresentação</h3>
      <div className="grade-form">
        {texto('nome_exibicao', 'Nome de exibição', TAMANHO_PERFIL.nome_exibicao, { dica: `vazio: vai "${nome}"`, tam: { m: 6 } })}
        {texto('cargo', 'Cargo no escritório', TAMANHO_PERFIL.cargo, { dica: 'ex.: sócio, advogada associada', tam: { m: 6 } })}
        {texto('bio_curta', 'Bio curta', TAMANHO_PERFIL.bio_curta, { dica: '2 ou 3 linhas, para a lista da equipe', longo: true })}
        {texto('biografia', 'Biografia completa', TAMANHO_PERFIL.biografia, { dica: 'para a página do advogado', longo: true })}
      </div>
    </section>

    <section className="cartao form-grade" aria-labelledby="tPerfOab">
      <h3 className="perfil-bloco" id="tPerfOab">OAB e áreas de atuação</h3>
      <div className="grade-form">
        <LinhasRepetidas rotulo="Inscrições na OAB" erro={erros.oab} item="inscrição" artigo="a" maximo={LINHAS_DO_PERFIL}
          linhas={c.oab} nova={{ numero: '', uf: '' }} aoMudar={l => mudar('oab', l)}
          colunas={[{ campo: 'numero', rotulo: 'Número', maximo: TAMANHO_PERFIL.item, tamanho: { p: 8, m: 9 } },
            { campo: 'uf', rotulo: 'UF', maximo: 2, opcoes: UFS, tamanho: { p: 4, m: 3 } }]} />
        {textos('areas', 'Uma por linha (ex.: Propriedade intelectual).')}
      </div>
    </section>

    <section className="cartao form-grade" aria-labelledby="tPerfForm">
      <h3 className="perfil-bloco" id="tPerfForm">Formação e experiência</h3>
      <div className="grade-form">
        <LinhasRepetidas rotulo="Formação" erro={erros.formacao} item="formação" artigo="a" maximo={LINHAS_DO_PERFIL}
          linhas={c.formacao} nova={{ curso: '', instituicao: '', ano: '' }} aoMudar={l => mudar('formacao', l)}
          colunas={[{ campo: 'curso', rotulo: 'Curso', maximo: TAMANHO_PERFIL.item, tamanho: { m: 5 } },
            { campo: 'instituicao', rotulo: 'Instituição', maximo: TAMANHO_PERFIL.item, tamanho: { p: 8, m: 5 } },
            { campo: 'ano', rotulo: 'Ano', maximo: TAMANHO_PERFIL.item, tamanho: { p: 4, m: 2 } }]} />
        <LinhasRepetidas rotulo="Experiência" erro={erros.experiencia} item="experiência" artigo="a" maximo={LINHAS_DO_PERFIL}
          linhas={c.experiencia} nova={{ cargo: '', lugar: '', periodo: '' }} aoMudar={l => mudar('experiencia', l)}
          colunas={[{ campo: 'cargo', rotulo: 'Cargo', maximo: TAMANHO_PERFIL.item, tamanho: { m: 5 } },
            { campo: 'lugar', rotulo: 'Onde', maximo: TAMANHO_PERFIL.item, tamanho: { p: 7, m: 4 } },
            { campo: 'periodo', rotulo: 'Período', maximo: TAMANHO_PERFIL.item, tamanho: { p: 5, m: 3 } }]} />
        {textos('idiomas')}
        {textos('associacoes')}
      </div>
    </section>

    <section className="cartao form-grade" aria-labelledby="tPerfPub">
      <h3 className="perfil-bloco" id="tPerfPub">Publicações e Lattes</h3>
      <div className="grade-form">
        <LinhasRepetidas rotulo="Publicações" erro={erros.publicacoes} item="publicação" artigo="a" maximo={LINHAS_DO_PERFIL}
          linhas={c.publicacoes} nova={{ titulo: '', onde: '', ano: '', link: '' }} aoMudar={l => mudar('publicacoes', l)}
          colunas={[{ campo: 'titulo', rotulo: 'Título', maximo: TAMANHO_PERFIL.item, tamanho: { g: 4 } },
            { campo: 'onde', rotulo: 'Onde saiu', maximo: TAMANHO_PERFIL.item, tamanho: { p: 8, g: 3 } },
            { campo: 'ano', rotulo: 'Ano', maximo: TAMANHO_PERFIL.item, tamanho: { p: 4, g: 1 } },
            { campo: 'link', rotulo: 'Link', maximo: TAMANHO_PERFIL.link, tipo: 'url', tamanho: { g: 4 } }]} />
        {texto('lattes', 'Currículo Lattes', TAMANHO_PERFIL.link, { dica: 'o link, ex.: http://lattes.cnpq.br/1234567890', tipo: 'url' })}
      </div>
    </section>

    <section className="cartao form-grade" aria-labelledby="tPerfCont">
      <h3 className="perfil-bloco" id="tPerfCont">Contatos públicos</h3>
      <Nota>Aparecem no site. Use os contatos de trabalho, não os pessoais.</Nota>
      <div className="grade-form">
        {texto('email_publico', 'E-mail profissional', TAMANHO_PERFIL.email, { tipo: 'email', tam: { m: 6 } })}
        {texto('telefone_publico', 'Telefone profissional', TAMANHO_PERFIL.telefone, { tipo: 'tel', tam: { m: 6 } })}
        {texto('linkedin', 'LinkedIn', TAMANHO_PERFIL.link, { tipo: 'url' })}
        <LinhasRepetidas rotulo="Outras redes" erro={erros.redes} item="rede" artigo="a" maximo={LINHAS_DO_PERFIL}
          linhas={c.redes} nova={{ nome: '', link: '' }} aoMudar={l => mudar('redes', l)}
          colunas={[{ campo: 'nome', rotulo: 'Rede', maximo: TAMANHO_PERFIL.item, tamanho: { m: 4 } },
            { campo: 'link', rotulo: 'Link', maximo: TAMANHO_PERFIL.link, tipo: 'url', tamanho: { m: 8 } }]} />
      </div>
    </section>

    <section className="cartao form-grade" aria-labelledby="tPerfSite">
      <h3 className="perfil-bloco" id="tPerfSite">No site</h3>
      <Nota>{podePublicar ? 'Ligado, o perfil entra na página da equipe do site, na ordem indicada (o menor número vem primeiro).'
        : 'Só administradores decidem quem aparece no site e em que ordem.'}</Nota>
      <div className="grade-form">
        <label className="perfil-no-site" style={naGrade({ m: 8 })}>
          <input type="checkbox" checked={c.no_site} disabled={!podePublicar} onChange={e => mudar('no_site', e.target.checked)} />
          Aparecer no site
        </label>
        <div className={'campo-form' + (erros.ordem_no_site ? ' com-erro' : '')} style={naGrade({ m: 4 })}>
          <label htmlFor="perfil-ordem">Ordem na página da equipe</label>
          <input id="perfil-ordem" type="number" min={0} max={ORDEM_NO_SITE_MAXIMA} disabled={!podePublicar} value={c.ordem_no_site ?? ''}
            aria-invalid={!!erros.ordem_no_site} onChange={e => mudar('ordem_no_site', e.target.value === '' ? null : Number(e.target.value))} />
          {erros.ordem_no_site && <span className="erro-campo">{erros.ordem_no_site}</span>}
        </div>
      </div>
    </section>

    <div className="config-salvar">
      {atualizado && <Nota>Salvo pela última vez em {dataHora(atualizado)}.</Nota>}
      <button className={estiloBotao({ variante: 'principal' })} type="submit" disabled={ocupado}>{ocupado ? 'Salvando…' : 'Salvar perfil'}</button>
    </div>
  </form>;
}
