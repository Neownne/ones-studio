# one's studio — 设计文档

| | |
|---|---|
| 版本 | v2.0（绝区零风格定稿） |
| 日期 | 2026-11-14 |
| 状态 | 已确认，进入开发 |
| 形态 | iOS PWA（原生 HTML/CSS/JS，无框架，无后端） |
| 品牌 | **one's studio**（界面不展示 zzz studio） |

---

## 0. 决策记录（ADR 摘要）

| # | 决策 | 结论 | 依据 |
|---|---|---|---|
| D1 | 载体 | **iOS PWA**，弃微信小程序 | 「饮食记录」无对应服务类目，最近类目需医疗资质 4 选 1，个人主体拿不到；斜切角/字体/canvas 无限制；0 元免审核 |
| D2 | 一期范围 | **全量 9 页面一次做全** | 用户拍板（推翻「核心闭环 3 页」建议） |
| D3 | 食物库 | **高频 30–50 项** | 酒店早餐 + 常点外卖，逐项标宏量 |
| D4 | 品牌 | **one's studio** | 用户拍板，不展示 zzz studio |
| D5 | 视觉风格 | **绝区零 ZZZ / 磁带未来主义朋克** | 用户拍板（推翻 NTC 极简荧光绿） |
| D6 | 技术栈 | **vanilla ES Modules + Vitest**，不引框架 | 降低复杂度（superpowers 核心原则） |
| D7 | 默认热量 | **训练日 2188 / 非训练日 2038 kcal** | 11-13 Mifflin-St Jeor 复算修正（原 2050/1900 会减过头），用户可编辑 |

---

## 1. 产品概述

**one's studio** 是一个帮用户在固定周期内执行「先减后增」体脂计划的 iOS PWA。核心回答两件事：**今天练什么、今天吃什么**。用绝区零式高辨识度视觉做「突出创意风格」，用可复算的热量公式和本地规则引擎做「成熟可靠」。

- **不加后端、不做账号**（一期）；数据全在本地 localStorage。
- **AI 接口二期已开放**（`base_url`/`api_key`/`model`，填齐即启用）；请求只在用户点击「生成」时发出，OpenAI 兼容 `/v1/chat/completions`，无后台请求；密钥只存本机、不进导出备份。
- 合规口径：只做「记录 / 健康管理 / 改善生活习惯」，不出现诊断、治疗、处方、疗效承诺。

## 2. 用户与减脂方案

- **用户**：成年男性，训练新手期。身高/体重/体脂及各项训练数据见本地文档，**不公开入库**。
- **日常活动**：仅早通勤骑车 4km，其余靠健身锻炼（非训练日近乎久坐）。
- **场景**：出差酒店，酒店健身房 + 酒店早餐 + 外卖，至 2027-02-05 除夕。
- **路线**：先减后增。减脂期达标后转增肌期（热量盈余 +200~300 kcal，月增重上限 1kg；具体目标值见本地文档，不公开入库）。
- **热量依据**：Mifflin-St Jeor 公式复算 BMR 与逐日法周均 TDEE，按目标周期反推日均热量缺口（计算过程与数值见本地文档，不公开入库）。
- **宏量目标（默认，可编辑）**：
  - 训练日：**2188 kcal / P155 / C275 / F52**
  - 非训练日：**2038 kcal / P155 / C247 / F48**
  - 蛋白 155g = 2.09 g/kg 体重 = 2.49 g/kg 瘦体重（减脂保肌合理，保留）
- **训练**：4 分化（推 / 拉 / 腿 / 上肢综合），加重规则 = 同一动作连续 2 次达上限 +2.5kg。
- **称重**：健身房同一台秤、练前非空腹、每周 1–2 次、看周均趋势。

## 3. 信息架构

底部 6 个 tab + 3 个二级页，共 9 个页面。hash 路由。

