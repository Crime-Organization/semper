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
  cidade: 'Montes Claros/MG',   // onde o SEMPER nasceu (página inicial)
  site: 'https://semper.app.br',
  // Contato da página inicial (quem quer conhecer o SEMPER). WhatsApp só com números, com DDI e DDD
  // (ex.: '5538999990000'); vazio, o botão abre um e-mail para o endereço abaixo.
  whatsapp: '',
  emailContato: 'contato@semper.app.br',
  cores: { destaque: '#377D22', escuro: '#1A1916' },

  // Conexão com o banco. A chave abaixo é pública por natureza (a segurança fica
  // nas regras do banco); a chave secreta nunca entra no site.
  supabaseUrl: 'https://uzafzwqjpxxiovfunxfm.supabase.co',
  supabaseChave: 'sb_publishable_8AUPxM9ZAZ5QgRgsLicunA_n8XRAsgt'
};
