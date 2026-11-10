import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultPointTables,
  pointsFor,
  prizes,
  buildTables,
  balanceSuggestions,
  applyMoves,
  entryState,
  totals,
  buildConfig,
  defaultSeasonConfig,
  results,
  ranking,
  buildSummary,
  boardText,
  handShort,
} from '../public/js/logic.js';

const pt = defaultPointTables();

test('puntajes según tabla normal y cantidad de jugadores', () => {
  assert.equal(pointsFor(pt, 'normal', 20, 1), 22);
  assert.equal(pointsFor(pt, 'normal', 15, 1), 18);
  assert.equal(pointsFor(pt, 'normal', 15, 8), 2);
  assert.equal(pointsFor(pt, 'normal', 15, 9), 0);
  assert.equal(pointsFor(pt, 'normal', 12, 7), 1);
  assert.equal(pointsFor(pt, 'normal', 6, 1), 9);
  assert.equal(pointsFor(pt, 'normal', 25, 1), 22, 'más de 20 usa la columna más alta');
});

test('puntajes Grand Slam', () => {
  assert.equal(pointsFor(pt, 'gs', 14, 1), 25);
  assert.equal(pointsFor(pt, 'gs', 14, 10), 2);
  assert.equal(pointsFor(pt, 'gs', 14, 11), 0);
});

test('premios con porcentajes y redondeo', () => {
  assert.deepEqual(prizes(300000, [50, 30, 20]), [150000, 90000, 60000]);
  const p = prizes(255000, [50, 30, 20], 1000);
  assert.equal(p.reduce((a, b) => a + b, 0), 255000);
  assert.deepEqual(p, [128000, 76000, 51000]);
});

test('arma mesas balanceadas y sienta al crupier que juega en su mesa', () => {
  const ids = Array.from({ length: 15 }, (_, i) => 'p' + i);
  const tables = buildTables(ids, 9, [{ playerId: 'p3' }, { name: 'Externo' }]);
  assert.equal(tables.length, 2);
  assert.deepEqual(tables.map((t) => t.seats.length).sort(), [7, 8]);
  assert.ok(tables[0].seats.includes('p3'));
  assert.equal(new Set(tables.flatMap((t) => t.seats)).size, 15);
});