| 路由 | 页面 | tab | 职责 |
|---|---|---|---|
| `#/home` | 首页 | 1 HOME | 日期+倒计时小字、双环（外=本周进度/内=今日完成度）、宏量缺口。进度全自动推导，无待办清单、无工具条 |
| `#/log-meal` | 记餐 | 2 FOOD | 记录三餐，累加已摄入 kcal/P/C/F，食物库检索，「生成今日吃法」入口 |
| `#/eat-plan` | 生成吃法 | — | 内置固定规则算法出 2-3 组当日吃法候选（昨天吃过的今天不推荐、每条可换）→ 采纳写入记餐 |
| `#/checkin` | 打卡 | 3 TASK | 按肌群 × 锻炼条件生成可替换的动作候选，点「完成」记录；确认后仍可换 |
| `#/workout` | 训练 | 4 GYM | 当日训练模板、动作组次、加重判定 |
| `#/weigh-in` | 称重 | 5 WT | 记录体重，周均趋势线 |
| `#/settings` | 我的 | 6 ME | 头像+名称、个人信息细项（名称/出生日期/身高/性别，左侧弹出层编辑）、历史/计划/AI 入口、备份、浅色/深色主题 |
| `#/plan-list` | 计划列表 | — | 多计划卡片（使用中/白卡），新建/切换/删除入口 |
| `#/plan-edit` | 计划编辑 | — | 编辑期限、宏量、能吃的食物、训练项目、自身/期望指标 |
| `#/ai-settings` | AI 设置 | — | base_url/api_key/model 三字段 + 配置状态（黑底反色页） |

## 4. 视觉系统（绝区零 ZZZ）

合成规则一句话：**用绝区零官网的「品牌电压」包装，装一个能每天工作的高密度工具**。

### 4.1 色板 token（12 个，深色单主题）

| token | 值 | 用途 |
|---|---|---|
| `canvas` | `#0a0a0a` | 页面画布（不用纯黑 #000，避免视觉疲劳） |
| `panel-0` | `#141614` | 一级卡片/输入卡 |
| `panel-1` | `#1b1d1b` | 二级面板 |
| `panel-2` | `#23251f` | 深嵌块 |
| `line` | `#2a2c2b` | 1px 结构描边/分隔 |
| `text-1` | `#f2f2ee` | 主文字 |
| `text-2` | `rgba(242,242,238,.58)` | 次级 |
| `text-3` | `rgba(242,242,238,.40)` | 说明/占位 |
| `text-4` | `rgba(242,242,238,.24)` | 禁用/装饰 |
| `accent` | `#d8fa00` | **唯一强调色**：主行动、选中 tab、进度弧、焦点环、编号徽章 |
| `accent-dim` | `#b6d400` | hover/次级强调、环外标签 |
| `amber` | `#ffde00` | **仅警告语义**（超额/预警），不做交互强调 |

纪律：
- **青柠整屏面积 ≤5%**，只给主行动/选中/进度弧/焦点/编号，不做大面积铺底、不做渐变铺底。
- **不引红色功能色**；错误用 amber + 斜纹 + 文案，不用红。
- 层级靠**底色阶差 + 1px 描边 + 0 blur 硬偏移**，零软阴影、零发光、零模糊。
- 文本四档对比降台阶，不做纯黑配纯白。

### 4.2 字体

| 用途 | 字体栈 | 规格 |
|---|---|---|
| 标题/数字 | `Anton`(子集) → `Impact` → `Arial Narrow` → 系统窄体 | 400 天然粗细，禁合成加粗 |
| 等宽标签 | `Cascadia Mono` → `SF Mono` → `Consolas` → monospace | 全大写，字距 .12–.38em，`// ` 前缀 |
| 中文/正文 | 系统黑体（PingFang SC/雅黑/Noto Sans SC） | 14px/400，**不斜体、不伪造品牌感** |

- 粗体只给标题和数字，**正文一律常规字重**（避免绝区零被批评的「全篇超粗黑体」）。
- 数字优先等宽 tabular 或 Impact。
- 字体子集化：Anton 仅数字+大写拉丁，控制包体积。

### 4.3 形态

- **斜切角**：卡片右上/左下切角（`clip-path: polygon(...)`），按钮平行四边形 `skewX(-24deg)` 小色块；几乎无正圆角。
- **硬偏移阴影**：`3/6/8px` 偏移、`0 blur`、纯色（黑 .55 或青柠 .55），无模糊。
- **触控热区 ≥44×44px**，切角不影响可点区域（用 `::after` 扩热区）。

### 4.4 纹理（装饰层，永不压住数字）

| 纹理 | 规格 | 位置 |
|---|---|---|
| 45° 警戒带 | 11px 节距，黄黑，细条 | 页面顶部分隔、空态、加载 |
| 18px 网点 | 1px 圆点，低透明 | 画布背景 |
| 斜切小色块 | 42×3，`skewX(-24°)`，青柠 | 标题下划线、强调 |
| 扫描线 | 3px 循环暗线 | **仅启动页** |

