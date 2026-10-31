// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { LINHAS_DO_PERFIL, ORDEM_NO_SITE_MAXIMA, TAMANHO_PERFIL } from '../dados/limites';
import { camposDoPerfil, errosDoPerfil, limparPerfil, nomeNoSite, perfilVazio } from './perfilProfissional';

const vazio = camposDoPerfil(perfilVazio('u-ana'));

describe('Perfil profissional', () => {
  it('quando ninguém preencheu nada, então o perfil vem vazio, fora do site e sem erros', () => {
    // Quando
    const perfil = perfilVazio('u-ana');
    // Então
    expect(perfil).toMatchObject({ perfil_id: 'u-ana', nome_exibicao: '', oab: [], no_site: false, ordem_no_site: null, atualizado_em: null });
    expect(errosDoPerfil(camposDoPerfil(perfil))).toEqual({});
  });

  it('quando o perfil é limpo, então os textos perdem os espaços, as linhas em branco e os repetidos saem, e a UF e o e-mail se acertam', () => {
    // Dado
    const digitado = {
      ...vazio, cargo: '  Sócia ', email_publico: ' Ana@Exemplo.COM ',
      oab: [{ numero: ' 123.456 ', uf: 'mg' }, { numero: '', uf: '' }],
      areas: ['Marcas', ' marcas ', 'Marcas', '', 'Patentes'],
      formacao: [{ curso: 'Direito', instituicao: ' UFMG ', ano: '2010' }, { curso: ' ', instituicao: '', ano: '' }]
    };
    // Quando
    const limpo = limparPerfil(digitado);
    // Então
    expect(limpo.cargo).toBe('Sócia');
    expect(limpo.email_publico).toBe('ana@exemplo.com');
    expect(limpo.oab).toEqual([{ numero: '123.456', uf: 'MG' }]);
    expect(limpo.areas).toEqual(['Marcas', 'marcas', 'Patentes']);
    expect(limpo.formacao).toEqual([{ curso: 'Direito', instituicao: 'UFMG', ano: '2010' }]);
  });

  it.each([
    ['uma inscrição sem número', { oab: [{ numero: '', uf: 'MG' }] }, 'oab', 'Informe o número de cada inscrição.'],
    ['uma inscrição sem UF', { oab: [{ numero: '123', uf: '' }] }, 'oab', 'Escolha a seccional (UF) de cada inscrição.'],
    ['uma formação sem curso', { formacao: [{ curso: '', instituicao: 'UFMG', ano: '' }] }, 'formacao', 'Informe o curso de cada formação.'],
    ['uma experiência sem cargo', { experiencia: [{ cargo: '', lugar: 'TJMG', periodo: '' }] }, 'experiencia', 'Informe o cargo de cada experiência.'],
    ['uma publicação sem título', { publicacoes: [{ titulo: '', onde: 'Revista', ano: '', link: '' }] }, 'publicacoes', 'Informe o título de cada publicação.'],
    ['uma publicação com link sem https', { publicacoes: [{ titulo: 'Artigo', onde: '', ano: '', link: 'revista.com/x' }] }, 'publicacoes', 'Cole o link completo, começando com https://.'],
    ['uma rede sem link', { redes: [{ nome: 'Instagram', link: '' }] }, 'redes', 'Informe o nome e o link de cada rede.'],
    ['o Lattes sem o endereço completo', { lattes: 'lattes.cnpq.br/123' }, 'lattes', 'Cole o link do Currículo Lattes, começando com http://lattes.cnpq.br/.'],
    ['o LinkedIn com um link que não é web', { linkedin: 'javascript:alert(1)' }, 'linkedin', 'Cole o link completo, começando com https://.'],
    ['um e-mail incompleto', { email_publico: 'ana@' }, 'email_publico', 'Confira o e-mail.'],
    ['a bio curta longa demais', { bio_curta: 'x'.repeat(TAMANHO_PERFIL.bio_curta + 1) }, 'bio_curta', `A bio curta tem até ${TAMANHO_PERFIL.bio_curta} letras (2 ou 3 linhas).`],
    ['uma área de atuação longa demais', { areas: ['x'.repeat(TAMANHO_PERFIL.item + 1)] }, 'areas', `Cada texto tem até ${TAMANHO_PERFIL.item} letras.`],
    ['idiomas demais', { idiomas: Array.from({ length: LINHAS_DO_PERFIL + 1 }, (_, i) => 'Idioma ' + i) }, 'idiomas', `Use até ${LINHAS_DO_PERFIL} linhas.`],
    ['a ordem no site fora da faixa', { ordem_no_site: ORDEM_NO_SITE_MAXIMA + 1 }, 'ordem_no_site', `Use um número de 0 a ${ORDEM_NO_SITE_MAXIMA}.`]
  ])('quando há %s, então só esse campo tem erro, com a mensagem certa', (_caso, mudanca, campo, mensagem) => {
    // Quando
    const erros = errosDoPerfil({ ...vazio, ...mudanca });
    // Então
    expect(erros).toEqual({ [campo]: mensagem });
  });

  it('quando o perfil está completo e certo, então não há erros', () => {
    // Dado
    const completo = {
      ...vazio, nome_exibicao: 'Ana Lima', cargo: 'Sócia', oab: [{ numero: '123.456', uf: 'MG' }], areas: ['Marcas'],
      bio_curta: 'Advogada de propriedade intelectual.', formacao: [{ curso: 'Direito', instituicao: 'UFMG', ano: '2010' }],
      publicacoes: [{ titulo: 'Marcas fortes', onde: 'Revista', ano: '2020', link: 'https://revista.com/marcas' }],
      redes: [{ nome: 'Instagram', link: 'https://instagram.com/ana' }], lattes: 'http://lattes.cnpq.br/123',
      linkedin: 'https://linkedin.com/in/ana', email_publico: 'ana@exemplo.com', ordem_no_site: 1, no_site: true
    };
    // Quando
    const erros = errosDoPerfil(completo);
    // Então
    expect(erros).toEqual({});
  });

  it('quando há nome de exibição, então é ele que vai ao site; sem ele, vai o nome do cadastro', () => {
    // Quando / Então
    expect(nomeNoSite({ nome_exibicao: ' Dra. Ana Lima ' }, 'Ana Teste Lima')).toBe('Dra. Ana Lima');
    expect(nomeNoSite({ nome_exibicao: '' }, 'Ana Teste Lima')).toBe('Ana Teste Lima');
  });
});