test('sugiere mover jugadores para balancear y romper mesas', () => {
  const tables = [
    { id: 'a', number: 1, seats: ['1', '2', '3', '4', '5', '6', '7'] },
    { id: 'b', number: 2, seats: ['8', '9', '10', '11', '12'] },
  ];
  const bal = balanceSuggestions(tables, ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'], 9);
  assert.equal(bal.moves.length, 1);
  assert.equal(bal.moves[0].from, 'a');
  // 9 vivos con mesas de 9 -> romper una mesa
  const brk = balanceSuggestions(tables, ['1', '2', '3', '4', '5', '8', '9', '10', '11'], 9);
  assert.equal(brk.breakTable, 'b');
  assert.equal(brk.moves.length, 4);
  const after = applyMoves(structuredClone(tables), brk.moves, brk.breakTable);
  assert.equal(after.length, 1);
});

function sampleDb() {
  const season = { id: 's1', name: 'T1', config: defaultSeasonConfig() };
  const players = ['Ana', 'Beto', 'Caro', 'Dani', 'Eli'].map((n, i) => ({ id: 'p' + i, name: n, nickname: n, type: i === 4 ? 'invitado' : 'club' }));
  const t = {
    id: 't1',
    seasonId: 's1',
    number: 1,
    label: 'Fecha 1',
    modality: 'rebuy',
    type: 'normal',
    status: 'finished',
    config: buildConfig(season, 'rebuy'),
    entries: players.map((p) => ({ playerId: p.id, rebuys: p.id === 'p1' ? 2 : 0, addon: true, luckyLoser: false })),
    tables: [{ id: 'mesa1', number: 1, seats: players.map((p) => p.id) }],
    events: [
      { id: 'e0', type: 'bust', playerId: 'p1', byPlayerId: 'p0', outcome: 'rebuy' },
      { id: 'e1', type: 'bust', playerId: 'p4', byPlayerId: 'p0', outcome: 'out', street: 'flop', playerCards: ['Ah', '6c'], byCards: ['Td', '6d'], board: ['Ts', '2c', '3h'] },
      { id: 'e2', type: 'bust', playerId: 'p3', byPlayerId: 'p1', outcome: 'out', street: 'preflop', playerCards: ['Kh', '5s'], byCards: ['As', 'Kd'] },
      { id: 'e3', type: 'bust', playerId: 'p2', byPlayerId: 'p0', outcome: 'out' },
      { id: 'e4', type: 'bust', playerId: 'p1', byPlayerId: 'p0', outcome: 'out', street: 'river' },
    ],
    jackpots: [],
    bonus: [{ playerId: 'p2', points: 1 }],
  };
  return { settings: { pointTables: pt }, players, seasons: [season], tournaments: [t] };
}

test('orden de salida, puntos, premios y ranking', () => {
  const db = sampleDb();
  const t = db.tournaments[0];
  const st = entryState(t);
  const pos = Object.fromEntries(st.map((e) => [e.playerId, e.position]));
  assert.deepEqual(pos, { p0: 1, p1: 2, p2: 3, p3: 4, p4: 5 });
  const tot = totals(t, t.config);
  assert.equal(tot.rebuys, 2);
  assert.equal(tot.pool, 5 * 5000 + 2 * 5000 + 5 * 5000);
  const res = results(t, db.settings);
  assert.equal(res[0].playerId, 'p0');
  assert.equal(res[0].points, 9);
  assert.equal(res[0].kills, 4);
  assert.equal(res[2].points, 5 + 1, 'punto extra');
  assert.equal(res[0].prize + res[1].prize + res[2].prize, tot.pool);
  const rk = ranking(db, 's1');
  assert.equal(rk.rows.length, 4, 'invitados no aparecen en el ranking');
  assert.equal(rk.rows[0].player.id, 'p0');
});

test('resumen lúdico con orden de salida', () => {
  const db = sampleDb();
  const blocks = buildSummary(db, db.tournaments[0]);
  const busts = blocks.filter((b) => b.kind === 'bust');
  assert.equal(busts.length, 4);
  assert.equal(busts[0].position, 5);
  assert.match(busts[0].text, /Eli/);
  assert.match(busts[0].text, /A6/);
  assert.match(blocks.find((b) => b.kind === 'winner').text, /Ana/);
  assert.equal(boardText(['8c', '7c', 'Jc', 'Js', '2c']), '87J J 2');
  assert.equal(handShort(['Td', '6d']), 'T6');
});

test('base inicial y copia pública sin correos', async () => {
  const { emptyDb, publicCopy } = await import('../public/js/logic.js');
  const db = emptyDb();
  assert.equal(db.tournaments.length, 12);
  assert.equal(db.seasons[0].id, db.settings.currentSeasonId);
  db.players.push({ id: 'a', name: 'Ana', email: 'ana@x.cl', type: 'club' });
  const pub = publicCopy(db);
  assert.equal(pub.players[0].email, undefined);
  assert.equal(db.players[0].email, 'ana@x.cl');
});

test('estructuras por modalidad y tipo, descansos y periodo de recompra', async () => {
  const m = await import('../public/js/logic.js');
  const sc = m.defaultSeasonConfig();
  const rb = m.levelsFor(sc, 'rebuy', 'normal');
  assert.equal(rb.length, 21);
  assert.ok(rb[8].break, 'descanso después del nivel 8');
  assert.equal(m.roundNumber(rb, 8), null);
  assert.equal(m.roundNumber(rb, 9), 9);
  assert.equal(rb[5].ante, 1200);
  assert.equal(m.levelsFor(sc, 'rebuy', 'gs').length, 21, 'GS sin estructura propia usa la normal');
  const fz = m.levelsFor(sc, 'freezeout', 'normal');
  assert.equal(fz.length, 21);
  assert.equal(fz[20].bb, 80000);
  const cfg = m.buildConfig({ config: sc }, 'rebuy', 'normal');
  assert.equal(cfg.rebuyUntilLevel, 8);
  assert.equal(m.rebuyOpenAt(cfg, 'rebuy', 7), true, 'nivel 8 abierto');
  assert.equal(m.rebuyOpenAt(cfg, 'rebuy', 8), false, 'en el descanso ya no');
  const fcfg = { ...m.buildConfig({ config: sc }, 'freezeout', 'normal'), luckyLoserAllowed: true };
  assert.equal(fcfg.buyIn, 10000);
  assert.equal(m.luckyLoserOpenAt(fcfg, 'freezeout', 7), true, 'nivel 8 abierto');
  assert.equal(m.luckyLoserOpenAt(fcfg, 'freezeout', 8), false, 'nivel 9 cerrado');
});

test('Grand Slam rebuy: misma estructura, buy-in y recompra de $7.500', async () => {
  const m = await import('../public/js/logic.js');
  const sc = m.defaultSeasonConfig();
  const gs = m.buildConfig({ config: sc }, 'rebuy', 'gs');
  const nr = m.buildConfig({ config: sc }, 'rebuy', 'normal');
  assert.equal(gs.buyIn, 7500);
  assert.equal(gs.rebuyCost, 7500);
  assert.equal(gs.addonCost, 7500);
  assert.equal(nr.addonCost, 5000);
  assert.equal(gs.startChips, 20000);
  assert.equal(gs.rebuyUntilLevel, 8);
  assert.equal(nr.buyIn, 5000);
  assert.deepEqual(gs.levels, nr.levels);
});

test('el crupier que juega siempre va en el puesto 1', async () => {
  const m = await import('../public/js/logic.js');
  const ids = Array.from({ length: 16 }, (_, i) => 'p' + i);
  for (let k = 0; k < 20; k++) {
    const tables = m.buildTables(ids, 9, [{ playerId: 'p5' }, { playerId: 'p11' }]);
    assert.equal(tables[0].seats[0], 'p5');
    assert.equal(tables[1].seats[0], 'p11');
  }
  // balancear nunca mueve al crupier de su mesa
  const tb = [
    { id: 'a', number: 1, dealer: { playerId: 'd1' }, seats: ['d1', 'x1', 'x2', 'x3', 'x4', 'x5'] },
    { id: 'b', number: 2, dealer: { playerId: 'd2' }, seats: ['d2', 'y1', 'y2'] },
  ];
  const bal = m.balanceSuggestions(tb, ['d1', 'x1', 'x2', 'x3', 'x4', 'x5', 'd2', 'y1', 'y2'], 6);
  assert.equal(bal.breakTable, null);
  assert.ok(bal.moves.length >= 1);
  assert.ok(bal.moves.every((mv) => mv.playerId !== 'd1' && mv.playerId !== 'd2'));
  const after = m.applyMoves(structuredClone(tb), bal.moves);
  assert.equal(after[0].seats[0], 'd1');
  assert.equal(after[1].seats[0], 'd2');
  // si se rompe la mesa, su crupier pasa a jugar en otra; el crupier de la mesa que queda sigue en el 1
  const brk = m.balanceSuggestions(tb, ['d1', 'x1', 'x2', 'd2', 'y1'], 9);
  const merged = m.applyMoves(structuredClone(tb), brk.moves, brk.breakTable);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].seats[0], merged[0].dealer.playerId);
});

