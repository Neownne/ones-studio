// src/pages/weigh-in.js — 称重：记录 + 周均趋势（健身房同秤、练前非空腹）
import { header, hint, label, card, btn, esc } from '../components/ui.js'

export function render(ctx) {
  const { weights = [], plan } = ctx
  const sorted = [...weights].sort((a, b) => a.dayKey.localeCompare(b.dayKey))
  const last = sorted[sorted.length - 1]
  const start = plan?.metrics?.current?.weight ?? 74

  // 按 ISO 周分组求周均，看趋势不看单点
  const weeks = new Map()
  for (const w of sorted) {
    const d = new Date(`${w.dayKey}T12:00:00`)
    const wk = `${d.getFullYear()}-W${String(Math.ceil(((d - new Date(d.getFullYear(), 0, 1)) / 86400000 + 1) / 7)).padStart(2, '0')}`
    if (!weeks.has(wk)) weeks.set(wk, [])
    weeks.get(wk).push(w.kg)
  }
  const weekAvg = [...weeks.entries()].map(([wk, arr]) => ({
    wk, avg: arr.reduce((s, v) => s + v, 0) / arr.length, n: arr.length,
  }))
  const trend = weekAvg.length >= 2 ? weekAvg[weekAvg.length - 1].avg - weekAvg[0].avg : 0

  const max = Math.max(start, ...sorted.map((w) => w.kg), 1)
  const min = Math.min(plan?.metrics?.target?.weight ?? 71.5, ...sorted.map((w) => w.kg), max - 1)

  return `
  ${header('称重', { sub: 'BODY WEIGHT', badge: '05', back: 'home' })}
  ${hint(2, 'METHOD', '固定健身房同一台秤 · 练前称 · 每周 1–2 次 · 看周均趋势，不追求空腹')}

  <section class="block">
    <div class="section-head">${label('LATEST')}</div>
    ${card(`<div class="weight-hero">
      <span class="type-display">${last ? last.kg.toFixed(1) : '—'}</span>
      <span class="type-caption">kg</span>
      <span class="type-label">${last ? esc(last.dayKey) : '暂无记录'}</span>
    </div>
    <div class="type-caption">起点 ${start} kg → 目标 ${plan?.metrics?.target?.weight ?? '—'} kg · 累计 ${last ? (last.kg - start).toFixed(1) : '—'} kg</div>`)}
  </section>

  <section class="block">
    <div class="section-head">${label('ADD RECORD')}</div>
    <div class="form-row">
      <input id="weigh-value" class="num-input" type="number" step="0.1" placeholder="74.0" inputmode="decimal" />
      ${btn('记录', 'weigh-add', { variant: 'primary' })}
    </div>
  </section>

  <section class="block">
    <div class="section-head">${label('WEEKLY AVERAGE')}</div>
    ${weekAvg.length ? `<div class="chart-simple" role="img" aria-label="体重周均趋势">
      ${weekAvg.map((w) => `<div class="chart-col">
        <span class="type-number">${w.avg.toFixed(1)}</span>
        <div class="chart-bar" style="height:${Math.max(8, ((w.avg - min) / Math.max(1, max - min)) * 100)}%"></div>
        <span class="type-label">${esc(w.wk)}</span>
      </div>`).join('')}
    </div>
    <div class="type-caption">周均变化 ${trend > 0 ? '+' : ''}${trend.toFixed(2)} kg · ${weekAvg.length} 周数据</div>`
    : '<div class="type-caption">记录 2 周以上才显示趋势</div>'}
  </section>

  <section class="block">
    <div class="section-head">${label('HISTORY / ' + sorted.length)}</div>
    ${sorted.length ? `<div class="food-log">${sorted.slice(-10).reverse().map((w) => `
      <div class="food-log__row"><span>${esc(w.dayKey)}</span><span class="type-number">${w.kg.toFixed(1)} kg</span></div>`).join('')}</div>`
    : '<div class="type-caption">暂无记录</div>'}
  </section>
  `
}
