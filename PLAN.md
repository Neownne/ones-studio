# one's studio — 实施计划

> 依据 `DESIGN.md` v2.0。superpowers 流程：红绿 TDD、2–5 分钟任务粒度、每个任务含文件 + 动作 + 验证。
> 分支：`develop`（隔离开发，验收后合 `main`）。提交前 `npm test` 必须全绿。

## Phase 0 — 工程地基（脚手架，无 TDD）

- **0.1** `package.json` + `vitest.config.js`：devDependency `vitest`，`scripts.test = "vitest run"`。**验证**：`npm install && npm test` 能启动（空套件不报错）。
- **0.2** `.gitignore`：`node_modules/`、`*.log`、`.DS_Store`。建目录骨架（`src/{styles,data,store,utils,services,components,pages}`、`tests/`、`assets/{fonts,icons}`）。
- **0.3** `index.html`：viewport、`theme-color #0a0a0a`、manifest 链接、字体预载、`#app` 挂载点、`<script type="module" src="/src/main.js">`。**验证**：静态服务打开无 404。
- **0.4** `manifest.webmanifest`：name「one's studio」、`display:standalone`、`theme_color/background_color #0a0a0a`、icons。
- **0.5** `sw.js`：Service Worker，cache-first 缓存核心静态资源，版本号常量。**验证**：注册无报错。

## Phase 1 — 逻辑层纯函数（红绿 TDD）

- **1.1** `tests/day.test.js`（先红）：`computeDayKey` 04:00 边界（03:59→前一天 / 04:00→当天）、`computeDayType`、`monthOf`、`d2t`、`newDayLog`、`rolloverIfNeeded`（跨天补空、跨月分片、no-plan 期 `planId=null` 不回填）。
- **1.2** `src/utils/day.js` 实现 → 绿。纯函数，不读写 storage（读写注入）。
- **1.3** `tests/derive.test.js`（先红）：`computePlanProgress`（日历分子含休息缺勤、缓存仅防时间倒退、编辑 startDate/totalDays 按 configSig 重算、notStarted/expired 态）、`computeTodayProgress`（分母恒 7、no-plan 第 6 项 false 且不可勾）、`computeMacroRemain`（剩余/超额/no-plan 返回 hidden）、`computeRingCenter`（untilStart vs countdown）。
- **1.4** `src/utils/derive.js` 实现 → 绿。
- **1.5** `tests/progression.test.js`（先红）：同一动作连续 2 次达上限 +2.5kg、`bodyweight`/`suppressIncrease` 跳过、中断清零、写回只改 currentWeight。
- **1.6** `src/utils/progression.js` 实现 → 绿。

## Phase 2 — 存储与数据（红绿 TDD）

- **2.1** `tests/storage.test.js`（先红）：`safeWrite` 容量预警/拒写/写后回读比对、`read` 缺省、月分片 `os:logs:YYYY-MM` 写入。
- **2.2** `src/store/storage.js` + `keys.js` 实现 → 绿（jsdom 下 mock localStorage）。
- **2.3** `tests/transaction.test.js`（先红）：`precheck` 版本/格式校验、`importTx`（abort/overwrite/merge，临时键全成功才提交、失败回滚、本机优先、**全程不碰 os:ai_config**）、迁移链 `0→1→2→3` 禁跳级、高版本本地只读/高版本导入拒绝。
- **2.4** `src/store/transaction.js` 实现 → 绿。
- **2.5** `src/data/foods.js`：高频 30–50 项（酒店早餐 + 常点外卖），每项 `perUnit` 宏量 + 来源 + 可食部。
- **2.6** `src/data/seed.js`：默认计划（D7 宏量 2188/2038）、4 分化训练模板（酒店器械：史密斯/飞鸟/哈克/高位下拉/坐姿划船/腿屈伸/腿弯举/哑铃）、睡前清单定义。

## Phase 3 — 视觉地基（ZZZ token）