test('al romper una mesa se prefiere la que no tiene dealer jugando', async () => {
  const m = await import('../public/js/logic.js');
  const tb = [
    { id: 'a', number: 1, dealer: { playerId: 'd1' }, seats: ['d1', 'x1', 'x2'] },
    { id: 'b', number: 2, dealer: { name: 'Externo' }, seats: ['y1', 'y2', 'y3', 'y4'] },
    { id: 'c', number: 3, dealer: { playerId: 'd3' }, seats: ['d3', 'z1', 'z2', 'z3'] },
  ];
  const bal = m.balanceSuggestions(tb, ['d1', 'x1', 'x2', 'y1', 'y2', 'y3', 'y4', 'd3', 'z1', 'z2', 'z3'], 6);
  assert.equal(bal.breakTable, 'b', 'se rompe la mesa sin dealer jugando aunque tenga más jugadores');
  assert.ok(bal.moves.every((mv) => mv.playerId !== 'd1' && mv.playerId !== 'd3'));
});

test('mesa final: con 9 jugadores se sortean todos los puestos y el dealer queda en el 1', async () => {
  const m = await import('../public/js/logic.js');
  const alive = Array.from({ length: 9 }, (_, i) => 'p' + i);
  const t = { config: { perTable: 9 }, initialTables: 2, tables: [{}, {}] };
  assert.equal(m.needsFinalTable(t, 10), false);
  assert.equal(m.needsFinalTable(t, 9), true);
  assert.equal(m.needsFinalTable({ ...t, finalTableDrawn: true }, 9), false);
  assert.equal(m.needsFinalTable({ config: { perTable: 9 }, initialTables: 1, tables: [{}] }, 9), false, 'si siempre fue una mesa no hay sorteo');
  const seen = new Set();
  for (let k = 0; k < 30; k++) {
    const [ft] = m.drawFinalTable(alive, { playerId: 'p4' });
    assert.equal(ft.seats.length, 9);
    assert.equal(ft.seats[0], 'p4');
    seen.add(ft.seats[1]);
  }
  assert.ok(seen.size > 1, 'los demás puestos se sortean');
  const [ext] = m.drawFinalTable(alive, { name: 'Externo' });
  assert.equal(ext.seats.length, 9);
});

