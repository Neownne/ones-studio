// src/data/foods.js — 高频食物库（40 项）
// 数值为每单位估算值，来源标注：中国食物成分表第 6 版参考 / 包装标示 / 餐饮常见份量估算
// edible = 可食部说明；不做医疗或疗效宣称，仅用于记录与健康管理
const F = (id, name, scene, unit, kcal, protein, carb, fat, source, edible = '整份可食') => ({
  id, name, scene, perUnit: { unit, kcal, protein, carb, fat }, source, edible,
})

export const FOODS = [
  // ---- 酒店早餐 ----
  F('egg_boiled', '水煮蛋', 'hotel-breakfast', '1 个(约50g)', 72, 6.3, 0.4, 5.0, '成分表第6版', '去壳'),
  F('egg_tea', '茶叶蛋', 'hotel-breakfast', '1 个(约50g)', 75, 6.4, 0.6, 5.1, '成分表第6版', '去壳'),
  F('egg_fried', '煎蛋', 'hotel-breakfast', '1 个(约50g)', 105, 6.2, 0.5, 8.8, '含煎油估算'),
  F('egg_white', '蛋白(去黄)', 'hotel-breakfast', '1 个', 17, 3.6, 0.2, 0.1, '成分表第6版'),
  F('milk_whole', '全脂牛奶', 'hotel-breakfast', '250ml', 160, 8.0, 12.0, 8.5, '包装标示'),
  F('yogurt', '酸奶(原味)', 'hotel-breakfast', '1 杯(150g)', 110, 5.0, 15.0, 3.2, '包装标示'),
  F('soymilk', '豆浆(无糖)', 'hotel-breakfast', '250ml', 78, 7.0, 3.0, 4.0, '成分表第6版'),
  F('douhua', '豆腐脑', 'hotel-breakfast', '1 碗(250g)', 95, 7.5, 4.0, 5.0, '常见份量估算'),
  F('fried_rice', '蛋炒饭', 'hotel-breakfast', '1 份(250g)', 420, 11.0, 62.0, 14.0, '常见份量估算'),
  F('fried_noodle', '炒面', 'hotel-breakfast', '1 份(250g)', 450, 12.0, 66.0, 15.0, '常见份量估算'),
  F('stir_veg', '炒蔬菜', 'hotel-breakfast', '1 份(150g)', 120, 3.0, 8.0, 8.5, '含油估算'),
  F('sausage', '早餐香肠', 'hotel-breakfast', '1 根(30g)', 95, 4.0, 1.0, 8.2, '包装标示'),
  F('bread', '面包(白吐司)', 'hotel-breakfast', '1 片(30g)', 80, 2.5, 15.0, 1.2, '包装标示'),
  F('oatmeal', '燕麦粥', 'hotel-breakfast', '1 碗(250g)', 150, 5.0, 27.0, 2.8, '成分表第6版'),
  F('banana', '香蕉', 'hotel-breakfast', '1 根(100g)', 93, 1.1, 22.0, 0.3, '成分表第6版', '去皮'),
  F('apple', '苹果', 'hotel-breakfast', '1 个(180g)', 95, 0.4, 24.0, 0.4, '成分表第6版', '去核'),
  F('coffee_black', '黑咖啡', 'hotel-breakfast', '1 杯(250ml)', 5, 0.3, 0.8, 0.0, '估算'),

  // ---- 常点外卖 ----
  F('chicken_breast', '鸡胸肉(白切/煎)', 'takeout', '100g', 165, 31.0, 0.0, 3.6, '成分表第6版'),
  F('beef_rice', '牛肉饭', 'takeout', '1 份(400g)', 620, 28.0, 85.0, 17.0, '连锁店标示'),
  F('chicken_rice', '黄焖鸡米饭', 'takeout', '1 份(450g)', 680, 32.0, 88.0, 22.0, '常见份量估算'),
  F('lanzhou_noodle', '兰州拉面(牛肉)', 'takeout', '1 碗(500g)', 550, 26.0, 78.0, 14.0, '常见份量估算'),
  F('dumpling', '猪肉水饺', 'takeout', '10 个(250g)', 480, 20.0, 58.0, 18.0, '包装标示'),
  F('baozi', '肉包', 'takeout', '1 个(80g)', 180, 7.0, 24.0, 6.0, '常见份量估算'),
  F('salad_chicken', '鸡胸轻食沙拉', 'takeout', '1 份(300g)', 320, 30.0, 20.0, 13.0, '连锁店标示', '含酱计'),
  F('salad_veg', '蔬菜沙拉(无酱)', 'takeout', '1 份(250g)', 90, 3.0, 12.0, 3.0, '估算'),
  F('malatang', '麻辣烫(清汤/少油)', 'takeout', '1 份(500g)', 450, 24.0, 42.0, 20.0, '常见份量估算', '汤不计'),
  F('grilled_fish', '烤鱼(单人份)', 'takeout', '1 份(400g)', 620, 45.0, 18.0, 40.0, '常见份量估算', '可食部约 60%'),
  F('hotpot', '清汤火锅(单人)', 'takeout', '1 餐', 700, 42.0, 45.0, 38.0, '常见份量估算', '蘸料计入'),
  F('luosifen', '螺蛳粉', 'takeout', '1 碗(500g)', 560, 16.0, 82.0, 19.0, '包装标示'),
  F('sushi_rice', '日式肥牛饭', 'takeout', '1 份(400g)', 650, 26.0, 90.0, 20.0, '连锁店标示'),
  F('burger', '牛肉汉堡', 'takeout', '1 个(200g)', 520, 25.0, 45.0, 26.0, '连锁店标示'),
  F('sandwich', '全麦三明治', 'takeout', '1 份(180g)', 330, 18.0, 36.0, 12.0, '包装标示'),
  F('rice_ball', '便利店饭团', 'takeout', '1 个(100g)', 190, 5.0, 38.0, 2.0, '包装标示'),
  F('tofu', '豆腐(北)', 'takeout', '100g', 98, 12.2, 2.0, 4.8, '成分表第6版'),
  F('shrimp', '虾仁', 'takeout', '100g', 93, 18.6, 2.8, 0.8, '成分表第6版', '去壳'),
  F('brown_rice', '杂粮饭', 'takeout', '1 碗(150g)', 190, 4.5, 40.0, 1.2, '估算'),
  F('sweet_potato', '蒸红薯', 'takeout', '1 个(150g)', 130, 2.0, 30.0, 0.2, '成分表第6版', '去皮'),
  F('corn', '玉米(水煮)', 'takeout', '1 根(150g)', 160, 5.0, 34.0, 1.8, '成分表第6版', '可食部约 65%'),
  F('whey', '蛋白粉', 'supplement', '1 袋(15g)', 58, 11.5, 1.2, 0.8, '包装标示(15g/袋)'),

  // ---- 加餐 / 备用 ----
  F('nuts', '混合坚果', 'snack', '1 小包(25g)', 155, 5.0, 6.0, 13.0, '包装标示'),
  F('greek_yogurt', '高蛋白酸奶', 'snack', '1 杯(150g)', 120, 12.0, 8.0, 3.5, '包装标示'),
  F('protein_bar', '蛋白棒', 'snack', '1 根(60g)', 220, 20.0, 20.0, 8.0, '包装标示'),
]

export const SCENE_LABELS = {
  'hotel-breakfast': '酒店早餐',
  takeout: '外卖 / 外食',
  supplement: '补剂',
  snack: '加餐',
}

export const findFood = (id) => FOODS.find((f) => f.id === id)
export const searchFoods = (q) => {
  const s = (q || '').trim().toLowerCase()
  if (!s) return FOODS
  return FOODS.filter((f) => f.name.toLowerCase().includes(s) || (SCENE_LABELS[f.scene] || '').includes(s))
}
