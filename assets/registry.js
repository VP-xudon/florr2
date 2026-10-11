// registry.js — 资源登记表（由 scripts/build_manifest.py 生成，可手改）
// 花瓣按 wikipetal.html 真实ID升序登记；生物按 wikimod.html 真实ID序登记。
// ai / drops 为生物自定义AI与掉落物表预留接口；links 为同名生物<->卡片关联。
window.REGISTRY = {
 "version": 2,
 "source": "petals: wikipetal.html (Florr.io中文维基 新花瓣图鉴); mobs: wikimod.html (纯表格, 按真实ID序); tiles/maps: florr.io-Resources",
 "idNote": "dump 的 petals/N.svg 与 mobs/N.svg 均按各自来源的真实ID升序排列：文件 N = 来源表中“真实ID=N”的实体（花瓣 1..93 与真实ID一致，94=真实95，95..116 为二创大编号留空；生物 1..83 与页面ID一致）。realId(Petal)/id(Mob) 字段记录来源中的真实编号。",
 "note": "生物数值(HP/伤害/类型/各稀有度)已据 wikimod.html 登记；speed/size/tier/color/ai/drops 为基于类型的推算与预留接口，待手填。links 记录“同名生物<->卡片”关联。",
 "petals": [
  {
   "id": 1,
   "file": "assets/petals/1.svg",
   "name": "Basic",
   "zh": "基本",
   "realId": 1,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 10.0,
    "hp": 10.0,
    "spd": 2.5
   },
   "rarityMultipliers": {
    "common": {"dmg": 1, "hp": 1},
    "unusual": {"dmg": 3, "hp": 3},
    "rare": {"dmg": 9, "hp": 9},
    "epic": {"dmg": 27, "hp": 27},
    "legendary": {"dmg": 81, "hp": 81},
    "mythic": {"dmg": 243, "hp": 243},
    "ultra": {"dmg": 729, "hp": 729},
    "super": {"dmg": 2187, "hp": 2187},
    "eternal": {"dmg": 6561, "hp": 6561}
   },
   "wiki": {
    "common": {
     "dmg": 10.0,
     "dur": 10.0,
     "other": "",
     "cd": "2.5s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 2,
   "file": "assets/petals/2.svg",
   "name": "Light",
   "zh": "轻",
   "realId": 2,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 13.0,
    "hp": 5.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 13.0,
     "dur": 5.0,
     "other": "",
     "cd": "0.8s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 3,
   "file": "assets/petals/3.svg",
   "name": "Rock",
   "zh": "岩石",
   "realId": 3,
   "kind": "tank",
   "fanmade": false,
   "stats": {
    "dmg": 22.0,
    "hp": 30.0,
    "spd": -16
   },
   "wiki": {
    "common": {
     "dmg": 22.0,
     "dur": 30.0,
     "other": "",
     "cd": "3.0s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 4,
   "file": "assets/petals/4.svg",
   "name": "Square",
   "zh": "正方形",
   "realId": 4,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 0,
    "hp": 0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 0.0,
     "dur": 0.0,
     "other": "",
     "cd": "60.0s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 5,
   "file": "assets/petals/5.svg",
   "name": "Rose",
   "zh": "玫瑰",
   "realId": 5,
   "kind": "attack",
   "fanmade": false,
   "stats": {
    "dmg": 5.0,
    "hp": 5.0,
    "spd": -12
   },
   "wiki": {
    "common": {
     "dmg": 5.0,
     "dur": 5.0,
     "other": "治疗=7.5",
     "cd": "3.5s + 1.5s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 6,
   "file": "assets/petals/6.svg",
   "name": "Stinger",
   "zh": "刺",
   "realId": 6,
   "kind": "attack",
   "fanmade": false,
   "stats": {
    "dmg": 100.0,
    "hp": 1.0,
    "spd": -4
   },
   "wiki": {
    "common": {
     "dmg": 100.0,
     "dur": 1.0,
     "other": "",
     "cd": "10.0s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 7,
   "file": "assets/petals/7.svg",
   "name": "Iris",
   "zh": "鸢尾",
   "realId": 7,
   "kind": "attack",
   "fanmade": false,
   "stats": {
    "dmg": 5.0,
    "hp": 5.0,
    "spd": -14
   },
   "wiki": {
    "common": {
     "dmg": 5.0,
     "dur": 5.0,
     "other": "剧毒=70 (23.3/s)",
     "cd": "4.0s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 8,
   "file": "assets/petals/8.svg",
   "name": "Wing",
   "zh": "翅膀",
   "realId": 8,
   "kind": "light",
   "fanmade": false,
   "stats": {
    "dmg": 20.0,
    "hp": 10.0,
    "spd": 44
   },
   "wiki": {
    "common": {
     "dmg": 20.0,
     "dur": 10.0,
     "other": "",
     "cd": "3.0s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 9,
   "file": "assets/petals/9.svg",
   "name": "Missile",
   "zh": "导弹",
   "realId": 9,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 35.0,
    "hp": 2.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 35.0,
     "dur": 2.0,
     "other": "",
     "cd": "1.5s + 0.5s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 10,
   "file": "assets/petals/10.svg",
   "name": "Grapes",
   "zh": "葡萄",
   "realId": 10,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 3.0,
    "hp": 5.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 3.0,
     "dur": 5.0,
     "other": "子瓣数量=4/5,剧毒=25 (35.7/s)",
     "cd": "1.5s + 0.5s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 11,
   "file": "assets/petals/11.svg",
   "name": "Cactus",
   "zh": "仙人掌",
   "realId": 11,
   "kind": "thorn",
   "fanmade": false,
   "stats": {
    "dmg": 7.0,
    "hp": 15.0,
    "spd": -6
   },
   "wiki": {
    "common": {
     "dmg": 7.0,
     "dur": 15.0,
     "other": "花朵生命值=30",
     "cd": "1.0s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 12,
   "file": "assets/petals/12.svg",
   "name": "Faster",
   "zh": "更快",
   "realId": 12,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 12.0,
    "hp": 5.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 12.0,
     "dur": 5.0,
     "other": "旋转速度=+0.5 rad/s",
     "cd": "2.5s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 13,
   "file": "assets/petals/13.svg",
   "name": "Bubble",
   "zh": "泡泡",
   "realId": 13,
   "kind": "shield",
   "fanmade": false,
   "stats": {
    "dmg": 0,
    "hp": 1.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 0.0,
     "dur": 1.0,
     "other": "",
     "cd": "2.0(2.00)s + 0.7s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 14,
   "file": "assets/petals/14.svg",
   "name": "Pollen",
   "zh": "花粉",
   "realId": 14,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 38.0,
    "hp": 5.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 38.0,
     "dur": 5.0,
     "other": "",
     "cd": "2.0s + 0.5s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 15,
   "file": "assets/petals/15.svg",
   "name": "Dandelion",
   "zh": "蒲公英",
   "realId": 15,
   "kind": "utility",
   "fanmade": false,
   "stats": {
    "dmg": 8.0,
    "hp": 8.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 8.0,
     "dur": 8.0,
     "other": "持续时间=30s",
     "cd": "1.0s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 16,
   "file": "assets/petals/16.svg",
   "name": "Beetle Egg",
   "zh": "甲虫卵",
   "realId": 16,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 0,
    "hp": 1.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 0.0,
     "dur": 1.0,
     "other": "内含= 甲虫 ,生物生命值=500,生物伤害=7",
     "cd": "30.0s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 17,
   "file": "assets/petals/17.svg",
   "name": "Antennae",
   "zh": "触角",
   "realId": 17,
   "kind": "utility",
   "fanmade": false,
   "stats": {
    "dmg": 0,
    "hp": 0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 0.0,
     "dur": 0.0,
     "other": "视野=11.1%",
     "cd": ""
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 18,
   "file": "assets/petals/18.svg",
   "name": "Heavy",
   "zh": "重",
   "realId": 18,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 13.0,
    "hp": 150.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 13.0,
     "dur": 150.0,
     "other": "",
     "cd": "10.0s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 19,
   "file": "assets/petals/19.svg",
   "name": "Yin Yang",
   "zh": "阴阳",
   "realId": 19,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 10.0,
    "hp": 10.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 10.0,
     "dur": 10.0,
     "other": "",
     "cd": "2.0s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 20,
   "file": "assets/petals/20.svg",
   "name": "Web",
   "zh": "网",
   "realId": 20,
   "kind": "control",
   "fanmade": false,
   "stats": {
    "dmg": 5.0,
    "hp": 5.0,
    "spd": -2
   },
   "wiki": {
    "common": {
     "dmg": 5.0,
     "dur": 5.0,
     "other": "持续时间=10s,半径=50",
     "cd": "3.0s + 0.5s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 21,
   "file": "assets/petals/21.svg",
   "name": "Honey",
   "zh": "蜂蜜",
   "realId": 21,
   "kind": "shield",
   "fanmade": false,
   "stats": {
    "dmg": 0,
    "hp": 50.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 0.0,
     "dur": 50.0,
     "other": "最高生物稀有度= 普通",
     "cd": "2.0s + 0.5s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 22,
   "file": "assets/petals/22.svg",
   "name": "Leaf",
   "zh": "叶子",
   "realId": 22,
   "kind": "light",
   "fanmade": false,
   "stats": {
    "dmg": 16.0,
    "hp": 12.0,
    "spd": 16
   },
   "wiki": {
    "common": {
     "dmg": 16.0,
     "dur": 12.0,
     "other": "治疗=1/s",
     "cd": "1.8s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 23,
   "file": "assets/petals/23.svg",
   "name": "Salt",
   "zh": "盐",
   "realId": 23,
   "kind": "tank",
   "fanmade": false,
   "stats": {
    "dmg": 10.0,
    "hp": 10.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 10.0,
     "dur": 10.0,
     "other": "伤害反弹=100%（对于 普通 ）,20%（对于花朵）",
     "cd": "2.5s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 24,
   "file": "assets/petals/24.svg",
   "name": "Rice",
   "zh": "米",
   "realId": 24,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 4.0,
    "hp": 1.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 4.0,
     "dur": 1.0,
     "other": "",
     "cd": "0.1(0.05)s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 25,
   "file": "assets/petals/25.svg",
   "name": "Corn",
   "zh": "玉米",
   "realId": 25,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 8.0,
    "hp": 200.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 8.0,
     "dur": 200.0,
     "other": "",
     "cd": "7.0s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 26,
   "file": "assets/petals/26.svg",
   "name": "Sand",
   "zh": "沙子",
   "realId": 26,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 5.0,
    "hp": 1.2,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 5.0,
     "dur": 1.2,
     "other": "子瓣数量=4/5",
     "cd": "1.5s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 27,
   "file": "assets/petals/27.svg",
   "name": "Pincer",
   "zh": "螫针",
   "realId": 27,
   "kind": "attack",
   "fanmade": false,
   "stats": {
    "dmg": 5.0,
    "hp": 5.0,
    "spd": -2
   },
   "wiki": {
    "common": {
     "dmg": 5.0,
     "dur": 5.0,
     "other": "剧毒=15 (20/s),持续时间=0.8s",
     "cd": "2.5s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 28,
   "file": "assets/petals/28.svg",
   "name": "Yucca",
   "zh": "丝兰",
   "realId": 28,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 5.0,
    "hp": 10.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 5.0,
     "dur": 10.0,
     "other": "治疗=2.2/s",
     "cd": "2.5s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 29,
   "file": "assets/petals/29.svg",
   "name": "Magnet",
   "zh": "磁铁",
   "realId": 29,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 1.0,
    "hp": 30.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 1.0,
     "dur": 30.0,
     "other": "拾取距离=+0",
     "cd": "1.5s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 30,
   "file": "assets/petals/30.svg",
   "name": "Yggdrasil",
   "zh": "世界树之叶",
   "realId": 30,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 0,
    "hp": 10.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 0.0,
     "dur": 10.0,
     "other": "治疗=100%,无法复活=13.5h",
     "cd": "5.0s + 5.0s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 31,
   "file": "assets/petals/31.svg",
   "name": "Starfish",
   "zh": "海星",
   "realId": 31,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 5.0,
    "hp": 7.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 5.0,
     "dur": 7.0,
     "other": "治疗=2.2/s",
     "cd": "1.5s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 32,
   "file": "assets/petals/32.svg",
   "name": "Pearl",
   "zh": "珍珠",
   "realId": 32,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 20.0,
    "hp": 50.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 20.0,
     "dur": 50.0,
     "other": "",
     "cd": "4.0s + 0.5s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 33,
   "file": "assets/petals/33.svg",
   "name": "Lightning",
   "zh": "闪电",
   "realId": 33,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 0,
    "hp": 20.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 0.0,
     "dur": 20.0,
     "other": "闪电=12,连锁=2",
     "cd": "2.5s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 34,
   "file": "assets/petals/34.svg",
   "name": "Jelly",
   "zh": "果冻",
   "realId": 34,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 10.0,
    "hp": 10.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 10.0,
     "dur": 10.0,
     "other": "击退=300",
     "cd": "10.0s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 35,
   "file": "assets/petals/35.svg",
   "name": "Claw",
   "zh": "爪子",
   "realId": 35,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 5.0,
    "hp": 10.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 5.0,
     "dur": 10.0,
     "other": "额外伤害=100",
     "cd": "3.5s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 36,
   "file": "assets/petals/36.svg",
   "name": "Shell",
   "zh": "贝壳",
   "realId": 36,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 5.0,
    "hp": 25.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 5.0,
     "dur": 25.0,
     "other": "护盾=7",
     "cd": "3.5s + 1.5s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 37,
   "file": "assets/petals/37.svg",
   "name": "Cutter",
   "zh": "锯齿",
   "realId": 37,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 0,
    "hp": 0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 0.0,
     "dur": 0.0,
     "other": "身体伤害=27",
     "cd": ""
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 38,
   "file": "assets/petals/38.svg",
   "name": "Dahlia",
   "zh": "大丽花",
   "realId": 38,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 1.7,
    "hp": 1.7,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 1.7,
     "dur": 1.7,
     "other": "治疗=1.2,子瓣数量=3/4",
     "cd": "1.5s + 1.5s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 39,
   "file": "assets/petals/39.svg",
   "name": "Uranium",
   "zh": "铀",
   "realId": 39,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 0,
    "hp": 75.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 0.0,
     "dur": 75.0,
     "other": "剧毒=50/s",
     "cd": "2.5s + 1.5s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 40,
   "file": "assets/petals/40.svg",
   "name": "Sponge",
   "zh": "海绵",
   "realId": 40,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 0,
    "hp": 0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 0.0,
     "dur": 0.0,
     "other": "周期=3s,花朵生命值=-50%",
     "cd": "2.5s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 41,
   "file": "assets/petals/41.svg",
   "name": "Soil",
   "zh": "土",
   "realId": 41,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 10.0,
    "hp": 10.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 10.0,
     "dur": 10.0,
     "other": "花朵生命值=50,花朵半径=+10",
     "cd": "2.5s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 42,
   "file": "assets/petals/42.svg",
   "name": "Fang",
   "zh": "尖牙",
   "realId": 42,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 15.0,
    "hp": 1.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 15.0,
     "dur": 1.0,
     "other": "伤害治疗=35%",
     "cd": "3.5s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 43,
   "file": "assets/petals/43.svg",
   "name": "Third Eye",
   "zh": "第三只眼",
   "realId": 43,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 0,
    "hp": 0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 0.0,
     "dur": 0.0,
     "other": "攻击距离=+0",
     "cd": ""
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 44,
   "file": "assets/petals/44.svg",
   "name": "Peas",
   "zh": "豌豆",
   "realId": 44,
   "kind": "attack",
   "fanmade": false,
   "stats": {
    "dmg": 15.0,
    "hp": 5.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 15.0,
     "dur": 5.0,
     "other": "子瓣数量=4/5",
     "cd": "1.5s + 0.5s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 45,
   "file": "assets/petals/45.svg",
   "name": "Mysterious Stick",
   "zh": "神秘的树枝",
   "realId": 45,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 0,
    "hp": 0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 0.0,
     "dur": 0.0,
     "other": "内含=4x 沙尘暴 ,生物生命值=30,生物伤害=30,持续时间=20s",
     "cd": "4.0s + 5.0s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 46,
   "file": "assets/petals/46.svg",
   "name": "Clover",
   "zh": "幸运草",
   "realId": 46,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 10.0,
    "hp": 10.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 10.0,
     "dur": 10.0,
     "other": "幸运值=+0.1",
     "cd": "2.5s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 47,
   "file": "assets/petals/47.svg",
   "name": "Mysterious Powder",
   "zh": "神秘的粉末",
   "realId": 47,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 0,
    "hp": 10.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 0.0,
     "dur": 10.0,
     "other": "移动速度=+25%,最高生物稀有度= 普通",
     "cd": "4.0s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 48,
   "file": "assets/petals/48.svg",
   "name": "Air",
   "zh": "空气",
   "realId": 48,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 0,
    "hp": 0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 0.0,
     "dur": 0.0,
     "other": "花朵半径=+8",
     "cd": ""
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 49,
   "file": "assets/petals/49.svg",
   "name": "Basil",
   "zh": "罗勒",
   "realId": 49,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 0,
    "hp": 0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 0.0,
     "dur": 0.0,
     "other": "治疗增益=+20%",
     "cd": "2.5s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 50,
   "file": "assets/petals/50.svg",
   "name": "Orange",
   "zh": "橙子",
   "realId": 50,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 8.0,
    "hp": 6.7,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 8.0,
     "dur": 6.7,
     "other": "子瓣数量=3/4",
     "cd": "3.5s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 51,
   "file": "assets/petals/51.svg",
   "name": "Ant Egg",
   "zh": "蚁卵",
   "realId": 51,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 0,
    "hp": 1.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 0.0,
     "dur": 1.0,
     "other": "子瓣数量=4/5,内含=4/5x 兵蚁 ,生物生命值=250,生物伤害=6",
     "cd": "60.0s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 52,
   "file": "assets/petals/52.svg",
   "name": "Poo",
   "zh": "便便",
   "realId": 52,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 5.0,
    "hp": 5.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 5.0,
     "dur": 5.0,
     "other": "生物仇恨距离=-25%",
     "cd": "2.5s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 53,
   "file": "assets/petals/53.svg",
   "name": "Mysterious Relic",
   "zh": "神秘的遗物",
   "realId": 53,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 0,
    "hp": 0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 0.0,
     "dur": 0.0,
     "other": "花朵生命值=+10%",
     "cd": ""
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 54,
   "file": "assets/petals/54.svg",
   "name": "",
   "zh": "莲花",
   "realId": 54,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 0,
    "hp": 0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 0.0,
     "dur": 0.0,
     "other": "剧毒抗性=14/s",
     "cd": "2.5s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 55,
   "file": "assets/petals/55.svg",
   "name": "Light Bulb",
   "zh": "灯泡",
   "realId": 55,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 5.0,
    "hp": 10.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 5.0,
     "dur": 10.0,
     "other": "半径=300",
     "cd": "1.0s + 0.5s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 56,
   "file": "assets/petals/56.svg",
   "name": "Cotton",
   "zh": "棉花",
   "realId": 56,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 0,
    "hp": 2.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 0.0,
     "dur": 2.0,
     "other": "",
     "cd": "1.5s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 57,
   "file": "assets/petals/57.svg",
   "name": "Carrot",
   "zh": "胡萝卜",
   "realId": 57,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 18.0,
    "hp": 18.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 18.0,
     "dur": 18.0,
     "other": "",
     "cd": "1.0s + 0.5s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 58,
   "file": "assets/petals/58.svg",
   "name": "Bone",
   "zh": "骨头",
   "realId": 58,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 14.0,
    "hp": 10.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 14.0,
     "dur": 10.0,
     "other": "护甲=10",
     "cd": "2.5s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 59,
   "file": "assets/petals/59.svg",
   "name": "Plank",
   "zh": "木板",
   "realId": 59,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 18.0,
    "hp": 15.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 18.0,
     "dur": 15.0,
     "other": "",
     "cd": "2.5s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 60,
   "file": "assets/petals/60.svg",
   "name": "Tomato",
   "zh": "番茄",
   "realId": 60,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 5.0,
    "hp": 10.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 5.0,
     "dur": 10.0,
     "other": "",
     "cd": "2.5s + 1.0s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 61,
   "file": "assets/petals/61.svg",
   "name": "Dark Mark",
   "zh": "暗黑标记",
   "realId": 61,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 0,
    "hp": 10.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 0.0,
     "dur": 10.0,
     "other": "被标记者将在冥界被困5分钟。=",
     "cd": "1.0s + 960.0s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 62,
   "file": "assets/petals/62.svg",
   "name": "Rubber",
   "zh": "橡胶",
   "realId": 62,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 1.0,
    "hp": 30.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 1.0,
     "dur": 30.0,
     "other": "击退=+0.3",
     "cd": "2.5s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 63,
   "file": "assets/petals/63.svg",
   "name": "Blood Stinger",
   "zh": "血刺",
   "realId": 63,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 100.0,
    "hp": 1.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 100.0,
     "dur": 1.0,
     "other": "自我伤害=5",
     "cd": "7.5s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 64,
   "file": "assets/petals/64.svg",
   "name": "Bur",
   "zh": "刺果",
   "realId": 64,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 5.0,
    "hp": 5.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 5.0,
     "dur": 5.0,
     "other": "护甲减益=-1.5,持续时间=3s",
     "cd": "2.0s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 65,
   "file": "assets/petals/65.svg",
   "name": "Root",
   "zh": "根",
   "realId": 65,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 0,
    "hp": 0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 0.0,
     "dur": 0.0,
     "other": "花朵护甲=2.5,间隔=2s,上限=10",
     "cd": "5.0s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 66,
   "file": "assets/petals/66.svg",
   "name": "Ankh",
   "zh": "安卡",
   "realId": 66,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 0,
    "hp": 10.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 0.0,
     "dur": 10.0,
     "other": "",
     "cd": "256.0s + 0.5s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 67,
   "file": "assets/petals/67.svg",
   "name": "Dice",
   "zh": "骰子",
   "realId": 67,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 10.0,
    "hp": 10.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 10.0,
     "dur": 10.0,
     "other": "",
     "cd": "2.5s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 68,
   "file": "assets/petals/68.svg",
   "name": "Talisman of Evasion",
   "zh": "闪避护符",
   "realId": 68,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 10.0,
    "hp": 10.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 10.0,
     "dur": 10.0,
     "other": "花朵闪避=+3%",
     "cd": "2.5s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 69,
   "file": "assets/petals/69.svg",
   "name": "Battery",
   "zh": "电池",
   "realId": 69,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 0,
    "hp": 0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 0.0,
     "dur": 0.0,
     "other": "闪电=12,连锁=2,充能=3",
     "cd": "2.5s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 70,
   "file": "assets/petals/70.svg",
   "name": "Amulet",
   "zh": "护符",
   "realId": 70,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 0,
    "hp": 10.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 0.0,
     "dur": 10.0,
     "other": "过量治疗转化=+5%",
     "cd": "2.0s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 71,
   "file": "assets/petals/71.svg",
   "name": "Compass",
   "zh": "指南针",
   "realId": 71,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 1.0,
    "hp": 40.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 1.0,
     "dur": 40.0,
     "other": "已损坏。=",
     "cd": "2.5s + 9.0s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 72,
   "file": "assets/petals/72.svg",
   "name": "Disc",
   "zh": "圆盘",
   "realId": 72,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 0,
    "hp": 0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 0.0,
     "dur": 0.0,
     "other": "碰撞伤害抗性=+9%",
     "cd": ""
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 73,
   "file": "assets/petals/73.svg",
   "name": "Shovel",
   "zh": "铲子",
   "realId": 73,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 0,
    "hp": 0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 0.0,
     "dur": 0.0,
     "other": "",
     "cd": "15.0(15.00)s + 2.0s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 74,
   "file": "assets/petals/74.svg",
   "name": "Coin",
   "zh": "硬币",
   "realId": 74,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 15.0,
    "hp": 10.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 15.0,
     "dur": 10.0,
     "other": "",
     "cd": "2.5s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 75,
   "file": "assets/petals/75.svg",
   "name": "Poker Chip",
   "zh": "扑克筹码",
   "realId": 75,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 7.0,
    "hp": 1.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 7.0,
     "dur": 1.0,
     "other": "闪避=90%",
     "cd": "2.5s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 76,
   "file": "assets/petals/76.svg",
   "name": "Card",
   "zh": "纸牌",
   "realId": 76,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 5.0,
    "hp": 30.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 5.0,
     "dur": 30.0,
     "other": "",
     "cd": "2.5s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 77,
   "file": "assets/petals/77.svg",
   "name": "Moon Rock",
   "zh": "月石",
   "realId": 77,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 3.0,
    "hp": 5000.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 3.0,
     "dur": 5000.0,
     "other": "",
     "cd": "100.0s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 78,
   "file": "assets/petals/78.svg",
   "name": "Privet Berry",
   "zh": "女贞子",
   "realId": 78,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 0,
    "hp": 0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 0.0,
     "dur": 0.0,
     "other": "额外剧毒=0.2s",
     "cd": "4.0(4.00)s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 79,
   "file": "assets/petals/79.svg",
   "name": "Glass",
   "zh": "玻璃",
   "realId": 79,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 22.0,
    "hp": 0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 22.0,
     "dur": 0.0,
     "other": "间隔=1s",
     "cd": "2.5s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 80,
   "file": "assets/petals/80.svg",
   "name": "Corruption",
   "zh": "腐化",
   "realId": 80,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 0,
    "hp": 0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 0.0,
     "dur": 0.0,
     "other": "无法卸下。=,死亡时丢失。=",
     "cd": ""
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 81,
   "file": "assets/petals/81.svg",
   "name": "Mana Orb",
   "zh": "魔法球",
   "realId": 81,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 0,
    "hp": 25.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 0.0,
     "dur": 25.0,
     "other": "魔力=8.2, 魔法 基础魔力上限 =57.8,允许寻找魔法花瓣。=",
     "cd": "2.5s + 1.5s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 82,
   "file": "assets/petals/82.svg",
   "name": "Blueberries",
   "zh": "蓝莓",
   "realId": 82,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 30.0,
    "hp": 5.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 30.0,
     "dur": 5.0,
     "other": "子瓣数量=4/5",
     "cd": "1.2 + 0.5s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 83,
   "file": "assets/petals/83.svg",
   "name": "Magic Cotton",
   "zh": "魔法棉花",
   "realId": 83,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 0,
    "hp": 0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 0.0,
     "dur": 0.0,
     "other": "伤害吸收=0.5/ 魔法 mana",
     "cd": "1.5s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 84,
   "file": "assets/petals/84.svg",
   "name": "Magic Stinger",
   "zh": "魔法刺",
   "realId": 84,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 100.0,
    "hp": 1.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 100.0,
     "dur": 1.0,
     "other": "",
     "cd": "10 + 1.0s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 85,
   "file": "assets/petals/85.svg",
   "name": "Magic Leaf",
   "zh": "魔法叶子",
   "realId": 85,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 16.0,
    "hp": 12.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 16.0,
     "dur": 12.0,
     "other": "魔力=2.5/s,基础魔力上限=57.8",
     "cd": "1.8s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 86,
   "file": "assets/petals/86.svg",
   "name": "Magic Cactus",
   "zh": "魔法仙人掌",
   "realId": 86,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 7.0,
    "hp": 15.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 7.0,
     "dur": 15.0,
     "other": "魔力上限=+115.5",
     "cd": "1.0s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 87,
   "file": "assets/petals/87.svg",
   "name": "Magic Eye",
   "zh": "魔法之眼",
   "realId": 87,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 0,
    "hp": 0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 0.0,
     "dur": 0.0,
     "other": "闪电=3.3/ 魔法 mana ,连锁=7",
     "cd": "1.0s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 88,
   "file": "assets/petals/88.svg",
   "name": "Magic Missile",
   "zh": "魔法导弹",
   "realId": 88,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 35.0,
    "hp": 2.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 35.0,
     "dur": 2.0,
     "other": "",
     "cd": "5.4 + 0.2s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 89,
   "file": "assets/petals/89.svg",
   "name": "Magic Stick",
   "zh": "魔法树枝",
   "realId": 89,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 0,
    "hp": 0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 0.0,
     "dur": 0.0,
     "other": "内含= 沙尘暴 ,生成消耗=20 魔法 mana ,生物生命值=30,生物伤害=30,持续时间=20s",
     "cd": "4.0s + 0.5s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 90,
   "file": "assets/petals/90.svg",
   "name": "Coral",
   "zh": "珊瑚",
   "realId": 90,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 11.0,
    "hp": 1.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 11.0,
     "dur": 1.0,
     "other": "",
     "cd": "1.5s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 91,
   "file": "assets/petals/91.svg",
   "name": "Magic Bubble",
   "zh": "魔法泡泡",
   "realId": 91,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 0,
    "hp": 0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 0.0,
     "dur": 0.0,
     "other": "",
     "cd": "5 + 2.0(2.00)s + 0.7s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 92,
   "file": "assets/petals/92.svg",
   "name": "Nazar Amulet",
   "zh": "邪眼护符",
   "realId": 92,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 0,
    "hp": 0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 0.0,
     "dur": 0.0,
     "other": "充能=3",
     "cd": "60.0(60.00)s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 93,
   "file": "assets/petals/93.svg",
   "name": "Mimic",
   "zh": "拟态",
   "realId": 93,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 0,
    "hp": 0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 0.0,
     "dur": 0.0,
     "other": "",
     "cd": ""
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 94,
   "file": "assets/petals/94.svg",
   "name": "Fragment",
   "zh": "碎片",
   "realId": 94,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 1.0,
    "hp": 1.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 1.0,
     "dur": 1.0,
     "other": "",
     "cd": "10.0s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 95,
   "file": "assets/petals/95.svg",
   "name": "Mecha Missile",
   "zh": "机械导弹",
   "realId": 95,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 35.0,
    "hp": 2.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 35.0,
     "dur": 2.0,
     "other": "",
     "cd": "1.5s + 0.5s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 96,
   "file": "assets/petals/96.svg",
   "name": "Wax",
   "zh": "蜂蜡",
   "realId": 96,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 0,
    "hp": 1000.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 0.0,
     "dur": 1000.0,
     "other": "半径=30",
     "cd": "30.0s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 97,
   "file": "assets/petals/97.svg",
   "name": "Golden Leaf",
   "zh": "黄金之叶",
   "realId": 97,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 16.0,
    "hp": 12.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 16.0,
     "dur": 12.0,
     "other": "冷却时间=-2.5%",
     "cd": "2.5s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 98,
   "file": "assets/petals/98.svg",
   "name": "Cogwheel",
   "zh": "齿轮",
   "realId": 98,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 19.0,
    "hp": 13.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 19.0,
     "dur": 13.0,
     "other": "",
     "cd": "2.5s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 99,
   "file": "assets/petals/99.svg",
   "name": "Monstera",
   "zh": "龟背竹",
   "realId": 99,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 0,
    "hp": 75.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 0.0,
     "dur": 75.0,
     "other": "治疗=1.4/s",
     "cd": "2.5s + 0.5s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 100,
   "file": "assets/petals/100.svg",
   "name": "Mecha Antennae",
   "zh": "机械触角",
   "realId": 100,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 0,
    "hp": 0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 0.0,
     "dur": 0.0,
     "other": "激活制导=机械导弹（ 普通 ）,视野=7.8%",
     "cd": ""
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 101,
   "file": "assets/petals/101.svg",
   "name": "Laser",
   "zh": "激光器",
   "realId": 101,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 5.0,
    "hp": 10.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 5.0,
     "dur": 10.0,
     "other": "伤害=50/s (lightning)",
     "cd": "5.0s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 102,
   "file": "assets/petals/102.svg",
   "name": "Domino",
   "zh": "多米诺骨牌",
   "realId": 102,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 0,
    "hp": 16.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 0.0,
     "dur": 16.0,
     "other": "",
     "cd": "1.0s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 103,
   "file": "assets/petals/103.svg",
   "name": "Bandage",
   "zh": "绷带",
   "realId": 103,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 0,
    "hp": 0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 0.0,
     "dur": 0.0,
     "other": "死亡延缓=1.5s,无法复活=30s,身体伤害=-75%",
     "cd": ""
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 104,
   "file": "assets/petals/104.svg",
   "name": "Pharaoh's Crown",
   "zh": "法老之冠",
   "realId": 104,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 0,
    "hp": 0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 0.0,
     "dur": 0.0,
     "other": "内含=甲虫（ 神话 ）,持续时间=6s",
     "cd": "1.0s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 105,
   "file": "assets/petals/105.svg",
   "name": "Totem",
   "zh": "图腾",
   "realId": 105,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 0,
    "hp": 0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 0.0,
     "dur": 0.0,
     "other": "持续时间=10s,治疗=1/s",
     "cd": "2.5s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 106,
   "file": "assets/petals/106.svg",
   "name": "Triangle",
   "zh": "三角形",
   "realId": 106,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 5.0,
    "hp": 10.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 5.0,
     "dur": 10.0,
     "other": "",
     "cd": "2.0s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 107,
   "file": "assets/petals/107.svg",
   "name": "Electric Web",
   "zh": "电网",
   "realId": 107,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 5.0,
    "hp": 5.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 5.0,
     "dur": 5.0,
     "other": "伤害=5/s (lightning) ,持续时间=10s,半径=50",
     "cd": "3.0s + 0.5s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 108,
   "file": "assets/petals/108.svg",
   "name": "Blood Sacrifice",
   "zh": "血祭",
   "realId": 108,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 0,
    "hp": 0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 0.0,
     "dur": 0.0,
     "other": "生成稀有度= 普通 ,使用时消耗。=",
     "cd": "10.0s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 109,
   "file": "assets/petals/109.svg",
   "name": "Sawblade",
   "zh": "锯片",
   "realId": 109,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 40.0,
    "hp": 25.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 40.0,
     "dur": 25.0,
     "other": "",
     "cd": "2.5s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 110,
   "file": "assets/petals/110.svg",
   "name": "Clay",
   "zh": "黏土",
   "realId": 110,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 5.0,
    "hp": 10.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 5.0,
     "dur": 10.0,
     "other": "",
     "cd": "2.0s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 111,
   "file": "assets/petals/111.svg",
   "name": "Dust",
   "zh": "灰尘",
   "realId": 111,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 4.3,
    "hp": 1.7,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 4.3,
     "dur": 1.7,
     "other": "",
     "cd": "0.8s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 112,
   "file": "assets/petals/112.svg",
   "name": "Broccoli",
   "zh": "西兰花",
   "realId": 112,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 10.0,
    "hp": 15.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 10.0,
     "dur": 15.0,
     "other": "导弹=3,导弹耐久=3.3,导弹伤害=5",
     "cd": "2.8s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 113,
   "file": "assets/petals/113.svg",
   "name": "Lentil",
   "zh": "小扁豆",
   "realId": 113,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 13.0,
    "hp": 12.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 13.0,
     "dur": 12.0,
     "other": "花瓣吸引范围=+8",
     "cd": "2.0s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 114,
   "file": "assets/petals/114.svg",
   "name": "Dead Leaf",
   "zh": "枯叶",
   "realId": 114,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 16.0,
    "hp": 12.0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 16.0,
     "dur": 12.0,
     "other": "花瓣耐久=+0%,冷却时间=+5%",
     "cd": "1.8s"
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 115,
   "file": "assets/petals/115.svg",
   "name": "Soul Splitter",
   "zh": "灵魂分裂",
   "realId": 115,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 0,
    "hp": 0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 0.0,
     "dur": 0.0,
     "other": "",
     "cd": ""
    }
   },
   "identified": true,
   "note": ""
  },
  {
   "id": 116,
   "file": "assets/petals/116.svg",
   "name": "Paranormal Goggles",
   "zh": "超自然护目镜",
   "realId": 116,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 0,
    "hp": 0,
    "spd": 0
   },
   "wiki": {
    "common": {
     "dmg": 0.0,
     "dur": 0.0,
     "other": "视野=-20%,最高生物稀有度= 普通",
     "cd": ""
    }
   },
   "identified": true,
   "note": ""
  }
 ],
 "mobs": [
  {
   "id": 1,
   "file": "assets/mobs/1.svg",
   "name": "Rock",
   "zh": "岩石",
   "biome": "",
   "hp": 10,
   "dmg": 0,
   "speed": 0,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "障碍型生物",
   "desc": "A rock. It doesn't do much. （一块石头，干不了什么事情。）",
   "spawn": "Something mountain-like appears in the distance... （花草之上，隐约浮现出一座如山峦般的巨物……）",
   "rarities": {
    "普通": {
     "hp": 10,
     "dmg": 0,
     "exp": 1,
     "type": "障碍型生物"
    },
    "罕见": {
     "hp": 30,
     "dmg": 0,
     "exp": 1,
     "type": "障碍型生物"
    },
    "稀有": {
     "hp": 90,
     "dmg": 0,
     "exp": 3,
     "type": "障碍型生物"
    },
    "史诗": {
     "hp": 270,
     "dmg": 0,
     "exp": 22,
     "type": "障碍型生物"
    },
    "传奇": {
     "hp": 810,
     "dmg": 0,
     "exp": 206,
     "type": "障碍型生物"
    },
    "神话": {
     "hp": 2430,
     "dmg": 0,
     "exp": 3100,
     "type": "障碍型生物"
    },
    "究极": {
     "hp": 7290,
     "dmg": 0,
     "exp": 131000,
     "type": "障碍型生物"
    },
    "超级": {
     "hp": 21870,
     "dmg": 0,
     "exp": 6800000,
     "type": "障碍型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "障碍型生物"
    },
    "唯一": {
     "hp": 65610,
     "dmg": 0,
     "exp": 6800000,
     "type": "障碍型生物"
    }
   },
   "ai": {
    "aggro": false,
    "chase": false,
    "flee": false,
    "retaliate": false,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 2,
   "file": "assets/mobs/2.svg",
   "name": "Cactus",
   "zh": "仙人掌",
   "biome": "",
   "hp": 35,
   "dmg": 0,
   "speed": 0,
   "size": 20,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "障碍型生物",
   "desc": "Avoid touching it, it hurts. （不要碰，它的刺很疼。）",
   "spawn": "A tower of thorn rises in the sand... （沙海之中，一座荆棘塔拔地而起破土擎天……）",
   "rarities": {
    "普通": {
     "hp": 35,
     "dmg": 0,
     "exp": 1,
     "type": "障碍型生物"
    },
    "罕见": {
     "hp": 105,
     "dmg": 0,
     "exp": 1,
     "type": "障碍型生物"
    },
    "稀有": {
     "hp": 315,
     "dmg": 0,
     "exp": 5,
     "type": "障碍型生物"
    },
    "史诗": {
     "hp": 945,
     "dmg": 0,
     "exp": 37,
     "type": "障碍型生物"
    },
    "传奇": {
     "hp": 2835,
     "dmg": 0,
     "exp": 339,
     "type": "障碍型生物"
    },
    "神话": {
     "hp": 8505,
     "dmg": 0,
     "exp": 4000,
     "type": "障碍型生物"
    },
    "究极": {
     "hp": 25515,
     "dmg": 0,
     "exp": 230000,
     "type": "障碍型生物"
    },
    "超级": {
     "hp": 76545,
     "dmg": 0,
     "exp": 9300000,
     "type": "障碍型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "障碍型生物"
    },
    "唯一": {
     "hp": 229635,
     "dmg": 0,
     "exp": 9300000,
     "type": "障碍型生物"
    }
   },
   "ai": {
    "aggro": false,
    "chase": false,
    "flee": false,
    "retaliate": false,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 3,
   "file": "assets/mobs/3.svg",
   "name": "Ladybug",
   "zh": "瓢虫",
   "biome": "",
   "hp": 10,
   "dmg": 0,
   "speed": 35,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "被动型生物",
   "desc": "Cute and harmless. （可爱而无害。）",
   "spawn": "A Super Ladybug has spawned somewhere! （一个超级瓢虫在某处生成了！）",
   "rarities": {
    "普通": {
     "hp": 10,
     "dmg": 0,
     "exp": 1,
     "type": "被动型生物"
    },
    "罕见": {
     "hp": 30,
     "dmg": 0,
     "exp": 2,
     "type": "被动型生物"
    },
    "稀有": {
     "hp": 90,
     "dmg": 0,
     "exp": 5,
     "type": "中立型生物"
    },
    "史诗": {
     "hp": 270,
     "dmg": 0,
     "exp": 41,
     "type": "中立型生物"
    },
    "传奇": {
     "hp": 810,
     "dmg": 0,
     "exp": 379,
     "type": "中立型生物"
    },
    "神话": {
     "hp": 2430,
     "dmg": 0,
     "exp": 5200,
     "type": "中立型生物"
    },
    "究极": {
     "hp": 7290,
     "dmg": 0,
     "exp": 260000,
     "type": "中立型生物"
    },
    "超级": {
     "hp": 21870,
     "dmg": 0,
     "exp": 13000000,
     "type": "中立型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "中立型生物"
    },
    "唯一": {
     "hp": 65610,
     "dmg": 0,
     "exp": 13000000,
     "type": "中立型生物"
    }
   },
   "ai": {
    "aggro": false,
    "chase": false,
    "flee": true,
    "retaliate": false,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 4,
   "file": "assets/mobs/4.svg",
   "name": "Bee",
   "zh": "蜜蜂",
   "biome": "",
   "hp": 50,
   "dmg": 0,
   "speed": 35,
   "size": 22,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "被动型生物",
   "desc": "It stings. Don't touch it. （会蜇人，别碰它。）",
   "spawn": "A Super Bee has spawned somewhere! （一个超级蜜蜂在某处生成了！）",
   "rarities": {
    "普通": {
     "hp": 50,
     "dmg": 0,
     "exp": 1,
     "type": "被动型生物"
    },
    "罕见": {
     "hp": 150,
     "dmg": 0,
     "exp": 1,
     "type": "被动型生物"
    },
    "稀有": {
     "hp": 450,
     "dmg": 0,
     "exp": 5,
     "type": "中立型生物"
    },
    "史诗": {
     "hp": 1350,
     "dmg": 0,
     "exp": 44,
     "type": "中立型生物"
    },
    "传奇": {
     "hp": 4050,
     "dmg": 0,
     "exp": 405,
     "type": "中立型生物"
    },
    "神话": {
     "hp": 12150,
     "dmg": 0,
     "exp": 5900,
     "type": "中立型生物"
    },
    "究极": {
     "hp": 36450,
     "dmg": 0,
     "exp": 266000,
     "type": "中立型生物"
    },
    "超级": {
     "hp": 109350,
     "dmg": 0,
     "exp": 13000000,
     "type": "中立型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "中立型生物"
    },
    "唯一": {
     "hp": 328050,
     "dmg": 0,
     "exp": 13000000,
     "type": "中立型生物"
    }
   },
   "ai": {
    "aggro": false,
    "chase": false,
    "flee": true,
    "retaliate": false,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 5,
   "file": "assets/mobs/5.svg",
   "name": "Baby Ant",
   "zh": "幼蚁",
   "biome": "",
   "hp": 10,
   "dmg": 0,
   "speed": 35,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "被动型生物",
   "desc": "Weak and defenseless, but big dreams. （虽软弱无力，却有远大的梦想。）",
   "spawn": "A Super Baby Ant has spawned somewhere! （一个超级幼蚁在某处生成了！）",
   "rarities": {
    "普通": {
     "hp": 10,
     "dmg": 0,
     "exp": 1,
     "type": "被动型生物"
    },
    "罕见": {
     "hp": 30,
     "dmg": 0,
     "exp": 2,
     "type": "被动型生物"
    },
    "稀有": {
     "hp": 90,
     "dmg": 0,
     "exp": 9,
     "type": "被动型生物"
    },
    "史诗": {
     "hp": 270,
     "dmg": 0,
     "exp": 67,
     "type": "被动型生物"
    },
    "传奇": {
     "hp": 810,
     "dmg": 0,
     "exp": 615,
     "type": "被动型生物"
    },
    "神话": {
     "hp": 2430,
     "dmg": 0,
     "exp": 8200,
     "type": "被动型生物"
    },
    "究极": {
     "hp": 7290,
     "dmg": 0,
     "exp": 420000,
     "type": "被动型生物"
    },
    "超级": {
     "hp": 21870,
     "dmg": 0,
     "exp": 20000000,
     "type": "被动型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "被动型生物"
    },
    "唯一": {
     "hp": 65610,
     "dmg": 0,
     "exp": 20000000,
     "type": "被动型生物"
    }
   },
   "ai": {
    "aggro": false,
    "chase": false,
    "flee": true,
    "retaliate": false,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 6,
   "file": "assets/mobs/6.svg",
   "name": "Worker Ant",
   "zh": "工蚁",
   "biome": "",
   "hp": 10,
   "dmg": 0,
   "speed": 45,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "中立型生物",
   "desc": "It's a bit temperamental, probably from working all the time. （脾气有点暴躁，可能是一直在工作的缘故。）",
   "spawn": "A Super Worker Ant has spawned somewhere! （一个超级工蚁在某处生成了！）",
   "rarities": {
    "普通": {
     "hp": 10,
     "dmg": 0,
     "exp": 1,
     "type": "中立型生物"
    },
    "罕见": {
     "hp": 30,
     "dmg": 0,
     "exp": 1,
     "type": "中立型生物"
    },
    "稀有": {
     "hp": 90,
     "dmg": 0,
     "exp": 4,
     "type": "中立型生物"
    },
    "史诗": {
     "hp": 270,
     "dmg": 0,
     "exp": 31,
     "type": "中立型生物"
    },
    "传奇": {
     "hp": 810,
     "dmg": 0,
     "exp": 279,
     "type": "中立型生物"
    },
    "神话": {
     "hp": 2430,
     "dmg": 0,
     "exp": 4100,
     "type": "中立型生物"
    },
    "究极": {
     "hp": 7290,
     "dmg": 0,
     "exp": 184000,
     "type": "中立型生物"
    },
    "超级": {
     "hp": 21870,
     "dmg": 0,
     "exp": 9300000,
     "type": "中立型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "中立型生物"
    },
    "唯一": {
     "hp": 65610,
     "dmg": 0,
     "exp": 9300000,
     "type": "中立型生物"
    }
   },
   "ai": {
    "aggro": false,
    "chase": false,
    "flee": false,
    "retaliate": true,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 7,
   "file": "assets/mobs/7.svg",
   "name": "Soldier Ant",
   "zh": "兵蚁",
   "biome": "",
   "hp": 10,
   "dmg": 0,
   "speed": 60,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "敌对型生物",
   "desc": "It's got wings and it's ready to use them. （它有翅膀，并时刻准备着使用它们。）",
   "spawn": "A Super Soldier Ant has spawned somewhere! （一个超级兵蚁在某处生成了！）",
   "rarities": {
    "普通": {
     "hp": 10,
     "dmg": 0,
     "exp": 1,
     "type": "敌对型生物"
    },
    "罕见": {
     "hp": 30,
     "dmg": 0,
     "exp": 2,
     "type": "敌对型生物"
    },
    "稀有": {
     "hp": 90,
     "dmg": 0,
     "exp": 6,
     "type": "敌对型生物"
    },
    "史诗": {
     "hp": 270,
     "dmg": 0,
     "exp": 44,
     "type": "敌对型生物"
    },
    "传奇": {
     "hp": 810,
     "dmg": 0,
     "exp": 400,
     "type": "敌对型生物"
    },
    "神话": {
     "hp": 2430,
     "dmg": 0,
     "exp": 5400,
     "type": "敌对型生物"
    },
    "究极": {
     "hp": 7290,
     "dmg": 0,
     "exp": 276000,
     "type": "敌对型生物"
    },
    "超级": {
     "hp": 21870,
     "dmg": 0,
     "exp": 14000000,
     "type": "敌对型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "敌对型生物"
    },
    "唯一": {
     "hp": 65610,
     "dmg": 0,
     "exp": 14000000,
     "type": "敌对型生物"
    }
   },
   "ai": {
    "aggro": true,
    "chase": true,
    "flee": false,
    "retaliate": false,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 8,
   "file": "assets/mobs/8.svg",
   "name": "Queen Ant",
   "zh": "蚁后",
   "biome": "",
   "hp": 10,
   "dmg": 0,
   "speed": 60,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "敌对型生物",
   "desc": "You must have done something really bad if she's chasing you. （如果她在追你，你肯定是做了什么天大的坏事。）",
   "spawn": "A Super Queen Ant has spawned somewhere! （一个超级蚁后在某处生成了！）",
   "rarities": {
    "普通": {
     "hp": 10,
     "dmg": 0,
     "exp": 1,
     "type": "敌对型生物"
    },
    "罕见": {
     "hp": 30,
     "dmg": 0,
     "exp": 1,
     "type": "敌对型生物"
    },
    "稀有": {
     "hp": 90,
     "dmg": 0,
     "exp": 4,
     "type": "敌对型生物"
    },
    "史诗": {
     "hp": 270,
     "dmg": 0,
     "exp": 31,
     "type": "敌对型生物"
    },
    "传奇": {
     "hp": 810,
     "dmg": 0,
     "exp": 287,
     "type": "敌对型生物"
    },
    "神话": {
     "hp": 2430,
     "dmg": 0,
     "exp": 4400,
     "type": "敌对型生物"
    },
    "究极": {
     "hp": 7290,
     "dmg": 0,
     "exp": 343000,
     "type": "敌对型生物"
    },
    "超级": {
     "hp": 21870,
     "dmg": 0,
     "exp": 16000000,
     "type": "敌对型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "敌对型生物"
    },
    "唯一": {
     "hp": 65610,
     "dmg": 0,
     "exp": 16000000,
     "type": "敌对型生物"
    }
   },
   "ai": {
    "aggro": true,
    "chase": true,
    "flee": false,
    "retaliate": false,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 9,
   "file": "assets/mobs/9.svg",
   "name": "Ant Hole",
   "zh": "蚁穴",
   "biome": "",
   "hp": 15,
   "dmg": 0,
   "speed": 30,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "召唤型生物",
   "desc": "Ants go in, and come out. Can't explain that. （蚂蚁进进又出出，这根本无法解释。）",
   "spawn": "A Super Ant Hole has spawned somewhere! （一个超级蚁穴在某处生成了！）",
   "rarities": {
    "普通": {
     "hp": 15,
     "dmg": 0,
     "exp": 1,
     "type": "召唤型生物"
    },
    "罕见": {
     "hp": 45,
     "dmg": 0,
     "exp": 2,
     "type": "召唤型生物"
    },
    "稀有": {
     "hp": 135,
     "dmg": 0,
     "exp": 5,
     "type": "召唤型生物"
    },
    "史诗": {
     "hp": 405,
     "dmg": 0,
     "exp": 39,
     "type": "召唤型生物"
    },
    "传奇": {
     "hp": 1215,
     "dmg": 0,
     "exp": 356,
     "type": "召唤型生物"
    },
    "神话": {
     "hp": 3645,
     "dmg": 0,
     "exp": 5000,
     "type": "召唤型生物"
    },
    "究极": {
     "hp": 10935,
     "dmg": 0,
     "exp": 243000,
     "type": "召唤型生物"
    },
    "超级": {
     "hp": 32805,
     "dmg": 0,
     "exp": 12000000,
     "type": "召唤型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "召唤型生物"
    },
    "唯一": {
     "hp": 98415,
     "dmg": 0,
     "exp": 12000000,
     "type": "召唤型生物"
    }
   },
   "ai": {
    "aggro": false,
    "chase": false,
    "flee": false,
    "retaliate": false,
    "summoned": true
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 10,
   "file": "assets/mobs/10.svg",
   "name": "Beetle",
   "zh": "甲虫",
   "biome": "",
   "hp": 30,
   "dmg": 0,
   "speed": 60,
   "size": 19,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "敌对型生物",
   "desc": "It's hungry and flowers are its favorite meal. （它饿了，而花是它最喜欢的食物。）",
   "spawn": "A Super Beetle has spawned somewhere! （一个超级甲虫在某处生成了！）",
   "rarities": {
    "普通": {
     "hp": 30,
     "dmg": 0,
     "exp": 1,
     "type": "敌对型生物"
    },
    "罕见": {
     "hp": 90,
     "dmg": 0,
     "exp": 2,
     "type": "敌对型生物"
    },
    "稀有": {
     "hp": 270,
     "dmg": 0,
     "exp": 7,
     "type": "敌对型生物"
    },
    "史诗": {
     "hp": 810,
     "dmg": 0,
     "exp": 52,
     "type": "敌对型生物"
    },
    "传奇": {
     "hp": 2430,
     "dmg": 0,
     "exp": 476,
     "type": "敌对型生物"
    },
    "神话": {
     "hp": 7290,
     "dmg": 0,
     "exp": 6100,
     "type": "敌对型生物"
    },
    "究极": {
     "hp": 21870,
     "dmg": 0,
     "exp": 328000,
     "type": "敌对型生物"
    },
    "超级": {
     "hp": 65610,
     "dmg": 0,
     "exp": 15000000,
     "type": "敌对型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "敌对型生物"
    },
    "唯一": {
     "hp": 196830,
     "dmg": 0,
     "exp": 15000000,
     "type": "敌对型生物"
    }
   },
   "ai": {
    "aggro": true,
    "chase": true,
    "flee": false,
    "retaliate": false,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 11,
   "file": "assets/mobs/11.svg",
   "name": "Hornet",
   "zh": "黄蜂",
   "biome": "",
   "hp": 50,
   "dmg": 5,
   "speed": 60,
   "size": 22,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "敌对型生物",
   "desc": "These aren't quite as nice as the little bees. （不像小蜜蜂那么友善。）",
   "spawn": "A big yellow spot shows up in the distance... （天空之上，一抹耀眼的金黄斑痕赫然跃出……）",
   "rarities": {
    "普通": {
     "hp": 50,
     "dmg": 5,
     "exp": 1,
     "type": "敌对型生物"
    },
    "罕见": {
     "hp": 150,
     "dmg": 25,
     "exp": 2,
     "type": "敌对型生物"
    },
    "稀有": {
     "hp": 450,
     "dmg": 125,
     "exp": 6,
     "type": "敌对型生物"
    },
    "史诗": {
     "hp": 1350,
     "dmg": 625,
     "exp": 53,
     "type": "敌对型生物"
    },
    "传奇": {
     "hp": 4050,
     "dmg": 3125,
     "exp": 486,
     "type": "敌对型生物"
    },
    "神话": {
     "hp": 12150,
     "dmg": 15625,
     "exp": 6900,
     "type": "敌对型生物"
    },
    "究极": {
     "hp": 36450,
     "dmg": 78125,
     "exp": 328000,
     "type": "敌对型生物"
    },
    "超级": {
     "hp": 109350,
     "dmg": 390625,
     "exp": 16000000,
     "type": "敌对型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "敌对型生物"
    },
    "唯一": {
     "hp": 328050,
     "dmg": 1953125,
     "exp": 16000000,
     "type": "敌对型生物"
    }
   },
   "ai": {
    "aggro": true,
    "chase": true,
    "flee": false,
    "retaliate": false,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 12,
   "file": "assets/mobs/12.svg",
   "name": "Centipede",
   "zh": "蜈蚣",
   "biome": "",
   "hp": 10,
   "dmg": 0,
   "speed": 35,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "被动型生物",
   "desc": "It's just there doing its thing. （它只是在那里做自己的事情。）",
   "spawn": "A Super Centipede has spawned somewhere! （一个超级蜈蚣在某处生成了！）",
   "rarities": {
    "普通": {
     "hp": 10,
     "dmg": 0,
     "exp": 1,
     "type": "被动型生物"
    },
    "罕见": {
     "hp": 30,
     "dmg": 0,
     "exp": 1,
     "type": "被动型生物"
    },
    "稀有": {
     "hp": 90,
     "dmg": 0,
     "exp": 3,
     "type": "被动型生物"
    },
    "史诗": {
     "hp": 270,
     "dmg": 0,
     "exp": 15,
     "type": "中立型生物"
    },
    "传奇": {
     "hp": 810,
     "dmg": 0,
     "exp": 133,
     "type": "中立型生物"
    },
    "神话": {
     "hp": 2430,
     "dmg": 0,
     "exp": 2000,
     "type": "中立型生物"
    },
    "究极": {
     "hp": 7290,
     "dmg": 0,
     "exp": 76700,
     "type": "中立型生物"
    },
    "超级": {
     "hp": 21870,
     "dmg": 0,
     "exp": 3900000,
     "type": "中立型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "中立型生物"
    },
    "唯一": {
     "hp": 65610,
     "dmg": 0,
     "exp": 3900000,
     "type": "中立型生物"
    }
   },
   "ai": {
    "aggro": false,
    "chase": false,
    "flee": true,
    "retaliate": false,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 13,
   "file": "assets/mobs/13.svg",
   "name": "Centipede (Body)",
   "zh": "蜈蚣",
   "biome": "",
   "hp": 10,
   "dmg": 0,
   "speed": 45,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "技术型生物",
   "desc": "It's just there doing its thing. （它只是在那里做自己的事情。）",
   "spawn": "- （-）",
   "rarities": {
    "普通": {
     "hp": 10,
     "dmg": 0,
     "exp": 1,
     "type": "技术型生物"
    },
    "罕见": {
     "hp": 30,
     "dmg": 0,
     "exp": 1,
     "type": "技术型生物"
    },
    "稀有": {
     "hp": 90,
     "dmg": 0,
     "exp": 3,
     "type": "技术型生物"
    },
    "史诗": {
     "hp": 270,
     "dmg": 0,
     "exp": 15,
     "type": "中立型生物"
    },
    "传奇": {
     "hp": 810,
     "dmg": 0,
     "exp": 133,
     "type": "中立型生物"
    },
    "神话": {
     "hp": 2430,
     "dmg": 0,
     "exp": 2000,
     "type": "中立型生物"
    },
    "究极": {
     "hp": 7290,
     "dmg": 0,
     "exp": 76700,
     "type": "中立型生物"
    },
    "超级": {
     "hp": 21870,
     "dmg": 0,
     "exp": 3900000,
     "type": "中立型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "中立型生物"
    },
    "唯一": {
     "hp": 65610,
     "dmg": 0,
     "exp": 3900000,
     "type": "中立型生物"
    }
   },
   "ai": {
    "aggro": false,
    "chase": false,
    "flee": false,
    "retaliate": false,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 14,
   "file": "assets/mobs/14.svg",
   "name": "Centipede (Evil)",
   "zh": "蜈蚣",
   "biome": "",
   "hp": 10,
   "dmg": 0,
   "speed": 60,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "敌对型生物",
   "desc": "This one loves flowers. （很爱吃花朵。）",
   "spawn": "A Super Centipede has spawned somewhere! （一个超级蜈蚣在某处生成了！）",
   "rarities": {
    "普通": {
     "hp": 10,
     "dmg": 0,
     "exp": 1,
     "type": "敌对型生物"
    },
    "罕见": {
     "hp": 30,
     "dmg": 0,
     "exp": 1,
     "type": "敌对型生物"
    },
    "稀有": {
     "hp": 90,
     "dmg": 0,
     "exp": 3,
     "type": "敌对型生物"
    },
    "史诗": {
     "hp": 270,
     "dmg": 0,
     "exp": 15,
     "type": "敌对型生物"
    },
    "传奇": {
     "hp": 810,
     "dmg": 0,
     "exp": 133,
     "type": "敌对型生物"
    },
    "神话": {
     "hp": 2430,
     "dmg": 0,
     "exp": 2000,
     "type": "敌对型生物"
    },
    "究极": {
     "hp": 7290,
     "dmg": 0,
     "exp": 76700,
     "type": "敌对型生物"
    },
    "超级": {
     "hp": 21870,
     "dmg": 0,
     "exp": 3900000,
     "type": "敌对型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "敌对型生物"
    },
    "唯一": {
     "hp": 65610,
     "dmg": 0,
     "exp": 3900000,
     "type": "敌对型生物"
    }
   },
   "ai": {
    "aggro": true,
    "chase": true,
    "flee": false,
    "retaliate": false,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 15,
   "file": "assets/mobs/15.svg",
   "name": "Centipede (Evil) (Body)",
   "zh": "蜈蚣",
   "biome": "",
   "hp": 10,
   "dmg": 0,
   "speed": 45,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "技术型生物",
   "desc": "This one loves flowers. （很爱吃花朵。）",
   "spawn": "- （-）",
   "rarities": {
    "普通": {
     "hp": 10,
     "dmg": 0,
     "exp": 1,
     "type": "技术型生物"
    },
    "罕见": {
     "hp": 30,
     "dmg": 0,
     "exp": 1,
     "type": "技术型生物"
    },
    "稀有": {
     "hp": 90,
     "dmg": 0,
     "exp": 3,
     "type": "技术型生物"
    },
    "史诗": {
     "hp": 270,
     "dmg": 0,
     "exp": 15,
     "type": "技术型生物"
    },
    "传奇": {
     "hp": 810,
     "dmg": 0,
     "exp": 133,
     "type": "技术型生物"
    },
    "神话": {
     "hp": 2430,
     "dmg": 0,
     "exp": 2000,
     "type": "技术型生物"
    },
    "究极": {
     "hp": 7290,
     "dmg": 0,
     "exp": 76700,
     "type": "技术型生物"
    },
    "超级": {
     "hp": 21870,
     "dmg": 0,
     "exp": 3900000,
     "type": "技术型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "技术型生物"
    },
    "唯一": {
     "hp": 65610,
     "dmg": 0,
     "exp": 3900000,
     "type": "技术型生物"
    }
   },
   "ai": {
    "aggro": false,
    "chase": false,
    "flee": false,
    "retaliate": false,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 16,
   "file": "assets/mobs/16.svg",
   "name": "Centipede (Desert)",
   "zh": "蜈蚣",
   "biome": "",
   "hp": 10,
   "dmg": 0,
   "speed": 35,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "被动型生物",
   "desc": "Gotta go fast. （要加速了。）",
   "spawn": "A Super Centipede has spawned somewhere! （一个超级蜈蚣在某处生成了！）",
   "rarities": {
    "普通": {
     "hp": 10,
     "dmg": 0,
     "exp": 1,
     "type": "被动型生物"
    },
    "罕见": {
     "hp": 30,
     "dmg": 0,
     "exp": 1,
     "type": "被动型生物"
    },
    "稀有": {
     "hp": 90,
     "dmg": 0,
     "exp": 3,
     "type": "被动型生物"
    },
    "史诗": {
     "hp": 270,
     "dmg": 0,
     "exp": 22,
     "type": "中立型生物"
    },
    "传奇": {
     "hp": 810,
     "dmg": 0,
     "exp": 206,
     "type": "中立型生物"
    },
    "神话": {
     "hp": 2430,
     "dmg": 0,
     "exp": 3100,
     "type": "中立型生物"
    },
    "究极": {
     "hp": 7290,
     "dmg": 0,
     "exp": 130000,
     "type": "中立型生物"
    },
    "超级": {
     "hp": 21870,
     "dmg": 0,
     "exp": 6600000,
     "type": "中立型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "中立型生物"
    },
    "唯一": {
     "hp": 65610,
     "dmg": 0,
     "exp": 6600000,
     "type": "中立型生物"
    }
   },
   "ai": {
    "aggro": false,
    "chase": false,
    "flee": true,
    "retaliate": false,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 17,
   "file": "assets/mobs/17.svg",
   "name": "Centipede (Desert) (Body)",
   "zh": "蜈蚣",
   "biome": "",
   "hp": 10,
   "dmg": 0,
   "speed": 45,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "技术型生物",
   "desc": "Gotta go fast. （要加速了。）",
   "spawn": "- （-）",
   "rarities": {
    "普通": {
     "hp": 10,
     "dmg": 0,
     "exp": 1,
     "type": "技术型生物"
    },
    "罕见": {
     "hp": 30,
     "dmg": 0,
     "exp": 1,
     "type": "技术型生物"
    },
    "稀有": {
     "hp": 90,
     "dmg": 0,
     "exp": 3,
     "type": "技术型生物"
    },
    "史诗": {
     "hp": 270,
     "dmg": 0,
     "exp": 22,
     "type": "中立型生物"
    },
    "传奇": {
     "hp": 810,
     "dmg": 0,
     "exp": 206,
     "type": "中立型生物"
    },
    "神话": {
     "hp": 2430,
     "dmg": 0,
     "exp": 3100,
     "type": "中立型生物"
    },
    "究极": {
     "hp": 7290,
     "dmg": 0,
     "exp": 130000,
     "type": "中立型生物"
    },
    "超级": {
     "hp": 21870,
     "dmg": 0,
     "exp": 6600000,
     "type": "中立型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "中立型生物"
    },
    "唯一": {
     "hp": 65610,
     "dmg": 0,
     "exp": 6600000,
     "type": "中立型生物"
    }
   },
   "ai": {
    "aggro": false,
    "chase": false,
    "flee": false,
    "retaliate": false,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 18,
   "file": "assets/mobs/18.svg",
   "name": "Square",
   "zh": "正方形",
   "biome": "",
   "hp": 10,
   "dmg": 0,
   "speed": 35,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "被动型生物",
   "desc": "This shape...it looks familiar... （这个形状……看起来很熟悉……）",
   "spawn": "A Super Square has spawned somewhere! （一个超级正方形在某处生成了！）",
   "rarities": {
    "普通": {
     "hp": 10,
     "dmg": 0,
     "exp": 1,
     "type": "被动型生物"
    },
    "罕见": {
     "hp": 30,
     "dmg": 0,
     "exp": 1,
     "type": "被动型生物"
    },
    "稀有": {
     "hp": 90,
     "dmg": 0,
     "exp": 1,
     "type": "被动型生物"
    },
    "史诗": {
     "hp": 270,
     "dmg": 0,
     "exp": 1,
     "type": "被动型生物"
    },
    "传奇": {
     "hp": 810,
     "dmg": 0,
     "exp": 1,
     "type": "被动型生物"
    },
    "神话": {
     "hp": 2430,
     "dmg": 0,
     "exp": 1,
     "type": "被动型生物"
    },
    "究极": {
     "hp": 7290,
     "dmg": 0,
     "exp": 1,
     "type": "被动型生物"
    },
    "超级": {
     "hp": 21870,
     "dmg": 0,
     "exp": 1,
     "type": "被动型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "被动型生物"
    },
    "唯一": {
     "hp": 65610,
     "dmg": 0,
     "exp": 1,
     "type": "被动型生物"
    }
   },
   "ai": {
    "aggro": false,
    "chase": false,
    "flee": true,
    "retaliate": false,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 19,
   "file": "assets/mobs/19.svg",
   "name": "Ladybug (Dark)",
   "zh": "瓢虫",
   "biome": "",
   "hp": 10,
   "dmg": 0,
   "speed": 45,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "中立型生物",
   "desc": "Cute and harmless... if left unprovoked. （可爱而无害……如果不打扰它的话。）",
   "spawn": "A Super Ladybug has spawned somewhere! （一个超级瓢虫在某处生成了！）",
   "rarities": {
    "普通": {
     "hp": 10,
     "dmg": 0,
     "exp": 1,
     "type": "中立型生物"
    },
    "罕见": {
     "hp": 30,
     "dmg": 0,
     "exp": 1,
     "type": "中立型生物"
    },
    "稀有": {
     "hp": 90,
     "dmg": 0,
     "exp": 4,
     "type": "中立型生物"
    },
    "史诗": {
     "hp": 270,
     "dmg": 0,
     "exp": 32,
     "type": "中立型生物"
    },
    "传奇": {
     "hp": 810,
     "dmg": 0,
     "exp": 297,
     "type": "中立型生物"
    },
    "神话": {
     "hp": 2430,
     "dmg": 0,
     "exp": 4200,
     "type": "中立型生物"
    },
    "究极": {
     "hp": 7290,
     "dmg": 0,
     "exp": 198000,
     "type": "中立型生物"
    },
    "超级": {
     "hp": 21870,
     "dmg": 0,
     "exp": 9900000,
     "type": "中立型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "中立型生物"
    },
    "唯一": {
     "hp": 65610,
     "dmg": 0,
     "exp": 9900000,
     "type": "中立型生物"
    }
   },
   "ai": {
    "aggro": false,
    "chase": false,
    "flee": false,
    "retaliate": true,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 20,
   "file": "assets/mobs/20.svg",
   "name": "Ladybug (Yellow)",
   "zh": "瓢虫",
   "biome": "",
   "hp": 10,
   "dmg": 0,
   "speed": 45,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "中立型生物",
   "desc": "Shiny, cute and mostly harmless. （亮闪闪，可爱，基本无害。）",
   "spawn": "A Super Ladybug has spawned somewhere! （一个超级瓢虫在某处生成了！）",
   "rarities": {
    "普通": {
     "hp": 10,
     "dmg": 0,
     "exp": 2,
     "type": "中立型生物"
    },
    "罕见": {
     "hp": 30,
     "dmg": 0,
     "exp": 2,
     "type": "中立型生物"
    },
    "稀有": {
     "hp": 90,
     "dmg": 0,
     "exp": 12,
     "type": "中立型生物"
    },
    "史诗": {
     "hp": 270,
     "dmg": 0,
     "exp": 94,
     "type": "中立型生物"
    },
    "传奇": {
     "hp": 810,
     "dmg": 0,
     "exp": 1100,
     "type": "中立型生物"
    },
    "神话": {
     "hp": 2430,
     "dmg": 0,
     "exp": 13500,
     "type": "中立型生物"
    },
    "究极": {
     "hp": 7290,
     "dmg": 0,
     "exp": 802000,
     "type": "中立型生物"
    },
    "超级": {
     "hp": 21870,
     "dmg": 0,
     "exp": 28000000,
     "type": "中立型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "中立型生物"
    },
    "唯一": {
     "hp": 65610,
     "dmg": 0,
     "exp": 28000000,
     "type": "中立型生物"
    }
   },
   "ai": {
    "aggro": false,
    "chase": false,
    "flee": false,
    "retaliate": true,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 21,
   "file": "assets/mobs/21.svg",
   "name": "Spider",
   "zh": "蜘蛛",
   "biome": "",
   "hp": 15,
   "dmg": 40,
   "speed": 60,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "敌对型生物",
   "desc": "Spooky. （吓人。）",
   "spawn": "A Super Spider has spawned somewhere! （一个超级蜘蛛在某处生成了！）",
   "rarities": {
    "普通": {
     "hp": 15,
     "dmg": 40,
     "exp": 1,
     "type": "敌对型生物"
    },
    "罕见": {
     "hp": 45,
     "dmg": 120,
     "exp": 2,
     "type": "敌对型生物"
    },
    "稀有": {
     "hp": 135,
     "dmg": 360,
     "exp": 5,
     "type": "敌对型生物"
    },
    "史诗": {
     "hp": 405,
     "dmg": 1080,
     "exp": 41,
     "type": "敌对型生物"
    },
    "传奇": {
     "hp": 1215,
     "dmg": 3240,
     "exp": 379,
     "type": "敌对型生物"
    },
    "神话": {
     "hp": 3645,
     "dmg": 9720,
     "exp": 5300,
     "type": "敌对型生物"
    },
    "究极": {
     "hp": 10935,
     "dmg": 29160,
     "exp": 268000,
     "type": "敌对型生物"
    },
    "超级": {
     "hp": 32805,
     "dmg": 87480,
     "exp": 13000000,
     "type": "敌对型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "敌对型生物"
    },
    "唯一": {
     "hp": 98415,
     "dmg": 262440,
     "exp": 13000000,
     "type": "敌对型生物"
    }
   },
   "ai": {
    "aggro": true,
    "chase": true,
    "flee": false,
    "retaliate": false,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 22,
   "file": "assets/mobs/22.svg",
   "name": "Scorpion",
   "zh": "蝎子",
   "biome": "",
   "hp": 15,
   "dmg": 5,
   "speed": 60,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "敌对型生物",
   "desc": "IT STINGS! （它！会！蜇！人！）",
   "spawn": "A Super Scorpion has spawned somewhere! （一个超级蝎子在某处生成了！）",
   "rarities": {
    "普通": {
     "hp": 15,
     "dmg": 5,
     "exp": 1,
     "type": "敌对型生物"
    },
    "罕见": {
     "hp": 45,
     "dmg": 25,
     "exp": 2,
     "type": "敌对型生物"
    },
    "稀有": {
     "hp": 135,
     "dmg": 125,
     "exp": 5,
     "type": "敌对型生物"
    },
    "史诗": {
     "hp": 405,
     "dmg": 1080,
     "exp": 41,
     "type": "敌对型生物"
    },
    "传奇": {
     "hp": 1215,
     "dmg": 3125,
     "exp": 379,
     "type": "敌对型生物"
    },
    "神话": {
     "hp": 3645,
     "dmg": 15625,
     "exp": 5200,
     "type": "敌对型生物"
    },
    "究极": {
     "hp": 10935,
     "dmg": 78125,
     "exp": 260000,
     "type": "敌对型生物"
    },
    "超级": {
     "hp": 32805,
     "dmg": 390625,
     "exp": 13000000,
     "type": "敌对型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "敌对型生物"
    },
    "唯一": {
     "hp": 98415,
     "dmg": 1953125,
     "exp": 13000000,
     "type": "敌对型生物"
    }
   },
   "ai": {
    "aggro": true,
    "chase": true,
    "flee": false,
    "retaliate": false,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 23,
   "file": "assets/mobs/23.svg",
   "name": "Soldier Fire Ant",
   "zh": "火兵蚁",
   "biome": "",
   "hp": 20,
   "dmg": 0,
   "speed": 60,
   "size": 18,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "敌对型生物",
   "desc": "This ant is on fireeeeeeeeeeeeee. （这只蚂蚁着火炎焱燚了！）",
   "spawn": "A Super Soldier Fire Ant has spawned somewhere! （一个超级火兵蚁在某处生成了！）",
   "rarities": {
    "普通": {
     "hp": 20,
     "dmg": 0,
     "exp": 1,
     "type": "敌对型生物"
    },
    "罕见": {
     "hp": 60,
     "dmg": 0,
     "exp": 2,
     "type": "敌对型生物"
    },
    "稀有": {
     "hp": 180,
     "dmg": 0,
     "exp": 6,
     "type": "敌对型生物"
    },
    "史诗": {
     "hp": 540,
     "dmg": 0,
     "exp": 44,
     "type": "敌对型生物"
    },
    "传奇": {
     "hp": 1620,
     "dmg": 0,
     "exp": 400,
     "type": "敌对型生物"
    },
    "神话": {
     "hp": 4860,
     "dmg": 0,
     "exp": 5400,
     "type": "敌对型生物"
    },
    "究极": {
     "hp": 14580,
     "dmg": 0,
     "exp": 276000,
     "type": "敌对型生物"
    },
    "超级": {
     "hp": 43740,
     "dmg": 0,
     "exp": 14000000,
     "type": "敌对型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "敌对型生物"
    },
    "唯一": {
     "hp": 131220,
     "dmg": 0,
     "exp": 14000000,
     "type": "敌对型生物"
    }
   },
   "ai": {
    "aggro": true,
    "chase": true,
    "flee": false,
    "retaliate": false,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 24,
   "file": "assets/mobs/24.svg",
   "name": "Fire Ant Burrow",
   "zh": "火蚁穴",
   "biome": "",
   "hp": 0,
   "dmg": 0,
   "speed": 30,
   "size": 16,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "召唤型生物",
   "desc": "What could be in here? （里面会有什么呢？）",
   "spawn": "A Super Fire Ant Burrow has spawned somewhere! （一个超级火蚁穴在某处生成了！）",
   "rarities": {
    "普通": {
     "hp": 0,
     "dmg": 0,
     "exp": 1,
     "type": "召唤型生物"
    },
    "罕见": {
     "hp": 0,
     "dmg": 0,
     "exp": 1,
     "type": "召唤型生物"
    },
    "稀有": {
     "hp": 0,
     "dmg": 0,
     "exp": 6,
     "type": "召唤型生物"
    },
    "史诗": {
     "hp": 0,
     "dmg": 0,
     "exp": 54,
     "type": "召唤型生物"
    },
    "传奇": {
     "hp": 0,
     "dmg": 0,
     "exp": 497,
     "type": "召唤型生物"
    },
    "神话": {
     "hp": 0,
     "dmg": 0,
     "exp": 6300,
     "type": "召唤型生物"
    },
    "究极": {
     "hp": 0,
     "dmg": 0,
     "exp": 343000,
     "type": "召唤型生物"
    },
    "超级": {
     "hp": 0,
     "dmg": 0,
     "exp": 16000000,
     "type": "召唤型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "召唤型生物"
    },
    "唯一": {
     "hp": 0,
     "dmg": 0,
     "exp": 16000000,
     "type": "召唤型生物"
    }
   },
   "ai": {
    "aggro": false,
    "chase": false,
    "flee": false,
    "retaliate": false,
    "summoned": true
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 25,
   "file": "assets/mobs/25.svg",
   "name": "Sandstorm",
   "zh": "沙尘暴",
   "biome": "",
   "hp": 40,
   "dmg": 0,
   "speed": 35,
   "size": 21,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "被动型生物",
   "desc": "Darude (1999) （达鲁德（1999年））",
   "spawn": "A Super Sandstorm has spawned somewhere! （一个超级沙尘暴在某处生成了！）",
   "rarities": {
    "普通": {
     "hp": 40,
     "dmg": 0,
     "exp": 1,
     "type": "被动型生物"
    },
    "罕见": {
     "hp": 120,
     "dmg": 0,
     "exp": 1,
     "type": "被动型生物"
    },
    "稀有": {
     "hp": 360,
     "dmg": 0,
     "exp": 4,
     "type": "被动型生物"
    },
    "史诗": {
     "hp": 1080,
     "dmg": 0,
     "exp": 30,
     "type": "被动型生物"
    },
    "传奇": {
     "hp": 3240,
     "dmg": 0,
     "exp": 308,
     "type": "被动型生物"
    },
    "神话": {
     "hp": 9720,
     "dmg": 0,
     "exp": 4700,
     "type": "被动型生物"
    },
    "究极": {
     "hp": 29160,
     "dmg": 0,
     "exp": 198000,
     "type": "被动型生物"
    },
    "超级": {
     "hp": 87480,
     "dmg": 0,
     "exp": 10000000,
     "type": "被动型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "被动型生物"
    },
    "唯一": {
     "hp": 262440,
     "dmg": 0,
     "exp": 10000000,
     "type": "被动型生物"
    }
   },
   "ai": {
    "aggro": false,
    "chase": false,
    "flee": true,
    "retaliate": false,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 26,
   "file": "assets/mobs/26.svg",
   "name": "Bubble",
   "zh": "泡泡",
   "biome": "",
   "hp": 5,
   "dmg": 0,
   "speed": 35,
   "size": 16,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "被动型生物",
   "desc": "Pop （啵）",
   "spawn": "A Super Bubble has spawned somewhere! （一个超级泡泡在某处生成了！）",
   "rarities": {
    "普通": {
     "hp": 5,
     "dmg": 0,
     "exp": 1,
     "type": "被动型生物"
    },
    "罕见": {
     "hp": 15,
     "dmg": 0,
     "exp": 2,
     "type": "被动型生物"
    },
    "稀有": {
     "hp": 45,
     "dmg": 0,
     "exp": 9,
     "type": "被动型生物"
    },
    "史诗": {
     "hp": 135,
     "dmg": 0,
     "exp": 68,
     "type": "被动型生物"
    },
    "传奇": {
     "hp": 405,
     "dmg": 0,
     "exp": 645,
     "type": "被动型生物"
    },
    "神话": {
     "hp": 1215,
     "dmg": 0,
     "exp": 7600,
     "type": "被动型生物"
    },
    "究极": {
     "hp": 3645,
     "dmg": 0,
     "exp": 432000,
     "type": "被动型生物"
    },
    "超级": {
     "hp": 10935,
     "dmg": 0,
     "exp": 16000000,
     "type": "被动型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "被动型生物"
    },
    "唯一": {
     "hp": 32805,
     "dmg": 0,
     "exp": 16000000,
     "type": "被动型生物"
    }
   },
   "ai": {
    "aggro": false,
    "chase": false,
    "flee": true,
    "retaliate": false,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 27,
   "file": "assets/mobs/27.svg",
   "name": "Bumble Bee",
   "zh": "熊蜂",
   "biome": "",
   "hp": 20,
   "dmg": 5,
   "speed": 35,
   "size": 18,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "被动型生物",
   "desc": "GOTTA RUN. （要 跑 起 来 了 ！）",
   "spawn": "A Super Bumble Bee has spawned somewhere! （一个超级熊蜂在某处生成了！）",
   "rarities": {
    "普通": {
     "hp": 20,
     "dmg": 5,
     "exp": 1,
     "type": "被动型生物"
    },
    "罕见": {
     "hp": 60,
     "dmg": 25,
     "exp": 1,
     "type": "被动型生物"
    },
    "稀有": {
     "hp": 180,
     "dmg": 125,
     "exp": 10,
     "type": "被动型生物"
    },
    "史诗": {
     "hp": 540,
     "dmg": 625,
     "exp": 93,
     "type": "被动型生物"
    },
    "传奇": {
     "hp": 1620,
     "dmg": 3125,
     "exp": 877,
     "type": "被动型生物"
    },
    "神话": {
     "hp": 4860,
     "dmg": 15625,
     "exp": 10600,
     "type": "被动型生物"
    },
    "究极": {
     "hp": 14580,
     "dmg": 78125,
     "exp": 593000,
     "type": "被动型生物"
    },
    "超级": {
     "hp": 43740,
     "dmg": 390625,
     "exp": 24000000,
     "type": "被动型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "被动型生物"
    },
    "唯一": {
     "hp": 131220,
     "dmg": 1953125,
     "exp": 24000000,
     "type": "被动型生物"
    }
   },
   "ai": {
    "aggro": false,
    "chase": false,
    "flee": true,
    "retaliate": false,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 28,
   "file": "assets/mobs/28.svg",
   "name": "Shell",
   "zh": "扇贝",
   "biome": "",
   "hp": 10,
   "dmg": 50,
   "speed": 45,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "中立型生物",
   "desc": "Not an advertisement. （这可不是那个广告牌。）",
   "spawn": "A Super Shell has spawned somewhere! （一个超级扇贝在某处生成了！）",
   "rarities": {
    "普通": {
     "hp": 10,
     "dmg": 50,
     "exp": 1,
     "type": "中立型生物"
    },
    "罕见": {
     "hp": 30,
     "dmg": 250,
     "exp": 1,
     "type": "中立型生物"
    },
    "稀有": {
     "hp": 90,
     "dmg": 1250,
     "exp": 5,
     "type": "中立型生物"
    },
    "史诗": {
     "hp": 270,
     "dmg": 6250,
     "exp": 38,
     "type": "中立型生物"
    },
    "传奇": {
     "hp": 810,
     "dmg": 31250,
     "exp": 351,
     "type": "中立型生物"
    },
    "神话": {
     "hp": 2430,
     "dmg": 156250,
     "exp": 5000,
     "type": "中立型生物"
    },
    "究极": {
     "hp": 7290,
     "dmg": 781250,
     "exp": 232000,
     "type": "中立型生物"
    },
    "超级": {
     "hp": 21870,
     "dmg": 3906250,
     "exp": 12000000,
     "type": "中立型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "中立型生物"
    },
    "唯一": {
     "hp": 65610,
     "dmg": 19531250,
     "exp": 12000000,
     "type": "中立型生物"
    }
   },
   "ai": {
    "aggro": false,
    "chase": false,
    "flee": false,
    "retaliate": true,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 29,
   "file": "assets/mobs/29.svg",
   "name": "Starfish",
   "zh": "海星",
   "biome": "",
   "hp": 20,
   "dmg": 0,
   "speed": 60,
   "size": 18,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "敌对型生物",
   "desc": "His name is Patrick. （它的名字叫派大星。）",
   "spawn": "A Super Starfish has spawned somewhere! （一个超级海星在某处生成了！）",
   "rarities": {
    "普通": {
     "hp": 20,
     "dmg": 0,
     "exp": 1,
     "type": "敌对型生物"
    },
    "罕见": {
     "hp": 60,
     "dmg": 0,
     "exp": 1,
     "type": "敌对型生物"
    },
    "稀有": {
     "hp": 180,
     "dmg": 0,
     "exp": 5,
     "type": "敌对型生物"
    },
    "史诗": {
     "hp": 540,
     "dmg": 0,
     "exp": 35,
     "type": "敌对型生物"
    },
    "传奇": {
     "hp": 1620,
     "dmg": 0,
     "exp": 322,
     "type": "敌对型生物"
    },
    "神话": {
     "hp": 4860,
     "dmg": 0,
     "exp": 4700,
     "type": "敌对型生物"
    },
    "究极": {
     "hp": 14580,
     "dmg": 0,
     "exp": 207000,
     "type": "敌对型生物"
    },
    "超级": {
     "hp": 43740,
     "dmg": 0,
     "exp": 10000000,
     "type": "敌对型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "敌对型生物"
    },
    "唯一": {
     "hp": 131220,
     "dmg": 0,
     "exp": 10000000,
     "type": "敌对型生物"
    }
   },
   "ai": {
    "aggro": true,
    "chase": true,
    "flee": false,
    "retaliate": false,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 30,
   "file": "assets/mobs/30.svg",
   "name": "Crab",
   "zh": "螃蟹",
   "biome": "",
   "hp": 25,
   "dmg": 0,
   "speed": 60,
   "size": 19,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "敌对型生物",
   "desc": "Mr. Crab. （蟹老板。）",
   "spawn": "A Super Crab has spawned somewhere! （一个超级螃蟹在某处生成了！）",
   "rarities": {
    "普通": {
     "hp": 25,
     "dmg": 0,
     "exp": 1,
     "type": "敌对型生物"
    },
    "罕见": {
     "hp": 75,
     "dmg": 0,
     "exp": 1,
     "type": "敌对型生物"
    },
    "稀有": {
     "hp": 225,
     "dmg": 0,
     "exp": 4,
     "type": "敌对型生物"
    },
    "史诗": {
     "hp": 675,
     "dmg": 0,
     "exp": 28,
     "type": "敌对型生物"
    },
    "传奇": {
     "hp": 2025,
     "dmg": 0,
     "exp": 256,
     "type": "敌对型生物"
    },
    "神话": {
     "hp": 6075,
     "dmg": 0,
     "exp": 3600,
     "type": "敌对型生物"
    },
    "究极": {
     "hp": 18225,
     "dmg": 0,
     "exp": 169000,
     "type": "敌对型生物"
    },
    "超级": {
     "hp": 54675,
     "dmg": 0,
     "exp": 8400000,
     "type": "敌对型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "敌对型生物"
    },
    "唯一": {
     "hp": 164025,
     "dmg": 0,
     "exp": 8400000,
     "type": "敌对型生物"
    }
   },
   "ai": {
    "aggro": true,
    "chase": true,
    "flee": false,
    "retaliate": false,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 31,
   "file": "assets/mobs/31.svg",
   "name": "Jellyfish",
   "zh": "水母",
   "biome": "",
   "hp": 25,
   "dmg": 7,
   "speed": 60,
   "size": 19,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "敌对型生物",
   "desc": "Makes the most delicious jam. （用来做最美味的果酱。）",
   "spawn": "You hear lightning strikes coming from a far distance... （浩淼海下，一阵滚滚的闷雷翻涌直上震破水面……）",
   "rarities": {
    "普通": {
     "hp": 25,
     "dmg": 7,
     "exp": 1,
     "type": "敌对型生物"
    },
    "罕见": {
     "hp": 75,
     "dmg": 21,
     "exp": 1,
     "type": "敌对型生物"
    },
    "稀有": {
     "hp": 225,
     "dmg": 63,
     "exp": 5,
     "type": "敌对型生物"
    },
    "史诗": {
     "hp": 675,
     "dmg": 189,
     "exp": 36,
     "type": "敌对型生物"
    },
    "传奇": {
     "hp": 2025,
     "dmg": 567,
     "exp": 329,
     "type": "敌对型生物"
    },
    "神话": {
     "hp": 6075,
     "dmg": 1701,
     "exp": 4700,
     "type": "敌对型生物"
    },
    "究极": {
     "hp": 18225,
     "dmg": 5103,
     "exp": 222000,
     "type": "敌对型生物"
    },
    "超级": {
     "hp": 54675,
     "dmg": 15309,
     "exp": 11000000,
     "type": "敌对型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "敌对型生物"
    },
    "唯一": {
     "hp": 164025,
     "dmg": 45927,
     "exp": 11000000,
     "type": "敌对型生物"
    }
   },
   "ai": {
    "aggro": true,
    "chase": true,
    "flee": false,
    "retaliate": false,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 32,
   "file": "assets/mobs/32.svg",
   "name": "Digger",
   "zh": "挖掘者",
   "biome": "",
   "hp": 30,
   "dmg": 0,
   "speed": 45,
   "size": 19,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "友善型生物",
   "desc": "Wrong game, bud. （兄弟，走错游戏了。）",
   "spawn": "A Super Digger has spawned somewhere! （一个超级挖掘者在某处生成了！）",
   "rarities": {
    "普通": {
     "hp": 30,
     "dmg": 0,
     "exp": 1,
     "type": "友善型生物"
    },
    "罕见": {
     "hp": 90,
     "dmg": 0,
     "exp": 1,
     "type": "友善型生物"
    },
    "稀有": {
     "hp": 270,
     "dmg": 0,
     "exp": 3,
     "type": "友善型生物"
    },
    "史诗": {
     "hp": 810,
     "dmg": 0,
     "exp": 30,
     "type": "友善型生物"
    },
    "传奇": {
     "hp": 2430,
     "dmg": 0,
     "exp": 279,
     "type": "友善型生物"
    },
    "神话": {
     "hp": 7290,
     "dmg": 0,
     "exp": 4100,
     "type": "友善型生物"
    },
    "究极": {
     "hp": 21870,
     "dmg": 0,
     "exp": 184000,
     "type": "友善型生物"
    },
    "超级": {
     "hp": 65610,
     "dmg": 0,
     "exp": 9300000,
     "type": "友善型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "友善型生物"
    },
    "唯一": {
     "hp": 196830,
     "dmg": 0,
     "exp": 9300000,
     "type": "友善型生物"
    }
   },
   "ai": {
    "aggro": false,
    "chase": false,
    "flee": false,
    "retaliate": false,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 33,
   "file": "assets/mobs/33.svg",
   "name": "Sponge",
   "zh": "海绵",
   "biome": "",
   "hp": 10,
   "dmg": 0,
   "speed": 0,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "障碍型生物",
   "desc": "Bob. （海绵-宝宝）",
   "spawn": "A Super Sponge has spawned somewhere! （一个超级海绵在某处生成了！）",
   "rarities": {
    "普通": {
     "hp": 10,
     "dmg": 0,
     "exp": 1,
     "type": "障碍型生物"
    },
    "罕见": {
     "hp": 30,
     "dmg": 0,
     "exp": 1,
     "type": "障碍型生物"
    },
    "稀有": {
     "hp": 90,
     "dmg": 0,
     "exp": 5,
     "type": "障碍型生物"
    },
    "史诗": {
     "hp": 270,
     "dmg": 0,
     "exp": 33,
     "type": "障碍型生物"
    },
    "传奇": {
     "hp": 810,
     "dmg": 0,
     "exp": 297,
     "type": "障碍型生物"
    },
    "神话": {
     "hp": 2430,
     "dmg": 0,
     "exp": 4200,
     "type": "障碍型生物"
    },
    "究极": {
     "hp": 7290,
     "dmg": 0,
     "exp": 198000,
     "type": "障碍型生物"
    },
    "超级": {
     "hp": 21870,
     "dmg": 0,
     "exp": 9900000,
     "type": "障碍型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "障碍型生物"
    },
    "唯一": {
     "hp": 65610,
     "dmg": 0,
     "exp": 9900000,
     "type": "障碍型生物"
    }
   },
   "ai": {
    "aggro": false,
    "chase": false,
    "flee": false,
    "retaliate": false,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 34,
   "file": "assets/mobs/34.svg",
   "name": "Leech",
   "zh": "水蛭",
   "biome": "",
   "hp": 10,
   "dmg": 7,
   "speed": 60,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "敌对型生物",
   "desc": "Slurp slurp. （吸溜吸溜。）",
   "spawn": "A Super Leech has spawned somewhere! （一个超级水蛭在某处生成了！）",
   "rarities": {
    "普通": {
     "hp": 10,
     "dmg": 7,
     "exp": 1,
     "type": "敌对型生物"
    },
    "罕见": {
     "hp": 30,
     "dmg": 21,
     "exp": 2,
     "type": "敌对型生物"
    },
    "稀有": {
     "hp": 90,
     "dmg": 63,
     "exp": 5,
     "type": "敌对型生物"
    },
    "史诗": {
     "hp": 270,
     "dmg": 189,
     "exp": 41,
     "type": "敌对型生物"
    },
    "传奇": {
     "hp": 810,
     "dmg": 567,
     "exp": 379,
     "type": "敌对型生物"
    },
    "神话": {
     "hp": 2430,
     "dmg": 1701,
     "exp": 5200,
     "type": "敌对型生物"
    },
    "究极": {
     "hp": 7290,
     "dmg": 5103,
     "exp": 260000,
     "type": "敌对型生物"
    },
    "超级": {
     "hp": 21870,
     "dmg": 15309,
     "exp": 13000000,
     "type": "敌对型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "敌对型生物"
    },
    "唯一": {
     "hp": 65610,
     "dmg": 45927,
     "exp": 13000000,
     "type": "敌对型生物"
    }
   },
   "ai": {
    "aggro": true,
    "chase": true,
    "flee": false,
    "retaliate": false,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 35,
   "file": "assets/mobs/35.svg",
   "name": "Leech (Body)",
   "zh": "水蛭",
   "biome": "",
   "hp": 10,
   "dmg": 7,
   "speed": 45,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "技术型生物",
   "desc": "Slurp slurp. （吸溜吸溜。）",
   "spawn": "- （-）",
   "rarities": {
    "普通": {
     "hp": 10,
     "dmg": 7,
     "exp": 1,
     "type": "技术型生物"
    },
    "罕见": {
     "hp": 30,
     "dmg": 21,
     "exp": 1,
     "type": "技术型生物"
    },
    "稀有": {
     "hp": 90,
     "dmg": 63,
     "exp": 1,
     "type": "技术型生物"
    },
    "史诗": {
     "hp": 270,
     "dmg": 189,
     "exp": 1,
     "type": "技术型生物"
    },
    "传奇": {
     "hp": 810,
     "dmg": 567,
     "exp": 1,
     "type": "技术型生物"
    },
    "神话": {
     "hp": 2430,
     "dmg": 1701,
     "exp": 1,
     "type": "技术型生物"
    },
    "究极": {
     "hp": 7290,
     "dmg": 5103,
     "exp": 1,
     "type": "技术型生物"
    },
    "超级": {
     "hp": 21870,
     "dmg": 15309,
     "exp": 1,
     "type": "技术型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "技术型生物"
    },
    "唯一": {
     "hp": 65610,
     "dmg": 45927,
     "exp": 1,
     "type": "技术型生物"
    }
   },
   "ai": {
    "aggro": false,
    "chase": false,
    "flee": false,
    "retaliate": false,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 36,
   "file": "assets/mobs/36.svg",
   "name": "Dandelion",
   "zh": "蒲公英",
   "biome": "",
   "hp": 15,
   "dmg": 25,
   "speed": 0,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "障碍型生物",
   "desc": "Puffy. （蓬松。）",
   "spawn": "A Super Dandelion has spawned somewhere! （一个超级蒲公英在某处生成了！）",
   "rarities": {
    "普通": {
     "hp": 15,
     "dmg": 25,
     "exp": 1,
     "type": "障碍型生物"
    },
    "罕见": {
     "hp": 45,
     "dmg": 125,
     "exp": 1,
     "type": "障碍型生物"
    },
    "稀有": {
     "hp": 135,
     "dmg": 625,
     "exp": 3,
     "type": "障碍型生物"
    },
    "史诗": {
     "hp": 405,
     "dmg": 3125,
     "exp": 23,
     "type": "障碍型生物"
    },
    "传奇": {
     "hp": 1215,
     "dmg": 15625,
     "exp": 211,
     "type": "障碍型生物"
    },
    "神话": {
     "hp": 3645,
     "dmg": 78125,
     "exp": 2800,
     "type": "障碍型生物"
    },
    "究极": {
     "hp": 10935,
     "dmg": 390625,
     "exp": 146000,
     "type": "障碍型生物"
    },
    "超级": {
     "hp": 32805,
     "dmg": 1953125,
     "exp": 7100000,
     "type": "障碍型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "障碍型生物"
    },
    "唯一": {
     "hp": 98415,
     "dmg": 9765625,
     "exp": 7100000,
     "type": "障碍型生物"
    }
   },
   "ai": {
    "aggro": false,
    "chase": false,
    "flee": false,
    "retaliate": false,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 37,
   "file": "assets/mobs/37.svg",
   "name": "Baby Fire Ant",
   "zh": "火幼蚁",
   "biome": "",
   "hp": 20,
   "dmg": 0,
   "speed": 35,
   "size": 18,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "被动型生物",
   "desc": "This ant is on fireeeeeeeeeeeeee. （这只蚂蚁着火炎焱燚了！）",
   "spawn": "A Super Baby Fire Ant has spawned somewhere! （一个超级火幼蚁在某处生成了！）",
   "rarities": {
    "普通": {
     "hp": 20,
     "dmg": 0,
     "exp": 1,
     "type": "被动型生物"
    },
    "罕见": {
     "hp": 60,
     "dmg": 0,
     "exp": 2,
     "type": "被动型生物"
    },
    "稀有": {
     "hp": 180,
     "dmg": 0,
     "exp": 9,
     "type": "被动型生物"
    },
    "史诗": {
     "hp": 540,
     "dmg": 0,
     "exp": 67,
     "type": "被动型生物"
    },
    "传奇": {
     "hp": 1620,
     "dmg": 0,
     "exp": 615,
     "type": "被动型生物"
    },
    "神话": {
     "hp": 4860,
     "dmg": 0,
     "exp": 8200,
     "type": "被动型生物"
    },
    "究极": {
     "hp": 14580,
     "dmg": 0,
     "exp": 420000,
     "type": "被动型生物"
    },
    "超级": {
     "hp": 43740,
     "dmg": 0,
     "exp": 20000000,
     "type": "被动型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "被动型生物"
    },
    "唯一": {
     "hp": 131220,
     "dmg": 0,
     "exp": 20000000,
     "type": "被动型生物"
    }
   },
   "ai": {
    "aggro": false,
    "chase": false,
    "flee": true,
    "retaliate": false,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 38,
   "file": "assets/mobs/38.svg",
   "name": "Worker Fire Ant",
   "zh": "火工蚁",
   "biome": "",
   "hp": 20,
   "dmg": 0,
   "speed": 45,
   "size": 18,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "中立型生物",
   "desc": "This ant is on fireeeeeeeeeeeeee. （这只蚂蚁着火炎焱燚了！）",
   "spawn": "A Super Worker Fire Ant has spawned somewhere! （一个超级火工蚁在某处生成了！）",
   "rarities": {
    "普通": {
     "hp": 20,
     "dmg": 0,
     "exp": 1,
     "type": "中立型生物"
    },
    "罕见": {
     "hp": 60,
     "dmg": 0,
     "exp": 1,
     "type": "中立型生物"
    },
    "稀有": {
     "hp": 180,
     "dmg": 0,
     "exp": 4,
     "type": "中立型生物"
    },
    "史诗": {
     "hp": 540,
     "dmg": 0,
     "exp": 31,
     "type": "中立型生物"
    },
    "传奇": {
     "hp": 1620,
     "dmg": 0,
     "exp": 279,
     "type": "中立型生物"
    },
    "神话": {
     "hp": 4860,
     "dmg": 0,
     "exp": 4100,
     "type": "中立型生物"
    },
    "究极": {
     "hp": 14580,
     "dmg": 0,
     "exp": 184000,
     "type": "中立型生物"
    },
    "超级": {
     "hp": 43740,
     "dmg": 0,
     "exp": 9300000,
     "type": "中立型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "中立型生物"
    },
    "唯一": {
     "hp": 131220,
     "dmg": 0,
     "exp": 9300000,
     "type": "中立型生物"
    }
   },
   "ai": {
    "aggro": false,
    "chase": false,
    "flee": false,
    "retaliate": true,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 39,
   "file": "assets/mobs/39.svg",
   "name": "Queen Fire Ant",
   "zh": "火蚁后",
   "biome": "",
   "hp": 20,
   "dmg": 0,
   "speed": 60,
   "size": 18,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "敌对型生物",
   "desc": "This ant is on fireeeeeeeeeeeeee. （这只蚂蚁着火炎焱燚了！）",
   "spawn": "A Super Queen Fire Ant has spawned somewhere! （一个超级火蚁后在某处生成了！）",
   "rarities": {
    "普通": {
     "hp": 20,
     "dmg": 0,
     "exp": 1,
     "type": "敌对型生物"
    },
    "罕见": {
     "hp": 60,
     "dmg": 0,
     "exp": 1,
     "type": "敌对型生物"
    },
    "稀有": {
     "hp": 180,
     "dmg": 0,
     "exp": 4,
     "type": "敌对型生物"
    },
    "史诗": {
     "hp": 540,
     "dmg": 0,
     "exp": 31,
     "type": "敌对型生物"
    },
    "传奇": {
     "hp": 1620,
     "dmg": 0,
     "exp": 287,
     "type": "敌对型生物"
    },
    "神话": {
     "hp": 4860,
     "dmg": 0,
     "exp": 4400,
     "type": "敌对型生物"
    },
    "究极": {
     "hp": 14580,
     "dmg": 0,
     "exp": 343000,
     "type": "敌对型生物"
    },
    "超级": {
     "hp": 43740,
     "dmg": 0,
     "exp": 16000000,
     "type": "敌对型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "敌对型生物"
    },
    "唯一": {
     "hp": 131220,
     "dmg": 0,
     "exp": 16000000,
     "type": "敌对型生物"
    }
   },
   "ai": {
    "aggro": true,
    "chase": true,
    "flee": false,
    "retaliate": false,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 40,
   "file": "assets/mobs/40.svg",
   "name": "Ant Egg",
   "zh": "蚁卵",
   "biome": "",
   "hp": 3,
   "dmg": 0,
   "speed": 30,
   "size": 16,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "召唤型生物",
   "desc": "Not yet an ant but perhaps soon. （还不是一只蚂蚁，但是可能快了。）",
   "spawn": "A Super Ant Egg has spawned somewhere! （一个超级蚁卵在某处生成了！）",
   "rarities": {
    "普通": {
     "hp": 3,
     "dmg": 0,
     "exp": 1,
     "type": "召唤型生物"
    },
    "罕见": {
     "hp": 9,
     "dmg": 0,
     "exp": 1,
     "type": "召唤型生物"
    },
    "稀有": {
     "hp": 27,
     "dmg": 0,
     "exp": 3,
     "type": "召唤型生物"
    },
    "史诗": {
     "hp": 81,
     "dmg": 0,
     "exp": 21,
     "type": "召唤型生物"
    },
    "传奇": {
     "hp": 243,
     "dmg": 0,
     "exp": 190,
     "type": "召唤型生物"
    },
    "神话": {
     "hp": 729,
     "dmg": 0,
     "exp": 2600,
     "type": "召唤型生物"
    },
    "究极": {
     "hp": 2187,
     "dmg": 0,
     "exp": 130000,
     "type": "召唤型生物"
    },
    "超级": {
     "hp": 6561,
     "dmg": 0,
     "exp": 6500000,
     "type": "召唤型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "召唤型生物"
    },
    "唯一": {
     "hp": 19683,
     "dmg": 0,
     "exp": 6500000,
     "type": "召唤型生物"
    }
   },
   "ai": {
    "aggro": false,
    "chase": false,
    "flee": false,
    "retaliate": false,
    "summoned": true
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 41,
   "file": "assets/mobs/41.svg",
   "name": "Fire Ant Egg",
   "zh": "火蚁卵",
   "biome": "",
   "hp": 3,
   "dmg": 0,
   "speed": 30,
   "size": 16,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "召唤型生物",
   "desc": "This ant is not yet on fire. （这只蚂蚁暂时还没火。）",
   "spawn": "A Super Fire Ant Egg has spawned somewhere! （一个超级火蚁卵在某处生成了！）",
   "rarities": {
    "普通": {
     "hp": 3,
     "dmg": 0,
     "exp": 1,
     "type": "召唤型生物"
    },
    "罕见": {
     "hp": 9,
     "dmg": 0,
     "exp": 1,
     "type": "召唤型生物"
    },
    "稀有": {
     "hp": 27,
     "dmg": 0,
     "exp": 3,
     "type": "召唤型生物"
    },
    "史诗": {
     "hp": 81,
     "dmg": 0,
     "exp": 21,
     "type": "召唤型生物"
    },
    "传奇": {
     "hp": 243,
     "dmg": 0,
     "exp": 190,
     "type": "召唤型生物"
    },
    "神话": {
     "hp": 729,
     "dmg": 0,
     "exp": 2600,
     "type": "召唤型生物"
    },
    "究极": {
     "hp": 2187,
     "dmg": 0,
     "exp": 130000,
     "type": "召唤型生物"
    },
    "超级": {
     "hp": 6561,
     "dmg": 0,
     "exp": 6500000,
     "type": "召唤型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "召唤型生物"
    },
    "唯一": {
     "hp": 19683,
     "dmg": 0,
     "exp": 6500000,
     "type": "召唤型生物"
    }
   },
   "ai": {
    "aggro": false,
    "chase": false,
    "flee": false,
    "retaliate": false,
    "summoned": true
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 42,
   "file": "assets/mobs/42.svg",
   "name": "Fly",
   "zh": "苍蝇",
   "biome": "",
   "hp": 10,
   "dmg": 90,
   "speed": 60,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "敌对型生物",
   "desc": "Hzzzzzzzzzzzz. （嗡嗡嗡嗡嗡嗡嗡嗡嗡嗡嗡嗡嗡）",
   "spawn": "A Super Fly has spawned somewhere! （一个超级苍蝇在某处生成了！）",
   "rarities": {
    "普通": {
     "hp": 10,
     "dmg": 90,
     "exp": 1,
     "type": "敌对型生物"
    },
    "罕见": {
     "hp": 30,
     "dmg": 90,
     "exp": 2,
     "type": "敌对型生物"
    },
    "稀有": {
     "hp": 90,
     "dmg": 90,
     "exp": 7,
     "type": "敌对型生物"
    },
    "史诗": {
     "hp": 270,
     "dmg": 90,
     "exp": 53,
     "type": "敌对型生物"
    },
    "传奇": {
     "hp": 810,
     "dmg": 90,
     "exp": 486,
     "type": "敌对型生物"
    },
    "神话": {
     "hp": 2430,
     "dmg": 90,
     "exp": 6900,
     "type": "敌对型生物"
    },
    "究极": {
     "hp": 7290,
     "dmg": 90,
     "exp": 328000,
     "type": "敌对型生物"
    },
    "超级": {
     "hp": 21870,
     "dmg": 90,
     "exp": 16000000,
     "type": "敌对型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "敌对型生物"
    },
    "唯一": {
     "hp": 65610,
     "dmg": 90,
     "exp": 16000000,
     "type": "敌对型生物"
    }
   },
   "ai": {
    "aggro": true,
    "chase": true,
    "flee": false,
    "retaliate": false,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 43,
   "file": "assets/mobs/43.svg",
   "name": "Leafbug",
   "zh": "叶虫",
   "biome": "",
   "hp": 30,
   "dmg": 0,
   "speed": 45,
   "size": 19,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "中立型生物",
   "desc": "It's not a leaf, but it is a bug. （它不是一片树叶，是一只虫子。）",
   "spawn": "A Super Leafbug has spawned somewhere! （一个超级叶虫在某处生成了！）",
   "rarities": {
    "普通": {
     "hp": 30,
     "dmg": 0,
     "exp": 1,
     "type": "中立型生物"
    },
    "罕见": {
     "hp": 90,
     "dmg": 0,
     "exp": 2,
     "type": "中立型生物"
    },
    "稀有": {
     "hp": 270,
     "dmg": 0,
     "exp": 5,
     "type": "中立型生物"
    },
    "史诗": {
     "hp": 810,
     "dmg": 0,
     "exp": 41,
     "type": "中立型生物"
    },
    "传奇": {
     "hp": 2430,
     "dmg": 0,
     "exp": 379,
     "type": "中立型生物"
    },
    "神话": {
     "hp": 7290,
     "dmg": 0,
     "exp": 5200,
     "type": "中立型生物"
    },
    "究极": {
     "hp": 21870,
     "dmg": 0,
     "exp": 260000,
     "type": "中立型生物"
    },
    "超级": {
     "hp": 65610,
     "dmg": 0,
     "exp": 13000000,
     "type": "中立型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "中立型生物"
    },
    "唯一": {
     "hp": 196830,
     "dmg": 0,
     "exp": 13000000,
     "type": "中立型生物"
    }
   },
   "ai": {
    "aggro": false,
    "chase": false,
    "flee": false,
    "retaliate": true,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 44,
   "file": "assets/mobs/44.svg",
   "name": "Mantis",
   "zh": "螳螂",
   "biome": "",
   "hp": 20,
   "dmg": 2,
   "speed": 60,
   "size": 18,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "敌对型生物",
   "desc": "You better pray you don't become dinner. （你最好祈祷你不会成为它的晚餐。）",
   "spawn": "A Super Mantis has spawned somewhere! （一个超级螳螂在某处生成了！）",
   "rarities": {
    "普通": {
     "hp": 20,
     "dmg": 2,
     "exp": 1,
     "type": "敌对型生物"
    },
    "罕见": {
     "hp": 60,
     "dmg": 12,
     "exp": 2,
     "type": "敌对型生物"
    },
    "稀有": {
     "hp": 180,
     "dmg": 62,
     "exp": 5,
     "type": "敌对型生物"
    },
    "史诗": {
     "hp": 540,
     "dmg": 312,
     "exp": 41,
     "type": "敌对型生物"
    },
    "传奇": {
     "hp": 1620,
     "dmg": 1600,
     "exp": 379,
     "type": "敌对型生物"
    },
    "神话": {
     "hp": 4860,
     "dmg": 7800,
     "exp": 5200,
     "type": "敌对型生物"
    },
    "究极": {
     "hp": 14580,
     "dmg": 1458,
     "exp": 260000,
     "type": "敌对型生物"
    },
    "超级": {
     "hp": 43740,
     "dmg": 4374,
     "exp": 13000000,
     "type": "敌对型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "敌对型生物"
    },
    "唯一": {
     "hp": 131220,
     "dmg": 13122,
     "exp": 13000000,
     "type": "敌对型生物"
    }
   },
   "ai": {
    "aggro": true,
    "chase": true,
    "flee": false,
    "retaliate": false,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 45,
   "file": "assets/mobs/45.svg",
   "name": "Baby Termite",
   "zh": "白幼蚁",
   "biome": "",
   "hp": 10,
   "dmg": 0,
   "speed": 35,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "被动型生物",
   "desc": "Weak and defenseless, but big dreams. These creatures appear to be connected somehow. （虽软弱无力，却有远大的梦想。 这些生物通过某种方式被连接了起来。）",
   "spawn": "A Super Baby Termite has spawned somewhere! （一个超级白幼蚁在某处生成了！）",
   "rarities": {
    "普通": {
     "hp": 10,
     "dmg": 0,
     "exp": 1,
     "type": "被动型生物"
    },
    "罕见": {
     "hp": 30,
     "dmg": 0,
     "exp": 1,
     "type": "被动型生物"
    },
    "稀有": {
     "hp": 90,
     "dmg": 0,
     "exp": 4,
     "type": "被动型生物"
    },
    "史诗": {
     "hp": 270,
     "dmg": 0,
     "exp": 28,
     "type": "被动型生物"
    },
    "传奇": {
     "hp": 810,
     "dmg": 0,
     "exp": 256,
     "type": "被动型生物"
    },
    "神话": {
     "hp": 2430,
     "dmg": 0,
     "exp": 3600,
     "type": "被动型生物"
    },
    "究极": {
     "hp": 7290,
     "dmg": 0,
     "exp": 169000,
     "type": "被动型生物"
    },
    "超级": {
     "hp": 21870,
     "dmg": 0,
     "exp": 8400000,
     "type": "被动型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "被动型生物"
    },
    "唯一": {
     "hp": 65610,
     "dmg": 0,
     "exp": 8400000,
     "type": "被动型生物"
    }
   },
   "ai": {
    "aggro": false,
    "chase": false,
    "flee": true,
    "retaliate": false,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 46,
   "file": "assets/mobs/46.svg",
   "name": "Worker Termite",
   "zh": "白工蚁",
   "biome": "",
   "hp": 10,
   "dmg": 0,
   "speed": 45,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "中立型生物",
   "desc": "It's a bit temperamental, probably from working all the time. These creatures appear to be connected somehow. （脾气有点暴躁，可能是一直在工作的缘故。 这些生物通过某种方式被连接了起来。）",
   "spawn": "A Super Worker Termite has spawned somewhere! （一个白工蚁在某处生成了！）",
   "rarities": {
    "普通": {
     "hp": 10,
     "dmg": 0,
     "exp": 1,
     "type": "中立型生物"
    },
    "罕见": {
     "hp": 30,
     "dmg": 0,
     "exp": 1,
     "type": "中立型生物"
    },
    "稀有": {
     "hp": 90,
     "dmg": 0,
     "exp": 3,
     "type": "中立型生物"
    },
    "史诗": {
     "hp": 270,
     "dmg": 0,
     "exp": 23,
     "type": "中立型生物"
    },
    "传奇": {
     "hp": 810,
     "dmg": 0,
     "exp": 206,
     "type": "中立型生物"
    },
    "神话": {
     "hp": 2430,
     "dmg": 0,
     "exp": 3100,
     "type": "中立型生物"
    },
    "究极": {
     "hp": 7290,
     "dmg": 0,
     "exp": 130000,
     "type": "中立型生物"
    },
    "超级": {
     "hp": 21870,
     "dmg": 0,
     "exp": 6600000,
     "type": "中立型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "中立型生物"
    },
    "唯一": {
     "hp": 65610,
     "dmg": 0,
     "exp": 6600000,
     "type": "中立型生物"
    }
   },
   "ai": {
    "aggro": false,
    "chase": false,
    "flee": false,
    "retaliate": true,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 47,
   "file": "assets/mobs/47.svg",
   "name": "Soldier Termite",
   "zh": "白兵蚁",
   "biome": "",
   "hp": 10,
   "dmg": 0,
   "speed": 60,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "敌对型生物",
   "desc": "It's got wings and it's ready to use them. These creatures appear to be connected somehow. （它有翅膀，并时刻准备着使用它们。 这些生物通过某种方式被连接了起来。）",
   "spawn": "A Super Soldier Termite has spawned somewhere! （一个超级白兵蚁在某处生成了！）",
   "rarities": {
    "普通": {
     "hp": 10,
     "dmg": 0,
     "exp": 1,
     "type": "敌对型生物"
    },
    "罕见": {
     "hp": 30,
     "dmg": 0,
     "exp": 1,
     "type": "敌对型生物"
    },
    "稀有": {
     "hp": 90,
     "dmg": 0,
     "exp": 4,
     "type": "敌对型生物"
    },
    "史诗": {
     "hp": 270,
     "dmg": 0,
     "exp": 28,
     "type": "敌对型生物"
    },
    "传奇": {
     "hp": 810,
     "dmg": 0,
     "exp": 256,
     "type": "敌对型生物"
    },
    "神话": {
     "hp": 2430,
     "dmg": 0,
     "exp": 3600,
     "type": "敌对型生物"
    },
    "究极": {
     "hp": 7290,
     "dmg": 0,
     "exp": 169000,
     "type": "敌对型生物"
    },
    "超级": {
     "hp": 21870,
     "dmg": 0,
     "exp": 8400000,
     "type": "敌对型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "敌对型生物"
    },
    "唯一": {
     "hp": 65610,
     "dmg": 0,
     "exp": 8400000,
     "type": "敌对型生物"
    }
   },
   "ai": {
    "aggro": true,
    "chase": true,
    "flee": false,
    "retaliate": false,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 48,
   "file": "assets/mobs/48.svg",
   "name": "Termite Overmind",
   "zh": "白蚁主宰者",
   "biome": "",
   "hp": 10,
   "dmg": 0,
   "speed": 45,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "中立型生物",
   "desc": "The one who oversees all. （运筹帷幄之中。）",
   "spawn": "A Super Termite Overmind has spawned somewhere! （一个超级白蚁主宰者在某处生成了！）",
   "rarities": {
    "普通": {
     "hp": 10,
     "dmg": 0,
     "exp": 1,
     "type": "中立型生物"
    },
    "罕见": {
     "hp": 30,
     "dmg": 0,
     "exp": 2,
     "type": "中立型生物"
    },
    "稀有": {
     "hp": 90,
     "dmg": 0,
     "exp": 10,
     "type": "中立型生物"
    },
    "史诗": {
     "hp": 270,
     "dmg": 0,
     "exp": 78,
     "type": "中立型生物"
    },
    "传奇": {
     "hp": 810,
     "dmg": 0,
     "exp": 742,
     "type": "中立型生物"
    },
    "神话": {
     "hp": 2430,
     "dmg": 0,
     "exp": 8500,
     "type": "中立型生物"
    },
    "究极": {
     "hp": 7290,
     "dmg": 0,
     "exp": 704000,
     "type": "中立型生物"
    },
    "超级": {
     "hp": 21870,
     "dmg": 0,
     "exp": 28000000,
     "type": "中立型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "中立型生物"
    },
    "唯一": {
     "hp": 65610,
     "dmg": 0,
     "exp": 28000000,
     "type": "中立型生物"
    }
   },
   "ai": {
    "aggro": false,
    "chase": false,
    "flee": false,
    "retaliate": true,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 49,
   "file": "assets/mobs/49.svg",
   "name": "Termite Mound",
   "zh": "白蚁丘",
   "biome": "",
   "hp": 0,
   "dmg": 0,
   "speed": 45,
   "size": 16,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "技术型生物",
   "desc": "Termites go in, and come out. Can't explain that. （白蚁进进又出出，这根本无法解释。）",
   "spawn": "A Super Termite Mound has spawned somewhere! （一个超级白蚁丘在某处生成了！）",
   "rarities": {
    "普通": {
     "hp": 0,
     "dmg": 0,
     "exp": 1,
     "type": "技术型生物"
    },
    "罕见": {
     "hp": 0,
     "dmg": 0,
     "exp": 2,
     "type": "技术型生物"
    },
    "稀有": {
     "hp": 0,
     "dmg": 0,
     "exp": 7,
     "type": "技术型生物"
    },
    "史诗": {
     "hp": 0,
     "dmg": 0,
     "exp": 54,
     "type": "技术型生物"
    },
    "传奇": {
     "hp": 0,
     "dmg": 0,
     "exp": 495,
     "type": "技术型生物"
    },
    "神话": {
     "hp": 0,
     "dmg": 0,
     "exp": 7000,
     "type": "技术型生物"
    },
    "究极": {
     "hp": 0,
     "dmg": 0,
     "exp": 335000,
     "type": "技术型生物"
    },
    "超级": {
     "hp": 0,
     "dmg": 0,
     "exp": 17000000,
     "type": "技术型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "技术型生物"
    },
    "唯一": {
     "hp": 0,
     "dmg": 0,
     "exp": 17000000,
     "type": "技术型生物"
    }
   },
   "ai": {
    "aggro": false,
    "chase": false,
    "flee": false,
    "retaliate": false,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 50,
   "file": "assets/mobs/50.svg",
   "name": "Termite Egg",
   "zh": "白蚁卵",
   "biome": "",
   "hp": 3,
   "dmg": 0,
   "speed": 30,
   "size": 16,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "召唤型生物",
   "desc": "Not yet a termite but perhaps soon. （还不是一只白蚁，但是可能快了。）",
   "spawn": "A Super Termite Egg has spawned somewhere! （一个超级白蚁卵在某处生成了！）",
   "rarities": {
    "普通": {
     "hp": 3,
     "dmg": 0,
     "exp": 1,
     "type": "召唤型生物"
    },
    "罕见": {
     "hp": 9,
     "dmg": 0,
     "exp": 1,
     "type": "召唤型生物"
    },
    "稀有": {
     "hp": 27,
     "dmg": 0,
     "exp": 4,
     "type": "召唤型生物"
    },
    "史诗": {
     "hp": 81,
     "dmg": 0,
     "exp": 28,
     "type": "召唤型生物"
    },
    "传奇": {
     "hp": 243,
     "dmg": 0,
     "exp": 256,
     "type": "召唤型生物"
    },
    "神话": {
     "hp": 729,
     "dmg": 0,
     "exp": 3600,
     "type": "召唤型生物"
    },
    "究极": {
     "hp": 2187,
     "dmg": 0,
     "exp": 169000,
     "type": "召唤型生物"
    },
    "超级": {
     "hp": 6561,
     "dmg": 0,
     "exp": 8400000,
     "type": "召唤型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "召唤型生物"
    },
    "唯一": {
     "hp": 19683,
     "dmg": 0,
     "exp": 8400000,
     "type": "召唤型生物"
    }
   },
   "ai": {
    "aggro": false,
    "chase": false,
    "flee": false,
    "retaliate": false,
    "summoned": true
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 51,
   "file": "assets/mobs/51.svg",
   "name": "Bush",
   "zh": "灌木丛",
   "biome": "",
   "hp": 10,
   "dmg": 0,
   "speed": 0,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "障碍型生物",
   "desc": "Don't misunderestimate me. （可别小看我。）",
   "spawn": "A Super Bush has spawned somewhere! （一个超级灌木在某处生成了！）",
   "rarities": {
    "普通": {
     "hp": 10,
     "dmg": 0,
     "exp": 1,
     "type": "障碍型生物"
    },
    "罕见": {
     "hp": 30,
     "dmg": 0,
     "exp": 1,
     "type": "障碍型生物"
    },
    "稀有": {
     "hp": 90,
     "dmg": 0,
     "exp": 4,
     "type": "障碍型生物"
    },
    "史诗": {
     "hp": 270,
     "dmg": 0,
     "exp": 31,
     "type": "障碍型生物"
    },
    "传奇": {
     "hp": 810,
     "dmg": 0,
     "exp": 387,
     "type": "障碍型生物"
    },
    "神话": {
     "hp": 2430,
     "dmg": 0,
     "exp": 6100,
     "type": "障碍型生物"
    },
    "究极": {
     "hp": 7290,
     "dmg": 0,
     "exp": 329000,
     "type": "障碍型生物"
    },
    "超级": {
     "hp": 21870,
     "dmg": 0,
     "exp": 15000000,
     "type": "障碍型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "障碍型生物"
    },
    "唯一": {
     "hp": 65610,
     "dmg": 0,
     "exp": 15000000,
     "type": "障碍型生物"
    }
   },
   "ai": {
    "aggro": false,
    "chase": false,
    "flee": false,
    "retaliate": false,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 52,
   "file": "assets/mobs/52.svg",
   "name": "Roach",
   "zh": "蟑螂",
   "biome": "",
   "hp": 20,
   "dmg": 0,
   "speed": 45,
   "size": 18,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "中立型生物",
   "desc": "Gotta go FAST… until they get tired. （要 加 速 了……直到它累了。）",
   "spawn": "A Super Roach has spawned somewhere! （一个超级蟑螂在某处生成了！）",
   "rarities": {
    "普通": {
     "hp": 20,
     "dmg": 0,
     "exp": 1,
     "type": "中立型生物"
    },
    "罕见": {
     "hp": 60,
     "dmg": 0,
     "exp": 1,
     "type": "中立型生物"
    },
    "稀有": {
     "hp": 180,
     "dmg": 0,
     "exp": 3,
     "type": "中立型生物"
    },
    "史诗": {
     "hp": 540,
     "dmg": 0,
     "exp": 28,
     "type": "中立型生物"
    },
    "传奇": {
     "hp": 1620,
     "dmg": 0,
     "exp": 256,
     "type": "中立型生物"
    },
    "神话": {
     "hp": 4860,
     "dmg": 0,
     "exp": 3600,
     "type": "中立型生物"
    },
    "究极": {
     "hp": 14580,
     "dmg": 0,
     "exp": 169000,
     "type": "中立型生物"
    },
    "超级": {
     "hp": 43740,
     "dmg": 0,
     "exp": 8400000,
     "type": "中立型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "中立型生物"
    },
    "唯一": {
     "hp": 131220,
     "dmg": 0,
     "exp": 8400000,
     "type": "中立型生物"
    }
   },
   "ai": {
    "aggro": false,
    "chase": false,
    "flee": false,
    "retaliate": true,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 53,
   "file": "assets/mobs/53.svg",
   "name": "Moth",
   "zh": "飞蛾",
   "biome": "",
   "hp": 10,
   "dmg": 0,
   "speed": 45,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "中立型生物",
   "desc": "Easily scared, be nice. （容易受惊，请对它们好点。）",
   "spawn": "A Super Moth has spawned somewhere! （一个超级飞蛾在某处生成了！）",
   "rarities": {
    "普通": {
     "hp": 10,
     "dmg": 0,
     "exp": 1,
     "type": "中立型生物"
    },
    "罕见": {
     "hp": 30,
     "dmg": 0,
     "exp": 2,
     "type": "中立型生物"
    },
    "稀有": {
     "hp": 90,
     "dmg": 0,
     "exp": 5,
     "type": "中立型生物"
    },
    "史诗": {
     "hp": 270,
     "dmg": 0,
     "exp": 41,
     "type": "中立型生物"
    },
    "传奇": {
     "hp": 810,
     "dmg": 0,
     "exp": 379,
     "type": "中立型生物"
    },
    "神话": {
     "hp": 2430,
     "dmg": 0,
     "exp": 5200,
     "type": "中立型生物"
    },
    "究极": {
     "hp": 7290,
     "dmg": 0,
     "exp": 260000,
     "type": "中立型生物"
    },
    "超级": {
     "hp": 21870,
     "dmg": 0,
     "exp": 13000000,
     "type": "中立型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "中立型生物"
    },
    "唯一": {
     "hp": 65610,
     "dmg": 0,
     "exp": 13000000,
     "type": "中立型生物"
    }
   },
   "ai": {
    "aggro": false,
    "chase": false,
    "flee": false,
    "retaliate": true,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 54,
   "file": "assets/mobs/54.svg",
   "name": "Firefly",
   "zh": "萤火虫",
   "biome": "",
   "hp": 5,
   "dmg": 13,
   "speed": 45,
   "size": 16,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "中立型生物",
   "desc": "Oooooh shiny. （呜呜呜哦好闪亮。）",
   "spawn": "There's a bright light in the horizon... （地平线上，一道明亮的黄色光芒刺破夜幕……）",
   "rarities": {
    "普通": {
     "hp": 5,
     "dmg": 13,
     "exp": 1,
     "type": "中立型生物"
    },
    "罕见": {
     "hp": 15,
     "dmg": 39,
     "exp": 2,
     "type": "中立型生物"
    },
    "稀有": {
     "hp": 45,
     "dmg": 117,
     "exp": 7,
     "type": "中立型生物"
    },
    "史诗": {
     "hp": 135,
     "dmg": 351,
     "exp": 49,
     "type": "中立型生物"
    },
    "传奇": {
     "hp": 405,
     "dmg": 1053,
     "exp": 445,
     "type": "中立型生物"
    },
    "神话": {
     "hp": 1215,
     "dmg": 3159,
     "exp": 6200,
     "type": "中立型生物"
    },
    "究极": {
     "hp": 3645,
     "dmg": 9477,
     "exp": 299000,
     "type": "中立型生物"
    },
    "超级": {
     "hp": 10935,
     "dmg": 28431,
     "exp": 15000000,
     "type": "中立型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "中立型生物"
    },
    "唯一": {
     "hp": 32805,
     "dmg": 85293,
     "exp": 15000000,
     "type": "中立型生物"
    }
   },
   "ai": {
    "aggro": false,
    "chase": false,
    "flee": false,
    "retaliate": true,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 55,
   "file": "assets/mobs/55.svg",
   "name": "Beetle (Hel)",
   "zh": "甲虫",
   "biome": "",
   "hp": 30,
   "dmg": 0,
   "speed": 60,
   "size": 19,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "敌对型生物",
   "desc": "Scourge that spawns in the other plane. （在异域诞生的亡灵。）",
   "spawn": "You sense ominous vibrations coming from a different realm... （大地之下，位面之间，异界的不祥波动悄然涌来……）",
   "rarities": {
    "普通": {
     "hp": 30,
     "dmg": 0,
     "exp": 1,
     "type": "敌对型生物"
    },
    "罕见": {
     "hp": 90,
     "dmg": 0,
     "exp": 1,
     "type": "敌对型生物"
    },
    "稀有": {
     "hp": 270,
     "dmg": 0,
     "exp": 3,
     "type": "敌对型生物"
    },
    "史诗": {
     "hp": 810,
     "dmg": 0,
     "exp": 18,
     "type": "敌对型生物"
    },
    "传奇": {
     "hp": 2430,
     "dmg": 0,
     "exp": 165,
     "type": "敌对型生物"
    },
    "神话": {
     "hp": 7290,
     "dmg": 0,
     "exp": 2500,
     "type": "敌对型生物"
    },
    "究极": {
     "hp": 21870,
     "dmg": 0,
     "exp": 95200,
     "type": "敌对型生物"
    },
    "超级": {
     "hp": 65610,
     "dmg": 0,
     "exp": 4800000,
     "type": "敌对型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "敌对型生物"
    },
    "唯一": {
     "hp": 196830,
     "dmg": 0,
     "exp": 4800000,
     "type": "敌对型生物"
    }
   },
   "ai": {
    "aggro": true,
    "chase": true,
    "flee": false,
    "retaliate": false,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 56,
   "file": "assets/mobs/56.svg",
   "name": "Wasp",
   "zh": "胡蜂",
   "biome": "",
   "hp": 50,
   "dmg": 5,
   "speed": 60,
   "size": 22,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "敌对型生物",
   "desc": "They are ANGRY. （它们 生 气 了。）",
   "spawn": "A Super Wasp has spawned somewhere! （一个超级胡蜂在某处生成了！）",
   "rarities": {
    "普通": {
     "hp": 50,
     "dmg": 5,
     "exp": 1,
     "type": "敌对型生物"
    },
    "罕见": {
     "hp": 150,
     "dmg": 25,
     "exp": 2,
     "type": "敌对型生物"
    },
    "稀有": {
     "hp": 450,
     "dmg": 125,
     "exp": 8,
     "type": "敌对型生物"
    },
    "史诗": {
     "hp": 1350,
     "dmg": 625,
     "exp": 69,
     "type": "敌对型生物"
    },
    "传奇": {
     "hp": 4050,
     "dmg": 3125,
     "exp": 647,
     "type": "敌对型生物"
    },
    "神话": {
     "hp": 12150,
     "dmg": 15625,
     "exp": 8200,
     "type": "敌对型生物"
    },
    "究极": {
     "hp": 36450,
     "dmg": 78125,
     "exp": 431000,
     "type": "敌对型生物"
    },
    "超级": {
     "hp": 109350,
     "dmg": 390625,
     "exp": 19000000,
     "type": "敌对型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "敌对型生物"
    },
    "唯一": {
     "hp": 328050,
     "dmg": 1953125,
     "exp": 19000000,
     "type": "敌对型生物"
    }
   },
   "ai": {
    "aggro": true,
    "chase": true,
    "flee": false,
    "retaliate": false,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 57,
   "file": "assets/mobs/57.svg",
   "name": "Target Dummy",
   "zh": "训练假花",
   "biome": "",
   "hp": 10,
   "dmg": 0,
   "speed": 45,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "NPC生物",
   "desc": "How do you have this in your gallery? （它怎么跑到你的图鉴里的？）",
   "spawn": "- （-）",
   "rarities": {
    "普通": {
     "hp": 10,
     "dmg": 0,
     "exp": 1,
     "type": "NPC生物"
    },
    "罕见": {
     "hp": 30,
     "dmg": 0,
     "exp": 1,
     "type": "NPC生物"
    },
    "稀有": {
     "hp": 90,
     "dmg": 0,
     "exp": 1,
     "type": "NPC生物"
    },
    "史诗": {
     "hp": 270,
     "dmg": 0,
     "exp": 1,
     "type": "NPC生物"
    },
    "传奇": {
     "hp": 810,
     "dmg": 0,
     "exp": 1,
     "type": "NPC生物"
    },
    "神话": {
     "hp": 2400,
     "dmg": 0,
     "exp": 1,
     "type": "NPC生物"
    },
    "究极": {
     "hp": 7300,
     "dmg": 0,
     "exp": 1,
     "type": "NPC生物"
    },
    "超级": {
     "hp": 21900,
     "dmg": 0,
     "exp": 1,
     "type": "NPC生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "NPC生物"
    },
    "唯一": {
     "hp": 65600,
     "dmg": 0,
     "exp": 1,
     "type": "NPC生物"
    }
   },
   "ai": {
    "aggro": false,
    "chase": false,
    "flee": false,
    "retaliate": false,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 58,
   "file": "assets/mobs/58.svg",
   "name": "Spider (Hel)",
   "zh": "蜘蛛",
   "biome": "",
   "hp": 15,
   "dmg": 80,
   "speed": 60,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "敌对型生物",
   "desc": "Scourge that spawns in the other plane. （在异域诞生的亡灵。）",
   "spawn": "You sense ominous vibrations coming from a different realm... （大地之下，位面之间，异界的不祥波动悄然涌来……）",
   "rarities": {
    "普通": {
     "hp": 15,
     "dmg": 80,
     "exp": 1,
     "type": "敌对型生物"
    },
    "罕见": {
     "hp": 45,
     "dmg": 240,
     "exp": 1,
     "type": "敌对型生物"
    },
    "稀有": {
     "hp": 135,
     "dmg": 720,
     "exp": 2,
     "type": "敌对型生物"
    },
    "史诗": {
     "hp": 405,
     "dmg": 2160,
     "exp": 14,
     "type": "敌对型生物"
    },
    "传奇": {
     "hp": 1215,
     "dmg": 6480,
     "exp": 130,
     "type": "敌对型生物"
    },
    "神话": {
     "hp": 3645,
     "dmg": 19440,
     "exp": 2000,
     "type": "敌对型生物"
    },
    "究极": {
     "hp": 10935,
     "dmg": 58320,
     "exp": 85700,
     "type": "敌对型生物"
    },
    "超级": {
     "hp": 32805,
     "dmg": 174960,
     "exp": 4500000,
     "type": "敌对型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "敌对型生物"
    },
    "唯一": {
     "hp": 98415,
     "dmg": 524880,
     "exp": 4500000,
     "type": "敌对型生物"
    }
   },
   "ai": {
    "aggro": true,
    "chase": true,
    "flee": false,
    "retaliate": false,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 59,
   "file": "assets/mobs/59.svg",
   "name": "Centipede (Hel)",
   "zh": "蜈蚣",
   "biome": "",
   "hp": 30,
   "dmg": 0,
   "speed": 60,
   "size": 19,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "敌对型生物",
   "desc": "Scourge that spawns in the other plane. （在异域诞生的亡灵。）",
   "spawn": "You sense ominous vibrations coming from a different realm... （大地之下，位面之间，异界的不祥波动悄然涌来……）",
   "rarities": {
    "普通": {
     "hp": 30,
     "dmg": 0,
     "exp": 1,
     "type": "敌对型生物"
    },
    "罕见": {
     "hp": 90,
     "dmg": 0,
     "exp": 1,
     "type": "敌对型生物"
    },
    "稀有": {
     "hp": 270,
     "dmg": 0,
     "exp": 1,
     "type": "敌对型生物"
    },
    "史诗": {
     "hp": 810,
     "dmg": 0,
     "exp": 3,
     "type": "敌对型生物"
    },
    "传奇": {
     "hp": 2430,
     "dmg": 0,
     "exp": 26,
     "type": "敌对型生物"
    },
    "神话": {
     "hp": 7290,
     "dmg": 0,
     "exp": 386,
     "type": "敌对型生物"
    },
    "究极": {
     "hp": 21870,
     "dmg": 0,
     "exp": 12500,
     "type": "敌对型生物"
    },
    "超级": {
     "hp": 65610,
     "dmg": 0,
     "exp": 613000,
     "type": "敌对型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "敌对型生物"
    },
    "唯一": {
     "hp": 196830,
     "dmg": 0,
     "exp": 613000,
     "type": "敌对型生物"
    }
   },
   "ai": {
    "aggro": true,
    "chase": true,
    "flee": false,
    "retaliate": false,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 60,
   "file": "assets/mobs/60.svg",
   "name": "Centipede (Hel) (Body)",
   "zh": "蜈蚣",
   "biome": "",
   "hp": 30,
   "dmg": 0,
   "speed": 60,
   "size": 19,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "敌对型生物",
   "desc": "Scourge that spawns in the other plane. （在异域诞生的亡灵。）",
   "spawn": "- （-）",
   "rarities": {
    "普通": {
     "hp": 30,
     "dmg": 0,
     "exp": 1,
     "type": "敌对型生物"
    },
    "罕见": {
     "hp": 90,
     "dmg": 0,
     "exp": 1,
     "type": "敌对型生物"
    },
    "稀有": {
     "hp": 270,
     "dmg": 0,
     "exp": 1,
     "type": "敌对型生物"
    },
    "史诗": {
     "hp": 810,
     "dmg": 0,
     "exp": 3,
     "type": "敌对型生物"
    },
    "传奇": {
     "hp": 2430,
     "dmg": 0,
     "exp": 26,
     "type": "敌对型生物"
    },
    "神话": {
     "hp": 7290,
     "dmg": 0,
     "exp": 386,
     "type": "敌对型生物"
    },
    "究极": {
     "hp": 21870,
     "dmg": 0,
     "exp": 12500,
     "type": "敌对型生物"
    },
    "超级": {
     "hp": 65610,
     "dmg": 0,
     "exp": 613000,
     "type": "敌对型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "敌对型生物"
    },
    "唯一": {
     "hp": 196830,
     "dmg": 0,
     "exp": 613000,
     "type": "敌对型生物"
    }
   },
   "ai": {
    "aggro": true,
    "chase": true,
    "flee": false,
    "retaliate": false,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 61,
   "file": "assets/mobs/61.svg",
   "name": "Wasp (Hel)",
   "zh": "胡蜂",
   "biome": "",
   "hp": 50,
   "dmg": 2,
   "speed": 60,
   "size": 22,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "敌对型生物",
   "desc": "Scourge that spawns in the other plane. （在异域诞生的亡灵。）",
   "spawn": "You sense ominous vibrations coming from a different realm... （大地之下，位面之间，异界的不祥波动悄然涌来……）",
   "rarities": {
    "普通": {
     "hp": 50,
     "dmg": 2,
     "exp": 1,
     "type": "敌对型生物"
    },
    "罕见": {
     "hp": 150,
     "dmg": 12,
     "exp": 2,
     "type": "敌对型生物"
    },
    "稀有": {
     "hp": 450,
     "dmg": 62,
     "exp": 7,
     "type": "敌对型生物"
    },
    "史诗": {
     "hp": 1350,
     "dmg": 312,
     "exp": 54,
     "type": "敌对型生物"
    },
    "传奇": {
     "hp": 4050,
     "dmg": 1600,
     "exp": 503,
     "type": "敌对型生物"
    },
    "神话": {
     "hp": 12150,
     "dmg": 1215,
     "exp": 6200,
     "type": "敌对型生物"
    },
    "究极": {
     "hp": 36450,
     "dmg": 3645,
     "exp": 329000,
     "type": "敌对型生物"
    },
    "超级": {
     "hp": 109350,
     "dmg": 10935,
     "exp": 14000000,
     "type": "敌对型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "敌对型生物"
    },
    "唯一": {
     "hp": 328050,
     "dmg": 32805,
     "exp": 14000000,
     "type": "敌对型生物"
    }
   },
   "ai": {
    "aggro": true,
    "chase": true,
    "flee": false,
    "retaliate": false,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 62,
   "file": "assets/mobs/62.svg",
   "name": "Trader",
   "zh": "商人",
   "biome": "",
   "hp": 0,
   "dmg": 0,
   "speed": 45,
   "size": 16,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "NPC生物",
   "desc": "- （-）",
   "spawn": "- （-）",
   "rarities": {
    "普通": {
     "hp": 0,
     "dmg": 0,
     "exp": 1,
     "type": "NPC生物"
    },
    "罕见": {
     "hp": 0,
     "dmg": 0,
     "exp": 1,
     "type": "NPC生物"
    },
    "稀有": {
     "hp": 0,
     "dmg": 0,
     "exp": 1,
     "type": "NPC生物"
    },
    "史诗": {
     "hp": 0,
     "dmg": 0,
     "exp": 1,
     "type": "NPC生物"
    },
    "传奇": {
     "hp": 0,
     "dmg": 0,
     "exp": 1,
     "type": "NPC生物"
    },
    "神话": {
     "hp": 0,
     "dmg": 0,
     "exp": 1,
     "type": "NPC生物"
    },
    "究极": {
     "hp": 0,
     "dmg": 0,
     "exp": 1,
     "type": "NPC生物"
    },
    "超级": {
     "hp": 0,
     "dmg": 0,
     "exp": 1,
     "type": "NPC生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "NPC生物"
    },
    "唯一": {
     "hp": 0,
     "dmg": 0,
     "exp": 1,
     "type": "NPC生物"
    }
   },
   "ai": {
    "aggro": false,
    "chase": false,
    "flee": false,
    "retaliate": false,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 63,
   "file": "assets/mobs/63.svg",
   "name": "Gambler",
   "zh": "赌徒",
   "biome": "",
   "hp": 15,
   "dmg": 0,
   "speed": 45,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "NPC生物",
   "desc": "This can happen to YOU. （你 也有可能会变成这样。）",
   "spawn": "You hear someone whisper faintly... \"just... one more game...\" （耳畔旁，微微回荡着不知源头的飘渺呢喃…… “最后……就最后一注……”）",
   "rarities": {
    "普通": {
     "hp": 15,
     "dmg": 0,
     "exp": 1,
     "type": "NPC生物"
    },
    "罕见": {
     "hp": 45,
     "dmg": 0,
     "exp": 2,
     "type": "NPC生物"
    },
    "稀有": {
     "hp": 135,
     "dmg": 0,
     "exp": 10,
     "type": "NPC生物"
    },
    "史诗": {
     "hp": 405,
     "dmg": 0,
     "exp": 82,
     "type": "NPC生物"
    },
    "传奇": {
     "hp": 1215,
     "dmg": 0,
     "exp": 757,
     "type": "NPC生物"
    },
    "神话": {
     "hp": 3645,
     "dmg": 0,
     "exp": 10500,
     "type": "NPC生物"
    },
    "究极": {
     "hp": 10935,
     "dmg": 0,
     "exp": 725000,
     "type": "NPC生物"
    },
    "超级": {
     "hp": 32805,
     "dmg": 0,
     "exp": 36000000,
     "type": "NPC生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "NPC生物"
    },
    "唯一": {
     "hp": 98415,
     "dmg": 0,
     "exp": 36000000,
     "type": "NPC生物"
    }
   },
   "ai": {
    "aggro": false,
    "chase": false,
    "flee": false,
    "retaliate": false,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 64,
   "file": "assets/mobs/64.svg",
   "name": "Oracle",
   "zh": "神使",
   "biome": "",
   "hp": 0,
   "dmg": 0,
   "speed": 45,
   "size": 16,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "NPC生物",
   "desc": "- （-）",
   "spawn": "- （-）",
   "rarities": {
    "普通": {
     "hp": 0,
     "dmg": 0,
     "exp": 1,
     "type": "NPC生物"
    },
    "罕见": {
     "hp": 0,
     "dmg": 0,
     "exp": 1,
     "type": "NPC生物"
    },
    "稀有": {
     "hp": 0,
     "dmg": 0,
     "exp": 1,
     "type": "NPC生物"
    },
    "史诗": {
     "hp": 0,
     "dmg": 0,
     "exp": 1,
     "type": "NPC生物"
    },
    "传奇": {
     "hp": 0,
     "dmg": 0,
     "exp": 1,
     "type": "NPC生物"
    },
    "神话": {
     "hp": 0,
     "dmg": 0,
     "exp": 1,
     "type": "NPC生物"
    },
    "究极": {
     "hp": 0,
     "dmg": 0,
     "exp": 1,
     "type": "NPC生物"
    },
    "超级": {
     "hp": 0,
     "dmg": 0,
     "exp": 1,
     "type": "NPC生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "NPC生物"
    },
    "唯一": {
     "hp": 0,
     "dmg": 0,
     "exp": 1,
     "type": "NPC生物"
    }
   },
   "ai": {
    "aggro": false,
    "chase": false,
    "flee": false,
    "retaliate": false,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 65,
   "file": "assets/mobs/65.svg",
   "name": "Firefly (Magic)",
   "zh": "萤火虫",
   "biome": "",
   "hp": 5,
   "dmg": 13,
   "speed": 45,
   "size": 16,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "中立型生物",
   "desc": "There's something magical about this one. （这只萤火虫有一种神奇的魔力。）",
   "spawn": "A Super Firefly has spawned somewhere! （一个超级萤火虫在某处生成了！）",
   "rarities": {
    "普通": {
     "hp": 5,
     "dmg": 13,
     "exp": 1,
     "type": "中立型生物"
    },
    "罕见": {
     "hp": 15,
     "dmg": 39,
     "exp": 2,
     "type": "中立型生物"
    },
    "稀有": {
     "hp": 45,
     "dmg": 117,
     "exp": 9,
     "type": "中立型生物"
    },
    "史诗": {
     "hp": 135,
     "dmg": 351,
     "exp": 69,
     "type": "中立型生物"
    },
    "传奇": {
     "hp": 405,
     "dmg": 1053,
     "exp": 658,
     "type": "中立型生物"
    },
    "神话": {
     "hp": 1215,
     "dmg": 3159,
     "exp": 7700,
     "type": "中立型生物"
    },
    "究极": {
     "hp": 3645,
     "dmg": 9477,
     "exp": 442000,
     "type": "中立型生物"
    },
    "超级": {
     "hp": 10935,
     "dmg": 28431,
     "exp": 17000000,
     "type": "中立型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "中立型生物"
    },
    "唯一": {
     "hp": 32805,
     "dmg": 85293,
     "exp": 17000000,
     "type": "中立型生物"
    }
   },
   "ai": {
    "aggro": false,
    "chase": false,
    "flee": false,
    "retaliate": true,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 66,
   "file": "assets/mobs/66.svg",
   "name": "Titan",
   "zh": "泰坦",
   "biome": "",
   "hp": 20,
   "dmg": 0,
   "speed": 45,
   "size": 18,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "NPC生物",
   "desc": "- （-）",
   "spawn": "- （-）",
   "rarities": {
    "普通": {
     "hp": 20,
     "dmg": 0,
     "exp": 1,
     "type": "NPC生物"
    },
    "罕见": {
     "hp": 60,
     "dmg": 0,
     "exp": 1,
     "type": "NPC生物"
    },
    "稀有": {
     "hp": 180,
     "dmg": 0,
     "exp": 1,
     "type": "NPC生物"
    },
    "史诗": {
     "hp": 540,
     "dmg": 0,
     "exp": 1,
     "type": "NPC生物"
    },
    "传奇": {
     "hp": 1620,
     "dmg": 0,
     "exp": 1,
     "type": "NPC生物"
    },
    "神话": {
     "hp": 4860,
     "dmg": 0,
     "exp": 1,
     "type": "NPC生物"
    },
    "究极": {
     "hp": 14580,
     "dmg": 0,
     "exp": 1,
     "type": "NPC生物"
    },
    "超级": {
     "hp": 43740,
     "dmg": 0,
     "exp": 1,
     "type": "NPC生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "NPC生物"
    },
    "唯一": {
     "hp": 131220,
     "dmg": 0,
     "exp": 1,
     "type": "NPC生物"
    }
   },
   "ai": {
    "aggro": false,
    "chase": false,
    "flee": false,
    "retaliate": false,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 67,
   "file": "assets/mobs/67.svg",
   "name": "Beetle (Nazar)",
   "zh": "甲虫",
   "biome": "",
   "hp": 30,
   "dmg": 0,
   "speed": 45,
   "size": 19,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "中立型生物",
   "desc": "This one has a different pattern... what does that mean? （它有一个不一样的图案……这是什么意思？）",
   "spawn": "A Super Beetle has spawned somewhere! （一个超级甲虫在某处生成了！）",
   "rarities": {
    "普通": {
     "hp": 30,
     "dmg": 0,
     "exp": 1,
     "type": "中立型生物"
    },
    "罕见": {
     "hp": 90,
     "dmg": 0,
     "exp": 2,
     "type": "中立型生物"
    },
    "稀有": {
     "hp": 270,
     "dmg": 0,
     "exp": 7,
     "type": "中立型生物"
    },
    "史诗": {
     "hp": 810,
     "dmg": 0,
     "exp": 54,
     "type": "中立型生物"
    },
    "传奇": {
     "hp": 2430,
     "dmg": 0,
     "exp": 522,
     "type": "中立型生物"
    },
    "神话": {
     "hp": 7290,
     "dmg": 0,
     "exp": 6000,
     "type": "中立型生物"
    },
    "究极": {
     "hp": 21870,
     "dmg": 0,
     "exp": 336000,
     "type": "中立型生物"
    },
    "超级": {
     "hp": 65610,
     "dmg": 0,
     "exp": 12000000,
     "type": "中立型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "中立型生物"
    },
    "唯一": {
     "hp": 196830,
     "dmg": 0,
     "exp": 12000000,
     "type": "中立型生物"
    }
   },
   "ai": {
    "aggro": false,
    "chase": false,
    "flee": false,
    "retaliate": true,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 68,
   "file": "assets/mobs/68.svg",
   "name": "Worm",
   "zh": "蠕虫",
   "biome": "",
   "hp": 30,
   "dmg": 0,
   "speed": 60,
   "size": 19,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "敌对型生物",
   "desc": "It's supposed to eat dirt but this one's eating flowers. （蠕虫本应吃土，它却吃花。）",
   "spawn": "A Super Worm has spawned somewhere! （一个超级蠕虫在某处生成了！）",
   "rarities": {
    "普通": {
     "hp": 30,
     "dmg": 0,
     "exp": 1,
     "type": "敌对型生物"
    },
    "罕见": {
     "hp": 90,
     "dmg": 0,
     "exp": 1,
     "type": "敌对型生物"
    },
    "稀有": {
     "hp": 270,
     "dmg": 0,
     "exp": 4,
     "type": "敌对型生物"
    },
    "史诗": {
     "hp": 810,
     "dmg": 0,
     "exp": 27,
     "type": "敌对型生物"
    },
    "传奇": {
     "hp": 2430,
     "dmg": 0,
     "exp": 247,
     "type": "敌对型生物"
    },
    "神话": {
     "hp": 7290,
     "dmg": 0,
     "exp": 3700,
     "type": "敌对型生物"
    },
    "究极": {
     "hp": 21870,
     "dmg": 0,
     "exp": 160000,
     "type": "敌对型生物"
    },
    "超级": {
     "hp": 65610,
     "dmg": 0,
     "exp": 8100000,
     "type": "敌对型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "敌对型生物"
    },
    "唯一": {
     "hp": 196830,
     "dmg": 0,
     "exp": 8100000,
     "type": "敌对型生物"
    }
   },
   "ai": {
    "aggro": true,
    "chase": true,
    "flee": false,
    "retaliate": false,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 69,
   "file": "assets/mobs/69.svg",
   "name": "Worm Guts",
   "zh": "蠕虫内脏",
   "biome": "",
   "hp": 5,
   "dmg": 0,
   "speed": 0,
   "size": 16,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "障碍型生物",
   "desc": "You're not supposed to see this text. I'm calling the police. （你不应该看到这个文本，我要报警了！）",
   "spawn": "- （-）",
   "rarities": {
    "普通": {
     "hp": 5,
     "dmg": 0,
     "exp": 1,
     "type": "障碍型生物"
    },
    "罕见": {
     "hp": 15,
     "dmg": 0,
     "exp": 1,
     "type": "障碍型生物"
    },
    "稀有": {
     "hp": 45,
     "dmg": 0,
     "exp": 1,
     "type": "障碍型生物"
    },
    "史诗": {
     "hp": 135,
     "dmg": 0,
     "exp": 1,
     "type": "障碍型生物"
    },
    "传奇": {
     "hp": 405,
     "dmg": 0,
     "exp": 1,
     "type": "障碍型生物"
    },
    "神话": {
     "hp": 1215,
     "dmg": 0,
     "exp": 1,
     "type": "障碍型生物"
    },
    "究极": {
     "hp": 3645,
     "dmg": 0,
     "exp": 1,
     "type": "障碍型生物"
    },
    "超级": {
     "hp": 10935,
     "dmg": 0,
     "exp": 1,
     "type": "障碍型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "障碍型生物"
    },
    "唯一": {
     "hp": 32805,
     "dmg": 0,
     "exp": 1,
     "type": "障碍型生物"
    }
   },
   "ai": {
    "aggro": false,
    "chase": false,
    "flee": false,
    "retaliate": false,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 70,
   "file": "assets/mobs/70.svg",
   "name": "Mecha Flower",
   "zh": "机械花",
   "biome": "",
   "hp": 10,
   "dmg": 0,
   "speed": 60,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "敌对型生物",
   "desc": "Someone has been making these mechanical flowers... What could this mean? （有些人一直在制作这些机械的花朵……这意味着什么？）",
   "spawn": "A Super Mecha Flower has spawned somewhere! （一个超级机械花在某处生成了！）",
   "rarities": {
    "普通": {
     "hp": 10,
     "dmg": 0,
     "exp": 1,
     "type": "敌对型生物"
    },
    "罕见": {
     "hp": 30,
     "dmg": 0,
     "exp": 2,
     "type": "敌对型生物"
    },
    "稀有": {
     "hp": 90,
     "dmg": 0,
     "exp": 7,
     "type": "敌对型生物"
    },
    "史诗": {
     "hp": 270,
     "dmg": 0,
     "exp": 54,
     "type": "敌对型生物"
    },
    "传奇": {
     "hp": 810,
     "dmg": 0,
     "exp": 522,
     "type": "敌对型生物"
    },
    "神话": {
     "hp": 2430,
     "dmg": 0,
     "exp": 6000,
     "type": "敌对型生物"
    },
    "究极": {
     "hp": 7290,
     "dmg": 0,
     "exp": 341000,
     "type": "敌对型生物"
    },
    "超级": {
     "hp": 21870,
     "dmg": 0,
     "exp": 12000000,
     "type": "敌对型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "敌对型生物"
    },
    "唯一": {
     "hp": 65610,
     "dmg": 0,
     "exp": 12000000,
     "type": "敌对型生物"
    }
   },
   "ai": {
    "aggro": true,
    "chase": true,
    "flee": false,
    "retaliate": false,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 71,
   "file": "assets/mobs/71.svg",
   "name": "Wasp (Mecha)",
   "zh": "胡蜂",
   "biome": "",
   "hp": 50,
   "dmg": 5,
   "speed": 60,
   "size": 22,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "敌对型生物",
   "desc": "They're MECHA ANGRY. （它们“机” 其 生 气。）",
   "spawn": "A Super Wasp has spawned somewhere! （一个超级胡蜂在某处生成了！）",
   "rarities": {
    "普通": {
     "hp": 50,
     "dmg": 5,
     "exp": 1,
     "type": "敌对型生物"
    },
    "罕见": {
     "hp": 150,
     "dmg": 25,
     "exp": 1,
     "type": "敌对型生物"
    },
    "稀有": {
     "hp": 450,
     "dmg": 125,
     "exp": 4,
     "type": "敌对型生物"
    },
    "史诗": {
     "hp": 1350,
     "dmg": 625,
     "exp": 36,
     "type": "敌对型生物"
    },
    "传奇": {
     "hp": 4050,
     "dmg": 3125,
     "exp": 335,
     "type": "敌对型生物"
    },
    "神话": {
     "hp": 12150,
     "dmg": 15625,
     "exp": 6700,
     "type": "敌对型生物"
    },
    "究极": {
     "hp": 36450,
     "dmg": 78125,
     "exp": 475000,
     "type": "敌对型生物"
    },
    "超级": {
     "hp": 109350,
     "dmg": 390625,
     "exp": 20000000,
     "type": "敌对型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "敌对型生物"
    },
    "唯一": {
     "hp": 328050,
     "dmg": 1953125,
     "exp": 20000000,
     "type": "敌对型生物"
    }
   },
   "ai": {
    "aggro": true,
    "chase": true,
    "flee": false,
    "retaliate": false,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 72,
   "file": "assets/mobs/72.svg",
   "name": "Spider (Mecha)",
   "zh": "蜘蛛",
   "biome": "",
   "hp": 30,
   "dmg": 0,
   "speed": 60,
   "size": 19,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "敌对型生物",
   "desc": "Mecha Spooky. （“机”其吓人。）",
   "spawn": "A Super Spider has spawned somewhere! （一个超级蜘蛛在某处生成了！）",
   "rarities": {
    "普通": {
     "hp": 30,
     "dmg": 0,
     "exp": 1,
     "type": "敌对型生物"
    },
    "罕见": {
     "hp": 90,
     "dmg": 0,
     "exp": 1,
     "type": "敌对型生物"
    },
    "稀有": {
     "hp": 270,
     "dmg": 0,
     "exp": 5,
     "type": "敌对型生物"
    },
    "史诗": {
     "hp": 810,
     "dmg": 0,
     "exp": 40,
     "type": "敌对型生物"
    },
    "传奇": {
     "hp": 2430,
     "dmg": 0,
     "exp": 363,
     "type": "敌对型生物"
    },
    "神话": {
     "hp": 7290,
     "dmg": 0,
     "exp": 5300,
     "type": "敌对型生物"
    },
    "究极": {
     "hp": 21870,
     "dmg": 0,
     "exp": 236000,
     "type": "敌对型生物"
    },
    "超级": {
     "hp": 65610,
     "dmg": 0,
     "exp": 12000000,
     "type": "敌对型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "敌对型生物"
    },
    "唯一": {
     "hp": 196830,
     "dmg": 0,
     "exp": 12000000,
     "type": "敌对型生物"
    }
   },
   "ai": {
    "aggro": true,
    "chase": true,
    "flee": false,
    "retaliate": false,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 73,
   "file": "assets/mobs/73.svg",
   "name": "Leafbug (Shiny)",
   "zh": "叶虫",
   "biome": "",
   "hp": 30,
   "dmg": 0,
   "speed": 45,
   "size": 19,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "中立型生物",
   "desc": "This one has a special color to it... （它有跟它一样特殊的颜色……）",
   "spawn": "A Super Leafbug has spawned somewhere! （一个超级叶虫在某处生成了！）",
   "rarities": {
    "普通": {
     "hp": 30,
     "dmg": 0,
     "exp": 1,
     "type": "中立型生物"
    },
    "罕见": {
     "hp": 90,
     "dmg": 0,
     "exp": 1,
     "type": "中立型生物"
    },
    "稀有": {
     "hp": 270,
     "dmg": 0,
     "exp": 6,
     "type": "中立型生物"
    },
    "史诗": {
     "hp": 810,
     "dmg": 0,
     "exp": 47,
     "type": "中立型生物"
    },
    "传奇": {
     "hp": 2430,
     "dmg": 0,
     "exp": 455,
     "type": "中立型生物"
    },
    "神话": {
     "hp": 7290,
     "dmg": 0,
     "exp": 5000,
     "type": "中立型生物"
    },
    "究极": {
     "hp": 21870,
     "dmg": 0,
     "exp": 354000,
     "type": "中立型生物"
    },
    "超级": {
     "hp": 65610,
     "dmg": 0,
     "exp": 16000000,
     "type": "中立型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "中立型生物"
    },
    "唯一": {
     "hp": 196830,
     "dmg": 0,
     "exp": 16000000,
     "type": "中立型生物"
    }
   },
   "ai": {
    "aggro": false,
    "chase": false,
    "flee": false,
    "retaliate": true,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 74,
   "file": "assets/mobs/74.svg",
   "name": "Crab (Mecha)",
   "zh": "螃蟹",
   "biome": "",
   "hp": 15,
   "dmg": 5,
   "speed": 60,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "敌对型生物",
   "desc": "Dr. Crab. （蟹博士。）",
   "spawn": "A Super Crab has spawned somewhere! （一个超级螃蟹在某处生成了！）",
   "rarities": {
    "普通": {
     "hp": 15,
     "dmg": 5,
     "exp": 1,
     "type": "敌对型生物"
    },
    "罕见": {
     "hp": 45,
     "dmg": 15,
     "exp": 2,
     "type": "敌对型生物"
    },
    "稀有": {
     "hp": 135,
     "dmg": 45,
     "exp": 9,
     "type": "敌对型生物"
    },
    "史诗": {
     "hp": 405,
     "dmg": 135,
     "exp": 74,
     "type": "敌对型生物"
    },
    "传奇": {
     "hp": 1215,
     "dmg": 405,
     "exp": 692,
     "type": "敌对型生物"
    },
    "神话": {
     "hp": 3645,
     "dmg": 1215,
     "exp": 8500,
     "type": "敌对型生物"
    },
    "究极": {
     "hp": 10935,
     "dmg": 3645,
     "exp": 466000,
     "type": "敌对型生物"
    },
    "超级": {
     "hp": 32805,
     "dmg": 10935,
     "exp": 20000000,
     "type": "敌对型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "敌对型生物"
    },
    "唯一": {
     "hp": 98415,
     "dmg": 32805,
     "exp": 20000000,
     "type": "敌对型生物"
    }
   },
   "ai": {
    "aggro": true,
    "chase": true,
    "flee": false,
    "retaliate": false,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 75,
   "file": "assets/mobs/75.svg",
   "name": "Assembler",
   "zh": "重构机",
   "biome": "",
   "hp": 0,
   "dmg": 0,
   "speed": 45,
   "size": 16,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "NPC生物",
   "desc": "- （-）",
   "spawn": "A Super Assembler has spawned somewhere! （一个超级稀有度的重构机在某处生成了！）",
   "rarities": {
    "普通": {
     "hp": 0,
     "dmg": 0,
     "exp": 1,
     "type": "NPC生物"
    },
    "罕见": {
     "hp": 0,
     "dmg": 0,
     "exp": 1,
     "type": "NPC生物"
    },
    "稀有": {
     "hp": 0,
     "dmg": 0,
     "exp": 1,
     "type": "NPC生物"
    },
    "史诗": {
     "hp": 0,
     "dmg": 0,
     "exp": 1,
     "type": "NPC生物"
    },
    "传奇": {
     "hp": 0,
     "dmg": 0,
     "exp": 1,
     "type": "NPC生物"
    },
    "神话": {
     "hp": 0,
     "dmg": 0,
     "exp": 1,
     "type": "NPC生物"
    },
    "究极": {
     "hp": 0,
     "dmg": 0,
     "exp": 1,
     "type": "NPC生物"
    },
    "超级": {
     "hp": 0,
     "dmg": 0,
     "exp": 1,
     "type": "NPC生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "NPC生物"
    },
    "唯一": {
     "hp": 0,
     "dmg": 0,
     "exp": 1,
     "type": "NPC生物"
    }
   },
   "ai": {
    "aggro": false,
    "chase": false,
    "flee": false,
    "retaliate": false,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 76,
   "file": "assets/mobs/76.svg",
   "name": "Barrel",
   "zh": "铀桶",
   "biome": "",
   "hp": 4,
   "dmg": 15,
   "speed": 0,
   "size": 16,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "障碍型生物",
   "desc": "Under no circumstances let this thing spill. We cannot risk another mutant insect this month. （严禁以任何形式使其内容物泄露。 绝不能在本月再次发生昆虫突变事故。）",
   "spawn": "A Super Barrel has spawned somewhere! （一个超级铀桶在某处生成了！）",
   "rarities": {
    "普通": {
     "hp": 4,
     "dmg": 15,
     "exp": 1,
     "type": "障碍型生物"
    },
    "罕见": {
     "hp": 12,
     "dmg": 45,
     "exp": 1,
     "type": "障碍型生物"
    },
    "稀有": {
     "hp": 36,
     "dmg": 135,
     "exp": 3,
     "type": "障碍型生物"
    },
    "史诗": {
     "hp": 108,
     "dmg": 405,
     "exp": 25,
     "type": "障碍型生物"
    },
    "传奇": {
     "hp": 324,
     "dmg": 1215,
     "exp": 231,
     "type": "障碍型生物"
    },
    "神话": {
     "hp": 972,
     "dmg": 3645,
     "exp": 3000,
     "type": "障碍型生物"
    },
    "究极": {
     "hp": 2916,
     "dmg": 10935,
     "exp": 160000,
     "type": "障碍型生物"
    },
    "超级": {
     "hp": 8748,
     "dmg": 32805,
     "exp": 7700000,
     "type": "障碍型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "障碍型生物"
    },
    "唯一": {
     "hp": 26244,
     "dmg": 98415,
     "exp": 7700000,
     "type": "障碍型生物"
    }
   },
   "ai": {
    "aggro": false,
    "chase": false,
    "flee": false,
    "retaliate": false,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 77,
   "file": "assets/mobs/77.svg",
   "name": "Beetle (Mummy)",
   "zh": "甲虫",
   "biome": "",
   "hp": 30,
   "dmg": 1,
   "speed": 60,
   "size": 19,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "敌对型生物",
   "desc": "This one seems like it shouldn't be alive... （它看起来不像个活物...）",
   "spawn": "A Super Beetle has spawned somewhere! （一个超级甲虫在某处生成了！）",
   "rarities": {
    "普通": {
     "hp": 30,
     "dmg": 1,
     "exp": 1,
     "type": "敌对型生物"
    },
    "罕见": {
     "hp": 90,
     "dmg": 2,
     "exp": 1,
     "type": "敌对型生物"
    },
    "稀有": {
     "hp": 270,
     "dmg": 3,
     "exp": 4,
     "type": "敌对型生物"
    },
    "史诗": {
     "hp": 810,
     "dmg": 4,
     "exp": 28,
     "type": "敌对型生物"
    },
    "传奇": {
     "hp": 2430,
     "dmg": 5,
     "exp": 256,
     "type": "敌对型生物"
    },
    "神话": {
     "hp": 7290,
     "dmg": 6,
     "exp": 4100,
     "type": "敌对型生物"
    },
    "究极": {
     "hp": 21870,
     "dmg": 7,
     "exp": 260000,
     "type": "敌对型生物"
    },
    "超级": {
     "hp": 65610,
     "dmg": 8,
     "exp": 13000000,
     "type": "敌对型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "敌对型生物"
    },
    "唯一": {
     "hp": 196830,
     "dmg": 9,
     "exp": 13000000,
     "type": "敌对型生物"
    }
   },
   "ai": {
    "aggro": true,
    "chase": true,
    "flee": false,
    "retaliate": false,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 78,
   "file": "assets/mobs/78.svg",
   "name": "Beetle (Pharaoh)",
   "zh": "甲虫",
   "biome": "",
   "hp": 30,
   "dmg": 1,
   "speed": 60,
   "size": 19,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "敌对型生物",
   "desc": "That thing on its head looks valuable... We should steal it. （它头顶的东西看起来价值连城...或许我们应该夺走它。）",
   "spawn": "A Super Beetle has spawned somewhere! （一个超级甲虫在某处生成了！）",
   "rarities": {
    "普通": {
     "hp": 30,
     "dmg": 1,
     "exp": 1,
     "type": "敌对型生物"
    },
    "罕见": {
     "hp": 90,
     "dmg": 2,
     "exp": 1,
     "type": "敌对型生物"
    },
    "稀有": {
     "hp": 270,
     "dmg": 3,
     "exp": 6,
     "type": "敌对型生物"
    },
    "史诗": {
     "hp": 810,
     "dmg": 4,
     "exp": 47,
     "type": "敌对型生物"
    },
    "传奇": {
     "hp": 2430,
     "dmg": 5,
     "exp": 455,
     "type": "敌对型生物"
    },
    "神话": {
     "hp": 7290,
     "dmg": 6,
     "exp": 8000,
     "type": "敌对型生物"
    },
    "究极": {
     "hp": 21870,
     "dmg": 7,
     "exp": 604000,
     "type": "敌对型生物"
    },
    "超级": {
     "hp": 65610,
     "dmg": 8,
     "exp": 20000000,
     "type": "敌对型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "敌对型生物"
    },
    "唯一": {
     "hp": 196830,
     "dmg": 9,
     "exp": 20000000,
     "type": "敌对型生物"
    }
   },
   "ai": {
    "aggro": true,
    "chase": true,
    "flee": false,
    "retaliate": false,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 79,
   "file": "assets/mobs/79.svg",
   "name": "Tomb",
   "zh": "棺材",
   "biome": "",
   "hp": 3,
   "dmg": 0,
   "speed": 0,
   "size": 16,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "障碍型生物",
   "desc": "Huh, what could be in here? （这具棺材里放着什么呢？）",
   "spawn": "A Super Tomb has spawned somewhere! （一个超级棺材在某处生成了！）",
   "rarities": {
    "普通": {
     "hp": 3,
     "dmg": 0,
     "exp": 2,
     "type": "障碍型生物"
    },
    "罕见": {
     "hp": 9,
     "dmg": 0,
     "exp": 3,
     "type": "障碍型生物"
    },
    "稀有": {
     "hp": 27,
     "dmg": 0,
     "exp": 12,
     "type": "障碍型生物"
    },
    "史诗": {
     "hp": 81,
     "dmg": 0,
     "exp": 99,
     "type": "障碍型生物"
    },
    "传奇": {
     "hp": 243,
     "dmg": 0,
     "exp": 931,
     "type": "障碍型生物"
    },
    "神话": {
     "hp": 729,
     "dmg": 0,
     "exp": 11100,
     "type": "障碍型生物"
    },
    "究极": {
     "hp": 2187,
     "dmg": 0,
     "exp": 630000,
     "type": "障碍型生物"
    },
    "超级": {
     "hp": 6561,
     "dmg": 0,
     "exp": 25000000,
     "type": "障碍型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "障碍型生物"
    },
    "唯一": {
     "hp": 19683,
     "dmg": 0,
     "exp": 25000000,
     "type": "障碍型生物"
    }
   },
   "ai": {
    "aggro": false,
    "chase": false,
    "flee": false,
    "retaliate": false,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 80,
   "file": "assets/mobs/80.svg",
   "name": "Silverfish",
   "zh": "蠹虫",
   "biome": "",
   "hp": 30,
   "dmg": 0,
   "speed": 60,
   "size": 19,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "敌对型生物",
   "desc": "Those annoying little things that eat clothes. It also loves garbage. （那些吃衣服的烦人小东西。 它也喜欢垃圾。）",
   "spawn": "A Super Silver Fish has spawned somewhere! （一个超级蠹虫在某处生成了！）",
   "rarities": {
    "普通": {
     "hp": 30,
     "dmg": 0,
     "exp": 1,
     "type": "敌对型生物"
    },
    "罕见": {
     "hp": 90,
     "dmg": 0,
     "exp": 2,
     "type": "敌对型生物"
    },
    "稀有": {
     "hp": 270,
     "dmg": 0,
     "exp": 8,
     "type": "敌对型生物"
    },
    "史诗": {
     "hp": 810,
     "dmg": 0,
     "exp": 60,
     "type": "敌对型生物"
    },
    "传奇": {
     "hp": 2430,
     "dmg": 0,
     "exp": 563,
     "type": "敌对型生物"
    },
    "神话": {
     "hp": 7290,
     "dmg": 0,
     "exp": 6900,
     "type": "敌对型生物"
    },
    "究极": {
     "hp": 21870,
     "dmg": 0,
     "exp": 381000,
     "type": "敌对型生物"
    },
    "超级": {
     "hp": 65610,
     "dmg": 0,
     "exp": 16000000,
     "type": "敌对型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "敌对型生物"
    },
    "唯一": {
     "hp": 196830,
     "dmg": 0,
     "exp": 16000000,
     "type": "敌对型生物"
    }
   },
   "ai": {
    "aggro": true,
    "chase": true,
    "flee": false,
    "retaliate": false,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 81,
   "file": "assets/mobs/81.svg",
   "name": "Garbage",
   "zh": "垃圾袋",
   "biome": "",
   "hp": 3,
   "dmg": 0,
   "speed": 0,
   "size": 16,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "障碍型生物",
   "desc": "Someone's treasure... （有些人倒是视若珍宝...）",
   "spawn": "A Super Garbage has spawned somewhere! （一个超级垃圾袋在某处生成了！）",
   "rarities": {
    "普通": {
     "hp": 3,
     "dmg": 0,
     "exp": 1,
     "type": "障碍型生物"
    },
    "罕见": {
     "hp": 9,
     "dmg": 0,
     "exp": 2,
     "type": "障碍型生物"
    },
    "稀有": {
     "hp": 27,
     "dmg": 0,
     "exp": 5,
     "type": "障碍型生物"
    },
    "史诗": {
     "hp": 81,
     "dmg": 0,
     "exp": 41,
     "type": "障碍型生物"
    },
    "传奇": {
     "hp": 243,
     "dmg": 0,
     "exp": 379,
     "type": "障碍型生物"
    },
    "神话": {
     "hp": 729,
     "dmg": 0,
     "exp": 5200,
     "type": "障碍型生物"
    },
    "究极": {
     "hp": 2187,
     "dmg": 0,
     "exp": 260000,
     "type": "障碍型生物"
    },
    "超级": {
     "hp": 6561,
     "dmg": 0,
     "exp": 13000000,
     "type": "障碍型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "障碍型生物"
    },
    "唯一": {
     "hp": 19683,
     "dmg": 0,
     "exp": 13000000,
     "type": "障碍型生物"
    }
   },
   "ai": {
    "aggro": false,
    "chase": false,
    "flee": false,
    "retaliate": false,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 82,
   "file": "assets/mobs/82.svg",
   "name": "Soldier Ant (Diver)",
   "zh": "兵蚁",
   "biome": "",
   "hp": 10,
   "dmg": 0,
   "speed": 60,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "敌对型生物",
   "desc": "How did they end up here? （它们怎么会到这里？）",
   "spawn": "A Super Soldier Ant has spawned somewhere! （一个超级兵蚁在某处生成了！）",
   "rarities": {
    "普通": {
     "hp": 10,
     "dmg": 0,
     "exp": 1,
     "type": "敌对型生物"
    },
    "罕见": {
     "hp": 30,
     "dmg": 0,
     "exp": 1,
     "type": "敌对型生物"
    },
    "稀有": {
     "hp": 90,
     "dmg": 0,
     "exp": 6,
     "type": "敌对型生物"
    },
    "史诗": {
     "hp": 270,
     "dmg": 0,
     "exp": 47,
     "type": "敌对型生物"
    },
    "传奇": {
     "hp": 810,
     "dmg": 0,
     "exp": 455,
     "type": "敌对型生物"
    },
    "神话": {
     "hp": 2430,
     "dmg": 0,
     "exp": 8000,
     "type": "敌对型生物"
    },
    "究极": {
     "hp": 7290,
     "dmg": 0,
     "exp": 604000,
     "type": "敌对型生物"
    },
    "超级": {
     "hp": 21870,
     "dmg": 0,
     "exp": 20000000,
     "type": "敌对型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "敌对型生物"
    },
    "唯一": {
     "hp": 65610,
     "dmg": 0,
     "exp": 20000000,
     "type": "敌对型生物"
    }
   },
   "ai": {
    "aggro": true,
    "chase": true,
    "flee": false,
    "retaliate": false,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  },
  {
   "id": 83,
   "file": "assets/mobs/83.svg",
   "name": "Ghost",
   "zh": "幽灵",
   "biome": "",
   "hp": 10,
   "dmg": 0,
   "speed": 45,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "中立型生物",
   "desc": "A tormented soul, freeing it is the best you can do for it. （一个饱受折磨的灵魂，释放它是你能为它做的最好的事。）",
   "spawn": "A Super Ghost has spawned somewhere! （一个超级幽灵在某处生成了！）",
   "rarities": {
    "普通": {
     "hp": 10,
     "dmg": 0,
     "exp": 1,
     "type": "中立型生物"
    },
    "罕见": {
     "hp": 30,
     "dmg": 0,
     "exp": 1,
     "type": "中立型生物"
    },
    "稀有": {
     "hp": 90,
     "dmg": 0,
     "exp": 1,
     "type": "中立型生物"
    },
    "史诗": {
     "hp": 270,
     "dmg": 0,
     "exp": 1,
     "type": "中立型生物"
    },
    "传奇": {
     "hp": 810,
     "dmg": 0,
     "exp": 1,
     "type": "中立型生物"
    },
    "神话": {
     "hp": 2430,
     "dmg": 0,
     "exp": 1,
     "type": "中立型生物"
    },
    "究极": {
     "hp": 7290,
     "dmg": 0,
     "exp": 1,
     "type": "中立型生物"
    },
    "超级": {
     "hp": 21870,
     "dmg": 0,
     "exp": 1,
     "type": "中立型生物"
    },
    "永恒": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "中立型生物"
    },
    "唯一": {
     "hp": 65610,
     "dmg": 0,
     "exp": 1,
     "type": "中立型生物"
    }
   },
   "ai": {
    "aggro": false,
    "chase": false,
    "flee": false,
    "retaliate": true,
    "summoned": false
   },
   "drops": {},
   "identified": true,
   "note": ""
  }
 ],
 "tiles": [
  {
   "id": 0,
   "image": "desert_c_0.svg",
   "file": "assets/static/tiles/desert_c_0.svg",
   "category": "desert",
   "props": {
    "covers_everything": true
   },
   "tileset": "tileset"
  },
  {
   "id": 1,
   "image": "desert_c_1.svg",
   "file": "assets/static/tiles/desert_c_1.svg",
   "category": "desert",
   "props": {
    "covers_everything": true
   },
   "tileset": "tileset"
  },
  {
   "id": 2,
   "image": "desert_c_2.svg",
   "file": "assets/static/tiles/desert_c_2.svg",
   "category": "desert",
   "props": {
    "covers_everything": true
   },
   "tileset": "tileset"
  },
  {
   "id": 3,
   "image": "desert_c_3.svg",
   "file": "assets/static/tiles/desert_c_3.svg",
   "category": "desert",
   "props": {
    "covers_everything": true
   },
   "tileset": "tileset"
  },
  {
   "id": 4,
   "image": "desert_c_4.svg",
   "file": "assets/static/tiles/desert_c_4.svg",
   "category": "desert",
   "props": {
    "covers_everything": true
   },
   "tileset": "tileset"
  },
  {
   "id": 5,
   "image": "grass_c_0.svg",
   "file": "assets/static/tiles/grass_c_0.svg",
   "category": "grass",
   "props": {
    "covers_everything": true
   },
   "tileset": "tileset"
  },
  {
   "id": 6,
   "image": "grass_c_1.svg",
   "file": "assets/static/tiles/grass_c_1.svg",
   "category": "grass",
   "props": {
    "covers_everything": true
   },
   "tileset": "tileset"
  },
  {
   "id": 7,
   "image": "grass_c_2.svg",
   "file": "assets/static/tiles/grass_c_2.svg",
   "category": "grass",
   "props": {
    "covers_everything": true
   },
   "tileset": "tileset"
  },
  {
   "id": 8,
   "image": "grass_c_3.svg",
   "file": "assets/static/tiles/grass_c_3.svg",
   "category": "grass",
   "props": {
    "covers_everything": true
   },
   "tileset": "tileset"
  },
  {
   "id": 9,
   "image": "ocean_c_0.svg",
   "file": "assets/static/tiles/ocean_c_0.svg",
   "category": "ocean",
   "props": {
    "covers_everything": true
   },
   "tileset": "tileset"
  },
  {
   "id": 10,
   "image": "ocean_c_1.svg",
   "file": "assets/static/tiles/ocean_c_1.svg",
   "category": "ocean",
   "props": {
    "covers_everything": true
   },
   "tileset": "tileset"
  },
  {
   "id": 11,
   "image": "ocean_c_2.svg",
   "file": "assets/static/tiles/ocean_c_2.svg",
   "category": "ocean",
   "props": {
    "covers_everything": true
   },
   "tileset": "tileset"
  },
  {
   "id": 12,
   "image": "ocean_c_3.svg",
   "file": "assets/static/tiles/ocean_c_3.svg",
   "category": "ocean",
   "props": {
    "covers_everything": true
   },
   "tileset": "tileset"
  },
  {
   "id": 13,
   "image": "pvp_c_0.svg",
   "file": "assets/static/tiles/pvp_c_0.svg",
   "category": "pvp",
   "props": {
    "covers_everything": true
   },
   "tileset": "tileset"
  },
  {
   "id": 14,
   "image": "pvp_c_1.svg",
   "file": "assets/static/tiles/pvp_c_1.svg",
   "category": "pvp",
   "props": {
    "covers_everything": true
   },
   "tileset": "tileset"
  },
  {
   "id": 15,
   "image": "pvp_c_2.svg",
   "file": "assets/static/tiles/pvp_c_2.svg",
   "category": "pvp",
   "props": {
    "covers_everything": true
   },
   "tileset": "tileset"
  },
  {
   "id": 16,
   "image": "pvp_c_3.svg",
   "file": "assets/static/tiles/pvp_c_3.svg",
   "category": "pvp",
   "props": {
    "covers_everything": true
   },
   "tileset": "tileset"
  },
  {
   "id": 17,
   "image": "castle_l_0.svg",
   "file": "assets/static/tiles/castle_l_0.svg",
   "category": "castle",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 18,
   "image": "castle_tl_0.svg",
   "file": "assets/static/tiles/castle_tl_0.svg",
   "category": "castle",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 19,
   "image": "castle_c_0.svg",
   "file": "assets/static/tiles/castle_c_0.svg",
   "category": "castle",
   "props": {
    "covers_everything": true
   },
   "tileset": "tileset"
  },
  {
   "id": 20,
   "image": "castle_tri_0.svg",
   "file": "assets/static/tiles/castle_tri_0.svg",
   "category": "castle",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 21,
   "image": "dirt_l_0.svg",
   "file": "assets/static/tiles/dirt_l_0.svg",
   "category": "dirt",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 22,
   "image": "dirt_tl_0.svg",
   "file": "assets/static/tiles/dirt_tl_0.svg",
   "category": "dirt",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 23,
   "image": "dirt_tri_0.svg",
   "file": "assets/static/tiles/dirt_tri_0.svg",
   "category": "dirt",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 24,
   "image": "dirt_c_0.svg",
   "file": "assets/static/tiles/dirt_c_0.svg",
   "category": "dirt",
   "props": {
    "covers_everything": true
   },
   "tileset": "tileset"
  },
  {
   "id": 25,
   "image": "fire_anthole.svg",
   "file": "assets/static/tiles/fire_anthole.svg",
   "category": "fire",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 27,
   "image": "dirt2_c_0.svg",
   "file": "assets/static/tiles/dirt2_c_0.svg",
   "category": "dirt2",
   "props": {
    "covers_everything": true
   },
   "tileset": "tileset"
  },
  {
   "id": 28,
   "image": "dirt2_c_1.svg",
   "file": "assets/static/tiles/dirt2_c_1.svg",
   "category": "dirt2",
   "props": {
    "covers_everything": true
   },
   "tileset": "tileset"
  },
  {
   "id": 32,
   "image": "water_l_0.svg",
   "file": "assets/static/tiles/water_l_0.svg",
   "category": "water",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 33,
   "image": "water_tl_0.svg",
   "file": "assets/static/tiles/water_tl_0.svg",
   "category": "water",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 34,
   "image": "water_tri_0.svg",
   "file": "assets/static/tiles/water_tri_0.svg",
   "category": "water",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 35,
   "image": "water_c_0.svg",
   "file": "assets/static/tiles/water_c_0.svg",
   "category": "water",
   "props": {
    "covers_everything": true
   },
   "tileset": "tileset"
  },
  {
   "id": 40,
   "image": "bridge_c_0.svg",
   "file": "assets/static/tiles/bridge_c_0.svg",
   "category": "bridge",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 41,
   "image": "bridge_r_0.svg",
   "file": "assets/static/tiles/bridge_r_0.svg",
   "category": "bridge",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 42,
   "image": "bridge_c_1.svg",
   "file": "assets/static/tiles/bridge_c_1.svg",
   "category": "bridge",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 45,
   "image": "desert_r_0.svg",
   "file": "assets/static/tiles/desert_r_0.svg",
   "category": "desert",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 46,
   "image": "desert_l_0.svg",
   "file": "assets/static/tiles/desert_l_0.svg",
   "category": "desert",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 47,
   "image": "desert_b_0.svg",
   "file": "assets/static/tiles/desert_b_0.svg",
   "category": "desert",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 48,
   "image": "sewer_entrance.svg",
   "file": "assets/static/tiles/sewer_entrance.svg",
   "category": "sewer",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 49,
   "image": "cobblestone_c_0.svg",
   "file": "assets/static/tiles/cobblestone_c_0.svg",
   "category": "cobblestone",
   "props": {
    "covers_everything": true
   },
   "tileset": "tileset"
  },
  {
   "id": 50,
   "image": "sewage_l_0.svg",
   "file": "assets/static/tiles/sewage_l_0.svg",
   "category": "sewage",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 51,
   "image": "sewage_tl_0.svg",
   "file": "assets/static/tiles/sewage_tl_0.svg",
   "category": "sewage",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 52,
   "image": "sewage_tri_0.svg",
   "file": "assets/static/tiles/sewage_tri_0.svg",
   "category": "sewage",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 53,
   "image": "sewage_c_0.svg",
   "file": "assets/static/tiles/sewage_c_0.svg",
   "category": "sewage",
   "props": {
    "covers_everything": true
   },
   "tileset": "tileset"
  },
  {
   "id": 54,
   "image": "grate_c_0.svg",
   "file": "assets/static/tiles/grate_c_0.svg",
   "category": "grate",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 55,
   "image": "grate_l_0.svg",
   "file": "assets/static/tiles/grate_l_0.svg",
   "category": "grate",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 56,
   "image": "grate_tr_0.svg",
   "file": "assets/static/tiles/grate_tr_0.svg",
   "category": "grate",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 57,
   "image": "grate_tli_0.svg",
   "file": "assets/static/tiles/grate_tli_0.svg",
   "category": "grate",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 58,
   "image": "sewer_entrance2.svg",
   "file": "assets/static/tiles/sewer_entrance2.svg",
   "category": "sewer",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 59,
   "image": "anthole.svg",
   "file": "assets/static/tiles/anthole.svg",
   "category": "anthole",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 60,
   "image": "hel_c_0.svg",
   "file": "assets/static/tiles/hel_c_0.svg",
   "category": "hel",
   "props": {
    "covers_everything": true
   },
   "tileset": "tileset"
  },
  {
   "id": 61,
   "image": "hel_c_1.svg",
   "file": "assets/static/tiles/hel_c_1.svg",
   "category": "hel",
   "props": {
    "covers_everything": true
   },
   "tileset": "tileset"
  },
  {
   "id": 62,
   "image": "hel_c_2.svg",
   "file": "assets/static/tiles/hel_c_2.svg",
   "category": "hel",
   "props": {
    "covers_everything": true
   },
   "tileset": "tileset"
  },
  {
   "id": 63,
   "image": "hel_c_3.svg",
   "file": "assets/static/tiles/hel_c_3.svg",
   "category": "hel",
   "props": {
    "covers_everything": true
   },
   "tileset": "tileset"
  },
  {
   "id": 64,
   "image": "hel_c_4.svg",
   "file": "assets/static/tiles/hel_c_4.svg",
   "category": "hel",
   "props": {
    "covers_everything": true
   },
   "tileset": "tileset"
  },
  {
   "id": 65,
   "image": "grass2_c_0.svg",
   "file": "assets/static/tiles/grass2_c_0.svg",
   "category": "grass2",
   "props": {
    "covers_everything": true
   },
   "tileset": "tileset"
  },
  {
   "id": 66,
   "image": "grass2_c_1.svg",
   "file": "assets/static/tiles/grass2_c_1.svg",
   "category": "grass2",
   "props": {
    "covers_everything": true
   },
   "tileset": "tileset"
  },
  {
   "id": 67,
   "image": "grass2_c_2.svg",
   "file": "assets/static/tiles/grass2_c_2.svg",
   "category": "grass2",
   "props": {
    "covers_everything": true
   },
   "tileset": "tileset"
  },
  {
   "id": 68,
   "image": "grass2_c_3.svg",
   "file": "assets/static/tiles/grass2_c_3.svg",
   "category": "grass2",
   "props": {
    "covers_everything": true
   },
   "tileset": "tileset"
  },
  {
   "id": 69,
   "image": "desert_t_0.svg",
   "file": "assets/static/tiles/desert_t_0.svg",
   "category": "desert",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 70,
   "image": "termite_mound.svg",
   "file": "assets/static/tiles/termite_mound.svg",
   "category": "termite",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 71,
   "image": "hut_c_0.svg",
   "file": "assets/static/tiles/hut_c_0.svg",
   "category": "hut",
   "props": {
    "covers_everything": true
   },
   "tileset": "tileset"
  },
  {
   "id": 72,
   "image": "hut_b_0.svg",
   "file": "assets/static/tiles/hut_b_0.svg",
   "category": "hut",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 73,
   "image": "hut_bl_0.svg",
   "file": "assets/static/tiles/hut_bl_0.svg",
   "category": "hut",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 74,
   "image": "hut_bli_0.svg",
   "file": "assets/static/tiles/hut_bli_0.svg",
   "category": "hut",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 75,
   "image": "hut_br_0.svg",
   "file": "assets/static/tiles/hut_br_0.svg",
   "category": "hut",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 76,
   "image": "hut_bri_0.svg",
   "file": "assets/static/tiles/hut_bri_0.svg",
   "category": "hut",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 77,
   "image": "hut_l_0.svg",
   "file": "assets/static/tiles/hut_l_0.svg",
   "category": "hut",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 78,
   "image": "hut_r_0.svg",
   "file": "assets/static/tiles/hut_r_0.svg",
   "category": "hut",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 79,
   "image": "hut_t_0.svg",
   "file": "assets/static/tiles/hut_t_0.svg",
   "category": "hut",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 80,
   "image": "hut_tl_0.svg",
   "file": "assets/static/tiles/hut_tl_0.svg",
   "category": "hut",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 81,
   "image": "hut_tli_0.svg",
   "file": "assets/static/tiles/hut_tli_0.svg",
   "category": "hut",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 82,
   "image": "hut_tr_0.svg",
   "file": "assets/static/tiles/hut_tr_0.svg",
   "category": "hut",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 83,
   "image": "hut_tri_0.svg",
   "file": "assets/static/tiles/hut_tri_0.svg",
   "category": "hut",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 84,
   "image": "wood_c_0.svg",
   "file": "assets/static/tiles/wood_c_0.svg",
   "category": "wood",
   "props": {
    "covers_everything": true
   },
   "tileset": "tileset"
  },
  {
   "id": 85,
   "image": "grass2_b_0.svg",
   "file": "assets/static/tiles/grass2_b_0.svg",
   "category": "grass2",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 86,
   "image": "grass2_t_0.svg",
   "file": "assets/static/tiles/grass2_t_0.svg",
   "category": "grass2",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 87,
   "image": "worm_c_0.svg",
   "file": "assets/static/tiles/worm_c_0.svg",
   "category": "worm",
   "props": {
    "covers_everything": true
   },
   "tileset": "tileset"
  },
  {
   "id": 88,
   "image": "worm_c_1.svg",
   "file": "assets/static/tiles/worm_c_1.svg",
   "category": "worm",
   "props": {
    "covers_everything": true
   },
   "tileset": "tileset"
  },
  {
   "id": 89,
   "image": "organic_wall_c_0.svg",
   "file": "assets/static/tiles/organic_wall_c_0.svg",
   "category": "organic",
   "props": {
    "covers_everything": true
   },
   "tileset": "tileset"
  },
  {
   "id": 90,
   "image": "organic_wall_l_0.svg",
   "file": "assets/static/tiles/organic_wall_l_0.svg",
   "category": "organic",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 91,
   "image": "organic_wall_tl_0.svg",
   "file": "assets/static/tiles/organic_wall_tl_0.svg",
   "category": "organic",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 92,
   "image": "organic_wall_tli_0.svg",
   "file": "assets/static/tiles/organic_wall_tli_0.svg",
   "category": "organic",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 93,
   "image": "factory_entrance.svg",
   "file": "assets/static/tiles/factory_entrance.svg",
   "category": "factory",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 94,
   "image": "factory_floor_c_0.svg",
   "file": "assets/static/tiles/factory_floor_c_0.svg",
   "category": "factory",
   "props": {
    "covers_everything": true
   },
   "tileset": "tileset"
  },
  {
   "id": 95,
   "image": "factory_floor_c_1.svg",
   "file": "assets/static/tiles/factory_floor_c_1.svg",
   "category": "factory",
   "props": {
    "covers_everything": true
   },
   "tileset": "tileset"
  },
  {
   "id": 96,
   "image": "factory_floor_c_2.svg",
   "file": "assets/static/tiles/factory_floor_c_2.svg",
   "category": "factory",
   "props": {
    "covers_everything": true
   },
   "tileset": "tileset"
  },
  {
   "id": 97,
   "image": "factory_floor_c_3.svg",
   "file": "assets/static/tiles/factory_floor_c_3.svg",
   "category": "factory",
   "props": {
    "covers_everything": true
   },
   "tileset": "tileset"
  },
  {
   "id": 98,
   "image": "factory_wall_c_0.svg",
   "file": "assets/static/tiles/factory_wall_c_0.svg",
   "category": "factory",
   "props": {
    "covers_everything": true
   },
   "tileset": "tileset"
  },
  {
   "id": 99,
   "image": "factory_wall_l_0.svg",
   "file": "assets/static/tiles/factory_wall_l_0.svg",
   "category": "factory",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 100,
   "image": "factory_wall_tl_0.svg",
   "file": "assets/static/tiles/factory_wall_tl_0.svg",
   "category": "factory",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 101,
   "image": "factory_wall_tli.svg",
   "file": "assets/static/tiles/factory_wall_tli.svg",
   "category": "factory",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 102,
   "image": "factory_exit.svg",
   "file": "assets/static/tiles/factory_exit.svg",
   "category": "factory",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 103,
   "image": "bush_c_0.svg",
   "file": "assets/static/tiles/bush_c_0.svg",
   "category": "bush",
   "props": {
    "covers_everything": true
   },
   "tileset": "tileset"
  },
  {
   "id": 104,
   "image": "bush_t_0.svg",
   "file": "assets/static/tiles/bush_t_0.svg",
   "category": "bush",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 105,
   "image": "bush_tl_0.svg",
   "file": "assets/static/tiles/bush_tl_0.svg",
   "category": "bush",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 106,
   "image": "bush_tri_0.svg",
   "file": "assets/static/tiles/bush_tri_0.svg",
   "category": "bush",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 107,
   "image": "coral_c_0.svg",
   "file": "assets/static/tiles/coral_c_0.svg",
   "category": "coral",
   "props": {
    "covers_everything": true
   },
   "tileset": "tileset"
  },
  {
   "id": 108,
   "image": "coral_t_0.svg",
   "file": "assets/static/tiles/coral_t_0.svg",
   "category": "coral",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 109,
   "image": "coral_tl_0.svg",
   "file": "assets/static/tiles/coral_tl_0.svg",
   "category": "coral",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 110,
   "image": "coral_tri_0.svg",
   "file": "assets/static/tiles/coral_tri_0.svg",
   "category": "coral",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 111,
   "image": "scliff_c_0.svg",
   "file": "assets/static/tiles/scliff_c_0.svg",
   "category": "scliff",
   "props": {
    "covers_everything": true
   },
   "tileset": "tileset"
  },
  {
   "id": 112,
   "image": "scliff_l_0.svg",
   "file": "assets/static/tiles/scliff_l_0.svg",
   "category": "scliff",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 113,
   "image": "scliff_tl_0.svg",
   "file": "assets/static/tiles/scliff_tl_0.svg",
   "category": "scliff",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 114,
   "image": "scliff_tli_0.svg",
   "file": "assets/static/tiles/scliff_tli_0.svg",
   "category": "scliff",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 115,
   "image": "pyramid.svg",
   "file": "assets/static/tiles/pyramid.svg",
   "category": "pyramid",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 116,
   "image": "pyramid_floor_c_0.svg",
   "file": "assets/static/tiles/pyramid_floor_c_0.svg",
   "category": "pyramid",
   "props": {
    "covers_everything": true
   },
   "tileset": "tileset"
  },
  {
   "id": 117,
   "image": "pyramid_floor_c_1.svg",
   "file": "assets/static/tiles/pyramid_floor_c_1.svg",
   "category": "pyramid",
   "props": {
    "covers_everything": true
   },
   "tileset": "tileset"
  },
  {
   "id": 118,
   "image": "pyramid_floor_c_2.svg",
   "file": "assets/static/tiles/pyramid_floor_c_2.svg",
   "category": "pyramid",
   "props": {
    "covers_everything": true
   },
   "tileset": "tileset"
  },
  {
   "id": 119,
   "image": "pyramid_floor_c_3.svg",
   "file": "assets/static/tiles/pyramid_floor_c_3.svg",
   "category": "pyramid",
   "props": {
    "covers_everything": true
   },
   "tileset": "tileset"
  },
  {
   "id": 120,
   "image": "pyramid_wall_bri_0.svg",
   "file": "assets/static/tiles/pyramid_wall_bri_0.svg",
   "category": "pyramid",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 121,
   "image": "pyramid_wall_c_0.svg",
   "file": "assets/static/tiles/pyramid_wall_c_0.svg",
   "category": "pyramid",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 122,
   "image": "pyramid_wall_l_0.svg",
   "file": "assets/static/tiles/pyramid_wall_l_0.svg",
   "category": "pyramid",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 123,
   "image": "pyramid_wall_tl_0.svg",
   "file": "assets/static/tiles/pyramid_wall_tl_0.svg",
   "category": "pyramid",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 124,
   "image": "cellar_door.svg",
   "file": "assets/static/tiles/cellar_door.svg",
   "category": "cellar",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 125,
   "image": "foliage_bri_0.svg",
   "file": "assets/static/tiles/foliage_bri_0.svg",
   "category": "foliage",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 126,
   "image": "foliage_t_0.svg",
   "file": "assets/static/tiles/foliage_t_0.svg",
   "category": "foliage",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 127,
   "image": "foliage_tl_0.svg",
   "file": "assets/static/tiles/foliage_tl_0.svg",
   "category": "foliage",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 128,
   "image": "vent_bri_0.svg",
   "file": "assets/static/tiles/vent_bri_0.svg",
   "category": "vent",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 129,
   "image": "vent_l_0.svg",
   "file": "assets/static/tiles/vent_l_0.svg",
   "category": "vent",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 130,
   "image": "vent_tl_0.svg",
   "file": "assets/static/tiles/vent_tl_0.svg",
   "category": "vent",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 131,
   "image": "seaweed_bri_0.svg",
   "file": "assets/static/tiles/seaweed_bri_0.svg",
   "category": "seaweed",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 132,
   "image": "seaweed_t_0.svg",
   "file": "assets/static/tiles/seaweed_t_0.svg",
   "category": "seaweed",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 133,
   "image": "seaweed_tl_0.svg",
   "file": "assets/static/tiles/seaweed_tl_0.svg",
   "category": "seaweed",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 134,
   "image": "vine_bri_0.svg",
   "file": "assets/static/tiles/vine_bri_0.svg",
   "category": "vine",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 135,
   "image": "vine_t_0.svg",
   "file": "assets/static/tiles/vine_t_0.svg",
   "category": "vine",
   "props": {},
   "tileset": "tileset"
  },
  {
   "id": 136,
   "image": "vine_tl_0.svg",
   "file": "assets/static/tiles/vine_tl_0.svg",
   "category": "vine",
   "props": {},
   "tileset": "tileset"
  }
 ],
 "maps": [
  {
   "name": "a",
   "file": "assets/static/tiles/a.tmj"
  },
  {
   "name": "ant_hell",
   "file": "assets/static/tiles/ant_hell.tmj"
  },
  {
   "name": "ant_hole1",
   "file": "assets/static/tiles/ant_hole1.tmj"
  },
  {
   "name": "ant_hole2",
   "file": "assets/static/tiles/ant_hole2.tmj"
  },
  {
   "name": "ant_hole3",
   "file": "assets/static/tiles/ant_hole3.tmj"
  },
  {
   "name": "ant_hole4",
   "file": "assets/static/tiles/ant_hole4.tmj"
  },
  {
   "name": "ant_hole5",
   "file": "assets/static/tiles/ant_hole5.tmj"
  },
  {
   "name": "b",
   "file": "assets/static/tiles/b.tmj"
  },
  {
   "name": "battle_royale",
   "file": "assets/static/tiles/battle_royale.tmj"
  },
  {
   "name": "crystal_room",
   "file": "assets/static/tiles/crystal_room.tmj"
  },
  {
   "name": "desert",
   "file": "assets/static/tiles/desert.tmj"
  },
  {
   "name": "factory",
   "file": "assets/static/tiles/factory.tmj"
  },
  {
   "name": "garden",
   "file": "assets/static/tiles/garden.tmj"
  },
  {
   "name": "hel",
   "file": "assets/static/tiles/hel.tmj"
  },
  {
   "name": "jungle",
   "file": "assets/static/tiles/jungle.tmj"
  },
  {
   "name": "ocean",
   "file": "assets/static/tiles/ocean.tmj"
  },
  {
   "name": "pvp1",
   "file": "assets/static/tiles/pvp1.tmj"
  },
  {
   "name": "pvp2",
   "file": "assets/static/tiles/pvp2.tmj"
  },
  {
   "name": "pvp3",
   "file": "assets/static/tiles/pvp3.tmj"
  },
  {
   "name": "sewers",
   "file": "assets/static/tiles/sewers.tmj"
  },
  {
   "name": "training_grounds",
   "file": "assets/static/tiles/training_grounds.tmj"
  },
  {
   "name": "worm",
   "file": "assets/static/tiles/worm.tmj"
  }
 ],
 "links": [
  {
   "name": "Rock",
   "en": "Rock",
   "zh": "岩石",
   "petalId": 3,
   "mobId": 1
  },
  {
   "name": "Cactus",
   "en": "Cactus",
   "zh": "仙人掌",
   "petalId": 11,
   "mobId": 2
  }
 ]
};
