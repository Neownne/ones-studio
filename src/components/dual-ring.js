// src/components/dual-ring.js — 同心双环 canvas 2d + dpr
// 外环 = 大计划进度；内环 = 当日完成度。底环 line，完成弧 accent，0.5px 轮廓。
import { themeColors } from '../data/tokens.js'

const START = -Math.PI / 2

export function drawRing(ctx, cx, cy, { R, w, ratio, track, arc, outline = true }) {
  const C = themeColors()
  const mid = R - w / 2
  ctx.lineCap = 'butt'

  // —— 凹槽底环：外沿压暗一圈 → 主轨道 → 内侧一线高光，衬出「凹进去」的立体感 ——
  ctx.strokeStyle = 'rgba(0,0,0,.55)'
  ctx.lineWidth = w + 2.5
  ctx.beginPath(); ctx.arc(cx, cy, mid, 0, Math.PI * 2); ctx.stroke()

  ctx.strokeStyle = track
  ctx.lineWidth = w
  ctx.beginPath(); ctx.arc(cx, cy, mid, 0, Math.PI * 2); ctx.stroke()

  ctx.strokeStyle = 'rgba(255,255,255,.07)'
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.arc(cx, cy, mid - w / 2 + 1, 0, Math.PI * 2); ctx.stroke()

  if (outline) {
    ctx.strokeStyle = C.line
    ctx.lineWidth = 0.5
    for (const r of [R, R - w]) {
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke()
    }
  }

  // —— 进度弧：发光 + 弧顶一道高光，衬出「凸起来」的包边感 ——
  const v = Math.max(0, Math.min(1, ratio || 0))
  if (v > 0) {
    ctx.save()
    ctx.shadowColor = arc
    ctx.shadowBlur = 9
    ctx.strokeStyle = arc
    ctx.lineWidth = w
    ctx.beginPath()
    ctx.arc(cx, cy, mid, START, START + Math.PI * 2 * v)
    ctx.stroke()
    ctx.restore()

    ctx.strokeStyle = 'rgba(255,255,255,.38)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(cx, cy, mid - w / 2 + 1.5, START, START + Math.PI * 2 * v)
    ctx.stroke()
  }
  // 12 点方向起点刻度
  ctx.fillStyle = C.text1
  ctx.fillRect(cx - 4, cy - R - 2, 8, 3)
}

// canvas 元素由页面提供；size 为 CSS 像素边长
// 动效：新值从「画布当前显示值」easeOutCubic 补间过去（420ms），首次从 0 充能；
// prefers-reduced-motion 下直接画终值。连续 render 时从中间值继续，不跳变。
let rafId = 0
let cur = null // 画布当前实际显示的 {outer, inner}
const clamp01 = (v) => Math.max(0, Math.min(1, v || 0))
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3)

export function renderDualRing(canvas, { outerRatio, innerRatio, size = 260 }) {
  if (!canvas) return
  const dpr = globalThis.devicePixelRatio || 1
  canvas.width = size * dpr
  canvas.height = size * dpr
  canvas.style.width = `${size}px`
  canvas.style.height = `${size}px`
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  const target = { outer: clamp01(outerRatio), inner: clamp01(innerRatio) }
  const from = cur || { outer: 0, inner: 0 }
  const reduce = globalThis.matchMedia &&
    globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches

  const paint = (o, i) => {
    const C = themeColors()
    cur = { outer: o, inner: i }
    ctx.clearRect(0, 0, size, size)
    const c = size / 2
    drawRing(ctx, c, c, {
      R: size / 2 - 4, w: 13, ratio: o,
      track: C.panel2, arc: C.accent,
    })
    drawRing(ctx, c, c, {
      R: size / 2 - 30, w: 11, ratio: i,
      track: C.panel2, arc: C.text1,
    })
    ctx.clearRect(c - 3, c - size / 2 + 1, 6, 4) // 让起点刻度只属于外环
  }

  if (reduce || (from.outer === target.outer && from.inner === target.inner)) {
    cancelAnimationFrame(rafId)
    paint(target.outer, target.inner)
    return
  }

  cancelAnimationFrame(rafId)
  const t0 = performance.now()
  const dur = 420
  const step = (now) => {
    const t = Math.min(1, (now - t0) / dur)
    const e = easeOutCubic(t)
    paint(from.outer + (target.outer - from.outer) * e,
      from.inner + (target.inner - from.inner) * e)
    if (t < 1) rafId = requestAnimationFrame(step)
  }
  rafId = requestAnimationFrame(step)
}
