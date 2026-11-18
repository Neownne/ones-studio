// src/pages/plan-list.js — 多计划：使用中黑卡 + 白卡列表 + CRUD 入口 + 导出导入
import { header, hint, label, card, btn, esc } from '../components/ui.js'
import { computePlanProgress } from '../utils/derive.js'

export function render(ctx) {
  const { plans = [], settings } = ctx
  const activeId = settings.activePlanId

  return `
  ${header('计划', { sub: 'PLANS', badge: 'P', back: 'home' })}
  ${hint(2, 'LOCAL ONLY', '计划与记录只存在本机 · 换机请用导出备份')}

  <section class="block">
    <div class="section-head">${label('PLANS / ' + plans.length)}</div>
    ${plans.length ? plans.map((p) => {
      const active = p.id === activeId
      const pr = computePlanProgress(p, settings.progressCache)
      return `<div class="plan-card${active ? ' plan-card--active' : ''}">
        <div class="plan-card__top">
          <span class="type-label">${active ? 'IN USE' : 'IDLE'}</span>
          <span class="badge-num"><span>${Math.round(pr.ratio * 100)}%</span></span>
        </div>
        <div class="plan-card__name type-title">${esc(p.name)}</div>
        <div class="type-caption">${esc(p.startDate)} → ${esc(p.endDate)} · ${esc(p.totalDays)} 天</div>
        <div class="type-caption">${esc(p.metrics?.current?.weight)}kg/${esc(p.metrics?.current?.bodyfat)}% → ${esc(p.metrics?.target?.weight)}kg/${esc(p.metrics?.target?.bodyfat)}%</div>
        <div class="plan-card__actions">
          ${active ? '<span class="type-label">使用中</span>' : btn('启用', 'plan-activate', { data: `data-id="${esc(p.id)}"` })}
          ${btn('编辑', 'plan-edit', { data: `data-id="${esc(p.id)}"` })}
          ${btn('复制', 'plan-copy', { data: `data-id="${esc(p.id)}"` })}
          ${btn('删除', 'plan-delete', { variant: 'warn', data: `data-id="${esc(p.id)}"` })}
        </div>
      </div>`
    }).join('') : '<div class="type-caption">还没有计划</div>'}
    <div class="btn-row">${btn('新建计划', 'plan-new', { variant: 'primary' })}</div>
  </section>

  <section class="block">
    <div class="section-head">${label('BACKUP / v1')}</div>
    ${card(`<div class="type-body">导出为 JSON 文件保存到「文件」App。导入支持覆盖 / 合并（合并时本机优先）。
      api_key、base_url、model 不会被导出。</div>
      <div class="btn-row">
        ${btn('导出备份', 'export')}
        ${btn('导入备份', 'import')}
      </div>`)}
    ${ctx.notice ? hint(2, ctx.notice.label, ctx.notice.text, ctx.notice.warn) : ''}
  </section>
  `
}