test('tabla de premios según cantidad de jugadores', async () => {
  const m = await import('../public/js/logic.js');
  const tb = m.defaultPrizeTable();
  assert.deepEqual(m.prizePercentsFor(tb, 20), [38, 26, 18, 11, 7]);
  assert.deepEqual(m.prizePercentsFor(tb, 17), [38, 26, 18, 11, 7]);
  assert.deepEqual(m.prizePercentsFor(tb, 15), [39, 27, 20, 14]);
  assert.deepEqual(m.prizePercentsFor(tb, 12), [50, 30, 20]);
  assert.deepEqual(m.prizePercentsFor(tb, 9), [50, 30, 20]);
  assert.deepEqual(m.prizePercentsFor(tb, 6), [65, 35]);
  assert.deepEqual(m.prizePercentsFor(tb, 23), [38, 26, 18, 11, 7], 'más de 20 usa el tramo más alto');
  tb.forEach((r) => assert.equal(r.percents.reduce((a, b) => a + b, 0), 100));
  const cfg = m.buildConfig({ config: m.defaultSeasonConfig() }, 'rebuy', 'normal');
  const t = { config: cfg, entries: Array.from({ length: 15 }, (_, i) => ({ playerId: 'p' + i })) };
  assert.deepEqual(m.prizePercentsOf(t), [39, 27, 20, 14]);
  t.entries.push({ playerId: 'tarde' }, { playerId: 'tarde2' });
  assert.deepEqual(m.prizePercentsOf(t), [38, 26, 18, 11, 7], 'se recalcula al inscribir tarde');
  assert.deepEqual(m.prizePercentsOf({ ...t, prizePercentsOverride: [60, 40] }), [60, 40]);
  const pz = m.prizes(170000, m.prizePercentsOf(t), cfg.roundTo);
  assert.equal(pz.length, 5);
  assert.equal(pz.reduce((a, b) => a + b, 0), 170000);
});

test('los premios de fechas finalizadas no cambian con una tabla nueva', async () => {
  const m = await import('../public/js/logic.js');
  const cfg = m.buildConfig({ config: m.defaultSeasonConfig() }, 'rebuy', 'normal');
  const t = { config: cfg, status: 'finished', prizePercentsFinal: [50, 30, 20], entries: Array.from({ length: 15 }, (_, i) => ({ playerId: 'p' + i })) };
  assert.deepEqual(m.prizePercentsOf(t), [50, 30, 20]);
  const legacy = { config: cfg, status: 'finished', prizePercents: [50, 30, 20], entries: t.entries };
  assert.deepEqual(m.prizePercentsOf(legacy), [50, 30, 20]);
});

