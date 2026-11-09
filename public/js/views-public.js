import { S, esc, cardsHtml, imgHtml, fmtDate, pname, currentSeason, on, isAdmin, playerById } from './core.js';
import {
  ranking,
  seasonTournaments,
  results,
  buildSummary,
  totals,
  tournamentConfig,
  money,
  hitman,
  seasonStats,
  pointColumn,
  STREETS,
  alivePlayers,
  outEvents,
  entryState,
  prizes,
  attendedIds,
  history,
  roundNumber,
  rebuyOpenAt,
  prizePercentsOf,
  defaultPrizeTable,
  seasonMoney,
  moneyHistory,
  bountyHunter,
  bountyPoints,
} from './logic.js';

export function seasonPicker(selectedId, route) {
  const opts = S.db.seasons.map((s) => `<option value="${s.id}" ${s.id === selectedId ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
  return `<select class="season-pick" data-route="${route}">${opts}</select>`;
}
export function bindSeasonPicker(root) {
  on(root, '.season-pick', 'change', (el) => {
    location.hash = `${el.dataset.route}?s=${el.value}`;
  });
}
export function seasonFromQuery(q) {
  return S.db.seasons.find((s) => s.id === q.s) || currentSeason();
}

const MODALITY = { rebuy: 'Rebuy', freezeout: 'Freezeout' };
const TYPE = { normal: 'Normal', gs: 'Grand Slam' };
const STATUS = { planned: 'Programada', setup: 'Preparando', running: 'En juego', finished: 'Finalizada' };

export function badges(t) {
  return `<span class="tag ${t.modality}">${MODALITY[t.modality] || ''}</span><span class="tag ${t.type}">${TYPE[t.type] || ''}</span>`;
}

// ---------- Inicio ----------
export function homeView() {
  if (S.noData)
    return {
      html: `<section class="hero"><h1>♠ Club de Poker</h1><p class="muted">Todavía no hay información publicada. El administrador debe ingresar y presionar <b>Publicar</b>.</p></section>`,
    };
  const season = currentSeason();
  if (!season) return { html: '<p>No hay temporadas.</p>' };
  const ts = seasonTournaments(S.db, season.id);
  const live = ts.find((t) => t.status === 'running');
  const today = new Date().toISOString().slice(0, 10);
  const next = ts.find((t) => t.status !== 'finished' && t.status !== 'running' && (t.finalDate || '9999') >= today);
  const last = [...ts].reverse().find((t) => t.status === 'finished');
  const rk = ranking(S.db, season.id).rows.slice(0, 5);
  const done = ts.filter((t) => t.status === 'finished').length;

  return {
    html: `
    <section class="hero">
      <h1>${esc(S.db.settings.clubName)}</h1>
      <p class="muted">${esc(season.name)} · ${done} de ${ts.length} fechas jugadas</p>
    </section>
    <div class="grid2">
      ${
        live
          ? `<a class="panel live-card" href="#/torneo/${live.id}"><div class="pulse"></div><h3>¡${esc(live.label)} en juego!</h3><p>${alivePlayers(live).length} jugadores en carrera · Ver en vivo →</p></a>`
          : ''
      }
      <div class="panel">
        <h3>Próxima fecha</h3>
        ${
          next
            ? `<p class="big">${esc(next.label)}</p><p>${next.finalDate ? fmtDate(next.finalDate) : next.dateOptions.length ? 'Opciones: ' + next.dateOptions.map((d) => fmtDate(d, { day: 'numeric', month: 'short' })).join(' / ') : 'Fecha por definir'}</p><p>${badges(next)} ${next.venue ? '· ' + esc(next.venue) : ''}</p>`
            : '<p class="muted">No hay fechas pendientes.</p>'
        }
      </div>
      <div class="panel">
        <h3>Última fecha</h3>
        ${
          last
            ? (() => {
                const w = results(last, S.db.settings)[0];
                return `<p class="big">${esc(last.label)}</p><p>Ganador: <b>${esc(pname(w && w.playerId))}</b></p><a class="btn sm" href="#/torneo/${last.id}">Ver resumen</a>`;
              })()
            : '<p class="muted">Aún no se juegan fechas.</p>'
        }
      </div>
      <div class="panel">
        <h3>Top 5 del ranking</h3>
        <ol class="top5">${rk.map((r) => `<li><span>${esc(r.player.nickname || r.player.name)}</span><b>${r.total}</b></li>`).join('') || '<li class="muted">Sin datos</li>'}</ol>
        <a class="btn sm ghost" href="#/ranking">Ranking completo</a>
      </div>
    </div>`,
  };
}

// ---------- Calendario ----------
export function calendarView(q) {
  const season = seasonFromQuery(q);
  const ts = seasonTournaments(S.db, season.id);
  const rows = ts
    .map((t) => {
      const opts = t.dateOptions || [];
      const dealers = (t.dealerIds || []).map(pname).join(', ');
      return `<tr class="${t.type === 'gs' ? 'gs-row' : ''}">
        <td><a href="#/torneo/${t.id}"><b>${esc(t.label)}</b></a></td>
        <td>${t.finalDate ? `<b>${fmtDate(t.finalDate, { day: '2-digit', month: '2-digit', year: 'numeric' })}</b>` : opts.map((d) => fmtDate(d, { day: '2-digit', month: '2-digit' })).join(' / ') || '<span class="muted">Por definir</span>'}</td>
        <td>${esc(t.venue || '')}</td>
        <td>${badges(t)}</td>
        <td class="hide-sm">${esc(dealers)}${t.trainee ? `<br><span class="muted small">Trainee: ${esc(t.trainee)}</span>` : ''}</td>
        <td><span class="status ${t.status}">${STATUS[t.status] || ''}</span></td>
      </tr>`;
    })
    .join('');
  return {
    html: `
    <div class="row between wrap"><h2>Calendario</h2>${seasonPicker(season.id, '#/calendario')}</div>
    <div class="panel">${monthGrids(ts)}</div>
    <div class="panel"><div class="table-wrap"><table class="tbl">
      <thead><tr><th>Fecha</th><th>Día</th><th>Sede</th><th>Modalidad</th><th class="hide-sm">Dealers</th><th>Estado</th></tr></thead>
      <tbody>${rows}</tbody></table></div></div>`,
    bind: bindSeasonPicker,
  };
}

function monthGrids(ts) {
  const map = {};
  ts.forEach((t) => {
    if (t.finalDate) (map[t.finalDate] = map[t.finalDate] || []).push({ t, final: true });
    else (t.dateOptions || []).forEach((d) => (map[d] = map[d] || []).push({ t, final: false }));
  });
  const dates = Object.keys(map).sort();
  if (!dates.length) return '<p class="muted">Aún no hay días definidos.</p>';
  const months = [...new Set(dates.map((d) => d.slice(0, 7)))];
  const dow = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  return `<div class="months">${months
    .map((m) => {
      const [y, mo] = m.split('-').map(Number);
      const first = new Date(y, mo - 1, 1);
      const days = new Date(y, mo, 0).getDate();
      const offset = (first.getDay() + 6) % 7;
      let cells = '';
      for (let i = 0; i < offset; i++) cells += '<div></div>';
      for (let d = 1; d <= days; d++) {
        const iso = `${m}-${String(d).padStart(2, '0')}`;
        const items = map[iso];
        if (items) {
          const it = items[0];
          cells += `<a class="day has ${it.final ? 'final' : 'option'} ${it.t.type === 'gs' ? 'gs' : ''}" href="#/torneo/${it.t.id}" title="${esc(it.t.label)}${it.final ? '' : ' (opción)'}">${d}<small>${esc(it.t.label.replace('Fecha ', 'F'))}</small></a>`;
        } else cells += `<div class="day">${d}</div>`;
      }
      return `<div class="month"><h4>${first.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })}</h4><div class="mgrid">${dow.map((x) => `<b>${x}</b>`).join('')}${cells}</div></div>`;
    })
    .join('')}</div>
    <p class="small muted legend"><span class="dot final"></span> Fecha confirmada <span class="dot option"></span> Opción de fecha <span class="dot gs"></span> Grand Slam</p>`;
}

// ---------- Fecha (resumen / en vivo) ----------
export function tournamentView(id) {
  const t = S.db.tournaments.find((x) => x.id === id);
  if (!t) return { html: '<p>Fecha no encontrada.</p>' };
  const season = S.db.seasons.find((s) => s.id === t.seasonId);
  const adminLink = isAdmin() ? `<a class="btn sm" href="#/admin/fecha/${t.id}">Administrar</a>` : '';
  const head = `<div class="row between wrap"><div><h2>${esc(t.label)} <small class="muted">${esc(season ? season.name : '')}</small></h2>
    <p>${t.finalDate ? fmtDate(t.finalDate) : 'Fecha por definir'} ${t.venue ? '· ' + esc(t.venue) : ''} ${badges(t)}</p></div>${adminLink}</div>`;

  if (t.status === 'finished' && t.imported) return { html: head + importedTournament(t) };
  if (t.status === 'finished')
    return {
      html: head + finishedTournament(t),
      bind(root) {
        const b = root.querySelector('[data-word]');
        if (b) b.onclick = () => import('./word.js').then((m) => m.downloadWord(t)).catch((e) => alert(e.message));
      },
    };
  if (t.status === 'running') return { html: head + liveTournament(t), poll: true };
  return { html: head + '<div class="panel"><p class="muted">Esta fecha aún no se juega.</p></div>' };
}

export function clockState(t) {
  const cfg = t.config;
  const c = t.clock || { level: 0, running: false, remaining: null };
  const lv = cfg.levels[c.level] || cfg.levels[cfg.levels.length - 1];
  let remaining = c.remaining ?? lv.minutes * 60000;
  if (c.running && c.endsAt) remaining = Math.max(0, c.endsAt - Date.now());
  const next = cfg.levels.slice(c.level + 1).find((l) => !l.break);
  const nextIsBreak = !!(cfg.levels[c.level + 1] && cfg.levels[c.level + 1].break);
  return { level: c.level, round: roundNumber(cfg.levels, c.level), lv, next, nextIsBreak, remaining, running: c.running };
}

export function fmtMs(ms) {
  const s = Math.ceil(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

const n = (v) => Number(v || 0).toLocaleString('es-CL');

export function clockHtml(t) {
  const cfg = t.config;
  const cs = clockState(t);
  const rebuyOpen = rebuyOpenAt(cfg, t.modality, cs.level);
  return `<div class="clock ${cs.lv.break ? 'on-break' : ''}" data-clock>
    <div class="lvl">${cs.lv.break ? '☕ Descanso' : `Nivel ${cs.round}`}</div>
    <div class="time" data-time>${fmtMs(cs.remaining)}</div>
    ${cs.lv.break ? '<div class="blinds">Descanso</div>' : `<div class="blinds">${n(cs.lv.sb)} / ${n(cs.lv.bb)}${cs.lv.ante ? ` <small>ante ${n(cs.lv.ante)}</small>` : ''}</div>`}
    ${cs.nextIsBreak ? `<div class="nextlvl">Luego: descanso de ${cfg.levels[cs.level + 1].minutes} min</div>` : cs.next ? `<div class="nextlvl">Próximo: ${n(cs.next.sb)} / ${n(cs.next.bb)}${cs.next.ante ? ` · ante ${n(cs.next.ante)}` : ''}</div>` : ''}
    ${t.modality === 'rebuy' ? `<div class="rebuy-flag ${rebuyOpen ? 'open' : 'closed'}">${rebuyOpen ? `Recompra abierta hasta el nivel ${cfg.rebuyUntilLevel}` : 'Periodo de recompra cerrado'}</div>` : ''}
  </div>`;
}

function liveTournament(t) {
  const cfg = t.config;
  const tot = totals(t, cfg);
  const pz = prizes(tot.pool, prizePercentsOf(t, cfg), cfg.roundTo);
  const alive = new Set(alivePlayers(t).map((e) => e.playerId));
  const outs = outEvents(t);
  const n = (t.entries || []).length;
  return `<div class="live-view">
  <div class="live-layout">
    <div class="panel center clock-panel">${clockHtml(t)}</div>
    <div class="panel">
      ${prizeCards(pz, cfg.currency)}
      ${publicBountyLine(t)}
      <div class="stats-row">
        <div><b>${tot.alive}/${tot.n}</b><span>jugadores</span></div>
        <div><b>${money(tot.pool, cfg.currency)}</b><span>pozo</span></div>
        <div><b>${tot.avgStack.toLocaleString('es-CL')}</b><span>stack promedio</span></div>
        ${t.modality === 'rebuy' ? `<div><b>${tot.rebuys}</b><span>recompras</span></div><div><b>${tot.addons}</b><span>add on</span></div>` : `<div><b>${tot.lucky}</b><span>lucky loser</span></div>`}
      </div>

    </div>
  </div>
  <div class="panel"><h3>Mesas</h3><div class="tables">${(t.tables || [])
    .map(
      (tb) => `<div class="felt ${tb.final ? 'final' : ''}"><h4>${tb.final ? 'Mesa final' : 'Mesa ' + tb.number}${tb.dealer ? ` <small>Dealer: ${esc(tb.dealer.playerId ? pname(tb.dealer.playerId) : tb.dealer.name)}</small>` : ''}</h4>
        <ul class="seats">${tb.seats.map((p, i) => (alive.has(p) ? `<li><span class="seat">${i + 1}</span>${esc(pname(p))}${tb.dealer && tb.dealer.playerId === p ? ' <span class="pill dealer">Dealer</span>' : ''}${t.bountyPlayerId === p ? ' <span class="pill bounty">🎯 Bounty</span>' : ''}</li>` : '')).join('')}</ul></div>`
    )
    .join('')}</div></div>
  <div class="panel"><h3>Eliminaciones</h3>${
    outs.length
      ? `<ol class="busts">${outs.map((e, i) => `<li><b>${n - i}°</b> ${esc(pname(e.playerId))} ${e.byPlayerId ? `<span class="muted">por</span> ${esc(pname(e.byPlayerId))}` : ''} ${cardsHtml(e.playerCards, true)} ${e.byCards && e.byCards.length ? 'vs ' + cardsHtml(e.byCards, true) : ''}</li>`).reverse().join('')}</ol>`
      : '<p class="muted">Aún no hay eliminados.</p>'
  }</div></div>`;
}

function publicBountyLine(t) {
  if (!t.bountyPlayerId) return '';
  const h = bountyHunter(t);
  const pts = bountyPoints(t);
  return `<div class="bounty-box"><b>🎯 Bounty: ${esc(pname(t.bountyPlayerId))}</b> ${h ? `— lo eliminó <b>${esc(pname(h))}</b> (+${pts})` : `<span class="muted small">quien lo elimine suma +${pts} ${pts === 1 ? 'punto' : 'puntos'}</span>`}</div>`;
}

// Premios en grande: un recuadro por puesto premiado
export function prizeCards(pz, currency) {
  if (!pz.length) return '';
  return `<div class="prize-cards">${pz.map((p, i) => `<div class="prize-card ${i === 0 ? 'first' : ''}"><span>${i + 1}° lugar</span><b>${money(p, currency)}</b></div>`).join('')}</div>`;
}

export function resultsTable(t) {
  const cfg = t.config;
  const res = results(t, S.db.settings);
  const hunter = bountyHunter(t);
  const bpts = bountyPoints(t);
  const bountyInfo = t.bountyPlayerId
    ? `<div class="bounty-box">🎯 <b>Punto extra:</b> ${
        hunter
          ? `<b>${esc(pname(hunter))}</b> eliminó al bounty <b>${esc(pname(t.bountyPlayerId))}</b> y suma +${bpts} ${bpts === 1 ? 'punto' : 'puntos'} al ranking.`
          : outEvents(t).some((e) => e.playerId === t.bountyPlayerId)
            ? `el bounty era <b>${esc(pname(t.bountyPlayerId))}</b>, pero no se registró quién lo eliminó.`
            : `el bounty era <b>${esc(pname(t.bountyPlayerId))}</b> y nadie lo eliminó: no se entregó el punto.`
      }</div>`
    : '';
  return `${bountyInfo}<div class="table-wrap"><table class="tbl">
    <thead><tr><th>#</th><th>Jugador</th><th>Puntos</th><th>Premio</th><th>Elim.</th>${t.modality === 'rebuy' ? '<th>Rec.</th><th>Add on</th>' : '<th>Lucky</th>'}</tr></thead>
    <tbody>${res
      .map((r) => {
        const p = playerById(r.playerId);
        return `<tr class="${r.position === 1 ? 'gold' : ''}"><td>${r.position || ''}</td><td>${esc(pname(r.playerId))}${p && p.type === 'invitado' ? ' <span class="tag guest">invitado</span>' : ''}${r.playerId === hunter ? ` <span class="pill bounty" title="Ganó el punto extra por eliminar al bounty">🎯 +${bpts} bounty</span>` : ''}${r.playerId === t.bountyPlayerId ? ' <span class="tag">era el bounty</span>' : ''}</td>
        <td><b>${r.points}</b>${r.bonus ? ` <small class="muted">(+${r.bonus} extra)</small>` : ''}</td><td>${r.prize ? money(r.prize, cfg.currency) : ''}</td><td>${r.kills || ''}</td>
        ${t.modality === 'rebuy' ? `<td>${r.rebuys || ''}</td><td>${r.addon ? '✔' : ''}</td>` : `<td>${r.luckyLoser ? '✔' : ''}</td>`}</tr>`;
      })
      .join('')}</tbody></table></div>`;
}

function finishedTournament(t) {
  const cfg = t.config;
  const tot = totals(t, cfg);
  const blocks = buildSummary(S.db, t);
  const hm = hitman(t);
  const summary = blocks
    .map((b) => {
      if (b.kind === 'title') return `<h2 class="sum-title">${esc(b.text)}</h2>`;
      const cls = b.kind === 'winner' ? 'sum-p winner' : 'sum-p';
      const ev = b.event;
      const cardsLine =
        ev && (ev.playerCards?.length || ev.byCards?.length || ev.board?.length)
          ? `<div class="hand-line">${esc(pname(ev.playerId))} ${cardsHtml(ev.playerCards, true)} ${ev.byPlayerId ? `vs ${esc(pname(ev.byPlayerId))} ${cardsHtml(ev.byCards, true)}` : ''} ${ev.board && ev.board.length ? `· Mesa ${cardsHtml(ev.board, true)}` : ''}${ev.street ? ` · all in ${esc(STREETS.find((s) => s.id === ev.street)?.label || '')}` : ''}</div>`
          : '';
      return `<div class="${cls}"><p>${esc(b.text)}</p>${cardsLine}${imgHtml(b.image)}</div>`;
    })
    .join('');
  return `
  <div class="tabs" data-tabs>
    <button class="on" data-tab="resumen">Resumen</button><button data-tab="resultados">Resultados</button><button data-tab="estad">Estadísticas</button>
  </div>
  <div data-pane="resumen" class="panel summary">${summary}
    <div class="row mt"><button class="btn ghost sm" data-word="${t.id}">Descargar Word</button><button class="btn ghost sm" onclick="window.print()">Imprimir</button></div>
  </div>
  <div data-pane="resultados" class="panel hidden">${resultsTable(t)}</div>
  <div data-pane="estad" class="panel hidden">
    <div class="stats-row">
      <div><b>${tot.n}</b><span>jugadores</span></div>
      <div><b>${money(tot.pool, cfg.currency)}</b><span>pozo</span></div>
      ${t.modality === 'rebuy' ? `<div><b>${tot.rebuys}</b><span>recompras</span></div><div><b>${tot.addons}</b><span>add on</span></div>` : `<div><b>${tot.lucky}</b><span>lucky loser</span></div>`}
      <div><b>${tot.chips.toLocaleString('es-CL')}</b><span>fichas en juego</span></div>
    </div>
    <h4>Hitman de la noche</h4>
    <p>${hm.kills ? `${hm.players.map((p) => `<b>${esc(pname(p))}</b>`).join(', ')} con ${hm.kills} eliminacion${hm.kills > 1 ? 'es' : ''}` : '<span class="muted">Sin datos</span>'}</p>
    ${(t.jackpots || [])
      .map(
        (j) => `<div class="jackpot"><h4>🎰 Jackpot</h4><p><b>${esc(pname(j.playerId))}</b> · ${esc(j.hand || '')} ${cardsHtml(j.cards, true)} · ${money(j.amount, cfg.currency)}${j.loserId ? ` · contra ${esc(pname(j.loserId))}` : ''}</p>${imgHtml(j.image, 'small')}</div>`
      )
      .join('') || '<p class="muted">Sin jackpot en esta fecha.</p>'}
  </div>`;
}

export function bindTabs(root) {
  on(root, '[data-tabs] button', 'click', (b) => {
    const tabs = b.closest('[data-tabs]');
    tabs.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    root.querySelectorAll('[data-pane]').forEach((p) => p.classList.toggle('hidden', p.dataset.pane !== b.dataset.tab));
  });
}

export function importedTournament(t) {
  const im = t.imported;
  const cur = (t.config && t.config.currency) || '$';
  const res = results(t, S.db.settings);
  return `<div class="panel"><p class="muted small">Fecha cargada desde la planilla histórica del club: se conocen los puntos${im.prizes ? ', los premios' : ''} y el ganador, pero no el detalle de las eliminaciones.</p>
    ${im.players ? `<p>${im.players} jugadores${im.guests ? ` (${im.guests} invitado${im.guests > 1 ? 's' : ''})` : ''}</p>` : ''}
    <div class="table-wrap"><table class="tbl"><thead><tr><th></th><th>Jugador</th><th>Puntos</th>${im.prizes ? '<th>Premio</th>' : ''}${Object.keys(im.kills || {}).length ? '<th>Elim.</th>' : ''}</tr></thead>
    <tbody>${res
      .map(
        (r) => `<tr class="${r.position === 1 ? 'gold' : ''}"><td>${r.position === 1 ? '🏆' : ''}</td><td>${esc(pname(r.playerId))}</td><td><b>${r.points}</b></td>${im.prizes ? `<td>${r.prize ? money(r.prize, cur) : ''}</td>` : ''}${Object.keys(im.kills || {}).length ? `<td>${r.kills || ''}</td>` : ''}</tr>`
      )
      .join('')}</tbody></table></div></div>`;
}

// ---------- Historial ----------
export function historyView() {
  const h = history(S.db);
  const medal = ['🥇', '🥈', '🥉'];
  return {
    html: `<h2>Historial del club</h2>
    <div class="champions">${[...h.seasons]
      .reverse()
      .map(
        (x) => `<a class="panel champ ${x.done ? '' : 'live'}" href="#/ranking?s=${x.season.id}">
          <div class="row between"><h3>${esc(x.season.name)}</h3><span class="muted small">${x.done ? `${x.played} fechas` : `En curso · ${x.played} de ${x.total}`}</span></div>
          <ol class="podium">${x.podium.map((r, i) => `<li><span>${x.done ? medal[i] : i + 1 + '°'} ${esc(r.player.nickname || r.player.name)}</span><b>${r.total}</b></li>`).join('')}</ol>
          ${x.hitman ? `<p class="small muted">Hitman: ${esc(pname(x.hitman.playerId))} (${x.hitman.kills})</p>` : ''}
        </a>`
      )
      .join('')}</div>
    <div class="panel"><h3>Salón de la fama</h3>
      <div class="table-wrap"><table class="tbl">
      <thead><tr><th>Jugador</th><th>Títulos</th><th>Podios</th><th>Fechas ganadas</th><th>Mejor lugar</th><th>Temporadas</th><th>Puntos históricos</th></tr></thead>
      <tbody>${h.hall
        .map(
          (f) => `<tr class="${f.titles ? 'gold' : ''}"><td>${esc(f.player.nickname || f.player.name)}</td><td>${f.titles ? '🏆'.repeat(f.titles) : ''}<span class="muted small">${f.titleSeasons.map((n) => ' ' + esc(n.replace('Temporada ', 'T'))).join(',')}</span></td><td>${f.podiums || ''}</td><td>${f.fechas || ''}</td><td>${f.best ? f.best + '°' : ''}</td><td>${f.seasons}</td><td>${Math.round(f.points)}</td></tr>`
        )
        .join('')}</tbody></table></div>
      <p class="small muted">Títulos, podios y mejor lugar cuentan solo temporadas terminadas. Fechas ganadas y puntos incluyen la temporada en curso. En las temporadas cargadas desde la planilla, la fecha se le asigna a quien sumó más puntos.</p>
    </div>`,
  };
}

// ---------- Ranking ----------
export function rankingView(q) {
  const season = seasonFromQuery(q);
  const { tournaments, rows } = ranking(S.db, season.id);
  return {
    html: `
    <div class="row between wrap"><h2>Tabla de posiciones</h2>${seasonPicker(season.id, '#/ranking')}</div>
    <div class="panel"><div class="table-wrap"><table class="tbl ranking">
      <thead><tr><th>Pos</th><th class="sticky">Jugador</th><th>Total</th>${tournaments.map((t) => `<th title="${esc(t.label)}"><a href="#/torneo/${t.id}">T${t.number}</a>${t.type === 'gs' ? '<sup>GS</sup>' : ''}</th>`).join('')}</tr></thead>
      <tbody>${rows
        .map(
          (r) => `<tr><td>${r.position}</td><td class="sticky">${esc(r.player.nickname || r.player.name)}</td><td><b>${r.total}</b></td>${r.cells
            .map((c) => `<td class="${c.value === 'x' ? 'absent' : ''} ${c.position === 1 ? 'win' : ''}">${c.value}</td>`)
            .join('')}</tr>`
        )
        .join('')}</tbody></table></div>
      <p class="small muted">x = no asistió · celda dorada = ganó la fecha · Solo se listan jugadores del club (no invitados).</p></div>`,
    bind: bindSeasonPicker,
  };
}

// ---------- Tablas de puntaje ----------
export function pointsView() {
  const pt = S.db.settings.pointTables;
  return {
    html: `<h2>Tablas de puntaje</h2>${['normal', 'gs'].map((k) => `<div class="panel"><h3>${esc(pt[k].name)}</h3>${pointsTableHtml(pt[k])}</div>`).join('')}
      <div class="panel"><h3>Tabla de premios</h3>${prizeTableHtml((currentSeason() && currentSeason().config.prizeTable) || defaultPrizeTable())}</div>`,
  };
}

export function prizeTableHtml(rows) {
  const max = Math.max(0, ...rows.map((r) => r.percents.length));
  const ord = ['1°', '2°', '3°', '4°', '5°', '6°', '7°', '8°', '9°', '10°'];
  let body = `<tr><th>Puestos premiados</th>${rows.map((r) => `<td><b>${r.percents.length}</b></td>`).join('')}</tr>`;
  for (let i = 0; i < max; i++) body += `<tr><th>${ord[i] || i + 1 + '°'}</th>${rows.map((r) => `<td>${r.percents[i] != null ? r.percents[i] + '%' : ''}</td>`).join('')}</tr>`;
  return `<div class="table-wrap"><table class="tbl points"><thead><tr><th>Lugar \\ Jugadores</th>${rows.map((r) => `<th>${esc(r.label)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>`;
}

export function pointsTableHtml(tb) {
  const maxRows = Math.max(0, ...tb.columns.map((c) => c.points.length));
  const ord = ['Primero', 'Segundo', 'Tercero', 'Cuarto', 'Quinto', 'Sexto', 'Séptimo', 'Octavo', 'Noveno', 'Décimo'];
  let rows = '';
  for (let i = 0; i < maxRows; i++) {
    rows += `<tr><th>${ord[i] || i + 1 + '°'}</th>${tb.columns.map((c) => `<td>${c.points[i] ?? ''}</td>`).join('')}</tr>`;
  }
  return `<div class="table-wrap"><table class="tbl points"><thead><tr><th>Lugar \\ Jugadores</th>${tb.columns.map((c) => `<th>${esc(c.label)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

// ---------- Estadísticas de temporada ----------
function moneyCell(v, cur = '$') {
  const n = Math.round(v || 0);
  return `<span class="${n > 0 ? 'pos' : n < 0 ? 'neg' : ''}">${n > 0 ? '+' : n < 0 ? '−' : ''}${money(Math.abs(n), cur)}</span>`;
}

function moneySection(season) {
  const fin = S.fin || {};
  const sm = seasonMoney(S.db, season.id, fin);
  const hist = moneyHistory(S.db, fin);
  const isGuest = (id) => (playerById(id) || {}).type === 'invitado';
  const tot = sm.rows.reduce((a, r) => ({ e: a.e + r.e, f: a.f + r.f, p: a.p + r.p, j: a.j + r.j }), { e: 0, f: 0, p: 0, j: 0 });
  return `<div class="panel"><h3>Ganancias y pérdidas — ${esc(season.name)}</h3>
    ${
      sm.rows.length
        ? `<div class="table-wrap"><table class="tbl money">
      <thead><tr><th>Jugador</th><th>Fechas</th><th>Entradas</th><th>Fee</th><th>Premios</th><th>Jackpot</th><th>Neto</th></tr></thead>
      <tbody>${sm.rows
        .map(
          (r) => `<tr><td>${esc(pname(r.playerId))}${isGuest(r.playerId) ? ' <span class="tag guest">inv</span>' : ''}</td><td>${r.fechas}</td><td>${money(r.e)}</td><td>${money(r.f)}</td><td>${r.p ? money(r.p) : ''}</td><td>${r.j ? money(r.j) : ''}</td><td><b>${moneyCell(r.net)}</b></td></tr>`
        )
        .join('')}</tbody>
      <tfoot><tr><th>Total</th><th></th><th>${money(tot.e)}</th><th>${money(tot.f)}</th><th>${money(tot.p)}</th><th>${money(tot.j)}</th><th></th></tr></tfoot></table></div>
      <p class="small muted">Neto = premios + jackpot − entradas (buy-in, recompras, add on, lucky loser) − fee. No incluye la comida. ${sm.fechas} fecha${sm.fechas === 1 ? '' : 's'} con datos de dinero.</p>`
        : '<p class="muted">Aún no hay datos de dinero para esta temporada.</p>'
    }</div>
    ${
      hist.rows.length
        ? `<div class="panel"><h3>Ganancias y pérdidas por temporada</h3><div class="table-wrap"><table class="tbl money">
      <thead><tr><th>Jugador</th>${hist.seasons.map((s) => `<th>${esc(s.name.replace('Temporada ', 'T'))}</th>`).join('')}<th>Total</th></tr></thead>
      <tbody>${hist.rows
        .map((r) => `<tr><td>${esc(pname(r.playerId))}</td>${hist.seasons.map((s) => `<td>${r.bySeason[s.id] != null ? moneyCell(r.bySeason[s.id]) : '<span class="muted">—</span>'}</td>`).join('')}<td><b>${moneyCell(r.total)}</b></td></tr>`)
        .join('')}</tbody></table></div></div>`
        : ''
    }`;
}

export function statsView(q) {
  const season = seasonFromQuery(q);
  const st = seasonStats(S.db, season.id);
  const ts = seasonTournaments(S.db, season.id).filter((t) => t.status === 'finished');
  const club = S.db.players.filter((p) => p.type !== 'invitado');
  const byId = Object.fromEntries(st.players.map((p) => [p.playerId, p]));
  const att = club
    .map((p) => ({ p, s: byId[p.id] || { played: 0, wins: 0, kills: 0, itm: 0, prize: 0, jackpots: 0, final: 0 } }))
    .sort((a, b) => b.s.played - a.s.played || a.p.name.localeCompare(b.p.name));
  const hit = [...st.players].filter((p) => p.kills).sort((a, b) => b.kills - a.kills).slice(0, 10);
  const jackpots = ts.flatMap((t) => (t.jackpots || []).map((j) => ({ t, j })));
  const attended = (pid) => ts.map((t) => (attendedIds(t).includes(pid) ? '<span class="att yes">●</span>' : '<span class="att no">○</span>')).join('');

  return {
    html: `
    <div class="row between wrap"><h2>Estadísticas</h2>${seasonPicker(season.id, '#/estadisticas')}</div>
    <div class="panel"><h3>Asistencia</h3><p class="muted small">${st.finished} fechas jugadas</p>
      <div class="table-wrap"><table class="tbl">
      <thead><tr><th>Jugador</th><th>Asistencias</th><th>%</th><th>Detalle</th><th>Victorias</th><th>Mesas finales</th><th>Cobros</th><th>Eliminaciones</th></tr></thead>
      <tbody>${att
        .map(
          ({ p, s }) =>
            `<tr><td>${esc(p.nickname || p.name)}</td><td>${s.played}</td><td>${st.finished ? Math.round((s.played / st.finished) * 100) : 0}%</td><td class="nowrap">${attended(p.id)}</td><td>${s.wins || ''}</td><td>${s.final || ''}</td><td>${s.itm || ''}</td><td>${s.kills || ''}</td></tr>`
        )
        .join('')}</tbody></table></div></div>
    <div class="grid2">
      <div class="panel"><h3>Hitman de la temporada</h3><ol class="top5">${hit.map((h) => `<li><span>${esc(pname(h.playerId))}</span><b>${h.kills}</b></li>`).join('') || '<li class="muted">Sin datos</li>'}</ol></div>
      <div class="panel"><h3>Jackpots</h3>${
        jackpots.length
          ? jackpots
              .map(
                ({ t, j }) =>
                  `<div class="jackpot"><p><b>${esc(pname(j.playerId))}</b> · ${esc(j.hand || '')} ${cardsHtml(j.cards, true)} · ${money(j.amount, t.config.currency)} <a href="#/torneo/${t.id}">${esc(t.label)}</a></p>${imgHtml(j.image, 'small')}</div>`
              )
              .join('')
          : '<p class="muted">Sin jackpots esta temporada.</p>'
      }</div>
    </div>
    ${moneySection(season)}`,
    bind: bindSeasonPicker,
  };
}

export { MODALITY, TYPE, STATUS, entryState, tournamentConfig, pointColumn };
