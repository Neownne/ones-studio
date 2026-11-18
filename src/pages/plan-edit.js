// src/pages/plan-edit.js — 计划编辑：期限/宏量/食物/训练模板/自身与期望指标
import { header, hint, label, field, btn, card, esc } from '../components/ui.js'
import { FOODS } from '../data/foods.js'
import { WORKOUT_TEMPLATES } from '../data/seed.js'

const SPLITS = ['push', 'pull', 'legs', 'upper']
export const SPLIT_NAMES = { push: '推 · 胸肩三头', pull: '拉 · 背二头', legs: '腿 · 股四头/腘绳/臀', upper: '上肢综合' }

// 单个动作编辑行；tpl-add-ex 在 main.js 里复用本函数往 DOM 追加空行
export function exEditRow(splitId, ex = {}) {
  return `<div class="ex-edit-row" data-exid="${esc(ex.id || '')}">
    <input class="ex-name" data-f="name" value="${esc(ex.name || '')}" placeholder="动作名" aria-label="动作名" />
    <input data-f="sets" type="number" min="1" max="10" value="${esc(ex.sets ?? 3)}" aria-label="组数" title="组数" />
    <input data-f="repMax" type="number" min="1" max="30" value="${esc(ex.repMax ?? 10)}" aria-label="次数上限" title="次数上限" />
    <input data-f="currentWeight" type="number" step="0.5" min="0" value="${esc(ex.currentWeight ?? 0)}" aria-label="当前重量 kg" title="当前重量 kg" />
    <button type="button" class="icon-btn" data-act="tpl-del-ex" aria-label="删除动作">×</button>
  </div>`
}

export function render(ctx, { embed = false } = {}) {
  const p = ctx.editPlan
  if (!p) return `${header('计划编辑', { sub: 'PLAN EDIT', back: 'plan-list' })}
    ${hint(2, 'NOT FOUND', '找不到要编辑的计划')}`

  const t = p.macroTargets.training
  const r = p.macroTargets.rest
  const allowed = new Set(p.foods || [])
  const tpls = p.workoutTemplates || WORKOUT_TEMPLATES // 计划级模板优先；没有就用全局默认作起点

  return `
  ${embed ? '' : header(p.id === '__new__' ? '新建计划' : '编辑计划', { sub: 'PLAN EDIT', back: 'plan-list' })}
  ${embed ? '' : hint(2, 'SNAPSHOT', '修改计划不会重算历史记录 · 旧日志保留当时的计划与宏量快照')}

  <form id="plan-form" data-plan-id="${esc(p.id)}">
    <section class="block">
      <div class="section-head">${label('BASIC')}</div>
      ${card(`
        ${field('f-name', '计划名称', p.name)}
        ${field('f-start', '开始日期', p.startDate, { type: 'date' })}
        ${field('f-end', '结束日期', p.endDate, { type: 'date' })}
        ${field('f-total', '总天数', p.totalDays, { type: 'number', step: '1' })}`)}
    </section>

    <section class="block">
      <div class="section-head">${label('METRICS / CURRENT → TARGET')}</div>
      ${card(`<div class="form-grid">
        ${field('f-w0', '当前体重 kg', p.metrics.current.weight, { type: 'number', step: '0.1' })}
        ${field('f-bf0', '当前体脂 %', p.metrics.current.bodyfat, { type: 'number', step: '0.1' })}
        ${field('f-w1', '目标体重 kg', p.metrics.target.weight, { type: 'number', step: '0.1' })}
        ${field('f-bf1', '目标体脂 %', p.metrics.target.bodyfat, { type: 'number', step: '0.1' })}
      </div>`)}
    </section>

    <section class="block">
      <div class="section-head">${label('MACRO / TRAINING DAY')}</div>
      ${card(`<div class="form-grid">
        ${field('f-t-kcal', 'kcal', t.kcal, { type: 'number' })}
        ${field('f-t-protein', '蛋白 g', t.protein, { type: 'number' })}
        ${field('f-t-carb', '碳水 g', t.carb, { type: 'number' })}
        ${field('f-t-fat', '脂肪 g', t.fat, { type: 'number' })}
      </div>`)}
    </section>

    <section class="block">
      <div class="section-head">${label('MACRO / REST DAY')}</div>
      ${card(`<div class="form-grid">
        ${field('f-r-kcal', 'kcal', r.kcal, { type: 'number' })}
        ${field('f-r-protein', '蛋白 g', r.protein, { type: 'number' })}
        ${field('f-r-carb', '碳水 g', r.carb, { type: 'number' })}
        ${field('f-r-fat', '脂肪 g', r.fat, { type: 'number' })}
      </div>`)}
    </section>

    <section class="block">
      <div class="section-head">${label('FOODS / ' + allowed.size)}</div>
      ${card(`<div class="pick-grid">${FOODS.map((f) => `
        <label class="pick-item">
          <input type="checkbox" data-food="${f.id}" ${allowed.has(f.id) ? 'checked' : ''} />
          <span>${esc(f.name)}</span>
        </label>`).join('')}</div>`)}
    </section>

    <section class="block">
      <div class="section-head">${label('TRAINING / TEMPLATES')}</div>
      ${hint(2, 'CUSTOM', '每个动作可改名、改组数/次数/当前重量，可增删。保存后写进本计划，不动其他计划。')}
      ${SPLITS.map((split) => {
        const tpl = tpls[split] || { exercises: [] }
        return `<div class="tpl-card card-skew" data-split="${split}">
          <div class="tpl-card__head">
            <span class="type-label">${split.toUpperCase()}</span>
            <span class="type-caption">${esc(tpl.name || SPLIT_NAMES[split])}</span>
          </div>
          <div class="ex-edit-head type-label"><span>动作</span><span>组</span><span>次</span><span>kg</span><span></span></div>
          <div class="ex-list">${(tpl.exercises || []).map((ex) => exEditRow(split, ex)).join('')}</div>
          ${btn('+ 添加动作', 'tpl-add-ex', { data: `data-split="${split}"` })}
        </div>`
      }).join('')}
    </section>

    <section class="block">
      <div class="section-head">${label('SCHEDULE / 7-DAY PATTERN')}</div>
      ${card(`<div class="pattern-grid">${(p.schedule?.pattern || []).map((v, i) => `
        <label class="pattern-item"><span class="type-label">D${i + 1}</span>
          <select data-day="${i}">
            ${['push', 'pull', 'legs', 'upper', 'rest'].map((o) => `<option value="${o}" ${v === o ? 'selected' : ''}>${o}</option>`).join('')}
          </select></label>`).join('')}</div>`)}
    </section>

    <div class="btn-row btn-row--sticky">
      ${btn('保存', 'plan-save', { variant: 'primary' })}
      ${btn('取消', 'nav', { data: 'data-route="plan-list"' })}
    </div>
  </form>
  `
}
