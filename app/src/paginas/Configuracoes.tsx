// Configurações (master e administradores): os dados da instituição. O nome aparece nas telas do
// escritório (barra lateral, mensagem de convite); a logomarca e os demais dados ficam prontos para
// contratos e procurações. O SEMPER não tem nome de escritório fixo: tudo vem daqui.
import { useRef, useState, type ChangeEvent, type FormEvent, type InputHTMLAttributes, type ReactNode, type Ref } from 'react';
import { Navigate } from 'react-router';
import { SD, type DadosEscritorio } from '../dados';
import { cnpjValido, dig, emailValido, fmtCEP, fmtCNPJ, limparDocumento, MASCARAS, nomeProprio, UFS } from '../regras/pessoa';
import { consultarCEP, consultarCNPJ } from '../dados/consultas';
import { TAMANHO_ESCRITORIO } from '../dados/limites';
import { avisar, falha, feito } from '../ui/avisos';
import { estiloBotao, naGrade, Nota, TituloSecao, type TamanhoNaGrade } from '../ui/base';
import { useSessao } from '../ui/sessao';
import { useTitulo } from '../ui/util';
import { LigacaoGoogle } from './LigacaoGoogle';
import './Configuracoes.css';

export default function Configuracoes() {
  useTitulo('Configurações');
  const { ctx } = useSessao();
  if (!ctx.ehAdmin) return <Navigate to="/inicio/" replace />;
  return <Instituicao />;
}

type Campo = Exclude<keyof DadosEscritorio, 'logo'>;
type Form = Record<Campo, string>;
const CAMPOS: Campo[] = ['nome', 'cnpj', 'oab_registro', 'cep', 'logradouro', 'numero', 'complemento', 'bairro', 'municipio', 'uf', 'telefone', 'email', 'site'];

// Para a tela, os números saem formatados; ao salvar, voltam a ser só números.
function paraForm(e: Partial<DadosEscritorio> | null | undefined): Form {
  const f = Object.fromEntries(CAMPOS.map(c => [c, e?.[c] ?? ''])) as Form;
  return { ...f, cnpj: fmtCNPJ(f.cnpj), cep: fmtCEP(f.cep), telefone: f.telefone ? MASCARAS.telefone(f.telefone) : '' };
}
function paraSalvar(f: Form): Omit<DadosEscritorio, 'logo'> {
  const t = (v: string) => v.trim() || null;
  const site = f.site.trim();
  return {
    nome: f.nome.trim(), cnpj: limparDocumento(f.cnpj) || null, oab_registro: t(f.oab_registro), cep: dig(f.cep) || null,
    logradouro: t(f.logradouro), numero: t(f.numero), complemento: t(f.complemento), bairro: t(f.bairro), municipio: t(f.municipio),
    uf: f.uf || null, telefone: dig(f.telefone) || null, email: f.email.trim().toLowerCase() || null,
    site: site ? (/^https?:\/\//i.test(site) ? site : 'https://' + site) : null
  };
}

// A logomarca vira uma imagem pequena (até 800 x 320) guardada junto com os dados do escritório.
// Redesenhar no canvas também tira de um SVG qualquer coisa que não seja desenho.
async function prepararLogo(arquivo: File): Promise<string> {
  if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(arquivo.type)) throw new Error('Use uma imagem PNG, JPG, WebP ou SVG.');
  if (arquivo.size > 5 * 1024 * 1024) throw new Error('A imagem tem mais de 5 MB. Use um arquivo menor.');
  const url = URL.createObjectURL(arquivo);
  try {
    const img = new Image();
    await new Promise<void>((ok, erro) => {
      img.onload = () => ok();
      img.onerror = () => erro(new Error('Não foi possível abrir essa imagem.'));
      img.src = url;
    });
    const w0 = img.naturalWidth || 600, h0 = img.naturalHeight || 200;
    const escala = Math.min(1, 800 / w0, 320 / h0);
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w0 * escala)); c.height = Math.max(1, Math.round(h0 * escala));
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    let dados = c.toDataURL('image/webp', 0.92);
    if (!dados.startsWith('data:image/webp')) dados = c.toDataURL('image/png');
    if (dados.length > 400000) throw new Error('A logomarca ficou grande demais. Use uma imagem mais simples ou menor.');
    return dados;
  } finally { URL.revokeObjectURL(url); }
}

