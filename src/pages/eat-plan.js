// src/pages/eat-plan.js — AI 生成今日吃法：自选输入 → 2-3 组候选 → 选一组采纳写入记餐
import { header, hint, label, btn, card, esc } from '../components/ui.js'

const fmt = (o = {}) =>
  `${Math.round(o.kcal || 0)}kcal · P${Math.round(o.protein || 0)} <i class="sep" aria-hidden="true"></i> C${Math.round(o.carb || 0)} <i class="sep" aria-hidden="true"></i> F${Math.round(o.fat || 0)}`

export function render(ctx) {
  const { log, macro, aiGen } = ctx
  const dayText = { training: '训练日', rest: '休息日' }[log.dayType] || '—'
  const t = log.macroTargetSnapshot
  const remain = macro.items || []

  return `
  ${header('今日吃啥', { sub: 'AI DAILY PLAN', badge: 'AI', back: 'log-meal' })}
  ${t
    ? hint(2, 'TODAY', `${dayText} · 已摄入 ${fmt(macro.intake)} · 剩余 ${fmt(Object.fromEntries(remain.map((i) => [i.key, i.remain])))}`)
    : hint(2, 'NO TARGET', '今天没有宏量目标快照 · 将按自由安排生成')}

  <section class="block">
    <div class="section-head">${label('YOUR PICK / OPTIONAL')}</div>
    ${card(`
      <textarea id="eat-picked" class="eat-picked" rows="2"
        placeholder="想吃的东西？例如：鸡腿饭、牛肉面。留空则按剩余缺口自由安排。">${esc(aiGen.picked || '')}</textarea>
      <div class="btn-row">${btn('生成吃法', 'eat-generate', { variant: 'primary' })}${ctx.eatEnabled ? btn(aiGen.loading ? 'AI 生成中…' : '用 AI 生成', 'eat-generate-ai', { disabled: aiGen.loading }) : ''}</div>
      <div class="type-caption">内置算法按剩余缺口即时生成 · ${ctx.eatEnabled ? '也可选 AI 生成（只在你点击时发一次请求）' : '配置 AI 后还能用 AI 生成'}</div>
    `)}
  </section>

  ${aiGen.error ? `<section class="block">${hint(2, 'FAILED', aiGen.error, true)}</section>` : ''}
  ${aiGen.loading ? `<section class="block"><div class="type-caption">模型生成中，通常 5-20 秒…</div></section>` : ''}
  ${aiGen.note ? `<section class="block">${hint(2, 'RULES', aiGen.note)}</section>` : ''}

  ${aiGen.candidates.length ? `
  <section class="block">
    <div class="section-head">${label('CANDIDATES / ' + aiGen.candidates.length)}</div>
    ${aiGen.candidates.map((c, i) => `
      <div class="tpl-card card-skew">
        <div class="tpl-card__head">
          <span class="type-title">${esc(c.name)}</span>
          <span class="type-caption">${fmt(c.total)}</span>
        </div>
        ${c.meals.map((meal, mi) => `
          <div class="meal-block">
            <div class="type-label">${esc(meal.slot)}</div>
            ${meal.items.map((it, ii) => `<div class="meal-row">
              <span class="type-body">${esc(it.name)} ×${esc(it.qty)}</span>
              <span class="type-caption">${Math.round(it.kcal)}kcal · P${Math.round(it.protein)}</span>
              <button type="button" class="chip-btn" data-act="eat-swap"
                data-c="${i}" data-m="${mi}" data-i="${ii}" aria-label="更换 ${esc(it.name)}">换</button>
            </div>`).join('')}
          </div>`).join('')}
        <div class="btn-row">${btn('选这组', 'eat-apply', { variant: 'primary', data: `data-idx="${i}"` })}</div>
      </div>`).join('')}
    <div class="type-caption">估算值仅供参考 · 每个条目都能「换」· 采纳后写入今日记餐，可逐条删改</div>
  </section>` : ''}
  `
}
