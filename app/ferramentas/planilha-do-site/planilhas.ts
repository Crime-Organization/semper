// As duas planilhas de entrada, já lidas do CSV (string[][]): a do formulário do site e as exportações do Google Contatos.
// Puro: confere o cabeçalho e devolve as linhas com o número de cada uma. Ler o arquivo fica em ler.ts.
import { linhaVazia } from '../../src/regras/csv';
import { normal } from '../../src/regras/texto';

/** As colunas usadas da planilha do site (o nome exato do cabeçalho). As outras (fórmulas) são ignoradas. */
export const COLUNAS_DO_SITE = {
  envio: 'DATA DE ENVIO', nome: 'NOME', tipo: 'TIPO DE CADASTRO', genero: 'GÊNERO', nacionalidade: 'NACIONALIDADE',
  profissao: 'PROFISSÃO', estadoCivil: 'ESTADO CIVIL', cpf: 'CPF', rg: 'RG', rgExpedicao: 'DATA DE EXPEDIÇÃO DO RG',
  mae: 'NOME DA MÃE', pai: 'NOME DO PAI', nascimento: 'DATA DE NASCIMENTO', nascimentoMunicipio: 'MUNICÍPIO DE NASCIMENTO',
  nascimentoUf: 'ESTADO DO NASCIMENTO', entidadeEmpresarial: 'TIPO DE ENTIDADE EMPRESARIAL', entePublico: 'TIPO DE ENTE PÚBLICO',
  entidade: 'TIPO DE ENTIDADE', fantasia: 'NOME FANTASIA', porte: 'PORTE', cnpj: 'CNPJ', abertura: 'DATA DE CRIAÇÃO',
  representantes: 'NOME COMPLETO DO(S) REPRESENTANTE(S) LEGAL(IS)', logradouro: 'LOGRADOURO', numero: 'NÚMERO',
  complemento: 'COMPLEMENTO', bairro: 'BAIRRO', municipio: 'MUNICÍPIO', uf: 'ESTADO', cep: 'CEP', telefone: 'TELEFONE',
  email: 'E-MAIL', responsavel: 'PROFISSIONAL RESPONSÁVEL', qualificacao: 'QUALIFICAÇÃO_37'
} as const;
export type ColunaDoSite = keyof typeof COLUNAS_DO_SITE;
/** Sem estas colunas a planilha não serve. */
const OBRIGATORIAS_DO_SITE: ColunaDoSite[] = ['nome', 'tipo'];

/** Uma linha da planilha do site. */
export interface LinhaDoSite {
  /** Número da linha na planilha (o cabeçalho é a 1), contado antes de tirar as linhas vazias. */
  linha: number;
  valores: Partial<Record<ColunaDoSite, string>>;
}

/** Um contato de uma exportação do Google Contatos: as colunas pelo nome do cabeçalho ("First Name", "Phone 1 - Value"…). */
export interface ContatoDoArquivo { linha: number; campos: Record<string, string> }
/** Uma exportação do Google Contatos. */
export interface ArquivoGoogle {
  /** Nome do arquivo, sem a pasta (para a conferência: "contatos.csv:55"). */
  arquivo: string;
  cabecalho: string[];
  contatos: ContatoDoArquivo[];
}
/** Sem esta coluna, o arquivo não é uma exportação do Google Contatos. */
const COLUNA_DO_GOOGLE = 'First Name';

/** Erro de fórmula que a planilha mostra no lugar do valor: vale como célula vazia. */
const ERRO_DE_FORMULA = /^#(N\/?A|REF!?|VALUE!?|ERROR!?|NAME\??|DIV\/0!?|NUM!?|NULL!?)$/i;
const celula = (v: string | undefined) => ERRO_DE_FORMULA.test((v ?? '').trim()) ? '' : (v ?? '');

/** As linhas com número (a primeira é a 1), sem as vazias: o número é o da planilha. */
const numeradas = (tabela: string[][]) => tabela.map((celulas, i) => ({ celulas, numero: i + 1 })).filter(l => !linhaVazia(l.celulas));

/**
 * A planilha do site (já lida do CSV, com as linhas vazias) -> linhas com os valores por coluna. O cabeçalho vale sem
 * acento nem maiúscula fazer diferença. Lança Error em português se falta coluna obrigatória ou não há nenhum cadastro.
 */
export function lerPlanilhaDoSite(tabela: string[][]): LinhaDoSite[] {
  const [cabecalho, ...dados] = numeradas(tabela);
  if (!cabecalho) throw new Error('A planilha do site está vazia.');
  const indice = new Map<ColunaDoSite, number>();
  const porNome = new Map(Object.entries(COLUNAS_DO_SITE).map(([chave, nome]) => [normal(nome), chave as ColunaDoSite]));
  // Coluna com o nome repetido: vale a última, como na leitura usada nos dados reais (carregar.cjs).
  cabecalho.celulas.forEach((nome, i) => {
    const chave = porNome.get(normal(nome));
    if (chave) indice.set(chave, i);
  });
  const faltando = OBRIGATORIAS_DO_SITE.filter(c => !indice.has(c));
  if (faltando.length) {
    throw new Error(`A planilha do site não tem a coluna ${faltando.map(c => COLUNAS_DO_SITE[c]).join(' nem a coluna ')}. Baixe a aba do formulário de novo (Arquivo > Fazer download > Valores separados por vírgula).`);
  }
  if (!dados.length) throw new Error('A planilha do site não tem nenhum cadastro: só o cabeçalho.');
  return dados.map(({ celulas, numero }) => ({
    linha: numero,
    valores: Object.fromEntries([...indice].map(([chave, j]) => [chave, celula(celulas[j])]))
  }));
}

/** Uma exportação do Google Contatos (já lida do CSV) -> contatos com o número da linha. */
export function lerExportacaoDoGoogle(arquivo: string, tabela: string[][]): ArquivoGoogle {
  const [cabecalho, ...dados] = numeradas(tabela);
  if (!cabecalho?.celulas.some(c => c.trim() === COLUNA_DO_GOOGLE)) {
    throw new Error(`Um dos arquivos do Google não parece uma exportação do Google Contatos (falta a coluna ${COLUNA_DO_GOOGLE}).`);
  }
  const nomes = cabecalho.celulas.map(c => c.trim());
  return {
    arquivo, cabecalho: nomes,
    contatos: dados.map(({ celulas, numero }) => ({
      linha: numero,
      campos: Object.fromEntries(nomes.map((nome, j) => [nome, celula(celulas[j]).trim()]))
    }))
  };
}

/** Os arquivos do Google precisam ter o mesmo cabeçalho (são exportações do mesmo jeito). Lança Error se não têm. */
export function conferirCabecalhosDoGoogle(arquivos: ArquivoGoogle[]) {
  const [primeiro, ...outros] = arquivos;
  outros.forEach((a, i) => {
    if (a.cabecalho.join('|') !== primeiro.cabecalho.join('|')) {
      throw new Error(`O ${i + 2}º arquivo do Google tem colunas diferentes das do 1º. Exporte os contatos do mesmo jeito (Google CSV).`);
    }
  });
}
