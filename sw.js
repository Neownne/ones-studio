// src 相对 SW scope 解析，GitHub Pages 子路径下同样成立
const CACHE_VERSION = 'ones-studio-v17'  // v17: 进度自动推导 + 打卡候选模式 + 昨日食物排除 + 设置页左弹层，旧缓存必须失效
const base = self.registration.scope
const CORE_ASSETS = [
  base,
  new URL('index.html', base).href,
  new URL('manifest.webmanifest', base).href,
  ...[
    'src/main.js', 'src/data/constants.js', 'src/data/tokens.js', 'src/data/foods.js',
    'src/data/seed.js', 'src/data/exercises.js', 'src/store/keys.js', 'src/store/storage.js',
    'src/store/transaction.js', 'src/services/ai.js', 'src/services/meal-planner.js',
    'src/services/workout-planner.js',
    'src/utils/day.js', 'src/utils/derive.js', 'src/utils/progression.js',
    'src/components/dual-ring.js', 'src/components/ui.js',
    ...['home', 'log-meal', 'checkin', 'workout', 'weigh-in', 'settings',
      'plan-list', 'plan-edit', 'ai-settings', 'eat-plan', 'history'].map((p) => `src/pages/${p}.js`),
    'src/styles/tokens.css', 'src/styles/base.css', 'src/styles/components.css', 'src/styles/app.css',
    'assets/icons/icon-192.png', 'assets/icons/icon-512.png',
    'assets/icons/icon-maskable-192.png', 'assets/icons/icon-maskable-512.png',
    'favicon.ico',
  ].map((p) => new URL(p, base).href),
]

self.addEventListener('install', (e) => {
  // addAll 有一个 404 就整体失败 → 逐个 add，缺失的跳过
  e.waitUntil(
    caches.open(CACHE_VERSION).then(async (c) => {
      await Promise.all(CORE_ASSETS.map((u) => c.add(u).catch(() => {})))
      await self.skipWaiting()
    })
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

// 导航请求走 network-first（拿最新 HTML），静态资源 cache-first
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then((res) => {
        const copy = res.clone()
        caches.open(CACHE_VERSION).then((c) => c.put(e.request, copy))
        return res
      }).catch(() => caches.match(e.request).then((hit) => hit || caches.match(base)))
    )
    return
  }
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      if (!res || res.status !== 200) return res
      const copy = res.clone()
      caches.open(CACHE_VERSION).then((c) => c.put(e.request, copy))
      return res
    }))
  )
})
