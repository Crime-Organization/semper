// =====================================================================
// MARCA E CONFIGURAÇÃO — o único lugar para trocar nome, logo e cores.
// Para licenciar o SEMPER a outro escritório, basta editar este arquivo
// e substituir as imagens em assets/img/.
// =====================================================================
window.MARCA = {
  nome: 'Braga Ferreira',
  submarca: 'SEMPER',
  logoClaro: 'logo-claro.svg',   // sobre fundo escuro (arquivos em assets/img/)
  logoEscuro: 'logo-escuro.svg', // sobre fundo claro
  cidade: 'Montes Claros/MG',
  site: 'https://bragaferreira.adv.br',
  cores: { destaque: '#377D22', escuro: '#1A1916' },

  // Conexão com o banco. A chave abaixo é pública por natureza (a segurança fica
  // nas regras do banco); a chave secreta nunca entra no site.
  supabaseUrl: 'https://uzafzwqjpxxiovfunxfm.supabase.co',
  supabaseChave: 'sb_publishable_8AUPxM9ZAZ5QgRgsLicunA_n8XRAsgt'
};
