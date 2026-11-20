// =====================================================================
// MARCA DO PRODUTO: o SEMPER (nome, foto da entrada, cores e o contato de
// quem quer conhecer o sistema). O SEMPER não pertence a nenhum escritório:
// o nome, a logomarca e os dados de cada escritório ficam no banco e são
// editados pelo administrador dele em Configurações.
// =====================================================================
import fotoEntrada from './imagens/farol.webp';

export const MARCA = {
  nome: 'SEMPER',
  fotoEntrada,  // fundo da tela de entrada e foto da página inicial
  site: 'https://semper.app.br',
  // Contato da página inicial (quem quer conhecer o SEMPER). WhatsApp só com números, com DDI e DDD
  // (ex.: '5538999990000'); vazio, o botão abre um e-mail para o endereço abaixo.
  whatsapp: '',
  emailContato: 'contato@semper.app.br',
  cores: { destaque: '#377D22', escuro: '#1A1916' },

  // Conexão com o banco: o endereço e a chave pública vêm das variáveis do ambiente (app/.env.production no site publicado,
  // app/.env.docker no "npm run dev"), escolhidas e conferidas pelo vite.config.ts com regras/qualBanco.ts. No banco fictício e nos testes,
  // um endereço que não existe.
  ...__BANCO__
};