- 警戒带斜纹是**品牌装饰**；危险/警告用「amber + 更密斜纹 + 文案」区分，两者疏密/色相不同，不混淆。

### 4.5 动效

- 统一 **140ms**，只允许**颜色 + 1px 位移**。
- 按下即时反馈 ≤140ms（避免绝区零被批评的 1s 延迟）。
- 禁 `@keyframes` 滥用、禁 `blur`/`backdrop-filter`、禁全屏闪烁。
- 支持 `prefers-reduced-motion` 时关闭非必要动效。

### 4.6 可用性避坑（对应「成熟」）

1. 不用 #000 纯黑 + 纯白大字 → #0a0a0a + 四档白。
2. 粗体只给标题数字，正文常规。
3. 6 tab 固定语义 + 文字标签，不靠图形猜（避免绝区零图标混乱）。
4. 装饰层（网点/斜纹/贴纸）永不压住数字与可点区。

## 5. 程序逻辑（冻结，不因换皮改变）

### 5.1 同心双环

- **外环** = 整体计划进度：分子 `clamp(今天 − startDate + 1, 0, totalDays)`，按自然日，含休息/缺勤，没打开也算。
- **内环** = 当日完成度：分母恒 6（5 个蛋白锚点 + 训练/休息；已删睡前清单）；记餐、称重**不进分母**。
- 完成度**全自动推导**（`derive.computeTodayProgress`）：`log.foods.length > i` → 第 i 个蛋白锚点自动勾；`workout` 有任一组完成或有确认的候选 → 训练项自动勾；休息日训练项恒完成。不写 `log.todos`，首页不再有待办清单。
- 缓存 `progressCache:{configSig, archivedDays}` 仅作「配置未变 + 系统时间倒退」兜底；编辑 startDate/totalDays 必按新配置重算。

### 5.2 日切与 rollover

- **04:00 日切**：`dayKey = 日期(now − 4h)`，格式 `YYYY-MM-DD`。
- **读时 rollover**，禁用后台定时器（PWA 无后台同步，正好契合）。
- 跨多天离线补全部空 `dayKey`，`isGap` 空日只补结构、不进外环分子；no-plan 期 `planId=null` 不回填。
- `daySeen` 为非待办标记，不进 6 项、不参与完成度。

### 5.3 多计划

- `plans[] + activePlanId`，新建/复制/编辑/切换/删除/更新全开。
- 可编辑：期限、宏量、能吃的食物、训练项目、自身指标、期望指标。
- 历史日志用 `planId + macroTargetSnapshot` 快照，切换/编辑/删计划**不重算旧账**。

### 5.4 存储

- localStorage，key 前缀 `os:`，日志**月分片** `os:logs:YYYY-MM`。
- 写入前查容量（按配额百分比预警），写后 JSON 回读比对防静默失败。
- 版本迁移链 `0→1→2→3`，禁跳级；本地遇更高版本进只读，导入文件版本更高则不导入不降级解析。

### 5.5 导出 / 导入

- 一键导出 JSON 备份（下载到「文件」App / Web Share / 剪贴板三级降级）。
- 导入事务式：临时键全成功才提交、失败回滚，本机优先。
- 导出黑名单：`api_key`/`base_url`/`model`。
- 版本分离：用户可见 `backupVersion = 1`，内部 `schemaVersion = 3`。

### 5.6 生成今日吃法（内置算法为主，AI 可选）

- **内置算法**（`meal-planner.js`，默认路径，无需配置、零请求）：按餐次热量权重把剩余缺口拆到五餐（训练日含练后、休息日换下午加餐），每餐在场景内选「热量最接近目标的主食物」+ 高蛋白小食补充；三种策略（均衡/高蛋白/快手）制造 2-3 组差异候选；自选关键词匹配食物库优先纳入。
- **AI 可选增强**（`ai.js`）：三字段齐全才启用，OpenAI 兼容 `/v1/chat/completions`，Bearer 认证，45s 超时，只在点击「用 AI 生成」时发一次请求；`api_key` 留空保存 = 保留旧 key、不回显明文、不进导出备份。
- 采纳：所选方案按餐写入今日 `log.foods` 自定义条目（与食物库同构参与剩余计算）。

### 5.7 加重判定

