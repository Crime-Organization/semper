// As etapas do cadastro de pessoa, uma por objeto (padrão State): cada uma sabe o que mostra (o componente) e como
// se valida (regras/cadastro.ts). O cadastro (NovaPessoa.tsx) mostra a etapa atual e pede a validação dela, sem
// testar qual é. Etapa nova: um componente aqui, uma validação em regras/cadastro.ts e uma entrada no fluxo().
import type { ComponentType } from 'react';
import { TAMANHO_PESSOA } from '../../dados/limites';
import { AO_ENTRAR, VALIDACAO, type AoEntrar, type CamposCadastro, type Etapa, type ResultadoEtapa } from '../../regras/cadastro';
import { cnpjValido, cpfValido, dig, ehIndividual, ENTIDADES, ESTADO_CIVIL, LGPD, limparDocumento, NATUREZAS, PORTES } from '../../regras/pessoa';
import { Campo, Dica, Escolhas, estiloBotao } from '../../ui/base';
import { Botao } from '../../ui/Botoes';
import { useFormulario } from './formulario';

function EtapaTipo() {
  const { botaoAvancar, erroDe, radios } = useFormulario();
  return <section className="etapa ativa">
    <header><h2>Qual é o tipo de cadastro?</h2></header>
    <Escolhas rotulo="Selecione uma opção" obrigatorio erro={erroDe('tipo')}>
      {radios('tipo', [['pf', 'Pessoa física'], ['pj', 'Pessoa jurídica'], ['contato', 'Somente informações de contato']],
        () => setTimeout(() => botaoAvancar.current?.click(), 200))}
    </Escolhas>
  </section>;
}

