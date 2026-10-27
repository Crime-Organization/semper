// =====================================================================
// MARCA E CONFIGURAÇÃO: o único lugar para trocar nome, logo e cores.
// Para licenciar o SEMPER a outro escritório, basta editar este arquivo
// e substituir as imagens em src/imagens/.
// =====================================================================
import logoClaro from './imagens/logo-claro.svg';
import logoEscuro from './imagens/logo-escuro.svg';
import fotoEntrada from './imagens/farol.webp';

export const MARCA = {
  nome: 'Braga Ferreira',
  submarca: 'SEMPER',
  logoClaro,    // sobre fundo escuro
  logoEscuro,   // sobre fundo claro
  fotoEntrada,  // fundo da tela de entrada
  cidade: 'Montes Claros/MG',
  site: 'https://bragaferreira.adv.br',
  // Contato da página inicial (quem quer conhecer o SEMPER). WhatsApp só com números, com DDI e DDD
  // (ex.: '5538999990000'); vazio, o botão abre um e-mail para o endereço abaixo.
  whatsapp: '',
  emailContato: 'contato@bragaferreira.adv.br',
  cores: { destaque: '#377D22', escuro: '#1A1916' },

  // Conexão com o banco. A chave abaixo é pública por natureza (a segurança fica
  // nas regras do banco); a chave secreta nunca entra no site.
  supabaseUrl: 'https://uzafzwqjpxxiovfunxfm.supabase.co',
  supabaseChave: 'sb_publishable_8AUPxM9ZAZ5QgRgsLicunA_n8XRAsgt'
};