- 同一动作**连续 2 次达上限** +2.5kg；`bodyweight` 与 `suppressIncrease` 跳过；中间任一未达即清零；写回只改 `currentWeight`，不改历史。

### 5.8 推荐规则（固定代码，不调 AI）

两条推荐线都是**纯函数固定规则**：不读 storage、不发请求、无随机种子漂移，可在 node 里直接单测。

**食物（`meal-planner.js`）**

- 候选 = 场景池（酒店早餐/外卖/便利店/加餐…）× 缺口偏移；先按餐次热量权重拆缺口，再选热量最接近的主食物。
- **昨日排除**：读昨天 `log.foods`，经 `normalizeFoodName` 剥「餐次·」前缀与「（用量）」后缀后与食物库对齐，命中的今天不再推荐；排除后同场景池 <2 项则放宽兜底，保证一定出结果。
- **可替换**：`swapMealItem` 在同餐次池内循环换下一个（先排除其他条目与昨日，第二圈只排除其他条目），保证换得动；换完 `recalcCandidate` 重算组合总量。

**运动（`workout-planner.js` + `data/exercises.js`）**

- 两级分类：**肌群**（胸/背/肩/手臂/腿/核心）× **锻炼条件**（`gym` 健身房 / `dumbbell` 居家哑铃 / `none` 徒手无器材）。每个肌群在每种条件下都有非空候选池（单测锁死）。
- 今日候选 = 模板动作默认保留；若该动作在当前条件下做不了、或**本周此前已练**、或已被其他槽位占用 → 用同肌群同条件且本周未练的动作顶替。
- **切换锻炼条件**：未确认的候选按新条件重排，**已确认的保留原动作**（不冲掉用户已完成的记录）。
- 「换一个」：同肌群同条件池内循环；第一圈排除「其他槽位占用 + 本周已练」，第二圈只排除占用，保证一定换得动。**确认（锁定）后仍可换**。
- 徒手池覆盖酒店房间场景：俯卧撑/上斜/跪姿/派克、桌下反向划船、椅上臂屈伸、臀桥、保加利亚分腿蹲、靠墙静蹲、卷腹、平板/侧平板、俄罗斯转体、死虫式、登山跑、开合跳等 ≥20 个，不依赖任何器械。

## 6. 数据 schema

### 6.1 Storage keys

```
os:settings            全局设置（含 schemaVersion、activePlanId、progressCache）
os:plans               计划数组
os:logs:YYYY-MM        日志月分片
os:templates           训练模板
os:weights             称重记录
os:foods               食物库（高频 30-50 项）
os:settings           设置（含个人主页 profile/theme/avatar/trainingCond、activePlanId、progressCache）
os:ai_config           AI 配置（导出黑名单）
os:tmp:                导入临时键前缀
```

### 6.2 计划 Plan

```js
{
  id, name,                       // 计划标识
  startDate, endDate, totalDays,  // 期限
  macroTargets: {                 // 宏量目标（训练日/非训练日）
    training: { kcal:2188, protein:155, carb:275, fat:52 },
    rest:     { kcal:2038, protein:155, carb:247, fat:48 }
  },
  metrics: {                      // 自身指标 + 期望指标（示例值已脱敏）
    current: { weight:0, bodyfat:0 },
    target:  { weight:0, bodyfat:0 }
  },
  foods: [...],                   // 能吃的食物（食物库子集/自定义）
  workoutTemplates: {             // 计划级训练模板（自定义训练计划；覆盖全局 os:templates）
    push:  { id:'push', name, split:'push', exercises:[{id, name, sets, repMax, currentWeight, weightStep}] },
    pull:  {...}, legs: {...}, upper: {...}
  },
  schedule: {...},                // 周训练安排（哪天推/拉/腿/综合）
}
```

### 6.3 日志 DayLog

```js
{
  dayKey,                         // 'YYYY-MM-DD'（04:00 日切）
  planId, planName, dayType,      // 'training'|'rest'|'no-plan'
  macroTargetSnapshot,            // 当日宏量快照（no-plan 为 null）
  // 不写 todos：6 项完成度由 foods / workout 自动推导
  foods: [{ foodId, qty, perUnit }],   // 已吃
  workout: {
    split,                        // 今日分化
    selections: [{ part, name, sets, repMax, weight, confirmed }],  // 今日候选（可换、确认后可换）
    exercises: [{ templateId, sets:[{done, reps, weight}] }],       // 训练页组次
  },
  weigh: null|number,
  archived, isGap, daySeen,
}
```

