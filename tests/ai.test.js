import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  getConfig, saveConfig, isEnabled, mask,
  buildDailyMealsPrompt, parseCandidates, call, generateDailyMeals,
} from '../src/services/ai.js'

beforeEach(() => localStorage.clear())
afterEach(() => vi.unstubAllGlobals())

const FULL = { base_url: 'https://api.example.com', api_key: 'sk-test-1234567890', model: 'demo-model' }
const PAYLOAD = {
  dayType: 'training',
  targets: { kcal: 2188, protein: 155, carb: 275, fat: 52 },
  intake: { kcal: 800, protein: 60, carb: 90, fat: 25 },
  remaining: { kcal: 1388, protein: 95, carb: 185, fat: 27 },
  picked: '鸡腿饭',
  foods: ['水煮蛋', '蛋白粉', '鸡胸肉'],
}
const GOOD_JSON = JSON.stringify({
  candidates: [
    { name: '方案A', meals: [{ slot: '早餐', items: [{ name: '水煮蛋', qty: '2个', kcal: 144, protein: 12.6, carb: 0.8, fat: 10 }] }], total: { kcal: 1380, protein: 96, carb: 180, fat: 27 } },
    { name: '方案B', meals: [{ slot: '午餐', items: [{ name: '鸡腿饭', qty: '1份', kcal: 700, protein: 40, carb: 80, fat: 20 }] }], total: { kcal: 1400, protein: 95, carb: 185, fat: 26 } },
  ],
})

describe('配置与启用判定', () => {
  it('三字段齐全才启用；缺任一 → false', () => {
    expect(isEnabled()).toBe(false)
    saveConfig({ base_url: 'https://a', api_key: '', model: 'm' })
    expect(isEnabled()).toBe(false)
    saveConfig({ base_url: 'https://a', api_key: 'sk-1', model: 'm' })
    expect(isEnabled()).toBe(true)
  })
  it('api_key 传空 = 保留旧 key（设置页不回显明文）', () => {
    saveConfig({ base_url: 'https://a', api_key: 'sk-old', model: 'm' })
    saveConfig({ base_url: 'https://b', api_key: '', model: 'm2' })
    expect(getConfig().api_key).toBe('sk-old')
    expect(getConfig().base_url).toBe('https://b')
    expect(getConfig().model).toBe('m2')
  })
  it('mask 只用于显示，不落地明文', () => {
    expect(mask('sk-1234567890abcd')).toBe('sk-••••••••abcd')
    expect(mask('short')).toBe('••••••••')
    expect(mask('')).toBe('')
  })
})

describe('buildDailyMealsPrompt', () => {
  it('注入日类型/目标/已摄入/剩余/自选，要求 JSON 与 2-3 组', () => {
    const msgs = buildDailyMealsPrompt(PAYLOAD)
    expect(Array.isArray(msgs)).toBe(true)
    expect(msgs[0].role).toBe('system')
    const text = JSON.stringify(msgs)
    expect(text).toContain('训练日')
    expect(text).toContain('2188')
    expect(text).toContain('1388')
    expect(text).toContain('鸡腿饭')
    expect(text).toContain('JSON')
    expect(text).toMatch(/2.?3|两组|三组|2-3/)
  })
  it('无自选时走缺口自由安排', () => {
    const text = JSON.stringify(buildDailyMealsPrompt({ ...PAYLOAD, picked: '' }))
    expect(text).toContain('自由安排')
  })
})

describe('parseCandidates', () => {
  it('标准 JSON → 2 组，结构规整', () => {
    const c = parseCandidates(GOOD_JSON)
    expect(c.length).toBe(2)
    expect(c[0].meals[0].items[0].name).toBe('水煮蛋')
    expect(c[0].total.kcal).toBe(1380)
  })
  it('```json 代码块 + 前后废话 → 仍能提取', () => {
    const c = parseCandidates('好的，为您安排：\n```json\n' + GOOD_JSON + '\n```\n以上。')
    expect(c.length).toBe(2)
  })
  it('畸形 JSON / 无 candidates → []', () => {
    expect(parseCandidates('不是 JSON')).toEqual([])
    expect(parseCandidates('{"candidates": 1}')).toEqual([])
    expect(parseCandidates('')).toEqual([])
  })
  it('超过 3 组截断；空 meals 的组被过滤；缺字段给默认值', () => {
    const many = { candidates: [
      { name: 'A', meals: [{ slot: '早餐', items: [{ name: '蛋' }] }] },
      { name: 'B', meals: [] },
      { name: 'C', meals: [{ slot: '午餐', items: [{ name: '饭', kcal: '700' }] }] },
      { name: 'D', meals: [{ slot: '晚餐', items: [{ name: '面' }] }] },
      { name: 'E', meals: [{ slot: '加餐', items: [{ name: '奶' }] }] },
    ] }
    const c = parseCandidates(JSON.stringify(many))
    expect(c.length).toBe(3)
    expect(c[0].meals[0].items[0].qty).toBe('1份')
    expect(c[1].meals[0].items[0].kcal).toBe(700) // 字符串数字容错
  })
})

describe('call / generateDailyMeals', () => {
  it('未配置 → 直接拒绝，不发请求', async () => {
    const spy = vi.fn()
    vi.stubGlobal('fetch', spy)
    await expect(call([])).rejects.toThrow('未配置')
    expect(spy).not.toHaveBeenCalled()
  })

  it('POST 到 {base_url}/v1/chat/completions，带 Bearer 与 model', async () => {
    saveConfig(FULL)
    const fake = vi.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: GOOD_JSON } }] }),
    }))
    vi.stubGlobal('fetch', fake)
    const candidates = await generateDailyMeals(PAYLOAD)
    expect(candidates.length).toBe(2)
    const [url, opts] = fake.mock.calls[0]
    expect(url).toBe('https://api.example.com/v1/chat/completions')
    expect(opts.method).toBe('POST')
    expect(opts.headers.Authorization).toBe('Bearer sk-test-1234567890')
    expect(JSON.parse(opts.body).model).toBe('demo-model')
  })

  it('base_url 末尾斜杠容错', async () => {
    saveConfig({ ...FULL, base_url: 'https://api.example.com/' })
    const fake = vi.fn(async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: GOOD_JSON } }] }) }))
    vi.stubGlobal('fetch', fake)
    await generateDailyMeals(PAYLOAD)
    expect(fake.mock.calls[0][0]).toBe('https://api.example.com/v1/chat/completions')
  })

  it('base_url 自带 /v1 → 不重复拼', async () => {
    saveConfig({ ...FULL, base_url: 'https://api.example.com/v1' })
    const fake = vi.fn(async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: GOOD_JSON } }] }) }))
    vi.stubGlobal('fetch', fake)
    await generateDailyMeals(PAYLOAD)
    expect(fake.mock.calls[0][0]).toBe('https://api.example.com/v1/chat/completions')
  })

  it('HTTP 非 2xx → 抛错含状态码', async () => {
    saveConfig(FULL)
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 401 })))
    await expect(generateDailyMeals(PAYLOAD)).rejects.toThrow('401')
  })

  it('模型返回非 JSON → 抛「没解析出」', async () => {
    saveConfig(FULL)
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: '随便聊聊' } }] }) })))
    await expect(generateDailyMeals(PAYLOAD)).rejects.toThrow('没解析出')
  })
})
