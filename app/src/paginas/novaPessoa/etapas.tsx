// As etapas do cadastro de pessoa, uma por objeto (padrão State): cada uma sabe o que mostra (o componente) e como
// se valida (regras/cadastro.ts). O cadastro (NovaPessoa.tsx) mostra a etapa atual e pede a validação dela, sem
// testar qual é. Etapa nova: um componente aqui, uma validação em regras/cadastro.ts e uma entrada no fluxo().
import type { ComponentType } from 'react';
import { TAMANHO_PESSOA } from '../../dados/limites';
import { AO_ENTRAR, VALIDACAO, type AoEntrar, type CamposCadastro, type Etapa, type ResultadoEtapa } from '../../regras/cadastro';
import { cnpjValido, cpfValido, dig, ehIndividual, ENTIDADES, ESTADO_CIVIL, LGPD, NATUREZAS, PORTES } from '../../regras/pessoa';
import { Botao } from '../../ui/Botoes';
import { useFormulario } from './formulario';

function EtapaTipo() {
  const { botaoAvancar, pc, erro, radios } = useFormulario();
  return <section className="etapa ativa">
    <header><h2>Qual é o tipo de cadastro?</h2></header>
    <div className={pc('tipo')}>
      <span className="rot">Selecione uma opção<span className="req">*</span></span>
      <div className="escolhas">{radios('tipo', [['pf', 'Pessoa física'], ['pj', 'Pessoa jurídica'], ['contato', 'Somente informações de contato']],
        () => setTimeout(() => botaoAvancar.current?.click(), 200))}</div>
      {erro('tipo')}
    </div>
  </section>;
}