### 6.4 食物 Food（30–50 项）

```js
{ id, name, brand?, scene,        // 'hotel-breakfast'|'takeout'|...
  perUnit: { unit, kcal, protein, carb, fat },
  source, edible,                 // 来源 + 可食部标注
}
```

## 7. 技术栈与工程结构

- **纯静态**，无构建步骤（降低复杂度）；ES Modules 直接跑；Vitest 仅用于本地 TDD。
- **路由**：hash 路由（`#/xxx`），无依赖。
- **渲染**：vanilla JS 组件（返回 DOM/模板字符串）。
- **双环**：canvas 2d + `devicePixelRatio` 缩放。
- **字体**：一期不随包附带字体二进制、不声明 `@font-face`，标题数字用系统窄体栈 `--font-display`（Impact → Arial Narrow → DIN Condensed），中文系统黑体；二期可选按 `docs/visual-tokens.md` §4 生成 Anton 子集（相对路径 + SW 预缓存）。零字体网络请求。
- **存储**：localStorage 封装，唯一读写口。
- **PWA**：`manifest.webmanifest` + Service Worker 离线缓存 + 添加到主屏幕。

```
ones-studio/                      （工作区根，git 管理）
├── index.html
├── manifest.webmanifest
├── sw.js
├── package.json                  （仅 devDependencies: vitest）
├── vitest.config.js
├── README.md
├── src/
│   ├── main.js                   （入口 + 路由 + 初始化 + rollover）
│   ├── styles/  tokens.css · base.css · components.css · app.css
│   ├── data/    tokens.js · constants.js · foods.js · exercises.js · seed.js
│   ├── store/   storage.js · keys.js · transaction.js
│   ├── utils/   day.js · derive.js · progression.js
│   ├── services/ ai.js · meal-planner.js · workout-planner.js
│   ├── components/ dual-ring.js · ui.js · tab-bar.js · hint.js · ...
│   └── pages/   home · log-meal · eat-plan · checkin · workout · weigh-in
│                · history · settings · plan-list · plan-edit · ai-settings
├── tests/       day · derive · progression · storage · transaction
│                · meal-planner · workout-planner · ai
│                · hit-test.html · home-eat-probe.html
│                · settings-probe.html · custom-training-probe.html
└── assets/      fonts/ · icons/
```

## 8. TDD 策略（红绿，强制）

- **逻辑层**（`day.js`/`derive.js`/`progression.js`/`storage.js`/`transaction.js`）红绿 TDD：先写失败测试 → 看红 → 最少实现 → 看绿 → 提交。
- **覆盖**：04:00 日切边界、跨天/跨月 rollover、外环日历分子、内环 6 项分母与自动推导、宏量剩余与超额、加重判定、事务提交/回滚、schema 迁移 0→3、no-plan 隐藏四小环、食物昨日排除、运动候选池完整性。
- **UI 层**：组件化，人工 + 截图对照本设计文档验收（canvas 视觉不做单测，用验收清单）。
- 提交前 `npm test` 必须全绿。

## 9. 部署

- GitHub Pages（或 Cloudflare Pages）静态托管，0 元。
- iPhone：Safari 打开 → 分享 → 添加到主屏幕，独立 Web App 打开。
- **必须保留「导出到文件」兜底**（iOS 7 天无交互清脚本存储，主屏 Web App 有独立计数器）。

## 10. 验收标准

1. **功能**：10 页面可导航；记餐累加正确；双环/倒计时/宏量缺口随数据实时刷新；04:00 日切正确；多计划 CRUD；导出导入可用；加重判定正确；配置后 AI 生成吃法可生成/采纳；打卡候选可换、条件可切、确认后可换；食物推荐避开昨天吃过的。
2. **逻辑**：`npm test` 全绿，覆盖 §8 列出的边界；四个浏览器探针全 PASS。
3. **视觉**：与本设计文档 §4 一致；青柠整屏 ≤5%；6 tab 带文字标签；装饰层不压数字。
4. **性能**：iPhone 真机首屏 <800ms；点击反馈 ≤140ms。
5. **合规**：无诊断/治疗/疗效文案；AI 请求只在用户点击时发出，无后台请求，密钥不进导出备份。
