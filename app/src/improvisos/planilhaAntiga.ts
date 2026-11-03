// PROVISÓRIO (tarefa #219): sai quando a sincronização oficial com o Google Contatos (#164) entrar no ar.
// Cada pessoa cadastrada no SEMPER também vai para o script do formulário antigo, que grava a linha na planilha, cria o contato
// no Google e manda o e-mail que abre o cartão no Trello. Vai só o primeiro telefone e o primeiro e-mail. O envio não tem volta:
// desfazer o cadastro no SEMPER deixa a linha, o contato e o cartão lá fora.
//
// Para tirar, procure "PROVISORIO-219" no projeto: apague a pasta src/improvisos e o teste e2e/planilha-provisoria.spec.ts, tire as
// três linhas de src/paginas/NovaPessoa.tsx e, em public/.htaccess, tire os dois endereços do connect-src e a linha de comentário.
// Nada mais depende disto.
import type { Contexto, DadosPessoa, TipoPessoa } from '../dados';
import { avisar } from '../ui/avisos';
import { ESTADO_CIVIL, fmtCNPJ, fmtCPF } from '../regras/pessoa';
import { normal } from '../regras/texto';

// O endereço e o token já são públicos: estão no HTML do formulário do site.
const ENDERECO_DO_SCRIPT = 'https://script.google.com/macros/s/AKfycbz_Pu4V5qsjc2wMA5sw8GzdZNpOZrZ2Z1lhJP5ofjpX_roF-tOvv6mSzGwv705knB1gdw/exec';
const TOKEN_DO_SCRIPT = 'BRAGA_SECRET_TOKEN';
/** Só este escritório usa a planilha: os outros clientes do SEMPER nunca enviam nada para lá. */
const ESCRITORIO_DA_PLANILHA = 'braga-ferreira';

/** Como a aba LISTAS escreve cada nome: é por este texto, com os acentos, que a planilha acha o e-mail do profissional. */
const NOMES_NA_PLANILHA = ['ADIEL MARCOS FREITAS OLIVEIRA', 'AMANDA OLIVEIRA MENDES', 'BÁRBARA SILVA ARAÚJO', 'CAMILA ROCHA TOLENTINO',
  'CAROLINE ANTUNES ATHAYDE SANTANA', 'HÉLLYNE NOGUEIRA BARBOZA GONÇALVES', 'JACKELINE FAYER PIMENTA', 'KARLA GRACIELLY CAETANO DE ANDRADE',
  'KELLEN KAROLINE PEREIRA BRAGA', 'LUCIO FERREIRA DOS SANTOS', 'LUIZ GUSTAVO BRAGA FERREIRA', 'MATEUS FREITAS GONÇALVES',
  'PAULO HENRIQUE MENDES CARDOSO', 'SABRINA ALVES SANTOS', 'STEFANIE GONÇALVES BARBOSA', 'VICTOR ALMEIDA VIEIRA'];
/** Só os nomes da lista: o formulário nunca mandou outros, e a planilha não sabe o que fazer com eles. */
const nomesNaPlanilha = (profissionais: string[]) => NOMES_NA_PLANILHA.filter(n => profissionais.some(p => normal(p) === normal(n)));

const TIPO_SEM_NATUREZA: Record<TipoPessoa, string> = { pf: 'Pessoa física', pj: 'Pessoa Jurídica', contato: 'Somente informações de contato' };
// A natureza decide o texto do tipo e o campo do script que recebe o tipo de entidade.
const POR_NATUREZA: Record<string, { tipo: string; campo: 'tipo_empresarial' | 'tipo_publico' | 'tipo_semfins' }> = {
  empresarial: { tipo: 'Entidade Empresarial', campo: 'tipo_empresarial' },
  publica: { tipo: 'Administração Pública', campo: 'tipo_publico' },
  sem_fins: { tipo: 'Entidade sem Fins Lucrativos', campo: 'tipo_semfins' }
};
const GENERO: Record<string, string> = { m: 'Masculino', f: 'Feminino' };
const PORTE: Record<string, string> = { me: 'Microempresa', epp: 'Empresa de Pequeno Porte', medio: 'Empresa de Médio Porte', grande: 'Empresa de Grande Porte' };

