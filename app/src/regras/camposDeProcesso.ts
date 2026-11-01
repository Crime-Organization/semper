// Campos que o escritório cria nos processos: os tipos, como cada valor é lido e mostrado, e o que aparece em cada processo.
// Tudo puro, sem tela nem banco. O valor fica guardado por id do campo: data em AAAA-MM-DD, número com ponto decimal.
import type { ApareceEm, CampoDeProcesso, DadosCampoDeProcesso, TipoDeCampo, TipoProcesso } from '../dados/tipos';
import { DIGITOS_DO_NUMERO, OPCOES_POR_CAMPO, TAMANHO_CAMPO } from '../dados/limites';
import { fmtData, lerData } from './pessoa';
import { CAMPOS_PROCESSO } from './processo';
import { normal } from './texto';

const NUMERO_EM_REAIS_OU_NAO = /^-?(\d{1,3}(\.\d{3})+|\d+)(,\d+)?$/;
/** "1.234,5" vira "1234.5". */
function lerNumero(digitado: string) {
  const t = digitado.trim();
  if (!NUMERO_EM_REAIS_OU_NAO.test(t)) throw new Error('Use um número como 1.234,50.');
  const guardado = t.replace(/\./g, '').replace(',', '.'), [inteiro, decimais = ''] = guardado.replace('-', '').split('.');
  if (inteiro.length > DIGITOS_DO_NUMERO.inteiros || decimais.length > DIGITOS_DO_NUMERO.decimais) {
    throw new Error(`Use até ${DIGITOS_DO_NUMERO.inteiros} algarismos antes da vírgula e ${DIGITOS_DO_NUMERO.decimais} depois.`);
  }
  return guardado;
}
/** "1234.50" vira "1.234,50". Trabalha no texto, sem virar número: assim, nenhum algarismo se perde, nem os zeros à esquerda. */
const mostrarNumero = (guardado: string) => {
  const [inteiro, decimais] = guardado.split('.');
  return inteiro.replace(/\B(?=(\d{3})+$)/g, '.') + (decimais ? ',' + decimais : '');
};
const comoGuardado = (v: string) => v;

/** O que cada tipo de campo sabe fazer: o nome, ler o que foi digitado (avisa se estiver errado) e mostrar o que está guardado. */
export const TIPOS_DE_CAMPO: Record<TipoDeCampo, { nome: string; ler: (digitado: string) => string; mostrar: (guardado: string) => string }> = {
  texto: {
    nome: 'Texto', mostrar: comoGuardado,
    ler: d => {
      const t = d.trim();
      if (t.length > TAMANHO_CAMPO.texto) throw new Error(`Pode ter até ${TAMANHO_CAMPO.texto} caracteres.`);
      return t;
    }
  },
  data: { nome: 'Data', ler: d => lerData(d) ?? '', mostrar: g => fmtData(g) },
  numero: { nome: 'Número', ler: lerNumero, mostrar: mostrarNumero },
  lista: { nome: 'Lista de opções', ler: comoGuardado, mostrar: comoGuardado }
};
export const TIPOS_DE_CAMPO_EM_ORDEM = Object.keys(TIPOS_DE_CAMPO) as TipoDeCampo[];
export const ONDE_APARECE: Record<ApareceEm, string> = { ambos: 'Judicial e administrativo', judicial: 'Só judicial', administrativo: 'Só administrativo' };

/** Os campos que valem para um tipo de processo (os apagados saem). */
export const camposDoTipo = (campos: CampoDeProcesso[], tipo: TipoProcesso) =>
  campos.filter(c => !c.apagado_em && (c.aparece_em === 'ambos' || c.aparece_em === tipo));

// ---------- preenchimento no cadastro ----------
type Valores = Record<string, string>;
/** Do que está guardado para o que aparece no formulário. */
export function valoresNoFormulario(campos: CampoDeProcesso[], guardados: Valores): Valores {
  return Object.fromEntries(campos.filter(c => guardados[c.id]).map(c => [c.id, TIPOS_DE_CAMPO[c.tipo].mostrar(guardados[c.id])]));
}
/** Erros do que foi digitado, por id do campo. Só contam os campos que valem para esse tipo de processo. Vazio é sempre aceito. */
export function errosDosCampos(campos: CampoDeProcesso[], tipo: TipoProcesso, digitados: Valores): Record<string, string> {
  const erros: Record<string, string> = {};
  for (const c of camposDoTipo(campos, tipo)) {
    const digitado = digitados[c.id]?.trim();
    if (!digitado) continue;
    try { TIPOS_DE_CAMPO[c.tipo].ler(digitado); } catch (e) { erros[c.id] = (e as Error).message; }
  }
  return erros;
}
/** O que vai para o banco. O que está guardado em campos fora da tela (ex.: um campo apagado) continua guardado. */
export function valoresParaGravar(campos: CampoDeProcesso[], tipo: TipoProcesso, digitados: Valores, guardados: Valores = {}): Valores {
  const valores = { ...guardados };
  for (const c of camposDoTipo(campos, tipo)) {
    const digitado = digitados[c.id]?.trim();
    if (digitado) valores[c.id] = TIPOS_DE_CAMPO[c.tipo].ler(digitado);
    else delete valores[c.id];
  }
  return valores;
}

/**
 * O que gravar ao desfazer uma edição. O banco confere todo valor que muda: um campo apagado ou uma opção retirada depois
 * não aceitam o valor antigo de volta. Esses ficam como estão, para o resto da edição voltar, e são listados pelo nome.
 */
