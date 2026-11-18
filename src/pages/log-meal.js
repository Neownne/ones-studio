// src/pages/log-meal.js — 记餐：食物库检索 + 三餐累加 + 未启用入口
import { header, hint, macroCards, label, card, btn, esc } from '../components/ui.js'
import { FOODS, SCENE_LABELS, searchFoods } from '../data/foods.js'

export function render(ctx) {
  const { log, macro, query = '' } = ctx
  const list = searchFoods(query)
  const grouped = Object.entries(SCENE_LABELS).map(([scene, name]) => ({
    scene, name, items: list.filter((f) => f.scene === scene),
  })).filter((g) => g.items.length)

  const intake = macro.intake || {}
  const hidden = macro.hidden

  return `
  ${header('记餐', { sub: 'FOOD LOG', badge: '02', back: 'home' })}

  ${hidden ? hint(1, 'NO PLAN', '未设计划 · 记录仅本地暂存，不计算剩余额度，也不做超额判定') : ''}

  <section class="block">
    <div class="section-head">${label('INTAKE / TODAY')}</div>
    ${card(`<div class="intake-grid">
      ${['kcal', 'protein', 'carb', 'fat'].map((k) => `<div>
        <div class="type-label">${k.toUpperCase()}</div>
        <div class="type-number">${Math.round(intake[k] || 0)}</div>
      </div>`).join('')}
    </div>`)}
    ${!hidden ? macroCards(macro) : ''}
  </section>

  <section class="block">
    <div class="section-head">${label('GENERATE / AI')}</div>
    ${btn('生成今日吃法', 'eat-suggest', { variant: 'primary' })}
    <div class="type-caption">按今天已摄入与剩余缺口内置生成 2-3 组候选；${ctx.eatEnabled ? '也可用 AI 生成' : '配置 AI 后还能用 AI 生成'}</div>
  </section>

  <section class="block">
    <div class="section-head">${label('LOGGED')}</div>
    ${log.foods.length ? `<div class="food-log">${log.foods.map((f, i) => `
      <div class="food-log__row">
        <span>${esc(f.name || f.foodId)} ×${esc(f.qty)}</span>
        <span class="type-caption">${Math.round((f.perUnit?.kcal || 0) * f.qty)} kcal</span>
        <button type="button" class="icon-btn" data-act="food-del" data-idx="${i}" aria-label="删除">×</button>
      </div>`).join('')}</div>` : '<div class="type-caption">今天还没有记录</div>'}
  </section>

  <section class="block">
    <div class="section-head">${label('FOOD DB / ' + FOODS.length)}</div>
    <input id="food-search" class="search-input" type="search" placeholder="搜索食物名称或场景" value="${esc(query)}" />
    ${grouped.map((g) => `
      <div class="food-group">
        <div class="type-label food-group__title">${esc(g.name)}</div>
        ${g.items.map((f) => `
          <div class="food-row">
            <div class="food-row__main">
              <div class="type-body">${esc(f.name)}</div>
              <div class="type-caption">${esc(f.perUnit.unit)} · ${esc(f.perUnit.kcal)} kcal · P${esc(f.perUnit.protein)} <i class="sep" aria-hidden="true"></i> C${esc(f.perUnit.carb)} <i class="sep" aria-hidden="true"></i> F${esc(f.perUnit.fat)}</div>
            </div>
            <button type="button" class="icon-btn icon-btn--add" data-act="food-add" data-id="${f.id}" aria-label="添加 ${esc(f.name)}">+</button>
          </div>`).join('')}
      </div>`).join('')}
    ${!grouped.length ? '<div class="type-caption">没有匹配的食物</div>' : ''}
  </section>
  `
}
