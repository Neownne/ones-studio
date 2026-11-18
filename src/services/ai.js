// src/services/ai.js — AI 设置 + OpenAI 兼容接口调用（二期：生成今日吃法）
// 安全边界：api_key 只存本机 localStorage、不进导出备份、设置页不回显明文；
// 请求只在「配置齐全 + 用户主动点生成」时发出，无任何后台请求。
import { store } from '../store/storage.js'
import { K } from '../store/keys.js'

const EMPTY = { base_url: '', api_key: '', model: '' }
const TIMEOUT_MS = 45000

export function getConfig() {
  return { ...EMPTY, ...(store.read(K.aiConfig, {}) || {}) }
}

export function saveConfig(patch) {
  const cur = getConfig()
  const next = { ...cur, ...patch }
  // api_key 传空 = 保留旧 key（密码框不回显，留空不代表清空）
  next.api_key = patch.api_key ? patch.api_key : cur.api_key
  return store.safeWrite(K.aiConfig, next)
}

// 启用判定：三字段齐全。不再有独立开关，避免「开了但没配」的假状态。
export function isEnabled() {
  const c = getConfig()
  return !!(c.base_url && c.api_key && c.model)
}

// 仅用于设置页显示，不落地明文
export function mask(k) {
  if (!k) return ''
  if (k.length <= 8) return '••••••••'
  return `${k.slice(0, 3)}••••••••${k.slice(-4)}`
}

// OpenAI 兼容 chat/completions；失败抛带原因的错误给 UI 层提示
export async function call(messages, { timeoutMs = TIMEOUT_MS } = {}) {
  if (!isEnabled()) {
    throw new Error('AI 未配置：先去 AI 设置填写 base_url / api_key / model')
  }
  const c = getConfig()
  const base = c.base_url.replace(/\/+$/, '')
  // 兼容两种填法：https://api.x.com 与 https://api.x.com/v1
  const url = /\/v1$/.test(base) ? `${base}/chat/completions` : `${base}/v1/chat/completions`
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${c.api_key}` },
      body: JSON.stringify({ model: c.model, messages, temperature: 0.7 }),
      signal: ctl.signal,
    })
    if (!res.ok) throw new Error(`请求失败 HTTP ${res.status}`)
    const data = await res.json()
    const text = data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text ?? ''
    if (!text) throw new Error('模型返回为空')
    return text
  } finally {
    clearTimeout(timer)
  }
}

// —— 生成今日吃法 ——

export function buildDailyMealsPrompt({ dayType, targets, intake, remaining, picked, foods } = {}) {
  const dayText = { training: '训练日', rest: '休息日' }[dayType] || '休息日'
  const f = (o = {}) =>
    `kcal ${Math.round(o.kcal || 0)} / 蛋白 ${Math.round(o.protein || 0)}g / 碳水 ${Math.round(o.carb || 0)}g / 脂肪 ${Math.round(o.fat || 0)}g`
  const user = [
    `今天是${dayText}。全天目标：${f(targets)}。`,
    `已摄入：${f(intake)}。还需安排：${f(remaining)}。`,
    picked ? `我今天想吃：${picked}。请围绕它安排。` : '我没有特别想吃的，按剩余缺口自由安排。',
    foods && foods.length ? `可参考的常吃食物：${foods.slice(0, 30).join('、')}。` : '',
    '请给出 2-3 组当日吃法候选（最好 3 组），要求：',
    '1. 每组按「早餐 / 上午加餐 / 午餐 / 练后 / 晚餐」五餐列出食物与用量；',
    '2. 每组给合计宏量，热量逼近剩余缺口（±150 kcal 内），蛋白不低于剩余的 90%；',
    '3. 食物限定在酒店早餐、常见外卖、便利店、蛋白粉能买到的范围；',
    '4. 只输出 JSON，不要任何多余文字，格式：',
    '{"candidates":[{"name":"方案A","meals":[{"slot":"早餐","items":[{"name":"水煮蛋","qty":"2个","kcal":144,"protein":12.6,"carb":0.8,"fat":10}]}],"total":{"kcal":0,"protein":0,"carb":0,"fat":0}}]}',
  ].join('\n')
  return [
    { role: 'system', content: '你是健身营养助手，为用户生成当日饮食清单。只输出 JSON，不说废话。' },
    { role: 'user', content: user },
  ]
}

// 从模型输出提取候选：容忍 ```json 包裹与前后废话；结构不合规 → []
export function parseCandidates(text) {
  const m = String(text || '').match(/\{[\s\S]*\}/)
  if (!m) return []
  let obj
  try { obj = JSON.parse(m[0]) } catch { return [] }
  const list = Array.isArray(obj?.candidates) ? obj.candidates : []
  return list
    .map((c, i) => ({
      name: String(c?.name || `方案 ${'ABC'[i] || i + 1}`),
      meals: (Array.isArray(c?.meals) ? c.meals : []).map((meal) => ({
        slot: String(meal?.slot || ''),
        items: (Array.isArray(meal?.items) ? meal.items : []).map((it) => ({
          name: String(it?.name || ''),
          qty: String(it?.qty || '1份'),
          kcal: Number(it?.kcal) || 0,
          protein: Number(it?.protein) || 0,
          carb: Number(it?.carb) || 0,
          fat: Number(it?.fat) || 0,
        })),
      })),
      total: {
        kcal: Number(c?.total?.kcal) || 0,
        protein: Number(c?.total?.protein) || 0,
        carb: Number(c?.total?.carb) || 0,
        fat: Number(c?.total?.fat) || 0,
      },
    }))
    .filter((c) => c.meals.length > 0)
    .slice(0, 3)
}

export async function generateDailyMeals(payload) {
  const text = await call(buildDailyMealsPrompt(payload))
  const candidates = parseCandidates(text)
  if (!candidates.length) throw new Error('没解析出候选方案，请再试一次')
  return candidates
}
