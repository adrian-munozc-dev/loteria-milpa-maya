// Lógica de la sala. Corre en el navegador del anfitrión; Firebase sirve de transporte y respaldo.
// Los jugadores escriben sus marcas y reclamos; el anfitrión reparte tableros, canta y valida.
import { conectar, ref, get, set, update, remove, onValue } from './firebase.js';

const SIZE = 16;
const MAX_PLAYERS = 40;
const KEY = 'milpa.sala';
const CLAIM_TTL = 20000;
const LINEAS = [
  [0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11], [12, 13, 14, 15],
  [0, 4, 8, 12], [1, 5, 9, 13], [2, 6, 10, 14], [3, 7, 11, 15],
  [0, 5, 10, 15], [3, 6, 9, 12],
];
const MODOS = ['clasica', 'linea', 'figuras', 'aprendizaje', 'adivinanza'];

const rnd = n => crypto.getRandomValues(new Uint32Array(1))[0] % n;
const shuffle = a => {
  for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
// Firebase devuelve arreglos vacíos como null y a veces como objetos
const arr = v => (Array.isArray(v) ? v : v ? Object.values(v) : []);
const keyOf = b => [...b].sort((a, c) => a - c).join(',');

export async function startHost({ nueva, onState, onConn }) {
  const { db, uid } = await conectar('host');
  let off = 0;
  onValue(ref(db, '.info/serverTimeOffset'), s => { off = s.val() || 0; });
  const now = () => Date.now() + off;
  const R = (code, p) => ref(db, `salas/${code}${p ? '/' + p : ''}`);
  const nums = CARTAS.map(c => c.n);

  const blank = code => ({
    code, status: 'lobby',
    config: { mode: 'linea', win: 'linea', figura: 'esquinas', auto: false, interval: 8, revealSecs: 10 },
    deck: [], called: [], current: null, winner: null, finishReason: null,
    players: new Map(), boardKeys: new Set(), timers: {}, nextAt: null, revealAt: null, claims: new Map(),
  });

  async function resume(code) {
    const v = (await get(R(code))).val();
    if (!v || v.hostUid !== uid || !v.pub) return null;
    const room = blank(code);
    const p = v.pub, sec = v.secreto || {};
    Object.assign(room, {
      status: p.status, config: { ...room.config, ...p.config }, called: arr(p.called), deck: arr(sec.deck),
      winner: p.winner || null, finishReason: p.finishReason || null,
      current: sec.currentN != null ? { n: sec.currentN, revealed: !!(p.current && p.current.revealed) } : null,
    });
    for (const [id, j] of Object.entries(v.jugadores || {})) {
      if (!j.board) continue;
      const board = arr(j.board);
      room.boardKeys.add(keyOf(board));
      room.players.set(id, { id, name: j.name, board, marks: new Set(arr(j.marks)), conn: false });
    }
    return room;
  }

  async function create() {
    for (let d = 2, tries = 0; d <= 5;) {
      const code = 'MILPA-' + String(rnd(10 ** d)).padStart(d, '0');
      try { await set(R(code, 'hostUid'), uid); } catch { if (++tries > 6) { d++; tries = 0; } continue; }
      return blank(code);
    }
    throw new Error('No se pudo crear la sala');
  }

  let room, saved = null;
  try { saved = localStorage.getItem(KEY); } catch {}
  if (saved && nueva) { try { await remove(R(saved)); } catch {} saved = null; }
  if (saved && !nueva) room = await resume(saved);
  if (!room) room = await create();
  try { localStorage.setItem(KEY, room.code); } catch {}
  const code = room.code;

  // ---------- reglas ----------
  function newBoard() {
    for (let i = 0; i < 2000; i++) {
      const b = shuffle([...nums]).slice(0, SIZE);
      const k = keyOf(b);
      if (!room.boardKeys.has(k)) { room.boardKeys.add(k); return b; }
    }
    for (;;) { // pocas cartas: al menos un orden distinto
      const b = shuffle([...nums]).slice(0, SIZE);
      if (![...room.players.values()].some(p => p.board.join() === b.join())) return b;
    }
  }

  function rule() {
    const { mode, win, figura } = room.config;
    return { kind: mode === 'aprendizaje' || mode === 'adivinanza' ? win : mode, figura };
  }

  function checkWin(p) {
    const called = new Set(room.called);
    for (const cell of p.marks) {
      const n = p.board[cell];
      if (!called.has(n)) return { ok: false, msg: `Marcaste "${BYN.get(n).maya}" y todavía no ha salido. Quita esa semilla.` };
    }
    const r = rule();
    const ok = r.kind === 'clasica' ? p.marks.size >= SIZE && [...Array(SIZE).keys()].every(c => p.marks.has(c))
      : r.kind === 'figuras' ? FIG[r.figura].every(c => p.marks.has(c))
      : LINEAS.some(l => l.every(c => p.marks.has(c)));
    if (ok) return { ok: true };
    return { ok: false, msg: { clasica: 'Aún no llenas todo el tablero.', linea: 'Aún no completas una fila, columna o diagonal.', figuras: 'Aún no completas la figura.' }[r.kind] };
  }

  // ---------- estado publicado ----------
  function pubObj() {
    const cur = room.current;
    return JSON.parse(JSON.stringify({
      status: room.status, config: room.config,
      current: cur ? (cur.revealed ? { revealed: true, n: cur.n } : { revealed: false, pista: BYN.get(cur.n).pista }) : null,
      called: room.called, nextAt: room.nextAt, revealAt: room.revealAt,
      deckLeft: room.deck.length, playerCount: room.players.size,
      winner: room.winner, finishReason: room.finishReason, ping: now(),
    }));
  }

  function broadcast() {
    onState({
      ...pubObj(), serverNow: now(), code, role: 'host',
      players: [...room.players.values()].map(p => ({ id: p.id, name: p.name, conn: p.conn, marks: p.marks.size })),
    });
    update(R(code), {
      pub: pubObj(),
      secreto: { deck: room.deck, currentN: room.current ? room.current.n : null },
    }).catch(e => console.error('No se pudo guardar', e));
  }

  function clearTimers() {
    clearTimeout(room.timers.next); clearTimeout(room.timers.reveal);
    room.nextAt = room.revealAt = null;
  }

  function schedule() {
    clearTimers();
    if (room.status !== 'playing') return;
    const cur = room.current;
    if (cur && !cur.revealed) {
      const ms = room.config.revealSecs * 1000;
      room.revealAt = now() + ms;
      room.timers.reveal = setTimeout(reveal, ms);
    } else if (room.config.auto) {
      const ms = (cur ? room.config.interval : 3) * 1000;
      room.nextAt = now() + ms;
      room.timers.next = setTimeout(draw, ms);
    }
  }

  function draw() {
    if (room.status !== 'playing') return;
    if (!room.deck.length) { room.status = 'finished'; room.finishReason = 'deck'; clearTimers(); return broadcast(); }
    const n = room.deck.pop();
    if (room.config.mode === 'adivinanza') room.current = { n, revealed: false };
    else { room.current = { n, revealed: true }; room.called.push(n); }
    schedule(); broadcast();
  }

  function reveal() {
    const cur = room.current;
    if (room.status !== 'playing' || !cur || cur.revealed) return;
    cur.revealed = true; room.called.push(cur.n);
    schedule(); broadcast();
  }

  function resetRound() {
    clearTimers();
    Object.assign(room, { status: 'lobby', deck: [], called: [], current: null, winner: null, finishReason: null, boardKeys: new Set() });
    const up = {};
    for (const p of room.players.values()) {
      p.board = newBoard(); p.marks = new Set();
      up[`jugadores/${p.id}/board`] = p.board; up[`jugadores/${p.id}/marks`] = null;
    }
    update(R(code), up).catch(console.error);
  }

  function action(b) {
    const cfg = room.config;
    switch (b.type) {
      case 'config': {
        const c = b.config || {};
        if (room.status === 'lobby') {
          if (MODOS.includes(c.mode)) cfg.mode = c.mode;
          if (['clasica', 'linea', 'figuras'].includes(c.win)) cfg.win = c.win;
          if (c.figura in FIG) cfg.figura = c.figura;
          if (Number.isFinite(+c.revealSecs)) cfg.revealSecs = Math.min(60, Math.max(3, Math.round(+c.revealSecs)));
        }
        if (typeof c.auto === 'boolean') cfg.auto = c.auto;
        if (Number.isFinite(+c.interval)) cfg.interval = Math.min(120, Math.max(2, Math.round(+c.interval)));
        if (room.status === 'playing') schedule();
        return broadcast();
      }
      case 'start':
        if (room.status !== 'lobby') return;
        room.deck = shuffle([...nums]); room.status = 'playing';
        schedule(); return broadcast();
      case 'draw':
        if (room.status !== 'playing') return;
        return room.current && !room.current.revealed ? reveal() : draw();
      case 'reveal': return reveal();
      case 'newround': resetRound(); return broadcast();
    }
  }

  // ---------- jugadores ----------
  function syncPlayers(v) {
    const up = {};
    for (const [id, j] of Object.entries(v)) {
      let p = room.players.get(id);
      if (p) { p.marks = new Set(arr(j.marks)); p.conn = !!j.conn; continue; }
      if (!j.name) continue;
      const lower = j.name.toLowerCase();
      const old = [...room.players.values()].find(x => x.id !== id && !x.conn && x.name.toLowerCase() === lower && !v[x.id]?.conn);
      if (old) { // vuelve con otro dispositivo o sin sesión: hereda su tablero y marcas
        p = { id, name: old.name, board: old.board, marks: old.marks, conn: !!j.conn };
        room.players.delete(old.id);
        up[`jugadores/${old.id}`] = null;
        up[`jugadores/${id}/marks`] = [...p.marks].length ? [...p.marks] : null;
      } else {
        if (room.players.size >= MAX_PLAYERS) continue;
        let name = j.name, i = 2;
        while ([...room.players.values()].some(x => x.name.toLowerCase() === name.toLowerCase())) name = `${j.name} ${i++}`;
        p = { id, name, board: newBoard(), marks: new Set(), conn: !!j.conn };
      }
      room.players.set(id, p);
      up[`jugadores/${id}/board`] = p.board;
      if (p.name !== j.name) up[`jugadores/${id}/name`] = p.name;
    }
    for (const id of [...room.players.keys()]) if (!v[id]) room.players.delete(id);
    if (Object.keys(up).length) update(R(code), up).catch(console.error);
    broadcast();
  }

  function responder(id, claimId, r) {
    set(R(code, `resp/${id}`), { id: claimId, ok: !!r.ok, msg: r.msg || null }).catch(console.error);
  }

  function lottery(id) {
    const p = room.players.get(id);
    if (!p) return { ok: false, msg: 'No te encuentro en la sala.' };
    if (room.status !== 'playing') return { ok: false, msg: 'No hay una partida en curso.' };
    const r = checkWin(p);
    if (!r.ok) return r;
    clearTimers();
    room.status = 'finished';
    room.winner = { id: p.id, name: p.name, board: p.board, marks: [...p.marks] };
    broadcast();
    return { ok: true };
  }

  onValue(R(code, 'jugadores'), s => syncPlayers(s.val() || {}));
  onValue(R(code, 'reclamo'), s => {
    for (const [id, c] of Object.entries(s.val() || {})) {
      if (!c || room.claims.get(id) === c.id) continue;
      room.claims.set(id, c.id);
      if (now() - c.at > CLAIM_TTL) continue;
      responder(id, c.id, lottery(id));
    }
  });
  onValue(ref(db, '.info/connected'), s => {
    onConn(!!s.val());
  });
  // Latido: los jugadores saben que el anfitrión sigue activo mientras 'ping' se renueve
  setInterval(() => set(R(code, 'pub/ping'), now()).catch(() => {}), 20000);

  if (room.status === 'playing') schedule();
  broadcast();
  return { code, action };
}
