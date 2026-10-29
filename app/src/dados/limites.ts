// Limites da camada de dados: quantos itens vêm por vez e o tamanho máximo dos campos.
// Os de tamanho marcados com o script do banco são exigidos por ele (regra "check"): mudar aqui sem mudar lá
// faz o banco recusar o que o formulário deixou digitar. Os outros valem só nos formulários.

/** Pessoas por página na tabela. */
export const POR_PAGINA = 50;
/** Cartões carregados por vez em cada coluna do quadro (o resto vem em "Carregar mais"). */
export const POR_COLUNA = 30;
/** Pessoas mostradas na busca enquanto se digita (BuscaPessoa). */
export const ACHADOS_DA_BUSCA = 8;
/** Últimas ações mostradas no registro de ações (Equipe). */
export const REGISTRO_DE_ACOES = 60;

/** Cadastro de pessoas: a tabela não limita o tamanho; valem só no formulário. */
export const TAMANHO_PESSOA = {
  nome: 200, nomeFantasia: 200, filiacao: 200, representantes: 400, nacionalidade: 60, profissao: 120, rg: 60,
  logradouro: 200, numero: 20, complemento: 120, bairro: 120, municipio: 120
};
/** Dados do escritório: os mesmos do banco (banco/008_identidade_escritorio.sql), menos o nome, que só o formulário limita. */
export const TAMANHO_ESCRITORIO = {
  nome: 120, oab_registro: 60, logradouro: 200, numero: 20, complemento: 100, bairro: 100, municipio: 100, email: 200, site: 200
};
/** Vínculos: nome, inverso e descrição como no banco (banco/003_vinculos.sql); a função do representante só no formulário. */
export const TAMANHO_VINCULO = { nome: 60, inverso: 60, descricao: 300, funcao: 120 };
/** Contratos: os mesmos do banco (banco/009_contratos.sql). */
export const TAMANHO_CONTRATO = { servico: 300, codigo_antigo: 40, documento_url: 500, observacoes: 4000 };
/** Número máximo de parcelas de um contrato (o banco aceita de 1 a 360). */
export const PARCELAS_MAXIMAS = 360;

/** Nome de coluna do quadro e informação sigilosa (só no formulário). */
export const TAMANHO_COLUNA = 60;
export const TAMANHO_SIGILO = 5000;