test('fecha en juego preparada antes de la tabla usa la tabla del club', async () => {
  const m = await import('../public/js/logic.js');
  const cfg = m.buildConfig({ config: m.defaultSeasonConfig() }, 'freezeout', 'normal');
  delete cfg.prizeTable; // como la fecha 11 de prueba
  const t = { config: cfg, status: 'running', prizePercents: [50, 30, 20], entries: Array.from({ length: 17 }, (_, i) => ({ playerId: 'p' + i })) };
  assert.deepEqual(m.prizePercentsOf(t), [38, 26, 18, 11, 7]);
});

test('ganancias y pérdidas de una fecha jugada en la app', async () => {
  const m = await import('../public/js/logic.js');
  const season = { id: 's', config: m.defaultSeasonConfig() };
  const cfg = m.buildConfig(season, 'rebuy', 'normal');
  const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const t = {
    id: 't', seasonId: 's', number: 1, status: 'finished', modality: 'rebuy', type: 'normal', config: cfg,
    entries: ids.map((id) => ({ playerId: id, rebuys: id === 'b' ? 2 : 0, addon: id !== 'h', luckyLoser: false })),
    events: ids.slice(1).reverse().map((id, i) => ({ id: 'e' + i, type: 'bust', playerId: id, outcome: 'out' })),
    jackpots: [{ playerId: 'c', amount: 20000 }],
  };
  const db = { settings: { pointTables: m.defaultPointTables() }, players: ids.map((id) => ({ id, name: id, type: 'club' })), seasons: [season], tournaments: [t] };
  const mt = m.moneyByTournament(t, db.settings, {});
  assert.equal(mt.b.e, 5000 + 2 * 5000 + 5000);
  assert.equal(mt.h.e, 5000);
  assert.equal(mt.a.f, 1000);
  assert.equal(mt.c.j, 20000);
  const pool = 8 * 5000 + 2 * 5000 + 7 * 5000; // 85.000; 8 jugadores: 65/35
  assert.equal(mt.a.p + mt.b.p, pool);
  const sm = m.seasonMoney(db, 's', {});
  const totalNet = sm.rows.reduce((s, r) => s + r.net, 0);
  assert.equal(totalNet, 20000 - 8 * 1000, 'lo que pierden unos lo ganan otros, salvo fee y jackpot');
  assert.equal(m.seasonMoney(db, 's', { t: { a: { e: 10000, f: 1000, p: 0, j: 0 } } }).rows.length, 1, 'los datos históricos tienen prioridad');
});

test('bounty: quien elimina al jugador asignado suma un punto extra', async () => {
  const m = await import('../public/js/logic.js');
  const season = { id: 's', config: m.defaultSeasonConfig() };
  const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const mk = (events, extra = {}) => ({
    id: 't', seasonId: 's', number: 1, label: 'Fecha 1', status: 'finished', modality: 'rebuy', type: 'normal',
    config: m.buildConfig(season, 'rebuy', 'normal'), entries: ids.map((id) => ({ playerId: id, rebuys: 0 })),
    events, bountyPlayerId: 'f', ...extra,
  });
  const outs = (pairs) => pairs.map(([p, by], i) => ({ id: 'e' + i, type: 'bust', playerId: p, byPlayerId: by, outcome: 'out' }));
  const order = [['h', 'a'], ['g', 'a'], ['f', 'c'], ['e', 'a'], ['d', 'b'], ['c', 'a'], ['b', 'a']];
  const t = mk(outs(order));
  const db = { settings: { pointTables: m.defaultPointTables() }, players: ids.map((id) => ({ id, name: id.toUpperCase(), type: 'club' })), seasons: [season], tournaments: [t] };
  assert.equal(m.bountyHunter(t), 'c');
  const res = Object.fromEntries(m.results(t, db.settings).map((r) => [r.playerId, r]));
  assert.equal(res.c.bonus, 1);
  assert.equal(res.c.points, m.pointsFor(db.settings.pointTables, 'normal', 8, 3) + 1);
  assert.match(m.buildSummary(db, t).find((b) => b.event && b.event.playerId === 'f').text, /C se cobra el bounty/);
  // una recompra del bounty no cuenta, solo la eliminación definitiva
  const t2 = mk([{ id: 'r', type: 'bust', playerId: 'f', byPlayerId: 'd', outcome: 'rebuy' }, ...outs(order)]);
  assert.equal(m.bountyHunter(t2), 'c');
  // si el bounty gana la fecha, nadie se lleva el punto
  const t3 = mk(outs(order), { bountyPlayerId: 'a' });
  assert.equal(m.bountyHunter(t3), null);
});