- **3.1** `src/styles/tokens.css`：§4.1 十二 token + 纹理（45° 警戒带 / 18px 网点 / 斜切）CSS 变量与工具类。
- **3.2** `src/styles/base.css`：reset、`--font-display` 系统窄体栈、排版阶梯（标题数字 / 等宽标签 / 系统黑体正文）、青柠焦点环。
- **3.3** `src/styles/components.css`：斜切卡、平行四边形按钮、硬偏移、tab-bar、hint 标签块、编号徽章、扫描线（仅启动）。
- **3.4** `src/data/tokens.js`：canvas 镜像 token（与 tokens.css 同源人工同步）。
- **3.5** ~~`assets/fonts/`：Anton 子集~~ → **实施偏差（Phase 7 收尾修正）**：仓库无 Anton 源文件，系统 Impact / Arial Narrow 属商业字体不可再分发，指向缺失 woff2 的 `@font-face` 会产生 404 且绝对路径不适配 GitHub Pages 子路径。改为删除 `@font-face`、字体栈统一收口到 `--font-display`，`sw.js` 缓存版本升 `ones-studio-v3` 使旧缓存失效。Anton 子集降为二期可选，见 `docs/visual-tokens.md` §4。

## Phase 4 — 核心组件

- **4.1** `components/dual-ring.js`：canvas 2d + `devicePixelRatio`，`drawRing`（底环 #2a2c2b / 完成弧 #d8fa00 / 0.5px 轮廓 / 起点刻度）。
- **4.2** `components/tab-bar.js`：6 tab + 文字标签 + 青柠选中斜切块，热区 ≥44px。
- **4.3** `components/macro-cards.js`：四斜切卡（剩余/超额 amber 态）。
- **4.4** `components/hint.js`：终端式标签块（首页 L1 / 二级页 L2）。
- **4.5** 其余：`countdown.js`、`todo-block.js`、`plan-card.js`、`danger-btn.js`、`entry-unenabled.js`、`ctrl-disabled.js`、`empty-state.js`。

## Phase 5 — 9 页面（渲染 + 数据接线）

- **5.1** `pages/home.js`：日期 + 同心双环 + 倒计时 + 宏量缺口 + 7 项入口；0 计划空态。
- **5.2** `pages/log-meal.js`：食物库检索 + 三餐记录 + 已摄入累加；「生成今日吃法」未启用入口。
- **5.3** `pages/checkin.js`：5 锚点 + 训练/休息勾选。
- **5.4** `pages/workout.js`：当日模板 + 组次 + 加重判定提示。
- **5.5** `pages/weigh-in.js`：体重记录 + 周均线。
- **5.6** `pages/checklist.js`：睡前清单子项。
- **5.7** `pages/plan-list.js`：使用中黑卡 + 白卡列表 + 新建/切换/删除。
- **5.8** `pages/plan-edit.js`：期限/宏量/食物/训练/指标编辑。
- **5.9** `pages/ai-settings.js`：黑底反色，真禁用开关 + base_url/api_key/model。

## Phase 6 — 服务与集成

- **6.1** `services/ai.js`：`getConfig/saveConfig/isEnabled()→false/call()→reject`，零网络请求，导出不落地三字段。
- **6.2** `main.js`：hash 路由 + 启动初始化 + 读时 rollover + 视图数据装配。
- **6.3** 导出/导入接线：导出（下载 / Web Share / 剪贴板三级降级）+ 导入（`<input type=file>` + 事务）。

## Phase 7 — 验收与部署

- **7.1** `npm test` 全绿（覆盖 Phase 1/2 边界）。
- **7.2** 9 页面导航 + 视觉对照 `DESIGN.md` §4（青柠 ≤5%、6 tab 带文字、装饰不压数字）。
- **7.3** 性能：iPhone 真机首屏 <800ms、反馈 ≤140ms。
- **7.4** `README.md`：加到主屏幕步骤 + 「导出到文件」兜底说明 + 合规声明。
- **7.5** GitHub Pages 部署 + 真机验证。

---

### 执行约定
- 逻辑层（Phase 1/2）**先红后绿**，UI 层（Phase 4/5）对照设计文档验收。
- 每个 Phase 提交一次，附 `npm test` 结果。
- 复杂度冒头就砍：能用 100 行不用 1000 行。