const data = (iso?: string | null) => iso ? iso.split('-').reverse().join('/') : '';
const cep = (v?: string | null) => v ? v.replace(/^(\d{5})(\d{3})$/, '$1-$2') : '';

/** Os mesmos campos que o formulário do site envia. Os que não valem para o tipo vão vazios. */
export function camposDoScript(p: DadosPessoa, profissionais: string[], agora: Date) {
  const tipo = p.tipo ?? 'contato', natureza = POR_NATUREZA[p.natureza ?? ''];
  const tipoDeCadastro = tipo === 'pj' && natureza ? natureza.tipo : TIPO_SEM_NATUREZA[tipo];
  const entidades = { tipo_empresarial: '', tipo_publico: '', tipo_semfins: '' };
  if (natureza) entidades[natureza.campo] = p.tipo_entidade ?? '';
  return {
    token: TOKEN_DO_SCRIPT,
    timestamp: agora.toLocaleString('pt-BR'),
    tipo_pessoa: tipoDeCadastro, tipo_cadastro: tipoDeCadastro, tipo_de_cadastro: tipoDeCadastro,
    nome: p.nome ?? '',
    genero: tipo === 'pf' ? GENERO[p.genero ?? ''] ?? '' : '',
    nacionalidade: p.nacionalidade === 'brasileira' ? 'brasileiro(a)' : p.nacionalidade ?? '',
    profissao: p.profissao ?? '',
    estado_civil: ESTADO_CIVIL[p.estado_civil ?? '']?.[2] ?? '',
    cpf: tipo === 'pf' ? fmtCPF(p.documento) : '',
    rg: p.rg ?? '',
    data_expedicao: data(p.rg_expedicao),
    nome_mae: p.nome_mae ?? '',
    nome_pai: p.nome_pai ?? '',
    data_nascimento: data(p.nascimento),
    municipio_nascimento: p.nascimento_municipio ?? '',
    estado_nascimento: p.nascimento_uf ?? '',
    ...entidades,
    titulo_estab: p.nome_fantasia ?? '',
    porte: PORTE[p.porte ?? ''] ?? '',
    cnpj: tipo === 'pj' ? fmtCNPJ(p.documento) : '',
    data_abertura: data(p.abertura),
    representante: p.representantes ?? '',
    logradouro: p.logradouro ?? '',
    numero: p.numero ?? '',
    complemento: p.complemento ?? '',
    bairro: p.bairro ?? '',
    municipio: p.municipio ?? '',
    estado_end: p.uf ?? '',
    cep: cep(p.cep),
    telefone: p.telefones?.[0] ?? '',
    email: p.emails?.[0] ?? '',
    profissional: nomesNaPlanilha(profissionais).join(', ')
  };
}

// "npm run dev" fala com o banco de verdade, mas um teste feito ali não pode abrir contato nem cartão.
const usaAPlanilha = (ctx: Pick<Contexto, 'escritorio'>) => ctx.escritorio?.slug === ESCRITORIO_DA_PLANILHA && import.meta.env.MODE !== 'development';

/** Não espera nem atrapalha o cadastro, que já está salvo. Como no formulário do site, só uma falha de rede é percebida. */
export function enviarParaPlanilhaAntiga(p: DadosPessoa, responsaveis: string[], ctx: Pick<Contexto, 'escritorio' | 'equipe'>) {
  if (!usaAPlanilha(ctx)) return;
  const nomes = responsaveis.flatMap(id => ctx.equipe.find(m => m.id === id)?.nome ?? []);
  fetch(ENDERECO_DO_SCRIPT, { method: 'POST', mode: 'no-cors', keepalive: true, body: JSON.stringify(camposDoScript(p, nomes, new Date())) })
    .catch(() => avisar('A pessoa foi salva no SEMPER, mas não deu para confirmar o envio à planilha. Confira a planilha; se ela não estiver lá, cadastre pelo formulário do site.', 'erro'));
}

/** O desfazer só alcança o SEMPER: o resto precisa ser apagado à mão. */
export function lembrarDeApagarNaPlanilha(ctx: Pick<Contexto, 'escritorio'>) {
  if (usaAPlanilha(ctx)) avisar('Saiu do SEMPER, mas a linha na planilha, o contato no Google e o cartão no Trello continuam: apague à mão.', 'erro');
}
