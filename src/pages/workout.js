// src/pages/workout.js — 训练：当日模板 + 组次记录 + 加重判定
import { header, hint, label, card, btn, esc } from '../components/ui.js'
import { shouldSuggestIncrease } from '../utils/progression.js'

export function render(ctx) {
  const { plan, log, templates = {}, dayKey } = ctx
  if (!plan) return `${header('训练', { sub: 'WORKOUT', badge: '04', back: 'home' })}
    ${hint(2, 'NO PLAN', '新建计划后才能查看训练模板')}`

  const pattern = plan.schedule?.pattern || []
  const idx = Math.round((new Date(`${dayKey}T12:00:00`) - new Date(`${plan.startDate}T12:00:00`)) / 86400000)
  const split = pattern[((idx % 7) + 7) % 7]
  if (!split || split === 'rest') {
    return `${header('训练', { sub: 'WORKOUT / REST', badge: '04', back: 'home' })}
      ${hint(2, 'REST DAY', '今天是休息日 · 没有训练模板')}
      <div class="block"><div class="section-head">${label('NEXT')}</div>
      <div class="type-body">恢复日按非训练日宏量目标执行，蛋白仍保持 155g。</div></div>`
  }

  // templates 已是计划级覆盖全局后的生效集（main.js buildCtx 合并）
  const tpl = templates[split]
  if (!tpl || !(tpl.exercises || []).length) {
    return `${header('训练', { sub: 'WORKOUT', badge: '04', back: 'home' })}
      ${hint(2, 'NO TEMPLATE', '这套模板没有动作 · 去计划编辑页添加')}`
  }

  const workout = log.workout || { exercises: [] }
  const history = ctx.recentLogs || {}
  const suggestions = tpl.exercises.map((ex) => ({
    ex, inc: shouldSuggestIncrease(history, ex, dayKey),
  }))

  return `
  ${header(tpl.name, { sub: `WORKOUT / ${split.toUpperCase()}`, badge: '04', back: 'home' })}
  ${hint(2, 'PROGRESSION', '同一动作连续 2 次达上限，建议下次 +2.5kg')}

  <section class="block">
    <div class="section-head">${label('EXERCISES / ' + tpl.exercises.length)}</div>
    ${tpl.exercises.map((ex, ei) => {
      const done = (workout.exercises || []).find((e) => e.templateId === ex.id)
      const sug = suggestions[ei]
      return card(`
        <div class="ex-head">
          <span class="badge-num"><span>0${ei + 1}</span></span>
          <span class="type-title">${esc(ex.name)}</span>
        </div>
        <div class="type-caption ex-meta">${esc(ex.sets)} 组 × ${esc(ex.repMax)} 次 · 当前 ${esc(ex.currentWeight)} kg</div>
        <div class="set-grid">${Array.from({ length: ex.sets }, (_, si) => `
          <button type="button" class="set-cell${done?.sets?.[si]?.done ? ' is-done' : ''}"
            data-act="set-toggle" data-ex="${ex.id}" data-set="${si}">
            <span class="type-label">S${si + 1}</span>
            <span>${done?.sets?.[si]?.done ? '✓' : '·'}</span>
          </button>`).join('')}</div>
        ${sug.inc.suggest
          ? `<div class="ex-suggest">${hint(2, 'INCREASE', `连续 2 次达上限，建议下次 ${sug.inc.nextWeight} kg`)}
              ${btn('应用 +2.5kg', 'increase', { data: `data-ex="${ex.id}" data-weight="${sug.inc.nextWeight}"` })}</div>`
          : ''}
      `)
    }).join('')}
  </section>

  <section class="block">
    <div class="section-head">${label('GYM / EQUIPMENT')}</div>
    <div class="type-caption">酒店健身房：史密斯机 · 飞鸟机 · 哈克机 · 高位下拉 · 坐姿划船 · 腿屈伸 · 俯卧腿弯举 · 哑铃 2.5–20kg</div>
  </section>
  `
}
