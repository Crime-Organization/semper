// Checagem de contraste para testes: cole no console (ou rode pela automação) numa página do SEMPER.
// Lista os textos visíveis com contraste abaixo do mínimo da WCAG (4,5:1; 3:1 para textos grandes).
(function () {
  const rgb = s => { const m = String(s).match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, b, a = 1] = m[1].split(',').map(Number); return { r, g, b, a }; };
  const lum = ({ r, g, b }) => [r, g, b].map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; })
    .reduce((t, v, i) => t + v * [.2126, .7152, .0722][i], 0);
  const mistura = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
  function fundo(el) {
    const camadas = [];
    for (let e = el; e; e = e.parentElement) {
      const c = rgb(getComputedStyle(e).backgroundColor);
      if (c && c.a > 0) { camadas.push(c); if (c.a >= 1) break; }
    }
    let base = { r: 255, g: 255, b: 255, a: 1 };
    if (getComputedStyle(document.documentElement).colorScheme === 'dark') base = rgb(getComputedStyle(document.body).backgroundColor) || base;
    return camadas.reverse().reduce((b, c) => mistura(c, b), base);
  }
  const problemas = [];
  const vistos = new Set();
  document.querySelectorAll('body *').forEach(el => {
    if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') return;
    const texto = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(' ').trim();
    if (!texto && !(el.tagName === 'INPUT' && el.placeholder)) return;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || Number(cs.opacity) === 0) return;
    const cor = rgb(cs.color); if (!cor) return;
    const bg = fundo(el);
    const fg = mistura(cor, bg);
    const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
    const razao = (a + .05) / (b + .05);
    const grande = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.66 && Number(cs.fontWeight) >= 700);
    const minimo = grande ? 3 : 4.5;
    if (razao < minimo) {
      const chave = el.tagName + '|' + (el.className || '') + '|' + texto.slice(0, 30);
      if (vistos.has(chave)) return; vistos.add(chave);
      problemas.push(`${razao.toFixed(2)}:1 (mín. ${minimo}) <${el.tagName.toLowerCase()}${el.className ? ' class="' + el.className + '"' : ''}> "${(texto || el.placeholder).slice(0, 50)}"`);
    }
  });
  return problemas;
})();
