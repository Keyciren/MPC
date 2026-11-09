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
    fee: 5000,
    perTable: 9,
    prizePercents: [50, 30, 20],
    roundTo: 1000,
    luckyLoserCost: 20000,
    freezeout: { buyIn: 20000, startChips: 20000 },
    rebuy: {
      buyIn: 10000,
      startChips: 10000,
      rebuyCost: 10000,
      rebuyChips: 10000,
      addonCost: 10000,
      addonChips: 15000,
      rebuyUntilLevel: 6,
    },
    levels: defaultLevels(),
  };
}

export function defaultLevels() {
  const bb = [100, 200, 300, 400, 600, 800, 1000, 1500, 2000, 3000, 4000, 6000, 8000, 10000, 15000, 20000, 30000];
  return bb.map((b) => ({ sb: b / 2, bb: b, ante: 0, minutes: 20 }));
}

// Configuración efectiva de una fecha (snapshot si ya comenzó, si no la de la temporada)
export function tournamentConfig(t, season) {
  if (t.config) return t.config;
  return buildConfig(season, t.modality);
}

export function buildConfig(season, modality) {
  const sc = (season && season.config) || defaultSeasonConfig();
  const m = modality === 'rebuy' ? sc.rebuy : sc.freezeout;
  return {
    currency: sc.currency,
    fee: Number(sc.fee) || 0,
    perTable: Number(sc.perTable) || 9,
    prizePercents: [...(sc.prizePercents || [])],
    roundTo: Number(sc.roundTo) || 0,
    luckyLoserCost: Number(sc.luckyLoserCost ?? m.buyIn) || 0,
    buyIn: Number(m.buyIn) || 0,
    startChips: Number(m.startChips) || 0,
    rebuyCost: Number(m.rebuyCost) || 0,
    rebuyChips: Number(m.rebuyChips) || 0,
    addonCost: Number(m.addonCost) || 0,
    addonChips: Number(m.addonChips) || 0,
    rebuyUntilLevel: Number(m.rebuyUntilLevel) || 0,
    levels: JSON.parse(JSON.stringify(sc.levels || defaultLevels())),
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
  return tables;
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
    const sorted = [...active].sort((a, b) => a.players.length - b.players.length || b.number - a.number);
    const victim = sorted[0];
    const others = active.filter((tb) => tb.id !== victim.id).map((tb) => ({ ...tb, count: tb.players.length }));
    victim.players.forEach((pid) => {
      const to = others.sort((a, b) => a.count - b.count || a.number - b.number)[0];
      moves.push({ playerId: pid, from: victim.id, to: to.id });
      to.count++;
    });
    return { moves, breakTable: victim.id };
  }
  const counts = active.map((tb) => ({ id: tb.id, number: tb.number, players: [...tb.players] }));
  for (let guard = 0; guard < 20; guard++) {
    counts.sort((a, b) => b.players.length - a.players.length || a.number - b.number);
    const big = counts[0];
    const small = counts[counts.length - 1];
    if (big.players.length - small.players.length < 2) break;
    const pid = big.players.pop();
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
  if (removeBroken) return tables.filter((tb) => tb.id !== removeBroken);
  return tables;
}

export function tableOf(t, playerId) {
  return (t.tables || []).find((tb) => tb.seats.includes(playerId)) || null;
}

// ---------- Resultados ----------
export function results(t, settings) {
  const st = entryState(t);
  const n = st.length;
  const cfg = t.config || {};
  const tot = cfg.buyIn != null ? totals(t, cfg) : { pool: 0 };
  const pz = prizes(t.prizePool ?? tot.pool, t.prizePercents || cfg.prizePercents, cfg.roundTo);
  const kills = killCounts(t);
  const bonus = {};
  (t.bonus || []).forEach((b) => {
    bonus[b.playerId] = (bonus[b.playerId] || 0) + (Number(b.points) || 0);
  });
  return st
    .map((e) => ({
      playerId: e.playerId,
      position: e.position,
      points: e.position ? pointsFor(settings.pointTables, t.type || 'normal', n, e.position) + (bonus[e.playerId] || 0) : 0,
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
export function seasonTournaments(db, seasonId) {
  return (db.tournaments || []).filter((t) => t.seasonId === seasonId).sort((a, b) => a.number - b.number);
}

export function ranking(db, seasonId) {
  const ts = seasonTournaments(db, seasonId);
  const players = (db.players || []).filter((p) => p.type !== 'invitado');
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
    ['se despide del torneo', 'queda eliminado del torneo', 'dice adiós a la fecha', 'deja la mesa', 'se va para la casa'],
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
  const cfg = t.config || buildConfig(season, t.modality);
  const outs = outEvents(t);
  const winner = st.find((e) => e.position === 1);
  const winnerName = winner ? playerName(db, winner.playerId) : null;
  const ov = (t.summary && t.summary.overrides) || {};
  const paid = (t.prizePercents || cfg.prizePercents || []).filter((p) => Number(p) > 0).length;
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
