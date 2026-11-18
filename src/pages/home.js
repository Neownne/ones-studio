// src/pages/home.js — 首页：日期 + 倒计时小字 + 本周进度双环 + 宏量缺口
// 进度全自动：待办不打勾（由记餐/训练记录推导），计划管理入口在「我的」页
import { header, hint, macroCards, emptyState, label } from '../components/ui.js'

export function render(ctx) {
  if (!ctx.plan) return emptyState()

  const { today, week, macro, log, dayKey, center } = ctx
  const weekPct = Math.round(((week && week.ratio) || 0) * 100)
  const dateText = dayKey.replace(/-/g, '.')
  const weekday = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][new Date(`${dayKey}T12:00:00`).getDay()]
  // 倒计时从大圆环挪到顶部一行小字
  const countdown = center.mode === 'untilStart' ? `距计划开始 ${center.days} 天` : `倒计时 ${center.days} 天`

  return `
  ${header("one's studio", { sub: `${dateText}  ${weekday}  ·  ${countdown}`, badge: '01' })}

  <section class="ring-section" aria-label="本周与今日进度">
    <div class="ring-wrap">
      <canvas id="dual-ring" role="img" aria-label="外环本周进度 ${weekPct}%，内环今日完成 ${today.done}/${today.total}"></canvas>
      <div class="ring-center">
        <div class="ring-center__top type-label">WEEK</div>
        <div class="ring-center__days type-display">${weekPct}<span class="ring-center__pct">%</span></div>
        <div class="ring-center__today type-number">${today.done}<i class="sep" aria-hidden="true"></i>${today.total} 今日</div>
      </div>
    </div>
  </section>

  <section class="block">
    <div class="section-head">${label('MACRO GAP')}</div>
    ${macro.hidden
      ? hint(1, 'NO PLAN', '未设计划 · 记录仅本地暂存，不计算剩余额度')
      : macroCards(macro)}
  </section>

  ${ctx.notice ? hint(1, ctx.notice.label, ctx.notice.text, ctx.notice.warn) : ''}
  ${log.isGap ? hint(1, 'GAP DAY', '这天空白已归档，不计入计划进度') : ''}
  `
}
