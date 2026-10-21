// Utilidades compartidas por las tres páginas. Todas las rutas son relativas para funcionar en GitHub Pages.
const $ = (s, e = document) => e.querySelector(s);
const SES = 'milpa.sesion';
const getSes = () => { try { return JSON.parse(localStorage.getItem(SES)); } catch { return null; } };
const setSes = s => { try { localStorage.setItem(SES, JSON.stringify(s)); } catch {} };
const clearSes = () => { try { localStorage.removeItem(SES); } catch {} };

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

let CARTAS = [], BYN = new Map();
async function loadCartas() {
  CARTAS = await (await fetch('cartas.json')).json();
  BYN = new Map(CARTAS.map(c => [c.n, c]));
  CARTAS.forEach(c => { new Image().src = c.img; }); // precarga en segundo plano
}

// Diferencia entre el reloj del servidor de Firebase y el del dispositivo, para las cuentas regresivas
let clockOff = 0;
const secsLeft = at => Math.max(0, Math.ceil((at - (Date.now() + clockOff)) / 1000));

let toastT;
function toast(msg, bad) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.append(t); }
  t.className = 'toast' + (bad ? ' bad' : '');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 4500);
}

const FIG = { esquinas: [0, 3, 12, 15], centro: [5, 6, 9, 10], x: [0, 5, 10, 15, 3, 6, 9, 12], marco: [0, 1, 2, 3, 4, 7, 8, 11, 12, 13, 14, 15] };
const FIG_NOM = { esquinas: 'Cuatro esquinas', centro: 'Centro (4 cuadros)', x: 'X', marco: 'Marco' };
function miniGrid(cells) {
  return `<span class="mini">${[...Array(16).keys()].map(i => `<i class="${cells.includes(i) ? 'on' : ''}"></i>`).join('')}</span>`;
}
function reglaTexto(cfg) {
  const k = ['aprendizaje', 'adivinanza'].includes(cfg.mode) ? cfg.win : cfg.mode;
  if (k === 'clasica') return { txt: 'Llena todo el tablero', mini: miniGrid([...Array(16).keys()]) };
  if (k === 'linea') return { txt: 'Completa una fila, columna o diagonal', mini: '' };
  return { txt: `Figura: ${FIG_NOM[cfg.figura]}`, mini: miniGrid(FIG[cfg.figura]) };
}
const MODO_NOM = { clasica: 'Clásica', linea: 'Línea', figuras: 'Figuras', aprendizaje: 'Aprendizaje', adivinanza: 'Adivinanza' };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sinSala = () => {
  document.body.innerHTML = '<div class="wrap stack"><div class="card stack"><h2>La sala ya no existe</h2><a class="btn" href="./">Volver al inicio</a></div></div>';
};
