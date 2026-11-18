// src/main.js — 入口：启动初始化 + 读时 rollover + hash 路由 + 状态装配 + 事件委托
import { store } from './store/storage.js'
import { K, logsKey } from './store/keys.js'
import { buildBackup, importTx, migrate } from './store/transaction.js'
import { seedIfEmpty, makeDefaultPlan, makeDefaultSettings, DEFAULT_PATTERN } from './data/seed.js'
import { findFood, FOODS } from './data/foods.js'
import { saveConfig, isEnabled as aiIsEnabled, generateDailyMeals } from './services/ai.js'
import { planDailyMeals, swapMealItem, recalcCandidate, normalizeFoodName } from './services/meal-planner.js'
import { planTodayWorkout, nextCandidate } from './services/workout-planner.js'
import { rolloverIfNeeded, computeDayKey, d2t, fmtDate, monthOf } from './utils/day.js'
import {
  computePlanProgress, computeTodayProgress, computeMacroRemain, computeRingCenter,
  shouldPersistProgressCache, resolveWorkoutTemplates, computeWeekProgress, buildHistoryGrid,
  splitOfDay, collectWeekDoneNames,
} from './utils/derive.js'
import { commitIncrease } from './utils/progression.js'
import { renderDualRing } from './components/dual-ring.js'
import { tabBar, hint, field, btn } from './components/ui.js'

import * as home from './pages/home.js'
import * as logMeal from './pages/log-meal.js'
import * as checkin from './pages/checkin.js'
import * as workout from './pages/workout.js'
import * as weighIn from './pages/weigh-in.js'
import * as settings from './pages/settings.js'
import * as planList from './pages/plan-list.js'
import * as planEdit from './pages/plan-edit.js'
import * as aiSettings from './pages/ai-settings.js'
import * as eatPlan from './pages/eat-plan.js'
import * as history from './pages/history.js'

const PAGES = {
  home, 'log-meal': logMeal, checkin, workout, 'weigh-in': weighIn,
  settings, 'plan-list': planList, 'plan-edit': planEdit, 'ai-settings': aiSettings,
  'eat-plan': eatPlan, history,
}
const TAB_OF = {
  home: 'home', 'log-meal': 'log-meal', checkin: 'checkin', workout: 'workout',
  'weigh-in': 'weigh-in', settings: 'settings',
  'plan-list': 'settings', 'plan-edit': 'settings', 'ai-settings': 'settings', 'eat-plan': 'log-meal',
  history: 'home',
}
const app = document.getElementById('app')
let notice = null
let query = ''
let editPlanId = null
let lastRoute = null // 入场动画用：同页数据更新不重播
let aiGen = { loading: false, error: '', candidates: [], picked: '', note: '' } // 生成吃法的一次性状态
let drawer = null // 左侧滑出弹层：{ kind: 'profile-name'|'profile-birth'|'profile-height'|'profile-gender'|'history' }

// ---------- 存储适配：把 store 注入 day.js 的 read/write ----------
const read = (key) => store.read(key)
const write = (key, val) => { store.safeWrite(key, val) }

function boot() {
  seedIfEmpty(store)
  const m = migrate(store)
  if (!m.ok) notice = { level: 2, label: 'READ ONLY', text: '本地数据版本高于当前程序，已进入只读模式。', warn: true }
  rolloverIfNeeded({ read, write, now: Date.now() })
}

function getLog(dayKey) {
  const mk = logsKey(dayKey)
  const month = store.read(mk, {}) || {}
  if (!month[dayKey]) {
    // 极端情况（导入后缺当天）：补一个 no-plan 空日志结构
    return { dayKey, planId: null, dayType: 'no-plan', macroTargetSnapshot: null,
      todos: {}, foods: [], workout: null, isGap: false }
  }
  return month[dayKey]
}

function saveLog(dayKey, log) {
  const mk = logsKey(dayKey)
  const month = store.read(mk, {}) || {}
  month[dayKey] = log
  store.safeWrite(mk, month)
}