test('bounty según la regla del club', async () => {
  const m = await import('../public/js/logic.js');
  const mkT = (sid, n, extra) => ({ ...m.newTournament(sid, n), id: `${sid}t${n}`, ...extra });
  const db = {
    settings: { pointTables: m.defaultPointTables() },
    players: [
      { id: 'a', name: 'A', type: 'club' }, { id: 'b', name: 'B', type: 'club' }, { id: 'c', name: 'C', type: 'club' },
      { id: 'g', name: 'Invitado', type: 'invitado' },
    ],
    seasons: [{ id: 's1', name: 'Temporada 7', finalOrder: ['b', 'a', 'c'] }, { id: 's2', name: 'Temporada 8', config: m.defaultSeasonConfig() }],
    tournaments: [
      mkT('s1', 1, { status: 'finished', imported: { points: { a: 10, b: 20, c: 5 }, winnerId: 'b' } }),
      mkT('s2', 1, {}),
      mkT('s2', 2, {}),
    ],
  };
  // primera fecha de la temporada: campeón de la temporada anterior
  const t1 = db.tournaments[1];
  assert.deepEqual(m.bountyTargetFor(db, t1), { playerId: 'b', reason: 'campeón de la Temporada 7' });
  // fecha 1 jugada en la app y ganada por un invitado: el bounty de la fecha 2 es el mejor del club
  Object.assign(t1, {
    status: 'finished', modality: 'freezeout', config: m.buildConfig(db.seasons[1], 'freezeout', 'normal'),
    entries: ['a', 'b', 'c', 'g'].map((id) => ({ playerId: id })),
    events: [['c', 'g'], ['a', 'g'], ['b', 'g']].map(([p, by], i) => ({ id: 'e' + i, type: 'bust', playerId: p, byPlayerId: by, outcome: 'out' })),
  });
  const r2 = m.bountyTargetFor(db, db.tournaments[2]);
  assert.equal(r2.playerId, 'b', 'b quedó 2°, el mejor del club');
  assert.match(r2.reason, /es invitado/);
  // si el ganador es del club, es él
  t1.events = [['c', 'a'], ['g', 'a'], ['b', 'a']].map(([p, by], i) => ({ id: 'e' + i, type: 'bust', playerId: p, byPlayerId: by, outcome: 'out' }));
  assert.deepEqual(m.bountyTargetFor(db, db.tournaments[2]), { playerId: 'a', reason: 'ganó la Fecha 1' });
});

test('reiniciar una fecha la deja programada y conserva el calendario', async () => {
  const m = await import('../public/js/logic.js');
  const t = { ...m.newTournament('s', 11), venue: 'Santiago', modality: 'freezeout', dateOptions: ['2026-12-04'], dealerIds: ['a'],
    status: 'running', config: { x: 1 }, entries: [{ playerId: 'a' }], tables: [{}], events: [{}], clock: { level: 3 }, startedAt: 1, bountyPlayerId: 'a', prizePercents: [50] };
  m.resetTournament(t);
  assert.equal(t.status, 'planned');
  assert.deepEqual([t.entries, t.tables, t.events], [[], [], []]);
  assert.equal(t.config, undefined);
  assert.equal(t.clock, undefined);
  assert.equal(t.bountyPlayerId, undefined);
  assert.equal(t.venue, 'Santiago');
  assert.equal(t.modality, 'freezeout');
  assert.deepEqual(t.dateOptions, ['2026-12-04']);
});

