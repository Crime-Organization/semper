// Foto do perfil: a pessoa escolhe uma foto, ajusta o corte redondo (arrastar e aproximar, como foto de perfil de
// rede social) e vê a prévia. Ao salvar, o próprio navegador grava dois AVIF redondos de fundo transparente: 1000×1000
// (a página do advogado no site) e 150×150 (as bolinhas do sistema). O conversor AVIF só é baixado ao salvar.
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { SD, type FotoDoPerfil as Foto, type Membro } from '../dados';
import { FOTO_GRANDE, FOTO_PEQUENA } from '../dados/limites';
import { aproximar, arrastar, corteInicial, fotoPequena, naJanela, recorteDaFoto, ZOOM_MAXIMO, type Corte, type Medidas } from '../regras/foto';
import { Avatar } from '../ui/Avatar';
import { avisar, falha } from '../ui/avisos';
import { BotaoDuplo } from '../ui/Botoes';
import { Carregando, estiloBotao, Nota } from '../ui/base';
import { useSessao } from '../ui/sessao';

/** Lado da janela do corte na tela, em pixels. */
const JANELA_DO_CORTE = 260;
/** Quanto a foto anda a cada seta do teclado, em pixels da janela. */
const PASSO_DA_SETA = 10;
/** Quanto cada tecla + ou -, ou cada volta da roda do mouse, aproxima ou afasta. */
const PASSO_DO_ZOOM = 0.1;
/** Qualidade e velocidade do AVIF (0 a 100, e 0 a 10): boa nitidez em arquivos pequenos, sem demorar demais. */
const QUALIDADE_DA_FOTO = 60, VELOCIDADE_DA_FOTO = 7;
/** Setas do teclado e para onde cada uma move a foto. */
const SETAS: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
/** Teclas que aproximam (1) e afastam (-1). */
const TECLAS_DO_ZOOM: Record<string, number> = { '+': 1, '=': 1, '-': -1 };

/** A foto escolhida, já aberta, com as medidas dela. */
interface Escolhida { img: HTMLImageElement; medidas: Medidas; endereco: string }

/** Desenha o recorte redondo num quadrado de "lado" pixels, transparente fora do círculo. */
function desenharRedondo(tela: HTMLCanvasElement, origem: CanvasImageSource, x: number, y: number, ladoOrigem: number, lado: number) {
  tela.width = tela.height = lado;
  const c = tela.getContext('2d')!;
  c.clearRect(0, 0, lado, lado);
  c.save();
  c.beginPath();
  c.arc(lado / 2, lado / 2, lado / 2, 0, Math.PI * 2);
  c.clip();
  c.imageSmoothingQuality = 'high';
  c.drawImage(origem, x, y, ladoOrigem, ladoOrigem, 0, 0, lado, lado);
  c.restore();
  return c;
}

/** Os dois AVIF redondos: o grande sai da foto; o pequeno, do grande (assim os dois têm o mesmo corte). */
async function gerarArquivos(f: Escolhida, corte: Corte) {
  const { default: avif } = await import('@jsquash/avif/encode');
  const r = recorteDaFoto(corte, f.medidas);
  const grande = document.createElement('canvas'), pequena = document.createElement('canvas');
  const cg = desenharRedondo(grande, f.img, r.x, r.y, r.lado, FOTO_GRANDE);
  const cp = desenharRedondo(pequena, grande, 0, 0, FOTO_GRANDE, FOTO_PEQUENA);
  const opcoes = { quality: QUALIDADE_DA_FOTO, speed: VELOCIDADE_DA_FOTO };
  const [g, p] = [await avif(cg.getImageData(0, 0, FOTO_GRANDE, FOTO_GRANDE), opcoes), await avif(cp.getImageData(0, 0, FOTO_PEQUENA, FOTO_PEQUENA), opcoes)];
  return [new Blob([g], { type: 'image/avif' }), new Blob([p], { type: 'image/avif' })] as const;
}