function recentLogs(dayKey, days = 30) {
  const out = {}
  for (let i = 1; i <= days; i++) {
    const dk = fmtDate(new Date(d2t(dayKey) - i * 86400000)) // 本地日期，不用 toISOString
    const m = store.read(logsKey(dk), {}) || {}
    if (m[dk]) out[dk] = m[dk]
  }
  return out
}

// 读计划期全部月份日志分片（历史热力图用；月份从 startDate 到 endDate 逐月合并）
function logsInRange(startDate, endDate) {
  const out = {}
  let [y, m] = monthOf(startDate).split('-').map(Number)
  const [ey, em] = monthOf(endDate).split('-').map(Number)
  while (y < ey || (y === ey && m <= em)) {
    Object.assign(out, store.read(logsKey(`${y}-${String(m).padStart(2, '0')}-01`), {}) || {})
    m += 1
    if (m > 12) { m = 1; y += 1 }
  }
  return out
}

// 从计划编辑页表单组装 4 个分化的计划级训练模板；动作名为空的行丢弃。
// 四个分化全被清空 → 不存计划级模板，训练页回落全局默认模板。
function collectWorkoutTemplates() {
  const out = {}
  document.querySelectorAll('.tpl-card[data-split]').forEach((cardEl) => {
    const split = cardEl.dataset.split
    const exercises = [...cardEl.querySelectorAll('.ex-edit-row')]
      .map((row, i) => {
        const val = (f) => row.querySelector(`[data-f="${f}"]`)?.value
        const name = (val('name') || '').trim()
        if (!name) return null
        const id = row.dataset.exid || `ex-${Date.now()}-${split}-${i}`
        return {
          id, templateId: id, name,
          sets: Math.max(1, Math.round(Number(val('sets')) || 3)),
          repMax: Math.max(1, Math.round(Number(val('repMax')) || 10)),
          currentWeight: Math.max(0, Number(val('currentWeight')) || 0),
          weightStep: 2.5,
        }
      })
      .filter(Boolean)
    out[split] = { id: split, name: planEdit.SPLIT_NAMES[split] || split, split, exercises }
  })
  return Object.values(out).some((t) => t.exercises.length > 0) ? out : undefined
}

function buildCtx(route) {
  const settings = store.read(K.settings, makeDefaultSettings()) || makeDefaultSettings()
  const plans = store.read(K.plans, []) || []
  const plan = plans.find((p) => p.id === settings.activePlanId) || null
  const dayKey = computeDayKey()
  const log = getLog(dayKey)
  const progress = computePlanProgress(plan, settings.progressCache)
  // 真正把外环兜底值落盘（此前缓存恒为空，DESIGN §5.1 的时间倒退兜底从未生效）
  if (shouldPersistProgressCache(settings.progressCache, progress)) {
    const nextCache = { configSig: progress.configSig, archivedDays: progress.archivedDays }
    const r = store.safeWrite(K.settings, { ...settings, progressCache: nextCache })
    if (r.ok) settings.progressCache = nextCache
  }
  const today = computeTodayProgress(log)
  const macro = computeMacroRemain(log)
  const center = computeRingCenter(plan)
  const recent = recentLogs(dayKey)
  const week = computeWeekProgress(recent, dayKey)
  // 全局模板被当前计划级 workoutTemplates 覆盖后的生效集
  const templates = resolveWorkoutTemplates(plan, store.read(K.templates, {}) || {})

  let editPlan = null
  if (route === 'plan-edit') {
    // 直接访问 / 刷新页面时，默认编辑当前启用计划，不留死路
    const targetId = editPlanId || settings.activePlanId
    editPlan = targetId === '__new__'
      ? { ...makeDefaultPlan(), id: '__new__', name: '新计划' }
      : plans.find((p) => p.id === targetId) || plans[0] || null
    editPlanId = editPlan ? editPlan.id : null
  }

  let history = null
  if ((route === 'history' || (drawer && drawer.kind === 'history')) && plan) {
    history = buildHistoryGrid(logsInRange(plan.startDate, dayKey), plan.startDate, dayKey)
  }

  // 打卡页：今日分化 + 候选槽位（懒生成并落盘）+ 本周已练 + 锻炼条件
  let checkin = null
  if (route === 'checkin') {
    const split = plan ? splitOfDay(plan, dayKey) : null
    const tpl = split ? (templates[split] || null) : null
    const weekDoneNames = collectWeekDoneNames(recent, dayKey, templates)
    const cond = settings.trainingCond || 'gym'
    if (split && tpl && (tpl.exercises || []).length) {
      log.workout = log.workout || {}
      if (!Array.isArray(log.workout.selections) || log.workout.split !== split) {
        // 懒生成今日候选：默认模板动作；本周已练或当前条件做不了 → 换成同肌群同条件未练的
        log.workout.split = split
        log.workout.selections = planTodayWorkout({
          split, template: tpl, weekDoneNames: [...weekDoneNames], cond,
        })
        saveLog(dayKey, log)
      }
      checkin = { split, selections: log.workout.selections, weekDoneNames, noTemplate: false, cond }
    } else {
      checkin = { split, selections: [], weekDoneNames, noTemplate: !!split, cond }
    }
  }

  // 吃法页：昨天已吃的食物名（今天不再推荐）
  let yesterdayNames = []
  if (route === 'eat-plan') {
    const ydk = fmtDate(new Date(d2t(dayKey) - 86400000))
    const ylog = (store.read(logsKey(ydk), {}) || {})[ydk]
    yesterdayNames = [...new Set((ylog?.foods || []).map((f) => normalizeFoodName(f.name)).filter(Boolean))]
  }

  return {
    route, settings, plans, plan, dayKey, log, progress, today, macro, center, week,
    templates,
    weights: store.read(K.weights, []) || [],
    recentLogs: recent,
    query, editPlan,
    aiGen,
    history, checkin, yesterdayNames,
    eatEnabled: aiIsEnabled(),
    notice: notice && (route === 'plan-list' || route === 'home' || route === 'ai-settings') ? notice : null,
  }
}