export function camposParaDesfazer(campos: CampoDeProcesso[], tipo: TipoProcesso, antes: Valores, atuais: Valores) {
  const valores = { ...atuais }, naoVoltaram: string[] = [], validos = camposDoTipo(campos, tipo);
  for (const id of new Set([...Object.keys(antes), ...Object.keys(atuais)])) {
    const antigo = antes[id];
    if (antigo === atuais[id]) continue;
    if (antigo === undefined) { delete valores[id]; continue; }
    const c = validos.find(x => x.id === id);
    if (c && (c.tipo !== 'lista' || c.opcoes.includes(antigo))) valores[id] = antigo;
    else naoVoltaram.push(campos.find(x => x.id === id)?.nome ?? 'campo excluído');
  }
  return { valores, naoVoltaram };
}

// ---------- cartão e histórico ----------
/** Os campos preenchidos, como aparecem no cartão: nome e valor. */
export const linhasDosCampos = (campos: CampoDeProcesso[], tipo: TipoProcesso, valores: Valores): [string, string][] =>
  camposDoTipo(campos, tipo).filter(c => valores[c.id]).map(c => [c.nome, TIPOS_DE_CAMPO[c.tipo].mostrar(valores[c.id])]);

const NO_HISTORICO = 'campo:';
/** O nome de cada campo no histórico, inclusive os apagados. */
export const nomesNoHistorico = (campos: CampoDeProcesso[]): Record<string, string> =>
  Object.fromEntries(campos.map(c => [NO_HISTORICO + c.id, c.nome]));
/** Como o valor aparece no histórico: pelo tipo do campo; o que não é campo criado pelo escritório, como quem chama já mostra. */
export const valorNoHistorico = (campos: CampoDeProcesso[], outros: (chave: string, v: unknown) => string) => (chave: string, v: unknown) => {
  if (!chave.startsWith(NO_HISTORICO)) return outros(chave, v);
  if (v === null || v === undefined || v === '') return '—';
  const c = campos.find(x => x.id === chave.slice(NO_HISTORICO.length));
  return c ? TIPOS_DE_CAMPO[c.tipo].mostrar(String(v)) : String(v);
};

// ---------- configuração ----------
export interface FormDoCampo { nome: string; tipo: TipoDeCampo; aparece_em: ApareceEm; opcoes: string }
export const CAMPO_NOVO: FormDoCampo = { nome: '', tipo: 'texto', aparece_em: 'ambos', opcoes: '' };
export const formDoCampo = (c: CampoDeProcesso): FormDoCampo => ({ nome: c.nome, tipo: c.tipo, aparece_em: c.aparece_em, opcoes: c.opcoes.join('\n') });

/** As opções digitadas, uma por linha: limpas e sem repetir, sem contar maiúsculas nem acentos. */
export function opcoesDigitadas(texto: string) {
  const vistas = new Set<string>(), opcoes: string[] = [];
  for (const linha of texto.split('\n')) {
    const o = linha.trim(), chave = normal(o);
    if (o && !vistas.has(chave)) { vistas.add(chave); opcoes.push(o); }
  }
  return opcoes;
}
/** Erros do formulário do campo. Vazio: pode salvar. O nome não repete, nem com um campo apagado. */
export function errosDoFormDoCampo(f: FormDoCampo, existentes: CampoDeProcesso[], id?: string): Partial<Record<keyof FormDoCampo, string>> {
  const erros: Partial<Record<keyof FormDoCampo, string>> = {};
  const nome = f.nome.trim(), opcoes = opcoesDigitadas(f.opcoes);
  const repetido = existentes.find(c => c.id !== id && normal(c.nome) === normal(nome));
  const dadoFixo = Object.values(CAMPOS_PROCESSO).some(rotulo => normal(rotulo) === normal(nome));
  if (!nome) erros.nome = 'Dê um nome ao campo.';
  else if (nome.length > TAMANHO_CAMPO.nome) erros.nome = `O nome pode ter até ${TAMANHO_CAMPO.nome} caracteres.`;
  else if (dadoFixo) erros.nome = 'O processo já tem um dado com esse nome. Escolha outro.';
  else if (repetido) erros.nome = repetido.apagado_em ? 'Já existe um campo apagado com esse nome. Reative esse campo.' : 'Já existe um campo com esse nome.';
  if (f.tipo !== 'lista') return erros;   // as opções só contam na lista: nos outros tipos, estão fora da tela
  if (!opcoes.length) erros.opcoes = 'Escreva pelo menos uma opção.';
  else if (opcoes.length > OPCOES_POR_CAMPO) erros.opcoes = `Uma lista pode ter até ${OPCOES_POR_CAMPO} opções.`;
  else if (opcoes.some(o => o.length > TAMANHO_CAMPO.opcao)) erros.opcoes = `Cada opção pode ter até ${TAMANHO_CAMPO.opcao} caracteres.`;
  return erros;
}
/** O que vai para o banco (só depois de errosDoFormDoCampo sem erros). */
export const dadosDoCampo = (f: FormDoCampo): DadosCampoDeProcesso => ({
  nome: f.nome.trim(), tipo: f.tipo, aparece_em: f.aparece_em, opcoes: f.tipo === 'lista' ? opcoesDigitadas(f.opcoes) : []
});