export function FotoDoPerfil({ membro }: { membro: Membro }) {
  const { recarregar } = useSessao();
  const [foto, setFoto] = useState<Foto | null | undefined>(undefined);
  const [escolhida, setEscolhida] = useState<Escolhida | null>(null);
  const [corte, setCorte] = useState<Corte | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null), janela = useRef<HTMLDivElement>(null), previa = useRef<HTMLCanvasElement>(null);
  const ponteiro = useRef<{ x: number; y: number } | null>(null);

  const carregar = useCallback(() => SD.fotoDoPerfil(membro.id).then(setFoto).catch(e => { falha(e); setFoto(null); }), [membro.id]);
  useEffect(() => { void carregar(); }, [carregar]);
  // A foto escolhida é um endereço local da aba: some quando sai da tela ou troca de foto.
  useEffect(() => () => { if (escolhida) URL.revokeObjectURL(escolhida.endereco); }, [escolhida]);
  // A prévia da bolinha acompanha o corte.
  useEffect(() => {
    if (!escolhida || !corte || !previa.current) return;
    const r = recorteDaFoto(corte, escolhida.medidas);
    desenharRedondo(previa.current, escolhida.img, r.x, r.y, r.lado, FOTO_PEQUENA);
  }, [escolhida, corte]);
  // A roda do mouse aproxima e afasta sem rolar a página (por isso fora do React, que não deixa impedir a rolagem).
  useEffect(() => {
    const el = janela.current;
    if (!el || !escolhida) return;
    const rodar = (e: WheelEvent) => {
      e.preventDefault();
      setCorte(c => c && aproximar(c, escolhida.medidas, c.zoom * (1 - Math.sign(e.deltaY) * PASSO_DO_ZOOM)));
    };
    el.addEventListener('wheel', rodar, { passive: false });
    return () => el.removeEventListener('wheel', rodar);
  }, [escolhida]);

  function escolher(f: File | undefined) {
    if (!f) return;
    const endereco = URL.createObjectURL(f), img = new Image();
    img.onload = () => {
      const medidas = { largura: img.naturalWidth, altura: img.naturalHeight };
      setEscolhida({ img, medidas, endereco });
      setCorte(corteInicial(medidas));
    };
    img.onerror = () => { URL.revokeObjectURL(endereco); falha(new Error('Não foi possível abrir essa imagem. Use uma foto em JPG, PNG ou WebP.')); };
    img.src = endereco;
  }
  const cancelar = () => { setEscolhida(null); setCorte(null); if (arquivo.current) arquivo.current.value = ''; };

  async function salvar() {
    if (!escolhida || !corte) return;
    setOcupado(true);
    try {
      const [grande, pequena] = await gerarArquivos(escolhida, corte);
      await SD.fotoSalvar(membro.id, grande, pequena);
      cancelar();
      await carregar();
      await recarregar(true);
      avisar('Foto salva. Ela já aparece nas bolinhas.');
    } catch (e) { falha(e); }
    setOcupado(false);
  }
  async function tirar() {
    try {
      await SD.fotoRemover(membro.id);
      await carregar();
      await recarregar(true);
      avisar('Foto tirada. As bolinhas voltam às iniciais.');
    } catch (e) { falha(e); }
  }

  function apertar(e: PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    ponteiro.current = { x: e.clientX, y: e.clientY };
  }
  function mover(e: PointerEvent<HTMLDivElement>) {
    const antes = ponteiro.current;
    if (!antes || !escolhida) return;
    ponteiro.current = { x: e.clientX, y: e.clientY };
    setCorte(c => c && arrastar(c, escolhida.medidas, e.clientX - antes.x, e.clientY - antes.y, JANELA_DO_CORTE));
  }
  function teclar(e: KeyboardEvent<HTMLDivElement>) {
    if (!escolhida || !corte) return;
    const seta = SETAS[e.key];
    const zoom = TECLAS_DO_ZOOM[e.key];
    if (!seta && !zoom) return;
    e.preventDefault();
    setCorte(seta ? arrastar(corte, escolhida.medidas, -seta[0] * PASSO_DA_SETA, -seta[1] * PASSO_DA_SETA, JANELA_DO_CORTE)
      : aproximar(corte, escolhida.medidas, corte.zoom + zoom! * PASSO_DO_ZOOM * corte.zoom));
  }

  const entrada = <input ref={arquivo} type="file" accept="image/*" hidden aria-label="Arquivo da foto" onChange={e => escolher(e.target.files?.[0])} />;
  if (foto === undefined) return <Carregando />;

  if (escolhida && corte) {
    const t = naJanela(corte, escolhida.medidas, JANELA_DO_CORTE);
    return <div className="foto-perfil foto-cortando">
      {entrada}
      <div ref={janela} className="foto-janela" style={{ width: JANELA_DO_CORTE, height: JANELA_DO_CORTE }} tabIndex={0} role="group"
        aria-label="Corte da foto: arraste ou use as setas para mover; + e - para aproximar e afastar"
        onPointerDown={apertar} onPointerMove={mover} onPointerUp={() => { ponteiro.current = null; }} onPointerCancel={() => { ponteiro.current = null; }} onKeyDown={teclar}>
        <img src={escolhida.endereco} alt="" draggable={false}
          style={{ width: escolhida.medidas.largura, height: escolhida.medidas.altura, transform: `translate(${t.x}px, ${t.y}px) scale(${t.escala})` }} />
        <span className="foto-mascara" aria-hidden="true" />
      </div>
      <div className="foto-controles">
        <label className="foto-zoom">Aproximar
          <input type="range" min={1} max={ZOOM_MAXIMO} step={PASSO_DO_ZOOM / 10} value={corte.zoom}
            onChange={e => setCorte(aproximar(corte, escolhida.medidas, Number(e.target.value)))} />
        </label>
        <div className="foto-previa">
          <canvas ref={previa} role="img" aria-label="Prévia da bolinha" />
          <Nota>Assim fica a sua bolinha. No site, a mesma foto vai em {FOTO_GRANDE}×{FOTO_GRANDE}.</Nota>
        </div>
        {fotoPequena(escolhida.medidas) && <Nota>Esta foto tem menos de {FOTO_GRANDE} pixels no menor lado: no site, ela pode ficar sem nitidez.</Nota>}
        <div className="acoes">
          <button type="button" className={estiloBotao({ variante: 'principal' })} disabled={ocupado} onClick={salvar}>{ocupado ? 'Preparando a foto…' : 'Salvar foto'}</button>
          <button type="button" className={estiloBotao()} disabled={ocupado} onClick={cancelar}>Cancelar</button>
        </div>
      </div>
    </div>;
  }

  return <div className="foto-perfil">
    {entrada}
    {foto ? <img className="foto-atual" src={foto.grande} alt={`Foto de ${membro.nome}`} width={120} height={120} /> : <Avatar p={{ ...membro, foto: null }} tam={120} />}
    <div className="foto-texto">
      <Nota>{foto ? 'Esta foto vai para o site e para as suas bolinhas no sistema.'
        : 'Sem foto, as bolinhas mostram as iniciais. Use uma foto grande, de rosto, com boa luz: você ajusta o corte redondo antes de salvar.'}</Nota>
      <div className="acoes">
        <button type="button" className={estiloBotao()} onClick={() => arquivo.current?.click()}>{foto ? 'Trocar foto' : 'Escolher foto'}</button>
        {foto && <BotaoDuplo variante="perigo" confirmar="Confirmar: tirar a foto" aoConfirmar={tirar}>Tirar foto</BotaoDuplo>}
      </div>
      {foto && <p className="foto-baixar">
        Baixar: <a href={foto.grande} download={`foto-${FOTO_GRANDE}.avif`}>{FOTO_GRANDE}×{FOTO_GRANDE}</a> · <a href={foto.pequena} download={`foto-${FOTO_PEQUENA}.avif`}>{FOTO_PEQUENA}×{FOTO_PEQUENA}</a>
      </p>}
    </div>
  </div>;
}