function EtapaIdentificacao() {
  const { c, pj, mudar, buscarCNPJ, retornoCNPJ, botaoCNPJ, erroDe, texto, retorno } = useFormulario();
  return <section className="etapa ativa">
    <header><h2>{pj ? 'Dados da empresa' : c.tipo === 'pf' ? 'Dados pessoais' : 'Identificação'}</h2></header>
    <Campo rotulo="Nome" para="nome" obrigatorio erro={erroDe('nome')}
      dica={pj ? 'Razão social, em letras maiúsculas.' : 'Nome completo, em letras maiúsculas.'}>
      {texto('nome', { maximo: TAMANHO_PESSOA.nome, maiusculas: true })}
    </Campo>
    {pj && <>
      <Campo rotulo="CNPJ" para="cnpjBusca" obrigatorio erro={erroDe('cnpjBusca')} depois={retorno(retornoCNPJ)}
        dica="Clique em Buscar para trazer os dados da Receita, ou siga e preencha manualmente.">
        <div className="linha-campo">
          {texto('cnpjBusca', { mascara: 'cnpj', placeholder: '00.000.000/0000-00' })}
          <Botao variante="escuro" ref={botaoCNPJ} ocupadoTexto="Buscando…" onClick={buscarCNPJ}>Buscar</Botao>
        </div>
      </Campo>
      <Campo rotulo="Natureza jurídica" para="natureza">
        <select id="natureza" value={c.natureza} onChange={e => {
          const natureza = e.target.value;
          mudar(c.entidade && !ENTIDADES[natureza]?.includes(c.entidade) ? { natureza, entidade: '' } : { natureza });
        }}>
          <option value="">Selecione</option>
          {Object.entries(NATUREZAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </Campo>
    </>}
  </section>;
}

function EtapaPessoaFisica() {
  const { c, cRef, marcarErro, verificarDocumento, erroDe, texto, data, radios, ufs } = useFormulario();
  return <section className="etapa ativa">
    <header><h2>Pessoa física</h2><p>Dados pessoais para a qualificação.</p></header>
    <Escolhas rotulo="Gênero" obrigatorio erro={erroDe('genero')}>{radios('genero', [['m', 'Masculino'], ['f', 'Feminino']])}</Escolhas>
    {/* A nacionalidade tem um campo depois das opções (a outra nacionalidade): fica com a marcação própria. */}
    <div className="pergunta">
      <span className="rot">Nacionalidade</span>
      <div className="escolhas">{radios('nac', [['brasileira', 'Brasileira'], ['outra', 'Outra']],
        v => { if (v === 'outra') setTimeout(() => document.getElementById('nacOutra')?.focus(), 0); })}</div>
      {c.nac === 'outra' && texto('nacOutra', { maximo: TAMANHO_PESSOA.nacionalidade, placeholder: 'Ex.: portuguesa' })}
    </div>
    <Campo rotulo="Profissão" para="profissao">{texto('profissao', { maximo: TAMANHO_PESSOA.profissao })}</Campo>
    <Escolhas rotulo="Estado civil">{radios('ec', Object.entries(ESTADO_CIVIL).map(([k, v]) => [k, v[2]] as [string, string]))}</Escolhas>
    <Campo rotulo="CPF" para="cpf" obrigatorio erro={erroDe('cpf')}>
      {texto('cpf', { mascara: 'cpf', placeholder: '000.000.000-00', numerico: true, aoSair: () => {
        const d = dig(cRef.current.cpf);
        if (cpfValido(d)) void verificarDocumento(d); else if (d) marcarErro('cpf', 'CPF inválido: confira os números.');
      } })}
    </Campo>
    <div className="grade-campos">
      <Campo rotulo="RG" para="rg" dica="Número, órgão e estado. Ex.: MG 12.345.678 SSP/MG">{texto('rg', { maximo: TAMANHO_PESSOA.rg })}</Campo>
      <Campo rotulo="Data de expedição" para="rgExp" dica="DD/MM/AAAA" erro={erroDe('rgExp')}>{data('rgExp')}</Campo>
    </div>
    <Campo rotulo="Nome da mãe" para="mae">{texto('mae', { maximo: TAMANHO_PESSOA.filiacao, maiusculas: true })}</Campo>
    <Campo rotulo="Nome do pai" para="pai">{texto('pai', { maximo: TAMANHO_PESSOA.filiacao, maiusculas: true })}</Campo>
    <div className="grade-campos">
      <Campo rotulo="Data de nascimento" para="nasc" erro={erroDe('nasc')}>{data('nasc')}</Campo>
      <Campo rotulo="Município de nascimento" para="nascMun">{texto('nascMun', { maximo: TAMANHO_PESSOA.municipio })}</Campo>
      <Campo rotulo="UF de nascimento" para="nascUf">{ufs('nascUf')}</Campo>
    </div>
  </section>;
}

function EtapaEntidade() {
  const { c, radios } = useFormulario();
  return <section className="etapa ativa">
    <header><h2>{NATUREZAS[c.natureza] || 'Tipo de entidade'}</h2><p>Em qual tipo a pessoa jurídica se enquadra?</p></header>
    {/* Sem rótulo próprio: o título da etapa já diz o que escolher. */}
    <div className="pergunta"><div className="escolhas coluna-unica">{radios('entidade', (ENTIDADES[c.natureza] || []).map(t => [t, t] as [string, string]))}</div></div>
  </section>;
}

function EtapaEmpresa() {
  const { c, cRef, marcarErro, verificarDocumento, erroDe, texto, data, radios } = useFormulario();
  return <section className="etapa ativa">
    <header><h2>Pessoa jurídica</h2><p>Dados da empresa ou entidade.</p></header>
    {ehIndividual(c.entidade) && <Escolhas rotulo="Gênero do(a) titular" obrigatorio erro={erroDe('genero')}
      dica="No MEI e no empresário individual, a empresa é a própria pessoa: a qualificação concorda com ela (empresário ou empresária, inscrito ou inscrita).">
      {radios('genero', [['m', 'Masculino'], ['f', 'Feminino']])}
    </Escolhas>}
    <Campo rotulo="Nome fantasia" para="fantasia">{texto('fantasia', { maximo: TAMANHO_PESSOA.nomeFantasia, maiusculas: true })}</Campo>
    <Escolhas rotulo="Porte" dica="Nos casos de MEI, não é preciso marcar.">{radios('porte', Object.entries(PORTES))}</Escolhas>
    <div className="grade-campos">
      <Campo rotulo="CNPJ" para="cnpj" obrigatorio erro={erroDe('cnpj')}>
        {texto('cnpj', { mascara: 'cnpj', placeholder: '00.000.000/0000-00', aoSair: () => {
          const d = limparDocumento(cRef.current.cnpj);
          if (cnpjValido(d)) void verificarDocumento(d); else if (d) marcarErro('cnpj', 'CNPJ inválido: confira os números.');
        } })}
      </Campo>
      <Campo rotulo="Data de abertura" para="abertura" erro={erroDe('abertura')}>{data('abertura')}</Campo>
    </div>
    <Campo rotulo="Representante(s) legal(is)" para="representantes"
      dica={'Nome completo. Havendo mais de um, separe com "e/ou". Em MEI ou empresário individual, deixe em branco.'}>
      {texto('representantes', { maximo: TAMANHO_PESSOA.representantes, maiusculas: true })}
    </Campo>
  </section>;
}

function EtapaEndereco() {
  const { buscarCEP, retornoCEP, botaoCEP, erroDe, texto, ufs, retorno } = useFormulario();
  return <section className="etapa ativa">
    <header><h2>Endereço</h2></header>
    <Campo rotulo="CEP" para="cep" dica="Clique em Buscar para preencher o endereço." erro={erroDe('cep')} depois={retorno(retornoCEP)}>
      <div className="linha-campo">
        {texto('cep', { mascara: 'cep', placeholder: '00000-000', numerico: true })}
        <Botao variante="escuro" ref={botaoCEP} ocupadoTexto="Buscando…" onClick={buscarCEP}>Buscar</Botao>
      </div>
    </Campo>
    <Campo rotulo="Logradouro" para="logradouro" dica="Rua, avenida, fazenda etc.">{texto('logradouro', { maximo: TAMANHO_PESSOA.logradouro })}</Campo>
    <div className="grade-campos">
      <Campo rotulo="Número" para="numero" dica="Sem número: S/N">{texto('numero', { maximo: TAMANHO_PESSOA.numero })}</Campo>
      <Campo rotulo="Complemento" para="complemento" dica="Apto, sala, bloco…">{texto('complemento', { maximo: TAMANHO_PESSOA.complemento })}</Campo>
    </div>
    <Campo rotulo="Bairro" para="bairro">{texto('bairro', { maximo: TAMANHO_PESSOA.bairro })}</Campo>
    <div className="grade-campos">
      <Campo rotulo="Município" para="municipio">{texto('municipio', { maximo: TAMANHO_PESSOA.municipio })}</Campo>
      <Campo rotulo="UF" para="uf">{ufs('uf')}</Campo>
    </div>
  </section>;
}

function EtapaContato() {
  const { c, cRef, mudar, opcoesResp, pc, erro, erroDe, data, lista, acrescentar } = useFormulario();
  return <section className="etapa ativa">
    <header><h2>Contato</h2></header>
    {/* Telefones e e-mails são listas com um botão de acrescentar: ficam com a marcação própria. */}
    <div className={pc('telefones')}>
      <span className="rot">Telefone<span className="req">*</span></span>
      <Dica>Com DDD. Ex.: (38) 99999-0000</Dica>
      {lista('telefones', true)}
      <div><button type="button" className={estiloBotao({ forma: 'link' })} onClick={() => acrescentar('telefones')}>+ Adicionar outro telefone</button></div>
      {erro('telefones')}
    </div>
    <div className={pc('emails')}>
      <span className="rot">E-mail</span>
      {lista('emails', false)}
      <div><button type="button" className={estiloBotao({ forma: 'link' })} onClick={() => acrescentar('emails')}>+ Adicionar outro e-mail</button></div>
      {erro('emails')}
    </div>
    <Escolhas rotulo="Profissionais responsáveis" dica="Eles aparecem no cartão da pessoa." arranjo="multipla">
      {opcoesResp.map(m => <label key={m.id}>
        <input type="checkbox" name="resp" value={m.id} checked={c.resp.includes(m.id)}
          onChange={e => mudar({ resp: e.target.checked ? [...cRef.current.resp, m.id] : cRef.current.resp.filter(x => x !== m.id) })} />
        {m.nome}{m.ativo ? '' : ' (desativado)'}
      </label>)}
    </Escolhas>
    <Campo rotulo="Base legal para o tratamento dos dados (LGPD)" para="lgpdBase">
      <select id="lgpdBase" value={c.lgpdBase} onChange={e => mudar({ lgpdBase: e.target.value })}>
        {Object.entries(LGPD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
    </Campo>
    {c.lgpdBase === 'consentimento' && <Campo rotulo="Data do consentimento" para="lgpdData" erro={erroDe('lgpdData')}>{data('lgpdData')}</Campo>}
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