test('bounty: si el ganador anterior no juega, pasa al 2°; en la planilla se detecta el +1', async () => {
  const m = await import('../public/js/logic.js');
  const pt = m.defaultPointTables();
  const db = {
    settings: { pointTables: pt },
    players: ['pancho', 'julio', 'joan', 'kc', 'x'].map((id) => ({ id, name: id, type: 'club' })),
    seasons: [{ id: 's', name: 'Temporada 6' }],
    tournaments: [
      { ...m.newTournament('s', 9), id: 't9', status: 'finished', imported: { points: { pancho: 19, julio: 13, joan: 0, kc: 0 }, winnerId: 'pancho', players: 16 } },
      { ...m.newTournament('s', 10), id: 't10', status: 'finished', imported: { points: { kc: 18, joan: 14, julio: 0, x: 10 }, winnerId: 'kc', players: 15 } },
    ],
  };
  const t10 = db.tournaments[1];
  const tg = m.bountyTargetFor(db, t10);
  assert.equal(tg.playerId, 'julio');
  assert.match(tg.reason, /2° en la Fecha 9 \(pancho no juega esta fecha\)/);
  assert.deepEqual(m.importedBounty(db, t10).hunter, 'joan');
});

test('cobros: saldo por jugador y pendientes', async () => {
  const m = await import('../public/js/logic.js');
  const fin = { t10: { a: { e: 20000, f: 1000, p: 0, j: 0, c: 8650 }, b: { e: 10000, f: 1000, p: 45000, j: 0, c: 0 }, 'g:Coke': { e: 15000, f: 1000, p: 0, j: 0, c: 6650 } } };
  const t = { id: 't10', status: 'finished', imported: { points: {} }, payments: { 'g:Coke': true } };
  const db = { settings: { pointTables: m.defaultPointTables() }, players: [], tournaments: [t] };
  const rows = Object.fromEntries(m.settlement(t, db.settings, fin).map((r) => [r.key, r]));
  assert.equal(m.settlement({ ...t, charges: { b: 4000 } }, db.settings, fin).find((r) => r.key === 'b').balance, 30000, 'otros se descuenta');
  assert.equal(rows.a.balance, -29650);
  assert.equal(rows.b.balance, 34000);
  assert.equal(rows['g:Coke'].paid, true);
  const pend = m.pendingDebts(db, fin);
  assert.deepEqual(pend.map((x) => [x.key, x.total]), [['a', -29650], ['b', 34000]]);
  assert.equal(m.tracksPayments({ status: 'finished', imported: {} }), false, 'fechas de la planilla sin control de cobros');
  assert.equal(m.seasonMoney({ ...db, seasons: [{ id: 's' }], tournaments: [{ ...t, seasonId: 's', number: 1 }] }, 's', fin).rows.length, 2, 'los invitados no entran en ganancias y pérdidas');
});

test('lugares de las fechas de la planilla a partir de los puntos', async () => {
  const m = await import('../public/js/logic.js');
  const db = { settings: { pointTables: m.defaultPointTables() }, players: [] };
  const t10 = { type: 'normal', imported: { players: 15, winnerId: 'kc', points: { kc: 18, joan: 14, billy: 10, serrano: 7, julio: 0 } } };
  assert.deepEqual(m.importedPositions(db, t10), { kc: 1, joan: 2, billy: 3, serrano: 4, julio: null });
  const sinCantidad = { type: 'normal', imported: { winnerId: 'g', points: { g: 19, j: 13, m: 10, k: 7, x: 0 } } };
  assert.deepEqual(m.importedPositions(db, sinCantidad), { g: 1, j: 2, m: 3, k: 4, x: null }, 'detecta el +1 del bounty sin saber la cantidad de jugadores');
  const empate = { type: 'normal', imported: { players: 10, winnerId: 'a', points: { a: 11, b: 3, c: 3 } } };
  const pe = m.importedPositions(db, empate);
  assert.notEqual(pe.b, pe.c, 'no repite lugares');
});

