// vitest 共享 setup：node 环境无 localStorage，给依赖单例 store 的模块（ai.js）一个内存实现
const m = new Map()
globalThis.localStorage = {
  getItem: (k) => (m.has(k) ? m.get(k) : null),
  setItem: (k, v) => m.set(k, String(v)),
  removeItem: (k) => m.delete(k),
  clear: () => m.clear(),
  key: (i) => [...m.keys()][i] ?? null,
  get length() { return m.size },
}
