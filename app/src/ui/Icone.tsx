// Ícones de traço fino, na cor do texto.
const ICONES = {
  inicio: '<path d="M3 10l9-7 9 7v10a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z"/>',
  pessoas: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0113 0"/><path d="M16 4.5a3.5 3.5 0 010 7M18 14a6.5 6.5 0 013.5 6"/>',
  contratos: '<path d="M14 3H6a1 1 0 00-1 1v16a1 1 0 001 1h12a1 1 0 001-1V8z"/><path d="M14 3v5h5M8.5 12.5h7M8.5 16h4"/>',
  mais: '<path d="M12 5v14M5 12h14"/>',
  equipe: '<path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/><circle cx="12" cy="11" r="2.5"/><path d="M8.5 16.5a4 4 0 017 0"/>',
  configuracoes: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  conta: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>',
  sair: '<path d="M15 4h4a1 1 0 011 1v14a1 1 0 01-1 1h-4M10 17l-5-5 5-5M5 12h11"/>',
  tema: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 010 17z" fill="currentColor"/>',
  buscar: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  fechar: '<path d="M6 6l12 12M18 6L6 18"/>',
  lado: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M14 4v16"/>',
  centro: '<rect x="3" y="4" width="18" height="16" rx="2"/><rect x="7.5" y="8" width="9" height="8" rx="1"/>',
  comentario: '<path d="M4 5h16v11H10l-5 4v-4H4z"/><path d="M8 9.5h8M8 12.5h5"/>',
  tabela: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 10v10"/>',
  kanban: '<rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="10" rx="1.5"/><rect x="17" y="4" width="4" height="13" rx="1.5"/>',
  arquivo: '<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10a1 1 0 001 1h12a1 1 0 001-1V9M10 13h4"/>',
  lixeira: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  copiar: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/>',
  cadeado: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
  editar: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>',
  olho: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  oculto: '<path d="M3 3l18 18M10.6 5.1A10 10 0 0112 5c6.5 0 10 7 10 7a17 17 0 01-3.2 4.2M6.6 6.6A17 17 0 002 12s3.5 7 10 7a9.7 9.7 0 005.4-1.6"/><path d="M9.9 9.9a3 3 0 004.2 4.2"/>',
  relogio: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  seta: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  voltar: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  pontos: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  check: '<path d="M5 12l5 5L20 7"/>',
  abaixo: '<path d="M6 9l6 6 6-6"/>',
  vinculo: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1.1 1.1"/><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1.1-1.1"/>',
  baixar: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  filtro: '<path d="M4 5h16l-6 7.5V18l-4 2v-7.5z"/>',
  cadastro: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="11" r="2"/><path d="M5.5 16a3 3 0 016 0M14 10h4M14 13.5h3"/>',
  dinheiro: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6.5 9.5v5M17.5 9.5v5"/>',
  divisao: '<path d="M12 4a8 8 0 108 8h-8z"/><path d="M15 3.5a8 8 0 015.5 5.5H15z"/>',
  texto: '<path d="M5 6h14M5 10h14M5 14h14M5 18h9"/>',
  anexo: '<path d="M20 11.5l-7.8 7.8a5 5 0 01-7.1-7.1l8.1-8.1a3.3 3.3 0 014.7 4.7l-8.1 8.1a1.7 1.7 0 01-2.4-2.4l7.4-7.4"/>'
};
export type NomeIcone = keyof typeof ICONES;

export function Icone({ nome, tam = 17 }: { nome: NomeIcone; tam?: number }) {
  return <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICONES[nome] }} />;
}