// 左侧弹层内容：个人信息细项编辑器 / 历史热力图（与历史记录一致的左弹样式）
function drawerMeta(kind) {
  const p = (store.read(K.settings, makeDefaultSettings()) || makeDefaultSettings()).profile || {}
  const profileField = (title, fieldKey, value, opts = {}) => ({
    title,
    body: () => `
      ${field('pf-one', title, value ?? '', opts)}
      <div class="btn-row">${btn('保存', 'pf-save-one', { variant: 'primary', data: `data-field="${fieldKey}"` })}</div>`,
  })
  const metas = {
    'profile-name': profileField('名称', 'name', p.name, { placeholder: '你的名字' }),
    'profile-birth': profileField('出生日期', 'birth', p.birth, { type: 'date' }),
    'profile-height': profileField('身高 (cm)', 'height', p.height, { type: 'number', placeholder: '175' }),
    'profile-gender': {
      title: '性别',
      body: () => `
        <div class="btn-row">
          <button type="button" class="seg-btn${p.gender === 'male' ? ' is-on' : ''}" data-act="pf-gender" data-v="male">男</button>
          <button type="button" class="seg-btn${p.gender === 'female' ? ' is-on' : ''}" data-act="pf-gender" data-v="female">女</button>
        </div>
        <div class="type-caption">选择即保存</div>`,
    },
    history: { title: '历史记录', body: (ctx) => history.render(ctx, { embed: true }) },
  }
  return metas[kind] || { title: '', body: () => '' }
}

