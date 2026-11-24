// No cadastro do processo (etapa Detalhes e lápis do cartão), os campos de propriedade intelectual (#317): aparecem quando a área do
// direito é "Propriedade intelectual", só no processo administrativo (#425). Primeiro o tipo de proteção; depois, só os campos daquele tipo (TIPOS_DE_PROTECAO), cada um
// desenhado pela tabela CONTROLES, e a explicação do tipo (de onde contam os prazos e onde entram titular, inventor e autor).
import type { ReactNode } from 'react';
import type { TipoProtecao } from '../../dados';
import { TAMANHO_PROTECAO } from '../../dados/limites';
import {
  APRESENTACOES_DA_MARCA, CAMPOS_DA_PROTECAO, NATUREZAS_DA_MARCA, temProtecao, TIPOS_DE_PROTECAO, TIPOS_DE_PROTECAO_EM_ORDEM, type CampoDaProtecao
} from '../../regras/propriedadeIntelectual';
import { CAMPOS_PROCESSO, type CamposProcesso } from '../../regras/processo';
import { Campo, CampoData, Nota, propsDoCampo, useNaLinhaDosDados } from '../../ui/base';

const NAO_INFORMADO = 'Não informado';
/** O nome do campo na leitura do cartão (CAMPOS_PROCESSO, com o nome da coluna: classesNice → classes_nice), para a seção de dados aberta (#432). */
const naLeitura = (campo: CampoDaProtecao) => CAMPOS_PROCESSO[campo.replace(/[A-Z]/g, l => '_' + l.toLowerCase())];
/** O id de cada campo na tela (o rótulo aponta para ele). */
const idDo = (campo: CampoDaProtecao | 'protecao') => 'pi-' + campo;

interface PropsDoControle { c: CamposProcesso; campo: CampoDaProtecao; erro?: string; mudar: (m: Partial<CamposProcesso>) => void }
const lista = (opcoes: Record<string, string>) => ({ c, campo, erro, mudar }: PropsDoControle) =>
  <select {...propsDoCampo(idDo(campo), { erro })} value={c[campo]} onChange={e => mudar({ [campo]: e.target.value })}>
    <option value="">{NAO_INFORMADO}</option>
    {Object.entries(opcoes).map(([v, nome]) => <option key={v} value={v}>{nome}</option>)}
  </select>;
const data = ({ c, campo, erro, mudar }: PropsDoControle) =>
  <CampoData {...propsDoCampo(idDo(campo), { erro })} valor={c[campo]} aoMudar={v => mudar({ [campo]: v })} />;
const texto = (maximo?: number, inputMode?: 'numeric') => ({ c, campo, erro, mudar }: PropsDoControle) =>
  <input type="text" {...propsDoCampo(idDo(campo), { dica: !!CAMPOS_DA_PROTECAO[campo].dica, erro })} maxLength={maximo} inputMode={inputMode} value={c[campo]}
    onChange={e => mudar({ [campo]: e.target.value })} />;

/** Como cada campo é preenchido. Campo novo = entrada nova aqui e em CAMPOS_DA_PROTECAO. */
const CONTROLES: Record<CampoDaProtecao, (p: PropsDoControle) => ReactNode> = {
  deposito: data, deferimento: data, concessao: data, publicacao: data, criacao: data,
  apresentacaoMarca: lista(APRESENTACOES_DA_MARCA), naturezaMarca: lista(NATUREZAS_DA_MARCA),
  classesNice: texto(),
  especificacao: ({ c, campo, erro, mudar }) => <textarea {...propsDoCampo(idDo(campo), { erro })} maxLength={TAMANHO_PROTECAO.especificacao} value={c[campo]}
    onChange={e => mudar({ [campo]: e.target.value })} />,
  variacoes: texto(undefined, 'numeric'),
  linguagem: texto(TAMANHO_PROTECAO.linguagem)
};

interface Props {
  c: CamposProcesso;
  erros: Partial<Record<keyof CamposProcesso, string>>;
  mudar: (m: Partial<CamposProcesso>) => void;
}

export function CamposDaProtecao({ c, erros, mudar }: Props) {
  // Na seção de dados aberta (#432), a nota de ajuda não entra no meio da tabela.
  const naLinha = useNaLinhaDosDados();
  if (!temProtecao(c)) return null;
  const tipo = c.protecao ? TIPOS_DE_PROTECAO[c.protecao] : null;
  return <>
    <Campo rotulo="Tipo de proteção" para={idDo('protecao')} dica={tipo?.nota}>
      <select {...propsDoCampo(idDo('protecao'), { dica: !!tipo })} value={c.protecao} onChange={e => mudar({ protecao: e.target.value as TipoProtecao | '' })}>
        <option value="">{NAO_INFORMADO}</option>
        {TIPOS_DE_PROTECAO_EM_ORDEM.map(t => <option key={t} value={t}>{TIPOS_DE_PROTECAO[t].nome}</option>)}
      </select>
    </Campo>
    {!tipo && !naLinha && <Nota>Escolha o tipo de proteção para ver os campos dele e as datas de validade e de anuidades no cartão.</Nota>}
    {tipo?.campos.map(campo => <Campo key={campo} rotulo={CAMPOS_DA_PROTECAO[campo].rotulo} curto={naLeitura(campo)} para={idDo(campo)} dica={CAMPOS_DA_PROTECAO[campo].dica} erro={erros[campo]}>
      {CONTROLES[campo]({ c, campo, erro: erros[campo], mudar })}
    </Campo>)}
  </>;
}
