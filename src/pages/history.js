// src/pages/history.js — 历史热力图：GitHub 贡献方块风，计划期内每天 6 项完成度
import { header, hint, label, esc } from '../components/ui.js'

function cell(d) {
  if (d.isFuture) return `<i class="hc hc--future" title="${d.dayKey}"></i>`
  const pct = Math.round(d.ratio * 100)
  const cls = `hc hc--${d.level}${d.isToday ? ' hc--today' : ''}${d.isGap ? ' hc--gap' : ''}`
  return `<i class="${cls}" title="${d.dayKey} · ${pct}%"></i>`
}

// embed：嵌在设置页左侧弹层里（不要页头与返回）
export function render(ctx, { embed = false } = {}) {
  const { plan, history } = ctx
  if (!plan) return embed
    ? hint(2, 'NO PLAN', '新建计划后才能查看历史')
    : `${header('历史', { sub: 'HISTORY', badge: 'H', back: 'home' })}
    ${hint(2, 'NO PLAN', '新建计划后才能查看历史')}`

  const { weeks } = history
  const doneDays = weeks.flat().filter((d) => d.inPlan && !d.isFuture && d.level > 0).length
  const pastDays = weeks.flat().filter((d) => d.inPlan && !d.isFuture).length

  const body = `
  ${hint(2, 'HEATMAP', `${esc(plan.name)} · 已过 ${pastDays} 天 · 每个方块一天，越浅完成越少`)}
  <section class="block">
    <div class="section-head">${label('PLAN / HEATMAP')}</div>
    <div class="history-scroll">
      <div class="history-grid">
        ${weeks.map((week) => `<div class="history-col">${week.map(cell).join('')}</div>`).join('')}
      </div>
    </div>
    <div class="history-legend">
      <span class="type-caption">少</span>
      ${[0, 1, 2, 3, 4].map((l) => `<i class="hc hc--${l}"></i>`).join('')}
      <span class="type-caption">多</span>
      <span class="type-caption history-legend__done">完成 ${doneDays} 天</span>
    </div>
  </section>`

  return embed ? body : `${header('历史', { sub: 'HISTORY', badge: 'H', back: 'home' })}${body}`
}