function EtapaIdentificacao() {
  const { c, pj, mudar, buscarCNPJ, retornoCNPJ, botaoCNPJ, pc, erro, texto, retorno } = useFormulario();
  return <section className="etapa ativa">
    <header><h2>{pj ? 'Dados da empresa' : c.tipo === 'pf' ? 'Dados pessoais' : 'Identificação'}</h2></header>
    <div className={pc('nome')}>
      <label htmlFor="nome">Nome<span className="req">*</span></label>
      <p className="dica">{pj ? 'Razão social, em letras maiúsculas.' : 'Nome completo, em letras maiúsculas.'}</p>
      {texto('nome', { maximo: TAMANHO_PESSOA.nome, maiusculas: true })}
      {erro('nome')}
    </div>
    {pj && <>
      <div className={pc('cnpjBusca')}>
        <label htmlFor="cnpjBusca">CNPJ<span className="req">*</span></label>
        <p className="dica">Clique em Buscar para trazer os dados da Receita, ou siga e preencha manualmente.</p>
        <div className="linha-campo">
          {texto('cnpjBusca', { mascara: 'cnpj', placeholder: '00.000.000/0000-00', numerico: true })}
          <Botao className="btn esc" ref={botaoCNPJ} ocupadoTexto="Buscando…" onClick={buscarCNPJ}>Buscar</Botao>
        </div>
        {erro('cnpjBusca')}
        {retorno(retornoCNPJ)}
      </div>
      <div className="pergunta">
        <label htmlFor="natureza">Natureza jurídica</label>
        <select id="natureza" value={c.natureza} onChange={e => {
          const natureza = e.target.value;
          mudar(c.entidade && !ENTIDADES[natureza]?.includes(c.entidade) ? { natureza, entidade: '' } : { natureza });
        }}>
          <option value="">Selecione</option>
          {Object.entries(NATUREZAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
    </>}
  </section>;
}

function EtapaPessoaFisica() {
  const { c, cRef, marcarErro, verificarDocumento, pc, erro, texto, data, radios, ufs } = useFormulario();
  return <section className="etapa ativa">
    <header><h2>Pessoa física</h2><p>Dados pessoais para a qualificação.</p></header>
    <div className={pc('genero')}>
      <span className="rot">Gênero<span className="req">*</span></span>
      <div className="escolhas">{radios('genero', [['m', 'Masculino'], ['f', 'Feminino']])}</div>
      {erro('genero')}
    </div>
    <div className="pergunta">
      <span className="rot">Nacionalidade</span>
      <div className="escolhas">{radios('nac', [['brasileira', 'Brasileira'], ['outra', 'Outra']],
        v => { if (v === 'outra') setTimeout(() => document.getElementById('nacOutra')?.focus(), 0); })}</div>
      {c.nac === 'outra' && texto('nacOutra', { maximo: TAMANHO_PESSOA.nacionalidade, placeholder: 'Ex.: portuguesa' })}
    </div>
    <div className="pergunta"><label htmlFor="profissao">Profissão</label>{texto('profissao', { maximo: TAMANHO_PESSOA.profissao })}</div>
    <div className="pergunta">
      <span className="rot">Estado civil</span>
      <div className="escolhas">{radios('ec', Object.entries(ESTADO_CIVIL).map(([k, v]) => [k, v[2]] as [string, string]))}</div>
    </div>
    <div className={pc('cpf')}>
      <label htmlFor="cpf">CPF<span className="req">*</span></label>
      {texto('cpf', { mascara: 'cpf', placeholder: '000.000.000-00', numerico: true, aoSair: () => {
        const d = dig(cRef.current.cpf);
        if (cpfValido(d)) void verificarDocumento(d); else if (d) marcarErro('cpf', 'CPF inválido: confira os números.');
      } })}
      {erro('cpf')}
    </div>
    <div className="grade-campos">
      <div className="pergunta"><label htmlFor="rg">RG</label><p className="dica">Número, órgão e estado. Ex.: MG 12.345.678 SSP/MG</p>{texto('rg', { maximo: TAMANHO_PESSOA.rg })}</div>
      <div className={pc('rgExp')}><label htmlFor="rgExp">Data de expedição</label><p className="dica">DD/MM/AAAA</p>{data('rgExp')}{erro('rgExp')}</div>
    </div>
    <div className="pergunta"><label htmlFor="mae">Nome da mãe</label>{texto('mae', { maximo: TAMANHO_PESSOA.filiacao, maiusculas: true })}</div>
    <div className="pergunta"><label htmlFor="pai">Nome do pai</label>{texto('pai', { maximo: TAMANHO_PESSOA.filiacao, maiusculas: true })}</div>
    <div className="grade-campos">
      <div className={pc('nasc')}><label htmlFor="nasc">Data de nascimento</label>{data('nasc')}{erro('nasc')}</div>
      <div className="pergunta"><label htmlFor="nascMun">Município de nascimento</label>{texto('nascMun', { maximo: TAMANHO_PESSOA.municipio })}</div>
      <div className="pergunta"><label htmlFor="nascUf">UF de nascimento</label>{ufs('nascUf')}</div>
    </div>
  </section>;
}

function EtapaEntidade() {
  const { c, radios } = useFormulario();
  return <section className="etapa ativa">
    <header><h2>{NATUREZAS[c.natureza] || 'Tipo de entidade'}</h2><p>Em qual tipo a pessoa jurídica se enquadra?</p></header>
    <div className="pergunta"><div className="escolhas coluna-unica">{radios('entidade', (ENTIDADES[c.natureza] || []).map(t => [t, t] as [string, string]))}</div></div>
  </section>;
}

function EtapaEmpresa() {
  const { c, cRef, marcarErro, verificarDocumento, pc, erro, texto, data, radios } = useFormulario();
  return <section className="etapa ativa">
    <header><h2>Pessoa jurídica</h2><p>Dados da empresa ou entidade.</p></header>
    {ehIndividual(c.entidade) && <div className={pc('genero')}>
      <span className="rot">Gênero do(a) titular<span className="req">*</span></span>
      <p className="dica">No MEI e no empresário individual, a empresa é a própria pessoa: a qualificação concorda com ela (empresário ou empresária, inscrito ou inscrita).</p>
      <div className="escolhas">{radios('genero', [['m', 'Masculino'], ['f', 'Feminino']])}</div>
      {erro('genero')}
    </div>}
    <div className="pergunta"><label htmlFor="fantasia">Nome fantasia</label>{texto('fantasia', { maximo: TAMANHO_PESSOA.nomeFantasia, maiusculas: true })}</div>
    <div className="pergunta">
      <span className="rot">Porte</span>
      <p className="dica">Nos casos de MEI, não é preciso marcar.</p>
      <div className="escolhas">{radios('porte', Object.entries(PORTES))}</div>
    </div>
    <div className="grade-campos">
      <div className={pc('cnpj')}>
        <label htmlFor="cnpj">CNPJ<span className="req">*</span></label>
        {texto('cnpj', { mascara: 'cnpj', placeholder: '00.000.000/0000-00', numerico: true, aoSair: () => {
          const d = dig(cRef.current.cnpj);
          if (cnpjValido(d)) void verificarDocumento(d); else if (d) marcarErro('cnpj', 'CNPJ inválido: confira os números.');
        } })}
        {erro('cnpj')}
      </div>
      <div className={pc('abertura')}><label htmlFor="abertura">Data de abertura</label>{data('abertura')}{erro('abertura')}</div>
    </div>
    <div className="pergunta"><label htmlFor="representantes">Representante(s) legal(is)</label>
      <p className="dica">Nome completo. Havendo mais de um, separe com "e/ou". Em MEI ou empresário individual, deixe em branco.</p>
      {texto('representantes', { maximo: TAMANHO_PESSOA.representantes, maiusculas: true })}</div>
  </section>;
}

function EtapaEndereco() {
  const { buscarCEP, retornoCEP, botaoCEP, pc, erro, texto, ufs, retorno } = useFormulario();
  return <section className="etapa ativa">
    <header><h2>Endereço</h2></header>
    <div className={pc('cep')}>
      <label htmlFor="cep">CEP</label>
      <p className="dica">Clique em Buscar para preencher o endereço.</p>
      <div className="linha-campo">
        {texto('cep', { mascara: 'cep', placeholder: '00000-000', numerico: true })}
        <Botao className="btn esc" ref={botaoCEP} ocupadoTexto="Buscando…" onClick={buscarCEP}>Buscar</Botao>
      </div>
      {erro('cep')}
      {retorno(retornoCEP)}
    </div>
    <div className="pergunta"><label htmlFor="logradouro">Logradouro</label><p className="dica">Rua, avenida, fazenda etc.</p>{texto('logradouro', { maximo: TAMANHO_PESSOA.logradouro })}</div>
    <div className="grade-campos">
      <div className="pergunta"><label htmlFor="numero">Número</label><p className="dica">Sem número: S/N</p>{texto('numero', { maximo: TAMANHO_PESSOA.numero })}</div>
      <div className="pergunta"><label htmlFor="complemento">Complemento</label><p className="dica">Apto, sala, bloco…</p>{texto('complemento', { maximo: TAMANHO_PESSOA.complemento })}</div>
    </div>
    <div className="pergunta"><label htmlFor="bairro">Bairro</label>{texto('bairro', { maximo: TAMANHO_PESSOA.bairro })}</div>
    <div className="grade-campos">
      <div className="pergunta"><label htmlFor="municipio">Município</label>{texto('municipio', { maximo: TAMANHO_PESSOA.municipio })}</div>
      <div className="pergunta"><label htmlFor="uf">UF</label>{ufs('uf')}</div>
    </div>
  </section>;
}

function EtapaContato() {
  const { c, cRef, mudar, opcoesResp, pc, erro, data, lista, acrescentar } = useFormulario();
  return <section className="etapa ativa">
    <header><h2>Contato</h2></header>
    <div className={pc('telefones')}>
      <span className="rot">Telefone<span className="req">*</span></span>
      <p className="dica">Com DDD. Ex.: (38) 99999-0000</p>
      {lista('telefones', true)}
      <div><button type="button" className="link" onClick={() => acrescentar('telefones')}>+ Adicionar outro telefone</button></div>
      {erro('telefones')}
    </div>
    <div className={pc('emails')}>
      <span className="rot">E-mail</span>
      {lista('emails', false)}
      <div><button type="button" className="link" onClick={() => acrescentar('emails')}>+ Adicionar outro e-mail</button></div>
      {erro('emails')}
    </div>
    <div className="pergunta">
      <span className="rot">Profissionais responsáveis</span>
      <p className="dica">Eles aparecem no cartão da pessoa.</p>
      <div className="escolhas multipla">{opcoesResp.map(m => <label key={m.id}>
        <input type="checkbox" name="resp" value={m.id} checked={c.resp.includes(m.id)}
          onChange={e => mudar({ resp: e.target.checked ? [...cRef.current.resp, m.id] : cRef.current.resp.filter(x => x !== m.id) })} />
        {m.nome}{m.ativo ? '' : ' (desativado)'}
      </label>)}</div>
    </div>
    <div className="pergunta">
      <label htmlFor="lgpdBase">Base legal para o tratamento dos dados (LGPD)</label>
      <select id="lgpdBase" value={c.lgpdBase} onChange={e => mudar({ lgpdBase: e.target.value })}>
        {Object.entries(LGPD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
    </div>
    {c.lgpdBase === 'consentimento' && <div className={pc('lgpdData')}>
      <label htmlFor="lgpdData">Data do consentimento</label>
      {data('lgpdData')}
      {erro('lgpdData')}
    </div>}
  </section>;
}

export interface DefEtapa {
  Componente: ComponentType;
  validar: (a: CamposCadastro) => ResultadoEtapa;
  /** Ajustes nos campos ao abrir a etapa. */
  aoEntrar?: (a: CamposCadastro, ctx: AoEntrar) => Partial<CamposCadastro>;
}

export const ETAPAS: Record<Etapa, DefEtapa> = {
  's-tipo': { Componente: EtapaTipo, validar: VALIDACAO['s-tipo'], aoEntrar: AO_ENTRAR['s-tipo'] },
  's-ident': { Componente: EtapaIdentificacao, validar: VALIDACAO['s-ident'], aoEntrar: AO_ENTRAR['s-ident'] },
  's-pf': { Componente: EtapaPessoaFisica, validar: VALIDACAO['s-pf'], aoEntrar: AO_ENTRAR['s-pf'] },
  's-entidade': { Componente: EtapaEntidade, validar: VALIDACAO['s-entidade'], aoEntrar: AO_ENTRAR['s-entidade'] },
  's-empresa': { Componente: EtapaEmpresa, validar: VALIDACAO['s-empresa'], aoEntrar: AO_ENTRAR['s-empresa'] },
  's-endereco': { Componente: EtapaEndereco, validar: VALIDACAO['s-endereco'], aoEntrar: AO_ENTRAR['s-endereco'] },
  's-contato': { Componente: EtapaContato, validar: VALIDACAO['s-contato'], aoEntrar: AO_ENTRAR['s-contato'] }
};
