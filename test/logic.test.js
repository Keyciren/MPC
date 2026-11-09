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
