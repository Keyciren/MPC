// Lógica pura del club (sin DOM): la usan el navegador y el servidor (resumen .docx).

export const SUITS = { s: '♠', h: '♥', d: '♦', c: '♣' };
export const SUIT_NAMES = { s: 'picas', h: 'corazones', d: 'diamantes', c: 'tréboles' };
export const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
export const STREETS = [
  { id: 'preflop', label: 'Preflop', text: 'preflop' },
  { id: 'flop', label: 'Flop', text: 'en el flop' },
  { id: 'turn', label: 'Turn', text: 'en el turn' },
  { id: 'river', label: 'River', text: 'en el river' },
];

export function uid(prefix = '') {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ---------- Cartas ----------
export function cardLabel(code) {
  if (!code) return '';
  const r = code[0] === 'T' ? '10' : code[0];
  return r + (SUITS[code[1]] || '');
}
export function isRed(code) {
  return code && (code[1] === 'h' || code[1] === 'd');
}
// Mano en formato corto como en los resúmenes: "AK", "T6", "55"
export function handShort(cards) {
  if (!cards || !cards.length) return '';
  return cards.map((c) => c[0]).join('');
}
export function handText(cards) {
  if (!cards || !cards.length) return '';
  const short = handShort(cards);
  if (cards.length === 2 && cards[0][1] === cards[1][1]) return `${short} de ${SUIT_NAMES[cards[0][1]]}`;
  return short;
}
export function boardText(board) {
  if (!board || !board.length) return '';
  const r = board.map((c) => c[0]);
  // Formato del club: "587", "JQQ 3", "87J J 2"
  const parts = [r.slice(0, 3).join('')];
  if (r[3]) parts.push(r[3]);
  if (r[4]) parts.push(r[4]);
  return parts.join(' ');
}

// ---------- Tablas de puntaje ----------
export function defaultPointTables() {
  return {
    normal: {
      name: 'Normal',
      columns: [
        { label: '19 o 20', min: 19, max: 20, points: [22, 17, 13, 10, 8, 6, 4, 3, 2, 1] },
        { label: '17 o 18', min: 17, max: 18, points: [20, 15, 11, 8, 6, 4, 3, 2, 1] },
        { label: '15 o 16', min: 15, max: 16, points: [18, 13, 10, 7, 5, 4, 3, 2] },
        { label: '13 o 14', min: 13, max: 14, points: [16, 12, 9, 6, 5, 3, 2] },
        { label: '11 o 12', min: 11, max: 12, points: [13, 10, 7, 5, 4, 3, 1] },
        { label: '9 o 10', min: 9, max: 10, points: [11, 8, 6, 4, 3, 1] },
        { label: '8 o menos', min: 0, max: 8, points: [9, 7, 5, 4, 1] },
      ],
    },
    gs: {
      name: 'Grand Slam',
      columns: [{ label: 'GS', min: 0, max: 999, points: [25, 20, 16, 13, 10, 8, 6, 4, 3, 2] }],
    },
  };
}

export function pointColumn(tables, type, nPlayers) {
  const cols = (tables && tables[type] && tables[type].columns) || [];
  if (!cols.length) return null;
  const hit = cols.find((c) => nPlayers >= Number(c.min) && nPlayers <= Number(c.max));
  if (hit) return hit;
  const sorted = [...cols].sort((a, b) => Number(b.max) - Number(a.max));
  return nPlayers > Number(sorted[0].max) ? sorted[0] : sorted[sorted.length - 1];
}

export function pointsFor(tables, type, nPlayers, position) {
  const col = pointColumn(tables, type, nPlayers);
  if (!col || !position) return 0;
  return Number(col.points[position - 1] || 0);
}

// ---------- Configuración ----------
export function defaultSeasonConfig() {
  return {
    currency: '$',
    fee: 1000,
    perTable: 9,
    prizePercents: [50, 30, 20],
    prizeTable: defaultPrizeTable(),
    roundTo: 1000,
    luckyLoserCost: 10000,
    freezeout: { buyIn: 10000, startChips: 30000, luckyLoserUntilLevel: 8 },
    rebuy: {
      buyIn: 5000,
      startChips: 20000,
      rebuyCost: 5000,
      rebuyChips: 20000,
      addonCost: 5000,
      addonChips: 20000,
      rebuyUntilLevel: 8,
      rebuyMaxPerPlayer: 10,
      rebuyMaxTotal: 50,
    },
    levels: defaultLevels(),
    // Estructuras de ciegas por modalidad y tipo de fecha: 'rebuy-normal', 'rebuy-gs', 'freezeout-normal', 'freezeout-gs'
    // Montos distintos para Grand Slam (vacío = igual que la fecha normal)
    rebuyGs: { buyIn: 7500, rebuyCost: 7500, addonCost: 7500 },
    freezeoutGs: {},
    structures: { 'rebuy-normal': clubRebuyLevels(), 'rebuy-gs': clubRebuyLevels(), 'freezeout-normal': clubFreezeoutLevels() },
  };
}

// Tabla de premios del club: puestos premiados y porcentajes según la cantidad de jugadores
export function defaultPrizeTable() {
  return [
    { label: '19 o 20', min: 19, max: 20, percents: [38, 26, 18, 11, 7] },
    { label: '17 o 18', min: 17, max: 18, percents: [38, 26, 18, 11, 7] },
    { label: '15 o 16', min: 15, max: 16, percents: [39, 27, 20, 14] },
    { label: '13 o 14', min: 13, max: 14, percents: [39, 27, 20, 14] },
    { label: '11 o 12', min: 11, max: 12, percents: [50, 30, 20] },
    { label: '9 o 10', min: 9, max: 10, percents: [50, 30, 20] },
    { label: '8 o menos', min: 0, max: 8, percents: [65, 35] },
  ];
}

export function prizePercentsFor(table, nPlayers) {
  const rows = table || [];
  if (!rows.length) return null;
  const hit = rows.find((r) => nPlayers >= Number(r.min) && nPlayers <= Number(r.max));
  if (hit) return [...hit.percents];
  const sorted = [...rows].sort((a, b) => Number(b.max) - Number(a.max));
  return [...(nPlayers > Number(sorted[0].max) ? sorted[0] : sorted[sorted.length - 1]).percents];
}

// Porcentajes que aplican a una fecha: los ingresados a mano para esa fecha, o los de la tabla según inscritos
export function prizePercentsOf(t, cfg = t.config || {}) {
  // Una fecha finalizada conserva los porcentajes con que se pagó: los cambios de tabla no afectan hacia atrás
  if (t.prizePercentsFinal && t.prizePercentsFinal.length) return t.prizePercentsFinal;
  if (t.status === 'finished' && t.prizePercents && t.prizePercents.length) return t.prizePercents;
  if (t.prizePercentsOverride && t.prizePercentsOverride.length) return t.prizePercentsOverride;
  const n = (t.entries || []).length;
  // Fechas por jugar o en juego: tabla de la fecha o, si se preparó antes de existir la tabla, la del club
  if (t.status !== 'finished') return prizePercentsFor(cfg.prizeTable || defaultPrizeTable(), n);
  return prizePercentsFor(cfg.prizeTable, n) || t.prizePercents || cfg.prizePercents || [];
}

export function defaultLevels() {
  const bb = [100, 200, 300, 400, 600, 800, 1000, 1500, 2000, 3000, 4000, 6000, 8000, 10000, 15000, 20000, 30000];
  return bb.map((b) => ({ sb: b / 2, bb: b, ante: 0, minutes: 20 }));
}

// Estructura del club para rebuy (fecha normal), según Tournament Director
export function clubRebuyLevels() {
  const L = (minutes, sb, ante = 0) => ({ sb, bb: sb * 2, ante, minutes });
  return [
    L(15, 100), L(15, 200), L(15, 300), L(15, 400), L(15, 500), L(15, 600, 1200), L(20, 800, 1600), L(20, 1000, 2000),
    { break: true, minutes: 5 },
    L(20, 1200, 2400), L(20, 1500, 3000), L(20, 2000, 4000), L(23, 3000, 6000), L(23, 4000, 8000), L(23, 5000, 10000),
    L(23, 7000, 14000), L(23, 10000, 20000), L(23, 15000, 30000), L(20, 20000, 40000), L(20, 30000, 60000), L(20, 40000, 80000),
  ];
}

// Estructura del club para freezeout (fecha normal), según Tournament Director
export function clubFreezeoutLevels() {
  const L = (minutes, sb, ante = 0) => ({ sb, bb: sb * 2, ante, minutes });
  return [
    L(20, 100), L(20, 200), L(20, 300), L(20, 400), L(20, 500), L(20, 600), L(20, 800, 1600), L(20, 1000, 2000), L(20, 1200, 2400),
    L(20, 1500, 3000), L(20, 1800, 3600), L(25, 2000, 4000), L(25, 3000, 6000), L(25, 4000, 8000), L(25, 5000, 10000), L(25, 8000, 16000),
    L(25, 10000, 20000), L(20, 15000, 30000), L(20, 20000, 40000), L(20, 30000, 60000), L(20, 40000, 80000),
  ];
}

export const STRUCTURE_KEYS = [
  { key: 'rebuy-normal', label: 'Rebuy — fecha normal' },
  { key: 'rebuy-gs', label: 'Rebuy — Grand Slam' },
  { key: 'freezeout-normal', label: 'Freezeout — fecha normal' },
  { key: 'freezeout-gs', label: 'Freezeout — Grand Slam' },
];

// Estructura que corresponde a una fecha: la de su modalidad y tipo; si no existe, la normal de esa modalidad; si no, la general.
export function levelsFor(sc, modality, type) {
  const st = (sc && sc.structures) || {};
  const pickL = (k) => (st[k] && st[k].length ? st[k] : null);
  const lv = pickL(`${modality}-${type || 'normal'}`) || pickL(`${modality}-normal`) || (sc && sc.levels) || defaultLevels();
  return JSON.parse(JSON.stringify(lv));
}

// Número de nivel (ronda) sin contar descansos; null si el índice es un descanso
export function roundNumber(levels, idx) {
  if (!levels[idx] || levels[idx].break) return null;
  return levels.slice(0, idx + 1).filter((l) => !l.break).length;
}

// ¿Se puede recomprar en este punto del reloj? (hasta el final del nivel indicado, sin contar el descanso posterior)
export function rebuyOpenAt(cfg, modality, levelIdx) {
  if (modality !== 'rebuy') return false;
  const r = roundNumber(cfg.levels || [], levelIdx);
  return r != null && r <= (Number(cfg.rebuyUntilLevel) || 0);
}

// ¿Se puede entrar como lucky loser en este punto? (freezeout, hasta el nivel indicado; 0 = sin límite)
export function luckyLoserOpenAt(cfg, modality, levelIdx) {
  if (modality !== 'freezeout' || !cfg.luckyLoserAllowed) return false;
  const until = Number(cfg.luckyLoserUntilLevel) || 0;
  const r = roundNumber(cfg.levels || [], levelIdx);
  return !until || (r != null && r <= until);
}

// Configuración efectiva de una fecha (snapshot si ya comenzó, si no la de la temporada)
export function tournamentConfig(t, season) {
  if (t.config) return t.config;
  return buildConfig(season, t.modality, t.type);
}

export function buildConfig(season, modality, type = 'normal') {
  const sc = (season && season.config) || defaultSeasonConfig();
  const base = (modality === 'rebuy' ? sc.rebuy : sc.freezeout) || {};
  const gs = type === 'gs' ? sc[modality === 'rebuy' ? 'rebuyGs' : 'freezeoutGs'] || {} : {};
  const m = { ...base };
  Object.entries(gs).forEach(([k, v]) => {
    if (v !== '' && v != null && Number(v) > 0) m[k] = v;
  });
  return {
    currency: sc.currency,
    fee: Number(sc.fee) || 0,
    perTable: Number(sc.perTable) || 9,
    prizePercents: [...(sc.prizePercents || [])],
    prizeTable: JSON.parse(JSON.stringify(sc.prizeTable || defaultPrizeTable())),
    roundTo: Number(sc.roundTo) || 0,
    luckyLoserCost: Number(sc.luckyLoserCost ?? m.buyIn) || 0,
    buyIn: Number(m.buyIn) || 0,
    startChips: Number(m.startChips) || 0,
    rebuyCost: Number(m.rebuyCost) || 0,
    rebuyChips: Number(m.rebuyChips) || 0,
    addonCost: Number(m.addonCost) || 0,
    addonChips: Number(m.addonChips) || 0,
    rebuyUntilLevel: Number(m.rebuyUntilLevel) || 0,
    rebuyMaxPerPlayer: Number(m.rebuyMaxPerPlayer) || 0,
    rebuyMaxTotal: Number(m.rebuyMaxTotal) || 0,
    luckyLoserUntilLevel: Number(m.luckyLoserUntilLevel) || 0,
    levels: levelsFor(sc, modality, type),
  };
}

export function money(n, currency = '$') {
  const v = Math.round(Number(n) || 0);
  return currency + v.toLocaleString('es-CL');
}

// ---------- Estado de un torneo ----------
// Los eventos son la fuente de verdad del orden de salida:
//  { id, type:'bust', playerId, byPlayerId, outcome:'out'|'rebuy'|'luckyloser', ... }
export function busts(t) {
  return (t.events || []).filter((e) => e.type === 'bust');
}
export function outEvents(t) {
  return busts(t).filter((e) => e.outcome === 'out');
}

export function entryState(t) {
  const entries = t.entries || [];
  const n = entries.length;
  const outs = outEvents(t);
  const posById = {};
  outs.forEach((e, i) => {
    posById[e.playerId] = n - i;
  });
  const res = entries.map((en) => ({
    ...en,
    eliminated: posById[en.playerId] != null,
    position: posById[en.playerId] ?? null,
  }));
  const alive = res.filter((e) => !e.eliminated);
  if (t.status === 'finished' && alive.length === 1) alive[0].position = 1;
  return res;
}

export function alivePlayers(t) {
  return entryState(t).filter((e) => !e.eliminated);
}

export function totals(t, cfg) {
  const entries = t.entries || [];
  const n = entries.length;
  const rebuys = entries.reduce((s, e) => s + (Number(e.rebuys) || 0), 0);
  const addons = entries.filter((e) => e.addon).length;
  const lucky = entries.filter((e) => e.luckyLoser).length;
  const pool = n * cfg.buyIn + rebuys * cfg.rebuyCost + addons * cfg.addonCost + lucky * cfg.luckyLoserCost;
  const fees = n * cfg.fee;
  const chips = n * cfg.startChips + rebuys * cfg.rebuyChips + addons * cfg.addonChips + lucky * cfg.startChips;
  const alive = alivePlayers(t).length;
  return { n, rebuys, addons, lucky, pool, fees, chips, alive, avgStack: alive ? Math.round(chips / alive) : 0 };
}

export function prizes(pool, percents, roundTo = 0) {
  const pcts = (percents || []).map(Number).filter((p) => p > 0);
  if (!pcts.length) return [];
  let amounts = pcts.map((p) => (pool * p) / 100);
  if (roundTo > 0) {
    amounts = amounts.map((a) => Math.floor(a / roundTo) * roundTo);
    const diff = Math.round(pool * (pcts.reduce((a, b) => a + b, 0) / 100)) - amounts.reduce((a, b) => a + b, 0);
    amounts[0] += diff; // el resto del redondeo va al primer lugar
  } else {
    amounts = amounts.map(Math.round);
  }
  return amounts;
}

// ---------- Mesas ----------
export function shuffle(arr, rnd = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// dealers: [{ playerId?, name? }] uno por mesa (opcional). Si el crupier también juega, se sienta en su mesa.
export function buildTables(playerIds, perTable, dealers = [], rnd = Math.random) {
  const n = playerIds.length;
  if (!n) return [];
  const nTables = Math.max(1, Math.ceil(n / Math.max(2, perTable)));
  const tables = Array.from({ length: nTables }, (_, i) => ({
    id: 'mesa' + (i + 1),
    number: i + 1,
    dealer: dealers[i] || null,
    seats: [],
  }));
  const placed = new Set();
  tables.forEach((tb) => {
    const pid = tb.dealer && tb.dealer.playerId;
    if (pid && playerIds.includes(pid) && !placed.has(pid)) {
      tb.seats.push(pid);
      placed.add(pid);
    }
  });
  const rest = shuffle(playerIds.filter((p) => !placed.has(p)), rnd);
  // repartir equilibrado: siempre a la mesa con menos jugadores
  rest.forEach((pid) => {
    const target = [...tables].sort((a, b) => a.seats.length - b.seats.length || a.number - b.number)[0];
    target.seats.push(pid);
  });
  tables.forEach((tb) => {
    tb.seats = shuffle(tb.seats, rnd);
  });
  return dealersToSeatOne(tables);
}

// Regla del club: el crupier que también juega se sienta siempre en el puesto 1 de la mesa que reparte.
export function dealersToSeatOne(tables) {
  (tables || []).forEach((tb) => {
    const pid = tb.dealer && tb.dealer.playerId;
    if (!pid || !tables.some((x) => x.seats.includes(pid))) return; // el crupier no juega
    tables.forEach((x) => (x.seats = x.seats.filter((p) => p !== pid)));
    tb.seats.unshift(pid);
  });
  return tables;
}

// Mesa final: cuando quedan tantos jugadores como caben en una mesa, se sortean de nuevo todos los puestos.
// Si el crupier de la mesa final está jugando, queda en el puesto 1.
export function needsFinalTable(t, aliveCount) {
  const perTable = (t.config && t.config.perTable) || 9;
  return !t.finalTableDrawn && (t.initialTables || (t.tables || []).length) > 1 && aliveCount <= perTable && aliveCount > 1;
}

export function drawFinalTable(aliveIds, dealer = null, rnd = Math.random) {
  const pid = dealer && dealer.playerId;
  const plays = pid && aliveIds.includes(pid);
  const rest = shuffle(aliveIds.filter((p) => p !== pid || !plays), rnd);
  return [{ id: 'final', number: 1, final: true, dealer: dealer || null, seats: plays ? [pid, ...rest] : rest }];
}

export function tableName(tb) {
  return tb && tb.final ? 'Mesa final' : `Mesa ${tb ? tb.number : ''}`;
}

export function isTableDealer(tb, pid) {
  return !!(tb && tb.dealer && tb.dealer.playerId === pid);
}

// Sugerencias para balancear mesas tras una eliminación.
export function balanceSuggestions(tables, aliveIds, perTable) {
  const alive = new Set(aliveIds);
  const active = (tables || [])
    .map((tb) => ({ ...tb, players: tb.seats.filter((p) => alive.has(p)) }))
    .filter((tb) => tb.players.length > 0 || tables.length === 1);
  const moves = [];
  if (active.length <= 1) return { moves, breakTable: null };
  const total = active.reduce((s, tb) => s + tb.players.length, 0);
  // ¿Se puede romper una mesa?
  if (total <= (active.length - 1) * perTable) {
    // se rompe preferentemente una mesa cuyo crupier no esté jugando, para no sacar a un dealer de su mesa
    const dealerPlays = (tb) => (tb.dealer && tb.dealer.playerId && tb.players.includes(tb.dealer.playerId) ? 1 : 0);
    const sorted = [...active].sort((a, b) => dealerPlays(a) - dealerPlays(b) || a.players.length - b.players.length || b.number - a.number);
    const victim = sorted[0];
    const others = active.filter((tb) => tb.id !== victim.id).map((tb) => ({ ...tb, count: tb.players.length }));
    victim.players.forEach((pid) => {
      const to = others.sort((a, b) => a.count - b.count || a.number - b.number)[0];
      moves.push({ playerId: pid, from: victim.id, to: to.id });
      to.count++;
    });
    return { moves, breakTable: victim.id };
  }
  const counts = active.map((tb) => ({ id: tb.id, number: tb.number, dealer: tb.dealer, players: [...tb.players] }));
  for (let guard = 0; guard < 20; guard++) {
    counts.sort((a, b) => b.players.length - a.players.length || a.number - b.number);
    const big = counts[0];
    const small = counts[counts.length - 1];
    if (big.players.length - small.players.length < 2) break;
    const movable = big.players.filter((p) => !isTableDealer(big, p));
    if (!movable.length) break;
    const pid = movable[movable.length - 1];
    big.players = big.players.filter((p) => p !== pid);
    small.players.push(pid);
    moves.push({ playerId: pid, from: big.id, to: small.id });
  }
  return { moves, breakTable: null };
}

export function applyMoves(tables, moves, removeBroken = null) {
  const byId = Object.fromEntries(tables.map((tb) => [tb.id, tb]));
  moves.forEach((m) => {
    const from = byId[m.from];
    const to = byId[m.to];
    if (!from || !to) return;
    from.seats = from.seats.filter((p) => p !== m.playerId);
    if (!to.seats.includes(m.playerId)) to.seats.push(m.playerId);
  });
  const out = removeBroken ? tables.filter((tb) => tb.id !== removeBroken) : tables;
  return dealersToSeatOne(out);
}

export function tableOf(t, playerId) {
  return (t.tables || []).find((tb) => tb.seats.includes(playerId)) || null;
}

// ---------- Resultados ----------
// Fechas cargadas desde la planilla histórica: solo puntos, premios y ganador
function importedResults(t) {
  const im = t.imported;
  return Object.entries(im.points || {})
    .map(([pid, pts]) => ({
      playerId: pid,
      position: im.winnerId === pid ? 1 : null,
      points: Number(pts) || 0,
      bonus: 0,
      prize: (im.prizes || {})[pid] || 0,
      kills: (im.kills || {})[pid] || 0,
      rebuys: 0,
      addon: false,
      luckyLoser: false,
    }))
    .sort((a, b) => (a.position === 1 ? -1 : b.position === 1 ? 1 : b.points - a.points));
}

export function attendedIds(t) {
  if (t.imported) return Object.keys(t.imported.points || {});
  return (t.entries || []).map((e) => e.playerId);
}

export function results(t, settings) {
  if (t.imported) return importedResults(t);
  const st = entryState(t);
  const n = st.length;
  const cfg = t.config || {};
  const tot = cfg.buyIn != null ? totals(t, cfg) : { pool: 0 };
  const pz = prizes(t.prizePool ?? tot.pool, prizePercentsOf(t, cfg), cfg.roundTo);
  const kills = killCounts(t);
  const bonus = {};
  (t.bonus || []).forEach((b) => {
    bonus[b.playerId] = (bonus[b.playerId] || 0) + (Number(b.points) || 0);
  });
  const bh = t.friendly ? null : bountyHunter(t);
  if (bh) bonus[bh] = (bonus[bh] || 0) + bountyPoints(t);
  return st
    .map((e) => ({
      playerId: e.playerId,
      position: e.position,
      points: t.friendly ? 0 : e.position ? pointsFor(settings.pointTables, t.type || 'normal', n, e.position) + (bonus[e.playerId] || 0) : 0,
      bonus: bonus[e.playerId] || 0,
      prize: e.position && e.position <= pz.length ? pz[e.position - 1] : 0,
      kills: kills[e.playerId] || 0,
      rebuys: e.rebuys || 0,
      addon: !!e.addon,
      luckyLoser: !!e.luckyLoser,
    }))
    .sort((a, b) => (a.position || 999) - (b.position || 999));
}

export function killCounts(t) {
  const k = {};
  busts(t).forEach((e) => {
    if (e.byPlayerId) k[e.byPlayerId] = (k[e.byPlayerId] || 0) + 1;
  });
  return k;
}

export function hitman(t) {
  const k = killCounts(t);
  const max = Math.max(0, ...Object.values(k));
  if (!max) return { kills: 0, players: [] };
  return { kills: max, players: Object.keys(k).filter((p) => k[p] === max) };
}

// ---------- Temporada ----------
// Fechas oficiales de la temporada (las amistosas no cuentan para puntos, posiciones ni estadísticas)
export function seasonTournaments(db, seasonId) {
  return (db.tournaments || []).filter((t) => t.seasonId === seasonId && !t.friendly).sort((a, b) => a.number - b.number);
}
// Todas las fechas, incluidas las amistosas (calendario y administración)
export function allSeasonTournaments(db, seasonId) {
  return (db.tournaments || [])
    .filter((t) => t.seasonId === seasonId)
    .sort((a, b) => (a.friendly ? 1 : 0) - (b.friendly ? 1 : 0) || a.number - b.number);
}
export function newFriendly(db, seasonId) {
  const k = (db.tournaments || []).filter((t) => t.seasonId === seasonId && t.friendly).length + 1;
  return { ...newTournament(seasonId, 1000 + k), label: `Amistoso ${k}`, friendly: true };
}

export function ranking(db, seasonId) {
  const ts = seasonTournaments(db, seasonId);
  const season = (db.seasons || []).find((x) => x.id === seasonId);
  const order = season && season.finalOrder; // orden final oficial (temporadas cargadas de la planilla)
  const players = order
    ? order.map((id) => (db.players || []).find((p) => p.id === id)).filter(Boolean)
    : (db.players || []).filter((p) => p.type !== 'invitado' && (p.active !== false || ts.some((t) => attendedIds(t).includes(p.id))));
  const resByT = {};
  ts.forEach((t) => {
    if (t.status === 'finished') resByT[t.id] = Object.fromEntries(results(t, db.settings).map((r) => [r.playerId, r]));
  });
  const rows = players.map((p) => {
    let total = 0;
    let wins = 0;
    let played = 0;
    const cells = ts.map((t) => {
      if (t.status !== 'finished') return { value: '', tournamentId: t.id };
      const r = resByT[t.id][p.id];
      if (!r) return { value: 'x', tournamentId: t.id };
      total += r.points;
      played++;
      if (r.position === 1) wins++;
      return { value: r.points, position: r.position, tournamentId: t.id };
    });
    return { player: p, total, wins, played, cells };
  });
  if (order) {
    rows.forEach((r, i) => (r.position = i + 1));
    return { tournaments: ts, rows };
  }
  rows.sort((a, b) => b.total - a.total || b.wins - a.wins || a.player.name.localeCompare(b.player.name));
  let pos = 0;
  let prev = null;
  rows.forEach((r, i) => {
    if (prev === null || r.total !== prev.total || r.wins !== prev.wins) pos = i + 1;
    r.position = pos;
    prev = r;
  });
  return { tournaments: ts, rows };
}

export function seasonStats(db, seasonId) {
  const ts = seasonTournaments(db, seasonId);
  const finished = ts.filter((t) => t.status === 'finished');
  const per = {};
  const get = (id) => (per[id] = per[id] || { playerId: id, played: 0, wins: 0, kills: 0, itm: 0, prize: 0, jackpots: 0, final: 0 });
  finished.forEach((t) => {
    const res = results(t, db.settings);
    const perTable = (t.config && t.config.perTable) || 9;
    res.forEach((r) => {
      const s = get(r.playerId);
      s.played++;
      if (r.position === 1) s.wins++;
      s.kills += r.kills;
      if (r.prize > 0) {
        s.itm++;
        s.prize += r.prize;
      }
      if (r.position && r.position <= perTable) s.final++;
    });
    (t.jackpots || []).forEach((j) => {
      if (j.playerId) get(j.playerId).jackpots++;
    });
  });
  return { finished: finished.length, total: ts.length, players: Object.values(per) };
}

export function seasonFinished(db, seasonId) {
  const ts = seasonTournaments(db, seasonId);
  return ts.length > 0 && ts.every((t) => t.status === 'finished');
}

// Historial de todas las temporadas: campeones y salón de la fama
export function history(db) {
  const seasons = (db.seasons || []).filter((s) => seasonTournaments(db, s.id).some((t) => t.status === 'finished'));
  const fame = {};
  const get = (p) => (fame[p.id] = fame[p.id] || { player: p, titles: 0, podiums: 0, seasons: 0, points: 0, fechas: 0, best: null, titleSeasons: [] });
  const list = seasons.map((s) => {
    const rk = ranking(db, s.id);
    const done = seasonFinished(db, s.id);
    rk.rows.forEach((r) => {
      if (!r.played) return;
      const f = get(r.player);
      f.seasons++;
      f.points += r.total;
      f.fechas += r.wins;
      if (done) {
        if (f.best == null || r.position < f.best) f.best = r.position;
        if (r.position <= 3) f.podiums++;
        if (r.position === 1) {
          f.titles++;
          f.titleSeasons.push(s.name);
        }
      }
    });
    const st = seasonStats(db, s.id);
    const hit = [...st.players].sort((a, b) => b.kills - a.kills)[0];
    return { season: s, done, podium: rk.rows.slice(0, 3), played: rk.tournaments.filter((t) => t.status === 'finished').length, total: rk.tournaments.length, hitman: hit && hit.kills ? hit : null };
  });
  const hall = Object.values(fame).sort((a, b) => b.titles - a.titles || b.podiums - a.podiums || b.points - a.points);
  return { seasons: list, hall };
}

// ---------- Bounty: jugador asignado al inicio; quien lo elimina gana un punto extra ----------
export function bountyPoints(t) {
  return Number(t.bountyPoints ?? 1) || 0;
}
// Lugar de cada jugador en una fecha de la planilla, deducido de sus puntos: cada lugar de la tabla tiene un
// puntaje distinto. Se usa la columna según la cantidad de jugadores; si no se conoce, la columna en que calzan todos.
export function importedPositions(db, t, extra = null, finT = null) {
  const im = t.imported;
  if (!im) return {};
  const tables = db.settings.pointTables;
  const type = t.type || 'normal';
  const raw = Object.entries(im.points || {});
  // Invitados de la fecha: los de la planilla y los jugadores (hoy del club) que pagaron pero no estaban en el ranking
  const guests = [...new Set([...((extra && extra.guests) || []), ...Object.keys(finT || {}).filter((k) => !(k in (im.points || {})))])];
  const valid = (col, v) => v <= 0 || col.points.includes(v);
  // Cómo calza una columna: sin diferencias, o con un único +1 (el bounty)
  const tryCol = (col) => {
    if (!col) return null;
    const odd = raw.filter(([, v]) => !valid(col, v));
    if (!odd.length) return { col, hunter: null };
    if (odd.length === 1 && valid(col, odd[0][1] - 1)) return { col, hunter: odd[0][0] };
    return null;
  };
  // Orden de los premios (incluye invitados): sirve para elegir la columna de puntos correcta cuando ganó un invitado
  const prizeRank = {};
  if (finT)
    Object.entries(finT)
      .filter(([, v]) => v.p > 0)
      .sort((a, b) => b[1].p - a[1].p)
      .forEach(([key], i) => (prizeRank[key] = i + 1));
  const paid = Object.keys(prizeRank).length;
  const cols = [...(tables[type] ? tables[type].columns : []), ...Object.values(tables).flatMap((tb) => tb.columns)];
  const sized = im.players ? tryCol(pointColumn(tables, type, im.players)) : null;
  const top = Number((im.points || {})[im.winnerId]) || 0;
  const score = (f) => {
    // cuántos jugadores del club con premio calzan: su puntaje es el del lugar que indica su premio
    let ok = 0;
    raw.forEach(([pid, v]) => {
      if (!prizeRank[pid]) return;
      const pv = v - (f.hunter === pid ? 1 : 0);
      if (Number(f.col.points[prizeRank[pid] - 1]) === pv) ok++;
    });
    return ok;
  };
  const fits = [sized, ...cols.map(tryCol)].filter(Boolean);
  let fit = null;
  if (fits.length) {
    const best = Math.max(...fits.map(score));
    const cands = fits.filter((f) => score(f) === best);
    fit = (sized && cands.includes(sized) && sized) || cands.find((f) => Number(f.col.points[0]) === top || (f.hunter === im.winnerId && Number(f.col.points[0]) === top - 1)) || cands[0];
  }
  const out = {};
  const used = new Set();
  const take = (key, p) => {
    if (!p || used.has(p)) return false;
    used.add(p);
    out[key] = p;
    return true;
  };
  // 1) Jugadores del club con puntos: el lugar sale del puntaje (descontando el bounty)
  const guestWonByPrize = Object.keys(prizeRank).some((k) => k.startsWith('g:') && prizeRank[k] === 1);
  raw
    .map(([pid, v]) => {
      const pv = v - (fit && fit.hunter === pid ? 1 : 0);
      const i = fit && pv > 0 ? fit.col.points.indexOf(pv) : -1;
      return [pid, i >= 0 ? i + 1 : pid === im.winnerId && !guestWonByPrize ? 1 : null, v];
    })
    .sort((a, b) => (a[1] || 99) - (b[1] || 99) || b[2] - a[2])
    .forEach(([pid, p]) => {
      if (out[pid] || !p) return;
      while (used.has(p)) p++; // si la planilla deja dos en el mismo lugar, el de menos puntos pasa al siguiente
      take(pid, p);
    });
  // 2) Invitados con premio: ocupan los lugares pagados que quedaron libres, en orden de premio
  const freePaid = [];
  for (let p = 1; p <= paid; p++) if (!used.has(p)) freePaid.push(p);
  Object.keys(prizeRank)
    .filter((k) => guests.includes(k))
    .sort((a, b) => prizeRank[a] - prizeRank[b])
    .forEach((g) => take(g, freePaid.shift()));
  raw.forEach(([pid]) => (out[pid] = out[pid] || null));
  guests.forEach((g) => (out[g] = out[g] || null));
  // 3) Relato de la fecha (archivo): invitados en cualquier lugar libre; del club sin puntos, solo bajo los que sumaron
  if (extra && extra.pos) {
    // cantidad de jugadores: la registrada, la del relato o, si no, cuántos pagaron ese día (club + invitados)
    const n = Number(im.players || extra.players) || (finT ? Object.keys(finT).length : 0);
    const lowest = Math.max(0, ...raw.filter(([, v]) => v > 0).map(([pid]) => out[pid] || 0));
    Object.entries(extra.pos)
      .sort((a, b) => b[1] - a[1])
      .forEach(([key, p]) => {
        if (out[key] || !(key in out)) return;
        if (n && p > n) return;
        if (!guests.includes(key) && p <= lowest) return;
        take(key, p);
      });
    // Si queda un solo jugador sin lugar y un solo lugar libre, es ese
    const missing = Object.keys(out).filter((k) => !out[k]);
    if (n && missing.length === 1) {
      const free = [];
      for (let p = 1; p <= n; p++) if (!used.has(p)) free.push(p);
      if (free.length === 1) take(missing[0], free[0]);
    }
  }
  // 4) Lugares ingresados a mano por el administrador
  Object.entries(t.placesManual || {}).forEach(([key, p]) => {
    if (key in out && Number(p) > 0) out[key] = Number(p);
  });
  return out;
}

// Lugar de un jugador en una fecha (de la app o de la planilla)
export function placeIn(db, t, pid, extra = null, finT = null) {
  if (t.imported) return importedPositions(db, t, extra, finT)[pid] || null;
  const r = results(t, db.settings).find((x) => x.playerId === pid);
  return r ? r.position : null;
}

// Bounty de una fecha cargada de la planilla: { target, hunter }
export function importedBounty(db, t) {
  const hunter = importedBountyHunter(db, t);
  if (!hunter) return null;
  const target = bountyTargetFor(db, t);
  return { hunter, target: target ? target.playerId : null, reason: target ? target.reason : '' };
}

// Quien eliminó definitivamente al bounty (null si sigue en juego, si nadie lo eliminó o si ganó la fecha)
export function bountyHunter(t) {
  if (!t.bountyPlayerId) return null;
  const ev = outEvents(t).find((e) => e.playerId === t.bountyPlayerId);
  return ev && ev.byPlayerId ? ev.byPlayerId : null;
}

// Regla del club: el bounty es quien ganó la fecha anterior de la temporada; en la primera fecha, el campeón
// de la temporada anterior. Si ese jugador es invitado o no juega esta fecha, pasa al siguiente mejor ubicado
// (2°, 3°, ...) del club que sí juegue.
// Número de temporada (de su nombre "Temporada N" o de su id "sN")
export function seasonNumber(db, seasonId) {
  const s = (db.seasons || []).find((x) => x.id === seasonId);
  return Number(((s && s.name) || '').replace(/\D+/g, '')) || Number(String(seasonId).replace(/\D+/g, '')) || 0;
}
// El bounty existe desde la temporada 3; el de la primera fecha (campeón de la temporada anterior), desde la 7
export const BOUNTY_FROM_SEASON = 3;
export const FIRST_DATE_BOUNTY_FROM_SEASON = 7;

export function bountyTargetFor(db, t) {
  if (t.friendly) return null;
  const sn = seasonNumber(db, t.seasonId);
  if (sn && sn < BOUNTY_FROM_SEASON) return null;
  const isClub = (id) => {
    const p = (db.players || []).find((x) => x.id === id);
    return !!p && p.type !== 'invitado';
  };
  const playing = attendedIds(t);
  const plays = (id) => !playing.length || playing.includes(id);
  const pick = (ordered, source) => {
    // ordered: [{ playerId, place }] del mejor al peor
    const skipped = [];
    for (const o of ordered) {
      if (!isClub(o.playerId)) {
        skipped.push(`${playerName(db, o.playerId)} es invitado`);
        continue;
      }
      if (!plays(o.playerId)) {
        skipped.push(`${playerName(db, o.playerId)} no juega esta fecha`);
        continue;
      }
      const lead = o.place === 1 ? (source.season ? 'campeón de la ' : 'ganó la ') : `${o.place}° en la `;
      return { playerId: o.playerId, reason: `${lead}${source.label}${skipped.length ? ` (${skipped.join('; ')})` : ''}` };
    }
    return null;
  };
  const prev = seasonTournaments(db, t.seasonId)
    .filter((x) => x.status === 'finished' && x.number < t.number)
    .pop();
  if (prev) {
    const res = results(prev, db.settings);
    const ordered = prev.imported
      ? res.slice().sort((a, b) => (a.position === 1 ? -1 : b.position === 1 ? 1 : b.points - a.points))
      : res.slice().sort((a, b) => (a.position || 999) - (b.position || 999));
    return pick(ordered.map((r, i) => ({ playerId: r.playerId, place: prev.imported ? i + 1 : r.position })), { label: prev.label });
  }
  if (sn && sn < FIRST_DATE_BOUNTY_FROM_SEASON) return null; // primera fecha sin bounty hasta la temporada 6
  const seasons = db.seasons || [];
  const i = seasons.findIndex((s) => s.id === t.seasonId);
  const prevSeason = i > 0 ? seasons[i - 1] : null;
  if (prevSeason && seasonFinished(db, prevSeason.id)) {
    return pick(ranking(db, prevSeason.id).rows.map((r) => ({ playerId: r.player.id, place: r.position })), { label: prevSeason.name, season: true });
  }
  return null;
}

// Fechas cargadas desde la planilla: el punto del bounty ya viene sumado en los puntos. Se detecta porque
// quien lo ganó tiene un puntaje que no existe en la tabla, pero sí existe ese puntaje menos 1.
export function importedBountyHunter(db, t) {
  const im = t.imported;
  if (!im || !im.players) return null;
  const col = pointColumn(db.settings.pointTables, t.type || 'normal', im.players);
  if (!col) return null;
  const valid = (v) => v === 0 || col.points.includes(v);
  const odd = Object.entries(im.points || {}).filter(([, v]) => !valid(v) && valid(v - 1));
  return odd.length === 1 ? odd[0][0] : null;
}

// ---------- Dinero: ganancias y pérdidas ----------
// fin: datos históricos por fecha { tid: { playerId: { e: entradas, f: fee, p: premio, j: jackpot } } }
export function moneyByTournament(t, settings, fin = {}) {
  if (fin[t.id]) return fin[t.id];
  if (t.status !== 'finished' || t.imported || !t.config) return {};
  const c = t.config;
  const prize = Object.fromEntries(results(t, settings).map((r) => [r.playerId, r.prize]));
  const out = {};
  (t.entries || []).forEach((e) => {
    out[e.playerId] = {
      e: c.buyIn + (e.rebuys || 0) * c.rebuyCost + (e.addon ? c.addonCost : 0) + (e.luckyLoser ? c.luckyLoserCost : 0),
      f: c.fee || 0,
      p: prize[e.playerId] || 0,
      j: 0,
      c: 0,
    };
  });
  (t.jackpots || []).forEach((j) => {
    if (out[j.playerId]) out[j.playerId].j += Number(j.amount) || 0;
  });
  return out;
}

// Jackpots de una fecha: los registrados en la app o, en fechas de la planilla, los del archivo de dinero
export function tournamentJackpots(t, fin = {}) {
  if (t.jackpots && t.jackpots.length) return t.jackpots;
  return Object.entries(fin[t.id] || {})
    .filter(([, v]) => v.j > 0)
    .map(([playerId, v]) => ({ playerId, amount: v.j }));
}

export function seasonMoney(db, seasonId, fin = {}) {
  const per = {};
  let withData = 0;
  seasonTournaments(db, seasonId).forEach((t) => {
    const m = moneyByTournament(t, db.settings, fin);
    if (Object.keys(m).length) withData++;
    Object.entries(m).forEach(([pid, v]) => {
      if (pid.startsWith('g:')) return; // invitados de la planilla: solo para cobros
      const r = (per[pid] = per[pid] || { playerId: pid, fechas: 0, e: 0, f: 0, p: 0, j: 0 });
      r.fechas++;
      r.e += v.e;
      r.f += v.f;
      r.p += v.p;
      r.j += v.j;
    });
  });
  const rows = Object.values(per).map((r) => ({ ...r, net: r.p + r.j - r.e - r.f }));
  rows.sort((a, b) => b.net - a.net);
  return { rows, fechas: withData };
}

// Neto histórico por jugador y temporada
export function moneyHistory(db, fin = {}) {
  const seasons = (db.seasons || []).filter((s) => seasonMoney(db, s.id, fin).fechas > 0);
  const per = {};
  seasons.forEach((s) => {
    seasonMoney(db, s.id, fin).rows.forEach((r) => {
      const x = (per[r.playerId] = per[r.playerId] || { playerId: r.playerId, bySeason: {}, total: 0 });
      x.bySeason[s.id] = r.net;
      x.total += r.net;
    });
  });
  return { seasons, rows: Object.values(per).sort((a, b) => b.total - a.total) };
}

// ---------- Cobros: lo que debe pagar o recibir cada jugador en una fecha ----------
// Se lleva el control en fechas jugadas en la app y en las de la planilla a las que se les activó (t.payments).
export function tracksPayments(t) {
  return t.status === 'finished' && (!t.imported || !!t.payments);
}

export function settlement(t, settings, fin = {}) {
  const m = moneyByTournament(t, settings, fin);
  const paid = t.payments || {};
  const others = t.charges || {}; // "Otros": comida u otros gastos que anota el admin por jugador
  return Object.entries(m)
    .map(([key, v]) => {
      // "Otros" (comida u otros gastos): lo que anotó el admin o, si no anotó nada, la comida de la planilla
      const o = key in others ? Number(others[key]) || 0 : v.c || 0;
      const balance = (v.p || 0) + (v.j || 0) - (v.e || 0) - (v.f || 0) - o;
      return { key, e: v.e || 0, f: v.f || 0, o, p: v.p || 0, j: v.j || 0, balance, paid: !!paid[key] };
    })
    .sort((a, b) => a.balance - b.balance);
}

// Saldos pendientes de todas las fechas, agrupados por jugador
export function pendingDebts(db, fin = {}) {
  const per = {};
  (db.tournaments || [])
    .filter(tracksPayments)
    .forEach((t) => {
      settlement(t, db.settings, fin).forEach((r) => {
        if (r.paid || Math.round(r.balance) === 0) return;
        const x = (per[r.key] = per[r.key] || { key: r.key, total: 0, items: [] });
        x.total += r.balance;
        x.items.push({ t, balance: r.balance });
      });
    });
  return Object.values(per).sort((a, b) => a.total - b.total);
}

// ---------- Resumen lúdico ----------
const ORDINALS = ['', 'Primer', 'Segundo', 'Tercer', 'Cuarto', 'Quinto', 'Sexto', 'Séptimo', 'Octavo', 'Noveno', 'Décimo', 'Onceavo', 'Doceavo'];

function pick(list, seed) {
  let h = 0;
  for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return list[h % list.length];
}

export function placeLabel(pos) {
  if (pos >= 1 && pos < ORDINALS.length) return `${ORDINALS[pos]} lugar`;
  return `Lugar ${pos}`;
}

export function playerName(db, id) {
  const p = (db.players || []).find((x) => x.id === id);
  return p ? p.nickname || p.name : '¿?';
}

export function bustParagraph(db, t, ev, ctx) {
  const name = playerName(db, ev.playerId);
  const killer = ev.byPlayerId ? playerName(db, ev.byPlayerId) : null;
  const pos = ctx.position;
  const street = STREETS.find((s) => s.id === ev.street);
  const streetTxt = street ? street.text : '';
  const hand = handText(ev.playerCards);
  const khand = handText(ev.byCards);
  const visible = { flop: 3, turn: 4 }[ev.street];
  const board = boardText(ev.board);
  const boardAtAllIn = boardText(visible ? (ev.board || []).slice(0, visible) : []);
  const seed = ev.id;
  const goodbye = pick(
    ['se despide del torneo', 'queda fuera del torneo', 'dice adiós a la fecha', 'deja la mesa', 'se va para la casa'],
    seed
  );

  let opener;
  if (pos === 2) {
    opener = `Heads up entre ${killer || 'el campeón'} y ${name}`;
  } else if (ctx.isFirst) {
    opener = `${pick(['El primero en decir adiós fue', 'Abre la cuenta de eliminados', 'El primer eliminado de la noche fue'], seed)} ${name} (lugar ${pos})`;
  } else if (ctx.finalTableFirst) {
    opener = `Mesa final y el primer eliminado es ${name} (lugar ${pos})`;
  } else if (ctx.bubble) {
    opener = `${placeLabel(pos)} y bubble del torneo para ${name}`;
  } else {
    opener = `${placeLabel(pos)} para ${name}`;
  }
  if (ctx.bubble && (ctx.isFirst || ctx.finalTableFirst)) opener += ', justo en la burbuja';

  const allInIsKiller = ev.allInPlayerId && ev.allInPlayerId === ev.byPlayerId;
  let body = '';
  if (pos === 2) {
    body = `, luego de algunas manos terminan all in ${streetTxt}`.trimEnd();
    if (hand || khand) body += `, ${name}${hand ? ' con ' + hand : ''} y ${killer || 'su rival'}${khand ? ' con ' + khand : ''}`;
    if (board) body += `, el board terminó ${board}`;
    body += ` y finalmente ${killer || 'su rival'} se queda con la mano.`;
  } else if (allInIsKiller) {
    body = `, ${killer} va all in ${streetTxt}${khand ? ' con ' + khand : ''}${boardAtAllIn ? ' con la mesa ' + boardAtAllIn : ''}`;
    body += ` y ${name} paga${hand ? ' con ' + hand : ''}`;
    body += `, ${pick(['no hubo milagro', 'la suerte no acompañó', 'las cartas no ayudaron'], seed + 'x')} y ${name} ${goodbye}.`;
  } else {
    body = ` que va all in ${streetTxt}${hand ? ' con ' + hand : ''}`.replace('all in  ', 'all in ');
    if (boardAtAllIn) body += ` cuando el board era ${boardAtAllIn}`;
    if (killer) body += `, ${killer} ${pick(['paga', 'lo estaba esperando y paga', 'no lo duda y paga'], seed)}${khand ? ' con ' + khand : ''}`;
    if (board && board !== boardAtAllIn) body += `, la mesa terminó ${board}`;
    body += ` y ${name} ${goodbye}.`;
  }
  let txt = opener + body;
  if (t.bountyPlayerId === ev.playerId && ev.outcome === 'out' && killer) {
    const pts = bountyPoints(t);
    txt = txt.replace(/\.$/, '') + `, de pasada ${killer} se cobra el bounty y suma ${pts === 1 ? 'un punto extra' : pts + ' puntos extra'} para el ranking.`;
  }
  if (ev.notes) txt += ' ' + ev.notes.trim();
  return txt.replace(/\s+,/g, ',').replace(/\s{2,}/g, ' ');
}

export function buildSummary(db, t) {
  const season = (db.seasons || []).find((s) => s.id === t.seasonId);
  const st = entryState(t);
  const n = st.length;
  const guests = st.filter((e) => {
    const p = db.players.find((x) => x.id === e.playerId);
    return p && p.type === 'invitado';
  }).length;
  const cfg = t.config || buildConfig(season, t.modality, t.type);
  const outs = outEvents(t);
  const winner = st.find((e) => e.position === 1);
  const winnerName = winner ? playerName(db, winner.playerId) : null;
  const ov = (t.summary && t.summary.overrides) || {};
  const paid = prizePercentsOf(t, cfg).filter((p) => Number(p) > 0).length;
  const multiTable = (t.initialTables || (t.tables || []).length) > 1;
  const blocks = [];

  const title = ov.title || (winnerName ? `¡${winnerName} se queda con la ${t.label || 'fecha ' + t.number}!` : t.label || `Fecha ${t.number}`);
  const fmt = t.modality === 'rebuy' ? 'formato rebuy' : 'formato freezeout';
  const intro =
    ov.intro ||
    `${t.label || 'Fecha ' + t.number}${t.type === 'gs' ? ' (Grand Slam)' : ''}, ${n} jugadores${guests ? ` (${guests} invitado${guests > 1 ? 's' : ''})` : ''}, ${fmt}${t.venue ? ' en ' + t.venue : ''}.`;
  blocks.push({ kind: 'title', text: title });
  blocks.push({ kind: 'intro', text: intro, key: 'intro' });

  (t.jackpots || []).forEach((j, i) => {
    const key = 'jackpot' + i;
    const txt =
      ov[key] ||
      `¡Tuvimos jackpot! ${j.playerId ? playerName(db, j.playerId) : 'Un jugador'} conectó ${j.hand || 'una gran mano'}${
        j.cards && j.cards.length ? ' (' + handText(j.cards) + ')' : ''
      }${j.loserId ? ' contra ' + playerName(db, j.loserId) : ''} y se lleva ${money(j.amount, cfg.currency)}.`;
    blocks.push({ kind: 'jackpot', text: txt, key, image: j.image || null });
  });

  if (t.modality === 'rebuy' && outs.length) {
    const tot = totals(t, cfg);
    blocks.push({
      kind: 'info',
      key: 'rebuyInfo',
      text: ov.rebuyInfo || `El periodo de recompra dejó ${tot.rebuys} recompra${tot.rebuys === 1 ? '' : 's'} y ${tot.addons} add on, y con eso empezaron las eliminaciones.`,
    });
  }

  let finalTableMarked = false;
  outs.forEach((ev, i) => {
    const position = n - i;
    const aliveBefore = n - i;
    const finalTableFirst = multiTable && !finalTableMarked && aliveBefore <= (cfg.perTable || 9) && i > 0;
    if (finalTableFirst) finalTableMarked = true;
    const ctx = { position, isFirst: i === 0, finalTableFirst, bubble: paid > 0 && position === paid + 1 };
    blocks.push({ kind: 'bust', key: ev.id, text: ov[ev.id] || bustParagraph(db, t, ev, ctx), image: ev.image || null, position, event: ev });
  });

  if (winnerName) {
    blocks.push({
      kind: 'winner',
      key: 'winner',
      text:
        ov.winner ||
        `¡Torneo para ${winnerName}${t.winnerCards && t.winnerCards.length ? ', que se lo lleva con ' + handText(t.winnerCards) : ''}! ¡FELICITACIONES!`,
      image: t.winnerImage || null,
    });
  }

  if (t.status === 'finished' && season) {
    const rk = ranking(db, season.id).rows.slice(0, 3).filter((r) => r.total > 0);
    if (rk.length) {
      const parts = rk.map((r) => `${r.player.nickname || r.player.name} (${r.total} pts)`);
      blocks.push({
        kind: 'closing',
        key: 'closing',
        text:
          ov.closing ||
          `Con estos resultados el ranking queda liderado por ${parts[0]}${parts[1] ? ', seguido de ' + parts[1] : ''}${parts[2] ? ' y ' + parts[2] : ''}.`,
      });
    }
  }
  return blocks;
}

// ---------- Base de datos inicial ----------
export function newTournament(seasonId, number) {
  return {
    id: uid('t'),
    seasonId,
    number,
    label: `Fecha ${number}`,
    dateOptions: [],
    finalDate: null,
    venue: '',
    modality: 'rebuy',
    type: 'normal',
    status: 'planned',
    dealerIds: [],
    trainee: '',
    entries: [],
    tables: [],
    events: [],
    jackpots: [],
    bonus: [],
  };
}

// Devuelve una fecha a "Programada": borra inscritos, mesas, eliminaciones, reloj, jackpots y resumen,
// conservando lo del calendario (número, nombre, opciones de día, sede, formato, dealers).
export function resetTournament(t) {
  const keep = ['id', 'seasonId', 'number', 'label', 'dateOptions', 'finalDate', 'venue', 'modality', 'type', 'dealerIds', 'trainee'];
  const fresh = newTournament(t.seasonId, t.number);
  Object.keys(t).forEach((k) => {
    if (!keep.includes(k)) delete t[k];
  });
  ['entries', 'tables', 'events', 'jackpots', 'bonus'].forEach((k) => (t[k] = []));
  t.status = 'planned';
  return Object.assign(fresh, t);
}

export function emptyDb() {
  const seasonId = uid('s');
  return {
    version: 0,
    settings: { clubName: 'Club de Poker', pointTables: defaultPointTables(), currentSeasonId: seasonId },
    players: [],
    seasons: [{ id: seasonId, name: 'Temporada 1', tournamentsCount: 12, config: defaultSeasonConfig() }],
    tournaments: Array.from({ length: 12 }, (_, i) => newTournament(seasonId, i + 1)),
  };
}

// Copia que se publica en GitHub (repositorio público): sin correos.
export function publicCopy(db) {
  return { ...db, players: (db.players || []).map(({ email, ...p }) => p) };
}