test('fechas amistosas no cuentan para puntos, posiciones ni estadísticas', async () => {
  const m = await import('../public/js/logic.js');
  const season = { id: 's', config: m.defaultSeasonConfig() };
  const ids = ['a', 'b', 'c', 'd'];
  const db = { settings: { pointTables: m.defaultPointTables() }, players: ids.map((id) => ({ id, name: id, type: 'club' })), seasons: [season], tournaments: [] };
  const am = { ...m.newFriendly(db, 's'), status: 'finished', modality: 'freezeout', config: m.buildConfig(season, 'freezeout', 'normal'),
    entries: ids.map((id) => ({ playerId: id })), events: [['d', 'a'], ['c', 'a'], ['b', 'a']].map(([p, by], i) => ({ id: 'e' + i, type: 'bust', playerId: p, byPlayerId: by, outcome: 'out' })) };
  db.tournaments.push(am);
  assert.equal(am.label, 'Amistoso 1');
  assert.equal(m.seasonTournaments(db, 's').length, 0);
  assert.equal(m.allSeasonTournaments(db, 's').length, 1);
  assert.ok(m.results(am, db.settings).every((r) => r.points === 0));
  assert.equal(m.ranking(db, 's').rows.every((r) => r.total === 0 && r.played === 0), true);
  assert.equal(m.seasonStats(db, 's').finished, 0);
  assert.equal(m.bountyTargetFor(db, am), null);
  assert.equal(m.tracksPayments(am), true, 'los cobros sí aplican');
});

test('lugares: el relato completa a quienes no sumaron puntos y el admin puede fijarlos', async () => {
  const m = await import('../public/js/logic.js');
  const db = { settings: { pointTables: m.defaultPointTables() }, players: [] };
  const t = { type: 'normal', imported: { players: 10, winnerId: 'a', points: { a: 11, b: 8, c: 0, d: 0, e: 0 } } };
  const extra = { players: 10, pos: { c: 9, d: 2, e: 30 } };
  const pp = m.importedPositions(db, t, extra);
  assert.equal(pp.c, 9);
  assert.equal(pp.d, null, 'no puede estar sobre quienes sumaron puntos');
  assert.equal(pp.e, null, 'fuera de rango');
  assert.equal(m.importedPositions(db, { ...t, placesManual: { e: 10 } }, extra).e, 10);
});

test('bounty: desde la temporada 4; en la fecha 1, solo desde la temporada 7', async () => {
  const m = await import('../public/js/logic.js');
  const done = (sid, n, winner) => ({ ...m.newTournament(sid, n), id: `${sid}t${n}`, status: 'finished', imported: { points: { a: winner === 'a' ? 9 : 7, b: winner === 'b' ? 9 : 7 }, winnerId: winner } });
  const todo = (sid, n) => ({ ...m.newTournament(sid, n), id: `${sid}t${n}` });
  const db = {
    settings: { pointTables: m.defaultPointTables() },
    players: ['a', 'b'].map((id) => ({ id, name: id, type: 'club' })),
    seasons: [{ id: 'x2', name: 'Temporada 2' }, { id: 'x5', name: 'Temporada 5', finalOrder: ['a', 'b'] }, { id: 'x6', name: 'Temporada 6', finalOrder: ['b', 'a'] }, { id: 'x7', name: 'Temporada 7' }],
    tournaments: [done('x2', 1, 'a'), todo('x2', 2), done('x5', 1, 'a'), done('x6', 1, 'b'), todo('x6', 2), todo('x7', 1)],
  };
  const get = (id) => db.tournaments.find((t) => t.id === id);
  assert.equal(m.bountyTargetFor(db, get('x2t2')), null, 'temporada 2: aún no existía el bounty');
  db.seasons[0].name = 'Temporada 3';
  assert.equal(m.bountyTargetFor(db, get('x2t2')), null, 'temporada 3: tampoco');
  assert.equal(m.bountyTargetFor(db, get('x6t1')), null, 'temporada 6, fecha 1: sin bounty');
  assert.equal(m.bountyTargetFor(db, get('x6t2')).playerId, 'b', 'temporada 6, fecha 2: ganador de la fecha 1');
  get('x6t2').status = 'finished';
  get('x6t2').imported = { points: { a: 9, b: 7 }, winnerId: 'a' };
  const r = m.bountyTargetFor(db, get('x7t1'));
  assert.equal(r.playerId, 'b');
  assert.equal(r.reason, 'campeón de la Temporada 6', 'temporada 7, fecha 1: campeón de la temporada anterior');
});
