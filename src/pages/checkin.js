// src/pages/checkin.js — 健身打卡：按肌群 + 锻炼条件的候选选择模式（与记餐一致）
// 程序按今日分化与当前条件（健身房 / 居家哑铃 / 徒手）生成可替换候选；
// 用户选择/更换后点「完成」确认记录；锁定（确认）后仍可随时「换一个」。
// 蛋白锚点不再手动勾——由记餐自动推导。
import { header, hint, label, esc } from '../components/ui.js'
import { MUSCLE_LABELS, COND_LABELS, CONDS } from '../data/exercises.js'

const SLOT_NAMES = { push: '推 · 胸肩三头', pull: '拉 · 背二头', legs: '腿 · 股四头/腘绳/臀', upper: '上肢综合' }

// 锻炼条件切换：切换后未确认的候选按新条件重生成，已确认的保留
const condBar = (cond) => `
  <div class="cond-bar" role="tablist" aria-label="锻炼条件">
    ${CONDS.map((c) => `
      <button type="button" class="cond-chip${c === cond ? ' is-on' : ''}"
        data-act="cond-set" data-v="${c}" role="tab" aria-selected="${c === cond}">
        ${esc(COND_LABELS[c])}
      </button>`).join('')}
  </div>`

export function render(ctx) {
  const { log, checkin = {} } = ctx
  const { split, selections = [], weekDoneNames = new Set(), noTemplate, cond = 'gym' } = checkin
  const dayTypeText = { training: '训练日', rest: '休息日', 'no-plan': '无计划' }[log.dayType] || '—'

  // 休息日 / 无计划日：无训练缺口，只给说明
  if (!split) {
    return `
    ${header('打卡', { sub: 'CHECK IN', badge: '03', back: 'home' })}
    ${hint(2, 'DAY TYPE', `今天是${dayTypeText} · 没有训练缺口，休息即完成`)}
    <section class="block">
      <div class="section-head">${label('AUTO / FOOD')}</div>
      <div class="type-caption">今日进度全自动：记餐勾饮食锚点，训练勾训练项。去「FOOD」确认吃了什么即可。</div>
    </section>`
  }

  const doneCount = selections.filter((s) => s.confirmed).length
  const weekParts = [...new Set(
    [...weekDoneNames].map((n) => {
      const hit = selections.find((s) => s.name === n)
      return hit ? hit.part : null
    }).filter(Boolean),
  )]

  return `
  ${header('打卡', { sub: `CHECK IN / ${split.toUpperCase()}`, badge: '03', back: 'home' })}
  ${hint(2, 'TODAY', `${SLOT_NAMES[split] || split} · 按肌群 + 锻炼条件生成候选，每个都能换`)}
  ${noTemplate ? hint(2, 'NO TEMPLATE', '这套分化在计划里没有动作 · 去「我的 → 健身计划」编辑模板', true) : ''}

  <section class="block">
    <div class="section-head">${label('CONDITION / 锻炼条件')}</div>
    ${condBar(cond)}
    <div class="type-caption ex-cond-note">换条件只重排未确认的候选 · 已确认的不动</div>
  </section>

  <section class="block">
    <div class="section-head">${label(`CANDIDATES / ${String(selections.length).padStart(2, '0')}`)}</div>
    <div class="ex-cand-list">${selections.map((s, i) => `
      <div class="ex-cand${s.confirmed ? ' is-done' : ''}">
        <div class="ex-cand__main">
          <span class="type-label">${esc(MUSCLE_LABELS[s.part] || s.part)}</span>
          <span class="ex-cand__name type-title">${esc(s.name)}</span>
          <span class="type-caption">${esc(s.sets)} 组 × ${esc(s.repMax)} 次${s.weight ? ` · ${esc(s.weight)} kg` : ' · 自重'}</span>
        </div>
        <div class="ex-cand__actions">
          <button type="button" class="chip-btn" data-act="ex-swap" data-idx="${i}"
            aria-label="更换 ${esc(s.name)}">换</button>
          <button type="button" class="chip-btn chip-btn--ok${s.confirmed ? ' is-on' : ''}"
            data-act="ex-confirm" data-idx="${i}" aria-pressed="${s.confirmed}"
            aria-label="${s.confirmed ? '取消完成' : '完成'} ${esc(s.name)}">${s.confirmed ? '✓' : '完成'}</button>
        </div>
      </div>`).join('')}</div>
    <div class="type-caption ex-cand__foot">已完成 ${doneCount}/${selections.length} · 确认后仍可随时「换」一个${weekParts.length ? ` · 本周已练：${weekParts.map((p) => MUSCLE_LABELS[p]).join('、')}` : ''}</div>
  </section>

  <section class="block">
    <div class="section-head">${label('AUTO / 06')}</div>
    <div class="type-caption">饮食 5 个锚点随记餐自动勾 · 训练项随上方确认自动勾 · 首页圆环同步更新</div>
  </section>
  `
}
