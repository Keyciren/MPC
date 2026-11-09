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
  assert.equal(tot.pool, 5 * 10000 + 2 * 10000 + 5 * 10000);
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