function Instituicao() {
  const { ctx, recarregar } = useSessao();
  const esc = ctx.escritorio;
  const [f, setF] = useState<Form>(() => paraForm(esc));
  const [logo, setLogo] = useState<string | null>(esc?.logo ?? null);
  const [erros, setErros] = useState<Partial<Record<Campo, string>>>({});
  const [ocupado, setOcupado] = useState(false);
  const [buscando, setBuscando] = useState<'' | 'cnpj' | 'cep'>('');
  const arquivo = useRef<HTMLInputElement>(null);
  const campoNumero = useRef<HTMLInputElement>(null);

  const mudar = (c: Campo, v: string) => { setF(x => ({ ...x, [c]: v })); setErros(x => ({ ...x, [c]: undefined })); };
  const vazio = (c: Campo) => !f[c].trim();

  async function escolherLogo(e: ChangeEvent<HTMLInputElement>) {
    const a = e.target.files?.[0];
    e.target.value = '';
    if (!a) return;
    try { setLogo(await prepararLogo(a)); } catch (err) { falha(err); }
  }

  async function preencherCNPJ() {
    if (!cnpjValido(f.cnpj)) { setErros(x => ({ ...x, cnpj: 'Informe um CNPJ válido.' })); return; }
    setBuscando('cnpj');
    try {
      const d = await consultarCNPJ(f.cnpj);
      // Só completa o que está em branco: o que o administrador já escreveu fica.
      setF(x => {
        const n = { ...x };
        const poe = (c: Campo, v: string | undefined) => { if (v && !x[c].trim()) n[c] = v; };
        poe('nome', nomeProprio(d.nome_fantasia || d.nome));
        poe('cep', fmtCEP(d.cep)); poe('logradouro', d.logradouro); poe('numero', d.numero); poe('complemento', d.complemento);
        poe('bairro', d.bairro); poe('municipio', d.municipio); poe('uf', d.uf);
        poe('telefone', d.telefones[0] ? MASCARAS.telefone(d.telefones[0]) : ''); poe('email', d.emails[0]?.toLowerCase());
        return n;
      });
      avisar('Dados da Receita Federal preenchidos nos campos em branco. Confira antes de salvar.');
    } catch (err) { falha(err); }
    setBuscando('');
  }

  async function mudarCEP(v: string) {
    const cep = MASCARAS.cep(v);
    mudar('cep', cep);
    if (dig(cep).length !== 8) return;
    setBuscando('cep');
    try {
      const d = await consultarCEP(cep);
      setF(x => ({ ...x, logradouro: d.logradouro || x.logradouro, bairro: d.bairro || x.bairro, municipio: d.municipio || x.municipio, uf: d.uf || x.uf }));
      campoNumero.current?.focus();
    } catch (err) { avisar((err as Error).message, 'erro'); }
    setBuscando('');
  }

  function validar() {
    const e: Partial<Record<Campo, string>> = {};
    if (vazio('nome')) e.nome = 'Informe o nome do escritório.';
    if (!vazio('cnpj') && !cnpjValido(f.cnpj)) e.cnpj = 'CNPJ inválido.';
    if (!vazio('cep') && dig(f.cep).length !== 8) e.cep = 'O CEP tem 8 dígitos.';
    if (!vazio('telefone') && ![10, 11].includes(dig(f.telefone).length)) e.telefone = 'Informe o DDD e o número.';
    if (!vazio('email') && !emailValido(f.email)) e.email = 'E-mail inválido.';
    setErros(e);
    const primeiro = CAMPOS.find(c => e[c]);
    if (primeiro) document.getElementById('cfg-' + primeiro)?.focus();
    return !primeiro;
  }

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    if (!validar()) return;
    const anterior = esc ? { ...paraSalvar(paraForm(esc)), logo: esc.logo } : null;
    setOcupado(true);
    try {
      const novo = paraSalvar(f);
      await SD.escritorioSalvar({ ...novo, ...(logo !== (esc?.logo ?? null) ? { logo } : {}) });
      await recarregar(true);
      setF(paraForm(novo));
      feito('Dados do escritório salvos.', 'dados do escritório', async () => {
        if (!anterior) return;
        await SD.escritorioSalvar(anterior);
        await recarregar(true);
        setF(paraForm(anterior)); setLogo(anterior.logo);
      });
    } catch (err) { falha(err); }
    setOcupado(false);
  }

  // Cada campo diz quantas das 12 colunas ocupa: p no estreito, m a partir de 560px, g a partir de 860px
  // (veja .grade-form em estilo.css). "junto" vai ao lado do campo, como o botão do CNPJ.
  type Opcoes = InputHTMLAttributes<HTMLInputElement> & { dica?: string; ref?: Ref<HTMLInputElement>; tam?: TamanhoNaGrade; junto?: ReactNode };
  const campo = (c: Campo, rotulo: string, props: Opcoes = {}) => {
    const { dica, tam, junto, ...resto } = props;
    const entrada = <input id={'cfg-' + c} value={f[c]} onChange={e => mudar(c, e.target.value)} aria-invalid={!!erros[c]}
      aria-describedby={erros[c] ? 'cfg-erro-' + c : undefined} {...resto} />;
    return <div className={'campo-form' + (erros[c] ? ' com-erro' : '')} style={naGrade(tam)}>
      <label htmlFor={'cfg-' + c}>{rotulo}{dica && <small> {dica}</small>}</label>
      {junto ? <div className="grupo-campo">{entrada}{junto}</div> : entrada}
      {erros[c] && <span className="erro-campo" id={'cfg-erro-' + c}>{erros[c]}</span>}
    </div>;
  };

  return <div className="miolo">
    <header>
      <p className="olho">Administração</p>
      <h1 className="titulo">Configurações<span className="ponto">.</span></h1>
      <p className="lead">Os dados da instituição. O nome aparece nas telas do escritório, como a barra lateral e a mensagem de convite da equipe; a logomarca e os demais dados vão para os documentos.</p>
    </header>

    <form className="config campos" noValidate onSubmit={salvar}>
      <section className="cartao form-grade" aria-labelledby="tInst">
        <TituloSecao id="tInst">Instituição</TituloSecao>
        <div className="config-logo">
          <div className={'config-logo-previa' + (logo ? '' : ' vazia')}>
            {logo ? <img src={logo} alt={`Logomarca de ${f.nome || 'escritório'}`} /> : <span>{(f.nome.trim() || 'S').charAt(0)}</span>}
          </div>
          <div className="config-logo-texto">
            <b>Logomarca</b>
            <Nota>Vai para os documentos do escritório, como contratos e procurações (em breve). PNG, JPG, WebP ou SVG, de preferência com fundo transparente.</Nota>
            <div className="acoes">
              <button type="button" className={estiloBotao()} onClick={() => arquivo.current?.click()}>{logo ? 'Trocar imagem' : 'Escolher imagem'}</button>
              {logo && <button type="button" className={estiloBotao()} onClick={() => setLogo(null)}>Remover</button>}
            </div>
            <input ref={arquivo} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onChange={escolherLogo} />
          </div>
        </div>
        <div className="grade-form">
          {campo('nome', 'Nome do escritório', { maxLength: TAMANHO_ESCRITORIO.nome, autoComplete: 'organization', required: true, tam: { g: 8 } })}
          {campo('oab_registro', 'Registro na OAB', { placeholder: 'da sociedade, ex.: OAB/MG 1.234', maxLength: TAMANHO_ESCRITORIO.oab_registro, tam: { m: 5, g: 4 } })}
          {campo('cnpj', 'CNPJ', {
            autoCapitalize: 'characters', onChange: e => mudar('cnpj', MASCARAS.cnpj(e.target.value)), tam: { m: 7, g: 8 },
            junto: <button type="button" className={estiloBotao()} onClick={preencherCNPJ} disabled={buscando === 'cnpj'}>{buscando === 'cnpj' ? 'Consultando…' : 'Preencher pelo CNPJ'}</button>
          })}
        </div>
      </section>

      <section className="cartao form-grade" aria-labelledby="tEnd">
        <TituloSecao id="tEnd">Endereço</TituloSecao>
        <div className="grade-form">
          {campo('cep', 'CEP', { inputMode: 'numeric', onChange: e => mudarCEP(e.target.value), dica: buscando === 'cep' ? 'consultando…' : undefined, tam: { p: 6, m: 4, g: 3 } })}
          {campo('logradouro', 'Logradouro', { maxLength: TAMANHO_ESCRITORIO.logradouro, tam: { m: 8, g: 7 } })}
          {campo('numero', 'Número', { maxLength: TAMANHO_ESCRITORIO.numero, ref: campoNumero, tam: { p: 4, m: 3, g: 2 } })}
          {campo('complemento', 'Complemento', { maxLength: TAMANHO_ESCRITORIO.complemento, tam: { p: 8, m: 4, g: 3 } })}
          {campo('bairro', 'Bairro', { maxLength: TAMANHO_ESCRITORIO.bairro, tam: { m: 5, g: 4 } })}
          {campo('municipio', 'Município', { maxLength: TAMANHO_ESCRITORIO.municipio, tam: { p: 8, m: 8, g: 3 } })}
          <div className="campo-form" style={naGrade({ p: 4, m: 4, g: 2 })}>
            <label htmlFor="cfg-uf">UF</label>
            <select id="cfg-uf" value={f.uf} onChange={e => mudar('uf', e.target.value)}>
              <option value="">—</option>
              {UFS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>
      </section>

      <section className="cartao form-grade" aria-labelledby="tCont">
        <TituloSecao id="tCont">Contato</TituloSecao>
        <div className="grade-form">
          {campo('telefone', 'Telefone', { inputMode: 'tel', autoComplete: 'tel', onChange: e => mudar('telefone', MASCARAS.telefone(e.target.value)), tam: { m: 6, g: 3 } })}
          {campo('email', 'E-mail', { type: 'email', autoComplete: 'email', maxLength: TAMANHO_ESCRITORIO.email, tam: { m: 6, g: 5 } })}
          {campo('site', 'Site', { inputMode: 'url', placeholder: 'www.escritorio.adv.br', maxLength: TAMANHO_ESCRITORIO.site, tam: { g: 4 } })}
        </div>
      </section>

      <div className="config-salvar">
        <button className={estiloBotao({ variante: 'principal' })} type="submit" disabled={ocupado}>{ocupado ? 'Salvando…' : 'Salvar'}</button>
      </div>
    </form>

    <LigacaoGoogle />
  </div>;
}