function render() {
  const route = (location.hash.replace(/^#\/?/, '').split('?')[0] || 'home')
  const page = PAGES[route] ? route : 'home'
  boot()
  const ctx = buildCtx(page)
  const body = PAGES[page].render(ctx)
  // 只在路由切换时加入场动画；同页数据更新（点待办/记餐）不重播
  const entering = page !== lastRoute
  lastRoute = page
  // 左侧滑出弹层：个人信息细项编辑 / 历史记录（与历史记录一致的左弹样式）
  const drawerHtml = drawer ? `
    <div class="drawer-mask" data-act="drawer-close"></div>
    <aside class="drawer drawer--left" role="dialog" aria-label="${drawerMeta(drawer.kind).title}">
      <div class="drawer__head">
        <span class="type-title">${drawerMeta(drawer.kind).title}</span>
        <button type="button" class="icon-btn" data-act="drawer-close" aria-label="关闭">×</button>
      </div>
      <div class="drawer__body">${drawerMeta(drawer.kind).body(ctx)}</div>
    </aside>` : ''
  app.innerHTML = `<div class="app-shell tx-dots">
    <div class="bg-stripes" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
    <main class="page page--${page}${entering ? ' page--enter' : ''}">${body}</main>
    ${tabBar(TAB_OF[page])}
    <div id="toast-host"></div>
    ${drawerHtml}
    <input id="import-file" type="file" accept="application/json,.json" hidden />
    <input id="avatar-file" type="file" accept="image/*" hidden />
  </div>`
  if (page === 'home' && ctx.plan) {
    renderDualRing(document.getElementById('dual-ring'), {
      outerRatio: ctx.week ? ctx.week.ratio : 0, innerRatio: ctx.today.ratio,
    })
  }
  notice = null
  window.scrollTo(0, 0)
}

function toast(text, warn = false) {
  const host = document.getElementById('toast-host')
  if (!host) return
  host.innerHTML = hint(2, warn ? 'NOTICE' : 'OK', text, warn)
  host.className = 'toast-host'
  setTimeout(() => { if (host) host.innerHTML = '' }, 3200)
}

const go = (route) => { location.hash = `#/${route}` }

// ---------- 事件委托 ----------
function onAction(act, el, ctxOf) {
  const ctx = ctxOf()
  const { dayKey, log, settings, plans } = ctx
  const save = () => saveLog(dayKey, log)

  switch (act) {
    case 'nav': return // <a href> 自行跳转

    case 'food-add': {
      const f = findFood(el.dataset.id)
      if (!f) return
      log.foods = log.foods || []
      log.foods.push({ foodId: f.id, name: f.name, qty: 1, perUnit: { ...f.perUnit } })
      save(); render(); return
    }
    case 'food-del': {
      const i = Number(el.dataset.idx)
      if (Number.isInteger(i)) { (log.foods || []).splice(i, 1); save(); render() }
      return
    }

    case 'weigh-add': {
      const input = document.getElementById('weigh-value')
      const kg = Number(input?.value)
      if (!kg || kg < 20 || kg > 300) { toast('请输入有效体重（20–300 kg）', true); return }
      const weights = store.read(K.weights, []) || []
      const i = weights.findIndex((w) => w.dayKey === dayKey)
      if (i >= 0) weights[i] = { dayKey, kg }
      else weights.push({ dayKey, kg })
      store.safeWrite(K.weights, weights)
      render(); return
    }

    case 'set-toggle': {
      const exId = el.dataset.ex, si = Number(el.dataset.set)
      log.workout = log.workout || { exercises: [] }
      let e = log.workout.exercises.find((x) => x.templateId === exId)
      if (!e) { e = { templateId: exId, sets: [] }; log.workout.exercises.push(e) }
      const tplEx = Object.values(ctx.templates).flatMap((t) => t.exercises || []).find((x) => x.id === exId)
      e.sets[si] = e.sets[si] || { done: false, reps: 0, weight: 0 }
      e.sets[si].done = !e.sets[si].done
      if (e.sets[si].done) {
        e.sets[si].reps = tplEx?.repMax || 0
        e.sets[si].weight = tplEx?.currentWeight || 0
      }
      save(); render(); return
    }

    case 'increase': {
      const exId = el.dataset.ex, w = Number(el.dataset.weight)
      // 动作在当前计划的自定义模板里 → 写回计划级；否则写全局模板
      let wrote = false
      const active = plans.find((p) => p.id === settings.activePlanId)
      if (active && active.workoutTemplates) {
        for (const t of Object.values(active.workoutTemplates)) {
          const ex = (t.exercises || []).find((x) => x.id === exId)
          if (ex) { Object.assign(ex, commitIncrease(ex, w)); wrote = true }
        }
        if (wrote) store.safeWrite(K.plans, plans)
      }
      if (!wrote) {
        const templates = store.read(K.templates, {}) || {}
        for (const t of Object.values(templates)) {
          const ex = (t.exercises || []).find((x) => x.id === exId)
          if (ex) Object.assign(ex, commitIncrease(ex, w))
        }
        store.safeWrite(K.templates, templates)
      }
      toast('下次训练建议重量已更新'); render(); return
    }

    // 模板编辑只做 DOM 增删，不写存储、不 render（render 会丢未保存的表单内容）；保存由 plan-save 统一收口
    case 'tpl-add-ex': {
      // 注意：按钮自身也带 data-split，closest 会命中自己；必须锁定外层 .tpl-card
      const cardEl = el.closest('.tpl-card')
      const list = cardEl && cardEl.querySelector('.ex-list')
      if (list) {
        list.insertAdjacentHTML('beforeend', planEdit.exEditRow(cardEl.dataset.split, {}))
        const last = list.lastElementChild
        last && last.querySelector('.ex-name')?.focus()
      }
      return
    }
    case 'tpl-del-ex': {
      el.closest('.ex-edit-row')?.remove()
      return
    }

    case 'drawer-open': { drawer = { kind: el.dataset.kind }; render(); return }
    case 'drawer-close': { drawer = null; render(); return }

    // 健身打卡：确认/取消确认（锁定后仍可换）
    case 'ex-confirm': {
      const sel = (log.workout && log.workout.selections) || []
      const i = Number(el.dataset.idx)
      if (!sel[i]) return
      sel[i].confirmed = !sel[i].confirmed
      save(); render(); return
    }
    case 'ex-swap': {
      const sel = (log.workout && log.workout.selections) || []
      const i = Number(el.dataset.idx)
      const slot = sel[i]
      if (!slot) return
      const otherNames = sel.map((s, j) => (j === i ? null : s.name)).filter(Boolean)
      const cand = nextCandidate(slot.part, {
        currentName: slot.name, otherNames,
        weekDone: [...((ctx.checkin && ctx.checkin.weekDoneNames) || [])],
        cond: (ctx.checkin && ctx.checkin.cond) || 'gym',
      })
      if (!cand) { toast('这个肌群没有可换的了'); return }
      // confirmed 状态保留：推荐被锁定后仍允许随时更换
      Object.assign(slot, { name: cand.name, sets: cand.sets, repMax: cand.repMax, weight: cand.weight })
      save(); render(); return
    }

    // 切换锻炼条件：未确认的候选按新条件重排，已确认的保留原动作
    case 'cond-set': {
      const v = el.dataset.v
      if (!v || !ctx.checkin || !ctx.checkin.split) return
      const tpl = ctx.templates[ctx.checkin.split]
      if (!tpl) return
      const kept = (log.workout && log.workout.selections || []).filter((s) => s.confirmed)
      const fresh = planTodayWorkout({
        split: ctx.checkin.split, template: tpl,
        weekDoneNames: [...ctx.checkin.weekDoneNames], cond: v,
      })
      const used = new Set()
      log.workout.selections = fresh.map((s) => {
        const k = kept.find((x) => x.part === s.part && !used.has(x.name))
        if (!k) return s
        used.add(k.name)
        return { ...k }
      })
      store.safeWrite(K.settings, { ...settings, trainingCond: v })
      save(); toast(`已切换到${({ gym: '健身房', dumbbell: '居家哑铃', none: '徒手无器材' })[v] || v}`); render(); return
    }

    case 'plan-activate': {
      store.safeWrite(K.settings, { ...settings, activePlanId: el.dataset.id,
        progressCache: { configSig: '', archivedDays: 0 } })
      toast('已切换计划'); render(); return
    }
    case 'plan-edit': { editPlanId = el.dataset.id; go('plan-edit'); return }
    case 'plan-new': { editPlanId = '__new__'; go('plan-edit'); return }
    case 'plan-copy': {
      const src = plans.find((p) => p.id === el.dataset.id)
      if (!src) return
      const copy = { ...JSON.parse(JSON.stringify(src)), id: `plan-${Date.now()}`, name: `${src.name} 副本` }
      store.safeWrite(K.plans, [...plans, copy])
      toast('已复制计划'); render(); return
    }
    case 'plan-delete': {
      const id = el.dataset.id
      if (!confirm('删除这个计划？历史记录会保留，不会重算。')) return
      const next = plans.filter((p) => p.id !== id)
      store.safeWrite(K.plans, next)
      if (settings.activePlanId === id) {
        store.safeWrite(K.settings, { ...settings, activePlanId: next[0]?.id || null,
          progressCache: { configSig: '', archivedDays: 0 } })
      }
      toast('计划已删除'); render(); return
    }

    case 'plan-save': {
      const form = document.getElementById('plan-form')
      if (!form) return
      const v = (id) => document.getElementById(id)?.value
      const num = (id, d = 0) => Number(v(id)) || d
      const base = editPlanId === '__new__'
        ? { ...makeDefaultPlan(), id: `plan-${Date.now()}` }
        : plans.find((p) => p.id === form.dataset.planId)
      if (!base) return
      const next = {
        ...base,
        name: v('f-name') || '未命名计划',
        startDate: v('f-start') || base.startDate,
        endDate: v('f-end') || base.endDate,
        totalDays: num('f-total', base.totalDays),
        metrics: {
          current: { weight: num('f-w0', 70), bodyfat: num('f-bf0', 15) },
          target: { weight: num('f-w1', 67.5), bodyfat: num('f-bf1', 13) },
        },
        macroTargets: {
          training: { kcal: num('f-t-kcal'), protein: num('f-t-protein'), carb: num('f-t-carb'), fat: num('f-t-fat') },
          rest: { kcal: num('f-r-kcal'), protein: num('f-r-protein'), carb: num('f-r-carb'), fat: num('f-r-fat') },
        },
        foods: [...form.querySelectorAll('[data-food]:checked')].map((x) => x.dataset.food),
        workoutTemplates: collectWorkoutTemplates(),
        schedule: { pattern: [...form.querySelectorAll('[data-day]')].map((s) => s.value) },
      }
      // 旧的动作勾选字段已被 workoutTemplates 取代，...base 会把它带回来，必须显式删掉
      delete next.exercises
      if (next.schedule.pattern.length !== 7) next.schedule = { pattern: [...DEFAULT_PATTERN] }
      const exists = plans.some((p) => p.id === next.id)
      store.safeWrite(K.plans, exists ? plans.map((p) => p.id === next.id ? next : p) : [...plans, next])
      // 编辑当前启用计划的期限 → configSig 变化，按新配置重算
      if (settings.activePlanId === next.id) {
        store.safeWrite(K.settings, { ...settings, progressCache: { configSig: '', archivedDays: 0 } })
      }
      editPlanId = null
      toast('计划已保存'); go('plan-list'); return
    }

    case 'ai-save': {
      const r = saveConfig({
        base_url: document.getElementById('ai-base')?.value || '',
        model: document.getElementById('ai-model')?.value || '',
        ...(document.getElementById('ai-key')?.value
          ? { api_key: document.getElementById('ai-key').value } : {}),
      })
      toast(r.ok ? '设置已保存（一期不会发起请求）' : '保存失败', !r.ok)
      render(); return
    }

    case 'export': {
      const backup = buildBackup(store)
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ones-studio-backup-${computeDayKey()}.json`
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      toast('备份已导出（不含 api_key）'); return
    }
    case 'import': {
      const input = document.getElementById('import-file')
      if (input) input.click()
      return
    }

    // 左侧弹层里单项保存（个人信息细项）
    case 'pf-save-one': {
      const fieldKey = el.dataset.field
      if (!fieldKey) return
      const val = (document.getElementById('pf-one')?.value || '').trim()
      settings.profile = { ...(settings.profile || {}), [fieldKey]: val }
      store.safeWrite(K.settings, settings)
      drawer = null
      toast('已保存'); render(); return
    }
    case 'pf-gender': {
      settings.profile = { ...(settings.profile || {}), gender: el.dataset.v }
      store.safeWrite(K.settings, settings)
      drawer = null
      render(); return
    }
    case 'avatar-pick': {
      document.getElementById('avatar-file')?.click(); return
    }
    case 'theme-toggle': {
      settings.theme = settings.theme === 'light' ? 'dark' : 'light'
      store.safeWrite(K.settings, settings)
      applyTheme(settings.theme)
      render(); return
    }

    case 'eat-suggest': {
      // 内置算法无需配置，直接进生成页；AI 只是其中的可选增强
      go('eat-plan'); return
    }

    case 'eat-generate': {
      // 内置算法：无需配置、不发请求、即时出结果；昨天吃过的今天不再推荐
      const picked = document.getElementById('eat-picked')?.value || ''
      const remaining = {}
      for (const it of (ctx.macro.items || [])) remaining[it.key] = it.remain
      const { candidates, note } = planDailyMeals({
        remaining, dayType: log.dayType, picked, excludeNames: ctx.yesterdayNames || [],
      })
      aiGen = { loading: false, error: candidates.length ? '' : '没算出来，请调整缺口或换个关键词', candidates, picked, note }
      render()
      return
    }

    case 'eat-swap': {
      const ci = Number(el.dataset.c), mi = Number(el.dataset.m), ii = Number(el.dataset.i)
      const c = aiGen.candidates[ci]
      const meal = c && c.meals[mi]
      const item = meal && meal.items[ii]
      if (!item) return
      const otherNames = c.meals.flatMap((m) => m.items.map((x) => x.name)).filter((n) => n !== item.name)
      const next = swapMealItem({
        dayType: log.dayType, slot: meal.slot, currentName: item.name,
        otherNames, excludeNames: ctx.yesterdayNames || [],
      })
      if (!next) { toast('这个餐次没有可换的了'); return }
      meal.items[ii] = next
      recalcCandidate(c)
      render()
      return
    }

    case 'eat-generate-ai': {
      // 可选增强：AI 生成（需已配置；只在点击时发一次请求）
      if (!aiIsEnabled()) { toast('先去 AI 设置填写 base_url / api_key / model'); go('ai-settings'); return }
      if (aiGen.loading) return
      const picked = document.getElementById('eat-picked')?.value || ''
      aiGen = { loading: true, error: '', candidates: [], picked }
      render()
      const remaining = {}
      for (const it of (ctx.macro.items || [])) remaining[it.key] = it.remain
      generateDailyMeals({
        dayType: log.dayType,
        targets: log.macroTargetSnapshot,
        intake: ctx.macro.intake,
        remaining,
        picked,
        foods: FOODS.map((x) => x.name),
      }).then((candidates) => {
        aiGen = { ...aiGen, loading: false, candidates }
      }).catch((err) => {
        aiGen = { ...aiGen, loading: false, error: err.message || '生成失败，请稍后再试' }
      }).finally(() => render())
      return
    }

    case 'eat-apply': {
      const c = aiGen.candidates[Number(el.dataset.idx)]
      if (!c) return
      log.foods = log.foods || []
      for (const meal of c.meals) {
        for (const it of meal.items) {
          log.foods.push({
            foodId: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: `${meal.slot}·${it.name}（${it.qty}）`,
            qty: 1,
            perUnit: { kcal: it.kcal, protein: it.protein, carb: it.carb, fat: it.fat },
          })
        }
      }
      save()
      aiGen = { loading: false, error: '', candidates: [], picked: '' }
      toast(`已采纳「${c.name}」· 写入今日记餐`)
      go('log-meal')
      return
    }

    default: return
  }
}

app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]')
  if (!el || el.disabled || el.classList.contains('btn-para--disabled')) return
  const act = el.dataset.act
  if (act === 'nav') {
    // <a href="#/x"> 自行跳转；button（如宏量卡）没有 href，需要手动跳
    if (el.tagName !== 'A' && el.dataset.route) location.hash = '#/' + el.dataset.route
    return
  }
  e.preventDefault()
  onAction(act, el, () => buildCtx(location.hash.replace(/^#\/?/, '').split('?')[0] || 'home'))
})

app.addEventListener('input', (e) => {
  if (e.target.id === 'food-search') {
    query = e.target.value
    const pos = e.target.selectionStart
    render()
    const next = document.getElementById('food-search')
    if (next) { next.focus(); next.setSelectionRange(pos, pos) }
  }
})

// 主题应用：深色默认，浅色切换（[data-theme] 驱动 CSS 变量）
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme === 'light' ? 'light' : 'dark'
}

// 头像读取并缩放到 size 内（避免原图撑爆 localStorage）
function readImageAsThumb(file, size = 128) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => {
      const img = new Image()
      img.onload = () => {
        const c = document.createElement('canvas')
        const s = Math.min(size / img.width, size / img.height, 1)
        c.width = Math.max(1, Math.round(img.width * s))
        c.height = Math.max(1, Math.round(img.height * s))
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
        resolve(c.toDataURL('image/jpeg', 0.85))
      }
      img.onerror = reject
      img.src = fr.result
    }
    fr.onerror = reject
    fr.readAsDataURL(file)
  })
}

app.addEventListener('change', async (e) => {
  if (e.target.id === 'avatar-file') {
    const file = e.target.files?.[0]
    if (file) {
      try {
        const dataUrl = await readImageAsThumb(file, 128)
        const s = store.read(K.settings, makeDefaultSettings()) || makeDefaultSettings()
        s.avatar = dataUrl
        store.safeWrite(K.settings, s)
        toast('头像已更新'); render()
      } catch { toast('图片读取失败') }
      e.target.value = ''
    }
    return
  }
  if (e.target.id !== 'import-file') return
  const file = e.target.files?.[0]
  if (!file) return
  try {
    const backup = JSON.parse(await file.text())
    const keyCount = backup && backup.data && typeof backup.data === 'object'
      ? Object.keys(backup.data).length : 0
    // 三态选择：「取消」不再悄悄等于「合并」；覆盖前明确告知会替换本机数据
    const overwrite = confirm(
      `备份文件含 ${keyCount} 个数据项。\n点「确定」= 覆盖本机同名数据（本机现有记录会被替换）\n点「取消」= 进入「合并 / 放弃」选择`)
    let mode = 'overwrite'
    if (!overwrite) {
      mode = confirm('点「确定」= 合并导入（本机已有数据优先，只补缺失）\n点「取消」= 放弃导入，不改任何数据')
        ? 'merge' : 'abort'
    }
    if (mode === 'abort') {
      notice = { level: 2, label: 'IMPORT ABORTED', text: '已放弃导入，本机数据未改动。' }
      go('plan-list')
      return
    }
    const r = importTx(store, backup, mode)
    notice = r.ok
      ? { level: 2, label: 'IMPORT OK', text: `已${mode === 'overwrite' ? '覆盖' : '合并'}导入 ${r.written.length} 项。` }
      : { level: 2, label: 'IMPORT FAILED', text: `导入失败：${r.reason}。本机数据未改动。`, warn: true }
    go('plan-list')
  } catch {
    notice = { level: 2, label: 'IMPORT FAILED', text: '文件不是有效 JSON，本机数据未改动。', warn: true }
    go('plan-list')
  }
})

window.addEventListener('hashchange', render)
window.addEventListener('focus', () => {
  // 回到前台时按 04:00 读时结算（禁用后台定时器）
  rolloverIfNeeded({ read, write, now: Date.now() })
})

applyTheme((store.read(K.settings, makeDefaultSettings()) || makeDefaultSettings()).theme)
boot()
render()

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  // 相对页面 URL 解析，GitHub Pages 子路径（/ones-studio/）下也能注册到正确 scope
  navigator.serviceWorker.register(new URL('sw.js', document.baseURI).href).catch(() => {})
  // 新版 SW 激活并接管时自动刷新一次，让新缓存的 CSS/JS 立即生效（避免「改了但看不到」）
  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return
    reloading = true
    location.reload()
  })
}
