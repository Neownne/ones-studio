// src/components/ui.js — 通用 HTML 片段（原生字符串模板，零依赖）
// 所有可点元素用 data-act + data-* 交由 main.js 事件委托统一处理。
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
))

// 注意：`// ` 前缀由 CSS 的 .type-label::before 统一生成，模板里不要手写，否则会出现 `// //`
// 文本内的 / 分隔符 → 斜切色块元素（宽、有质感）；先 esc 再替换，安全
const SEP = '<i class="sep" aria-hidden="true"></i>'
const sepify = (text) => esc(text).replace(/\s*\/\s*/g, SEP)

export const label = (text) => `<span class="type-label">${sepify(text)}</span>`
export const section = (text) => `<div class="section-head">${label(text)}</div>`

export function hint(level, labelText, text, warn = false) {
  return `<div class="hint hint--${level === 1 ? 'l1' : 'l2'}${warn ? ' hint--warn' : ''}" role="status">
    <span class="hint__label">${sepify(labelText)}</span>
    <span class="hint__text">${sepify(text)}</span>
  </div>`
}

export const TABS = [
  { route: 'home', label: 'HOME' },
  { route: 'log-meal', label: 'FOOD' },
  { route: 'checkin', label: 'TASK' },
  { route: 'workout', label: 'GYM' },
  { route: 'weigh-in', label: 'WT' },
  { route: 'settings', label: 'ME' },
]

export function tabBar(active) {
  return `<nav class="tab-bar" aria-label="主导航">${TABS.map((t) => `
    <a class="tab-bar__item${t.route === active ? ' is-active' : ''}"
       href="#/${t.route}" data-act="nav" data-route="${t.route}"
       aria-current="${t.route === active ? 'page' : 'false'}">
      <span class="tab-bar__label">${t.label}</span>
    </a>`).join('')}</nav>`
}

export function header(title, { badge = '', sub = '', back = '' } = {}) {
  return `<header class="page-head">
    ${back ? `<a class="page-head__back" href="#/${back}" data-act="nav" data-route="${back}" aria-label="返回">←</a>` : ''}
    <div class="page-head__main">
      <div class="page-head__skew tx-skew-block"></div>
      <h1 class="type-title">${esc(title)}</h1>
      ${sub ? `<div class="type-caption">${sepify(sub)}</div>` : ''}
    </div>
    ${badge ? `<span class="badge-num"><span>${esc(badge)}</span></span>` : ''}
  </header>`
}

export function btn(text, act, { variant = '', data = '', disabled = false } = {}) {
  const cls = `btn-para${variant ? ` btn-para--${variant}` : ''}${disabled ? ' btn-para--disabled' : ''}`
  return `<button type="button" class="${cls}" data-act="${esc(act)}" ${data} ${disabled ? 'disabled' : ''}>
    <span>${esc(text)}</span></button>`
}

export function card(inner, { level = 0 } = {}) {
  return `<div class="card-skew${level ? ` card-skew--panel-${level}` : ''}">${inner}</div>`
}

export function field(id, labelText, value, { type = 'text', placeholder = '', step = '' } = {}) {
  return `<label class="field">
    <span class="type-label">${esc(labelText)}</span>
    <input id="${esc(id)}" type="${type}" value="${esc(value)}"
      placeholder="${esc(placeholder)}" ${step ? `step="${step}"` : ''} />
  </label>`
}

export function macroCards(macro) {
  if (!macro || macro.hidden) return ''
  const names = { kcal: 'KCAL', protein: 'PRO', carb: 'CARB', fat: 'FAT' }
  const units = { kcal: 'kcal', protein: 'g', carb: 'g', fat: 'g' }
  // 卡片可点：跳记餐页，消除「看起来像控件却点不动」的死卡感
  return `<div class="macro-grid">${macro.items.map((it) => `
    <button type="button" class="macro-card${it.over ? ' macro-card--over' : ''}"
      data-act="nav" data-route="log-meal" aria-label="${names[it.key]} 剩余，去记餐">
      <div class="macro-card__label type-label">${names[it.key]}</div>
      <div class="macro-card__value type-number">${it.remain > 0 ? '' : '−'}${Math.abs(Math.round(it.remain))}</div>
      <div class="macro-card__unit type-caption">${units[it.key]} 剩余</div>
    </button>`).join('')}</div>`
}

// 空态：无白卡、无双环、canvas 底 + 上下警戒带（交互规范 §5）
export function emptyState() {
  return `<div class="empty-state">
    <div class="tx-hazard empty-state__tape"></div>
    <div class="empty-state__body">
      <div class="type-label">NO PLAN</div>
      <h2 class="type-display">还没有计划</h2>
      <p class="type-body">新建一个计划，或导入之前的备份。记录会先暂存在本机。</p>
      <div class="btn-row">
        ${btn('新建计划', 'plan-new', { variant: 'primary' })}
        ${btn('导入备份', 'import', { data: 'data-route="plan-list"' })}
      </div>
    </div>
    <div class="tx-hazard empty-state__tape"></div>
  </div>`
}
