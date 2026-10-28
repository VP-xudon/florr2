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
   "realId": 1,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 10.0,
    "hp": 10.0,
    "spd": 0
   },
   "reload": 2.5,
   "rarityMultipliers": {
    "common": {
     "dmg": 1,
     "hp": 1
    },
    "unusual": {
     "dmg": 3,
     "hp": 3
    },
    "rare": {
     "dmg": 9,
     "hp": 9
    },
    "epic": {
     "dmg": 27,
     "hp": 27
    },
    "legendary": {
     "dmg": 81,
     "hp": 81
    },
    "mythic": {
     "dmg": 243,
     "hp": 243
    },
    "ultra": {
     "dmg": 729,
     "hp": 729
    },
    "super": {
     "dmg": 2187,
     "hp": 2187
    },
    "eternal": {
     "dmg": 6561,
     "hp": 6561
    }
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
   "realId": 2,
   "kind": "misc",
   "fanmade": false,
   "stats": {
    "dmg": 13.0,
    "hp": 5.0,
    "spd": 0
   },
   "rarityStats": {
    "common": {
     "dmg": 13,
     "hp": 5
    },
    "unusual": {
     "dmg": 19.5,
     "hp": 7.5
    },
    "rare": {
     "dmg": 58.5,
     "hp": 22.5
    },
    "epic": {
     "dmg": 117,
     "hp": 45
    },
    "legendary": {
     "dmg": 351,
     "hp": 135
    },
    "mythic": {
     "dmg": 631.8,
     "hp": 243
    },
    "ultra": {
     "dmg": 1895.4,
     "hp": 729
    },
    "super": {
     "dmg": 5686.2,
     "hp": 2187
    },
    "eternal": {
     "dmg": 17058.6,
     "hp": 6561
    }
   },
   "reload": 0.8,
   "reloadText": "0.8s",
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
   "realId": 5,
   "kind": "attack",
   "fanmade": false,
   "stats": {
    "dmg": 5.0,
    "hp": 5.0,
    "spd": -12,
    "heal": 8.0
   },
   "rarityStats": {
    "common": {
     "dmg": 5,
     "hp": 5,
     "heal": 8
    },
    "unusual": {
     "dmg": 15,
     "hp": 15,
     "heal": 23
    },
    "rare": {
     "dmg": 45,
     "hp": 45,
     "heal": 68
    },
    "epic": {
     "dmg": 135,
     "hp": 135,
     "heal": 203
    },
    "legendary": {
     "dmg": 405,
     "hp": 405,
     "heal": 608
    },
    "mythic": {
     "dmg": 1215,
     "hp": 1215,
     "heal": 1822.5
    },
    "ultra": {
     "dmg": 3645,
     "hp": 3645,
     "heal": 3156.7
    },
    "super": {
     "dmg": 10935,
     "hp": 10935,
     "heal": 5467.5
    },
    "eternal": {
     "dmg": 32805,
     "hp": 32805,
     "heal": 9500
    },
    "unique": {
     "dmg": 32805,
     "hp": 32805,
     "heal": 9500
    }
   },
   "reload": 3.5,
   "reloadText": "3.5s + 1.5s",
   "wiki": {
    "common": {
     "dmg": 5.0,
     "dur": 5.0,
     "other": "",
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
   "realId": 6,
   "kind": "attack",
   "fanmade": false,
   "stats": {
    "dmg": 100.0,
    "hp": 1.0,
    "spd": -4
   },
   "rarityMultipliers": {
    "common": {
     "dmg": 1,
     "hp": 1
    },
    "unusual": {
     "dmg": 3,
     "hp": 1
    },
    "rare": {
     "dmg": 9,
     "hp": 1
    },
    "epic": {
     "dmg": 27,
     "hp": 1
    },
    "legendary": {
     "dmg": 81,
     "hp": 1
    },
    "mythic": {
     "dmg": 81,
     "hp": 1
    },
    "ultra": {
     "dmg": 145.8,
     "hp": 1
    },
    "super": {
     "dmg": 437.4,
     "hp": 1
    },
    "eternal": {
     "dmg": 1312.2,
     "hp": 1
    }
   },
   "reload": 10,
   "reloadText": "10.0s",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
     "other": "",
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
   "biome": "",
   "hp": 10,
   "dmg": 0,
   "speed": 0,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Obstacle",
   "desc": "A rock. It doesn't do much.",
   "spawn": "Something mountain-like appears in the distance...",
   "rarities": {
    "common": {
     "hp": 10,
     "dmg": 0,
     "exp": 1,
     "type": "Obstacle"
    },
    "unusual": {
     "hp": 30,
     "dmg": 0,
     "exp": 1,
     "type": "Obstacle"
    },
    "rare": {
     "hp": 90,
     "dmg": 0,
     "exp": 3,
     "type": "Obstacle"
    },
    "epic": {
     "hp": 270,
     "dmg": 0,
     "exp": 22,
     "type": "Obstacle"
    },
    "legendary": {
     "hp": 810,
     "dmg": 0,
     "exp": 206,
     "type": "Obstacle"
    },
    "mythic": {
     "hp": 2430,
     "dmg": 0,
     "exp": 3100,
     "type": "Obstacle"
    },
    "ultra": {
     "hp": 7290,
     "dmg": 0,
     "exp": 131000,
     "type": "Obstacle"
    },
    "super": {
     "hp": 21870,
     "dmg": 0,
     "exp": 6800000,
     "type": "Obstacle"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Obstacle"
    },
    "unique": {
     "hp": 65610,
     "dmg": 0,
     "exp": 6800000,
     "type": "Obstacle"
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
   "biome": "",
   "hp": 35,
   "dmg": 0,
   "speed": 0,
   "size": 20,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Obstacle",
   "desc": "Avoid touching it, it hurts.",
   "spawn": "A tower of thorn rises in the sand...",
   "rarities": {
    "common": {
     "hp": 35,
     "dmg": 0,
     "exp": 1,
     "type": "Obstacle"
    },
    "unusual": {
     "hp": 105,
     "dmg": 0,
     "exp": 1,
     "type": "Obstacle"
    },
    "rare": {
     "hp": 315,
     "dmg": 0,
     "exp": 5,
     "type": "Obstacle"
    },
    "epic": {
     "hp": 945,
     "dmg": 0,
     "exp": 37,
     "type": "Obstacle"
    },
    "legendary": {
     "hp": 2835,
     "dmg": 0,
     "exp": 339,
     "type": "Obstacle"
    },
    "mythic": {
     "hp": 8505,
     "dmg": 0,
     "exp": 4000,
     "type": "Obstacle"
    },
    "ultra": {
     "hp": 25515,
     "dmg": 0,
     "exp": 230000,
     "type": "Obstacle"
    },
    "super": {
     "hp": 76545,
     "dmg": 0,
     "exp": 9300000,
     "type": "Obstacle"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Obstacle"
    },
    "unique": {
     "hp": 229635,
     "dmg": 0,
     "exp": 9300000,
     "type": "Obstacle"
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
   "biome": "",
   "hp": 10,
   "dmg": 0,
   "speed": 35,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Passive",
   "desc": "Cute and harmless.",
   "spawn": "A Super Ladybug has spawned somewhere!",
   "rarities": {
    "common": {
     "hp": 60,
     "dmg": 10,
     "armor": 1,
     "exp": 1,
     "type": "Passive"
    },
    "unusual": {
     "hp": 225,
     "dmg": 30,
     "armor": 2,
     "exp": 2,
     "type": "Passive"
    },
    "rare": {
     "hp": 810,
     "dmg": 90,
     "armor": 7,
     "exp": 5,
     "type": "Neutral"
    },
    "epic": {
     "hp": 3240,
     "dmg": 270,
     "armor": 22,
     "exp": 41,
     "type": "Neutral"
    },
    "legendary": {
     "hp": 19440,
     "dmg": 810,
     "armor": 65,
     "exp": 379,
     "type": "Neutral"
    },
    "mythic": {
     "hp": 189540,
     "dmg": 2430,
     "armor": 194,
     "exp": 5228,
     "type": "Neutral"
    },
    "ultra": {
     "hp": 8748000,
     "dmg": 7290,
     "armor": 583,
     "exp": 213479,
     "type": "Neutral"
    },
    "super": {
     "hp": 262440000,
     "dmg": 21870,
     "armor": 583,
     "exp": 12951125,
     "type": "Neutral"
    },
    "eternal": {
     "hp": 1574640000,
     "dmg": 65610,
     "armor": 583,
     "exp": 12951125,
     "type": "Neutral"
    },
    "unique": {
     "hp": 1574640000,
     "dmg": 65610,
     "armor": 583,
     "exp": 12951125,
     "type": "Neutral"
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
   "biome": "",
   "hp": 50,
   "dmg": 0,
   "speed": 35,
   "size": 22,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Passive",
   "desc": "It stings. Don't touch it.",
   "spawn": "A Super Bee has spawned somewhere!",
   "rarities": {
    "common": {
     "hp": 50,
     "dmg": 0,
     "exp": 1,
     "type": "Passive"
    },
    "unusual": {
     "hp": 150,
     "dmg": 0,
     "exp": 1,
     "type": "Passive"
    },
    "rare": {
     "hp": 450,
     "dmg": 0,
     "exp": 5,
     "type": "Neutral"
    },
    "epic": {
     "hp": 1350,
     "dmg": 0,
     "exp": 44,
     "type": "Neutral"
    },
    "legendary": {
     "hp": 4050,
     "dmg": 0,
     "exp": 405,
     "type": "Neutral"
    },
    "mythic": {
     "hp": 12150,
     "dmg": 0,
     "exp": 5900,
     "type": "Neutral"
    },
    "ultra": {
     "hp": 36450,
     "dmg": 0,
     "exp": 266000,
     "type": "Neutral"
    },
    "super": {
     "hp": 109350,
     "dmg": 0,
     "exp": 13000000,
     "type": "Neutral"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Neutral"
    },
    "unique": {
     "hp": 328050,
     "dmg": 0,
     "exp": 13000000,
     "type": "Neutral"
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
   "biome": "",
   "hp": 10,
   "dmg": 0,
   "speed": 35,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Passive",
   "desc": "Weak and defenseless, but big dreams.",
   "spawn": "A Super Baby Ant has spawned somewhere!",
   "rarities": {
    "common": {
     "hp": 10,
     "dmg": 0,
     "exp": 1,
     "type": "Passive"
    },
    "unusual": {
     "hp": 30,
     "dmg": 0,
     "exp": 2,
     "type": "Passive"
    },
    "rare": {
     "hp": 90,
     "dmg": 0,
     "exp": 9,
     "type": "Passive"
    },
    "epic": {
     "hp": 270,
     "dmg": 0,
     "exp": 67,
     "type": "Passive"
    },
    "legendary": {
     "hp": 810,
     "dmg": 0,
     "exp": 615,
     "type": "Passive"
    },
    "mythic": {
     "hp": 2430,
     "dmg": 0,
     "exp": 8200,
     "type": "Passive"
    },
    "ultra": {
     "hp": 7290,
     "dmg": 0,
     "exp": 420000,
     "type": "Passive"
    },
    "super": {
     "hp": 21870,
     "dmg": 0,
     "exp": 20000000,
     "type": "Passive"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Passive"
    },
    "unique": {
     "hp": 65610,
     "dmg": 0,
     "exp": 20000000,
     "type": "Passive"
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
   "biome": "",
   "hp": 10,
   "dmg": 0,
   "speed": 45,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Neutral",
   "desc": "It's a bit temperamental, probably from working all the time.",
   "spawn": "A Super Worker Ant has spawned somewhere!",
   "rarities": {
    "common": {
     "hp": 10,
     "dmg": 0,
     "exp": 1,
     "type": "Neutral"
    },
    "unusual": {
     "hp": 30,
     "dmg": 0,
     "exp": 1,
     "type": "Neutral"
    },
    "rare": {
     "hp": 90,
     "dmg": 0,
     "exp": 4,
     "type": "Neutral"
    },
    "epic": {
     "hp": 270,
     "dmg": 0,
     "exp": 31,
     "type": "Neutral"
    },
    "legendary": {
     "hp": 810,
     "dmg": 0,
     "exp": 279,
     "type": "Neutral"
    },
    "mythic": {
     "hp": 2430,
     "dmg": 0,
     "exp": 4100,
     "type": "Neutral"
    },
    "ultra": {
     "hp": 7290,
     "dmg": 0,
     "exp": 184000,
     "type": "Neutral"
    },
    "super": {
     "hp": 21870,
     "dmg": 0,
     "exp": 9300000,
     "type": "Neutral"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Neutral"
    },
    "unique": {
     "hp": 65610,
     "dmg": 0,
     "exp": 9300000,
     "type": "Neutral"
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
   "biome": "",
   "hp": 10,
   "dmg": 0,
   "speed": 60,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Hostile",
   "desc": "It's got wings and it's ready to use them.",
   "spawn": "A Super Soldier Ant has spawned somewhere!",
   "rarities": {
    "common": {
     "hp": 10,
     "dmg": 0,
     "exp": 1,
     "type": "Hostile"
    },
    "unusual": {
     "hp": 30,
     "dmg": 0,
     "exp": 2,
     "type": "Hostile"
    },
    "rare": {
     "hp": 90,
     "dmg": 0,
     "exp": 6,
     "type": "Hostile"
    },
    "epic": {
     "hp": 270,
     "dmg": 0,
     "exp": 44,
     "type": "Hostile"
    },
    "legendary": {
     "hp": 810,
     "dmg": 0,
     "exp": 400,
     "type": "Hostile"
    },
    "mythic": {
     "hp": 2430,
     "dmg": 0,
     "exp": 5400,
     "type": "Hostile"
    },
    "ultra": {
     "hp": 7290,
     "dmg": 0,
     "exp": 276000,
     "type": "Hostile"
    },
    "super": {
     "hp": 21870,
     "dmg": 0,
     "exp": 14000000,
     "type": "Hostile"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Hostile"
    },
    "unique": {
     "hp": 65610,
     "dmg": 0,
     "exp": 14000000,
     "type": "Hostile"
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
   "biome": "",
   "hp": 10,
   "dmg": 0,
   "speed": 60,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Hostile",
   "desc": "You must have done something really bad if she's chasing you.",
   "spawn": "A Super Queen Ant has spawned somewhere!",
   "rarities": {
    "common": {
     "hp": 10,
     "dmg": 0,
     "exp": 1,
     "type": "Hostile"
    },
    "unusual": {
     "hp": 30,
     "dmg": 0,
     "exp": 1,
     "type": "Hostile"
    },
    "rare": {
     "hp": 90,
     "dmg": 0,
     "exp": 4,
     "type": "Hostile"
    },
    "epic": {
     "hp": 270,
     "dmg": 0,
     "exp": 31,
     "type": "Hostile"
    },
    "legendary": {
     "hp": 810,
     "dmg": 0,
     "exp": 287,
     "type": "Hostile"
    },
    "mythic": {
     "hp": 2430,
     "dmg": 0,
     "exp": 4400,
     "type": "Hostile"
    },
    "ultra": {
     "hp": 7290,
     "dmg": 0,
     "exp": 343000,
     "type": "Hostile"
    },
    "super": {
     "hp": 21870,
     "dmg": 0,
     "exp": 16000000,
     "type": "Hostile"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Hostile"
    },
    "unique": {
     "hp": 65610,
     "dmg": 0,
     "exp": 16000000,
     "type": "Hostile"
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
   "biome": "",
   "hp": 15,
   "dmg": 0,
   "speed": 30,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Summon",
   "desc": "Ants go in, and come out. Can't explain that.",
   "spawn": "A Super Ant Hole has spawned somewhere!",
   "rarities": {
    "common": {
     "hp": 15,
     "dmg": 0,
     "exp": 1,
     "type": "Summon"
    },
    "unusual": {
     "hp": 45,
     "dmg": 0,
     "exp": 2,
     "type": "Summon"
    },
    "rare": {
     "hp": 135,
     "dmg": 0,
     "exp": 5,
     "type": "Summon"
    },
    "epic": {
     "hp": 405,
     "dmg": 0,
     "exp": 39,
     "type": "Summon"
    },
    "legendary": {
     "hp": 1215,
     "dmg": 0,
     "exp": 356,
     "type": "Summon"
    },
    "mythic": {
     "hp": 3645,
     "dmg": 0,
     "exp": 5000,
     "type": "Summon"
    },
    "ultra": {
     "hp": 10935,
     "dmg": 0,
     "exp": 243000,
     "type": "Summon"
    },
    "super": {
     "hp": 32805,
     "dmg": 0,
     "exp": 12000000,
     "type": "Summon"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Summon"
    },
    "unique": {
     "hp": 98415,
     "dmg": 0,
     "exp": 12000000,
     "type": "Summon"
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
   "biome": "",
   "hp": 30,
   "dmg": 0,
   "speed": 60,
   "size": 19,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Hostile",
   "desc": "It's hungry and flowers are its favorite meal.",
   "spawn": "A Super Beetle has spawned somewhere!",
   "rarities": {
    "common": {
     "hp": 30,
     "dmg": 0,
     "exp": 1,
     "type": "Hostile"
    },
    "unusual": {
     "hp": 90,
     "dmg": 0,
     "exp": 2,
     "type": "Hostile"
    },
    "rare": {
     "hp": 270,
     "dmg": 0,
     "exp": 7,
     "type": "Hostile"
    },
    "epic": {
     "hp": 810,
     "dmg": 0,
     "exp": 52,
     "type": "Hostile"
    },
    "legendary": {
     "hp": 2430,
     "dmg": 0,
     "exp": 476,
     "type": "Hostile"
    },
    "mythic": {
     "hp": 7290,
     "dmg": 0,
     "exp": 6100,
     "type": "Hostile"
    },
    "ultra": {
     "hp": 21870,
     "dmg": 0,
     "exp": 328000,
     "type": "Hostile"
    },
    "super": {
     "hp": 65610,
     "dmg": 0,
     "exp": 15000000,
     "type": "Hostile"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Hostile"
    },
    "unique": {
     "hp": 196830,
     "dmg": 0,
     "exp": 15000000,
     "type": "Hostile"
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
   "biome": "",
   "hp": 50,
   "dmg": 5,
   "speed": 60,
   "size": 22,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Hostile",
   "desc": "These aren't quite as nice as the little bees.",
   "spawn": "A big yellow spot shows up in the distance...",
   "rarities": {
    "common": {
     "hp": 50,
     "dmg": 5,
     "exp": 1,
     "type": "Hostile"
    },
    "unusual": {
     "hp": 150,
     "dmg": 25,
     "exp": 2,
     "type": "Hostile"
    },
    "rare": {
     "hp": 450,
     "dmg": 125,
     "exp": 6,
     "type": "Hostile"
    },
    "epic": {
     "hp": 1350,
     "dmg": 625,
     "exp": 53,
     "type": "Hostile"
    },
    "legendary": {
     "hp": 4050,
     "dmg": 3125,
     "exp": 486,
     "type": "Hostile"
    },
    "mythic": {
     "hp": 12150,
     "dmg": 15625,
     "exp": 6900,
     "type": "Hostile"
    },
    "ultra": {
     "hp": 36450,
     "dmg": 78125,
     "exp": 328000,
     "type": "Hostile"
    },
    "super": {
     "hp": 109350,
     "dmg": 390625,
     "exp": 16000000,
     "type": "Hostile"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Hostile"
    },
    "unique": {
     "hp": 328050,
     "dmg": 1953125,
     "exp": 16000000,
     "type": "Hostile"
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
   "biome": "",
   "hp": 10,
   "dmg": 0,
   "speed": 35,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Passive",
   "desc": "It's just there doing its thing.",
   "spawn": "A Super Centipede has spawned somewhere!",
   "rarities": {
    "common": { "hp": 25, "dmg": 10, "armor": 1, "exp": 1, "type": "Passive" },
    "unusual": { "hp": 93.8, "dmg": 30, "armor": 2, "exp": 1, "type": "Passive" },
    "rare": { "hp": 337.5, "dmg": 90, "armor": 7, "exp": 2, "type": "Passive" },
    "epic": { "hp": 1350, "dmg": 270, "armor": 22, "exp": 14, "type": "Neutral" },
    "legendary": { "hp": 8100, "dmg": 810, "armor": 65, "exp": 133, "type": "Neutral" },
    "mythic": { "hp": 78975, "dmg": 2430, "armor": 194, "exp": 2038, "type": "Neutral" },
    "ultra": { "hp": 3645000, "dmg": 7290, "armor": 583, "exp": 59386, "type": "Neutral" },
    "super": { "hp": 109350000, "dmg": 21870, "armor": 583, "exp": 3895257, "type": "Neutral" },
    "eternal": { "hp": 656100000, "dmg": 65610, "armor": 583, "exp": 3895257, "type": "Neutral" },
    "unique": { "hp": 656100000, "dmg": 65610, "armor": 583, "exp": 3895257, "type": "Neutral" }
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
   "biome": "",
   "hp": 10,
   "dmg": 0,
   "speed": 45,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Technical",
   "desc": "It's just there doing its thing.",
   "spawn": "",
   "rarities": {
    "common": {
     "hp": 10,
     "dmg": 0,
     "exp": 1,
     "type": "Technical"
    },
    "unusual": {
     "hp": 30,
     "dmg": 0,
     "exp": 1,
     "type": "Technical"
    },
    "rare": {
     "hp": 90,
     "dmg": 0,
     "exp": 3,
     "type": "Technical"
    },
    "epic": {
     "hp": 270,
     "dmg": 0,
     "exp": 15,
     "type": "Neutral"
    },
    "legendary": {
     "hp": 810,
     "dmg": 0,
     "exp": 133,
     "type": "Neutral"
    },
    "mythic": {
     "hp": 2430,
     "dmg": 0,
     "exp": 2000,
     "type": "Neutral"
    },
    "ultra": {
     "hp": 7290,
     "dmg": 0,
     "exp": 76700,
     "type": "Neutral"
    },
    "super": {
     "hp": 21870,
     "dmg": 0,
     "exp": 3900000,
     "type": "Neutral"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Neutral"
    },
    "unique": {
     "hp": 65610,
     "dmg": 0,
     "exp": 3900000,
     "type": "Neutral"
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
   "biome": "",
   "hp": 10,
   "dmg": 0,
   "speed": 60,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Hostile",
   "desc": "This one loves flowers.",
   "spawn": "A Super Centipede has spawned somewhere!",
   "rarities": {
    "common": {
     "hp": 10,
     "dmg": 0,
     "exp": 1,
     "type": "Hostile"
    },
    "unusual": {
     "hp": 30,
     "dmg": 0,
     "exp": 1,
     "type": "Hostile"
    },
    "rare": {
     "hp": 90,
     "dmg": 0,
     "exp": 3,
     "type": "Hostile"
    },
    "epic": {
     "hp": 270,
     "dmg": 0,
     "exp": 15,
     "type": "Hostile"
    },
    "legendary": {
     "hp": 810,
     "dmg": 0,
     "exp": 133,
     "type": "Hostile"
    },
    "mythic": {
     "hp": 2430,
     "dmg": 0,
     "exp": 2000,
     "type": "Hostile"
    },
    "ultra": {
     "hp": 7290,
     "dmg": 0,
     "exp": 76700,
     "type": "Hostile"
    },
    "super": {
     "hp": 21870,
     "dmg": 0,
     "exp": 3900000,
     "type": "Hostile"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Hostile"
    },
    "unique": {
     "hp": 65610,
     "dmg": 0,
     "exp": 3900000,
     "type": "Hostile"
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
   "biome": "",
   "hp": 10,
   "dmg": 0,
   "speed": 45,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Technical",
   "desc": "This one loves flowers.",
   "spawn": "",
   "rarities": {
    "common": {
     "hp": 10,
     "dmg": 0,
     "exp": 1,
     "type": "Technical"
    },
    "unusual": {
     "hp": 30,
     "dmg": 0,
     "exp": 1,
     "type": "Technical"
    },
    "rare": {
     "hp": 90,
     "dmg": 0,
     "exp": 3,
     "type": "Technical"
    },
    "epic": {
     "hp": 270,
     "dmg": 0,
     "exp": 15,
     "type": "Technical"
    },
    "legendary": {
     "hp": 810,
     "dmg": 0,
     "exp": 133,
     "type": "Technical"
    },
    "mythic": {
     "hp": 2430,
     "dmg": 0,
     "exp": 2000,
     "type": "Technical"
    },
    "ultra": {
     "hp": 7290,
     "dmg": 0,
     "exp": 76700,
     "type": "Technical"
    },
    "super": {
     "hp": 21870,
     "dmg": 0,
     "exp": 3900000,
     "type": "Technical"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Technical"
    },
    "unique": {
     "hp": 65610,
     "dmg": 0,
     "exp": 3900000,
     "type": "Technical"
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
   "biome": "",
   "hp": 10,
   "dmg": 0,
   "speed": 35,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Passive",
   "desc": "Gotta go fast.",
   "spawn": "A Super Centipede has spawned somewhere!",
   "rarities": {
    "common": {
     "hp": 10,
     "dmg": 0,
     "exp": 1,
     "type": "Passive"
    },
    "unusual": {
     "hp": 30,
     "dmg": 0,
     "exp": 1,
     "type": "Passive"
    },
    "rare": {
     "hp": 90,
     "dmg": 0,
     "exp": 3,
     "type": "Passive"
    },
    "epic": {
     "hp": 270,
     "dmg": 0,
     "exp": 22,
     "type": "Neutral"
    },
    "legendary": {
     "hp": 810,
     "dmg": 0,
     "exp": 206,
     "type": "Neutral"
    },
    "mythic": {
     "hp": 2430,
     "dmg": 0,
     "exp": 3100,
     "type": "Neutral"
    },
    "ultra": {
     "hp": 7290,
     "dmg": 0,
     "exp": 130000,
     "type": "Neutral"
    },
    "super": {
     "hp": 21870,
     "dmg": 0,
     "exp": 6600000,
     "type": "Neutral"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Neutral"
    },
    "unique": {
     "hp": 65610,
     "dmg": 0,
     "exp": 6600000,
     "type": "Neutral"
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
   "biome": "",
   "hp": 10,
   "dmg": 0,
   "speed": 45,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Technical",
   "desc": "Gotta go fast.",
   "spawn": "",
   "rarities": {
    "common": {
     "hp": 10,
     "dmg": 0,
     "exp": 1,
     "type": "Technical"
    },
    "unusual": {
     "hp": 30,
     "dmg": 0,
     "exp": 1,
     "type": "Technical"
    },
    "rare": {
     "hp": 90,
     "dmg": 0,
     "exp": 3,
     "type": "Technical"
    },
    "epic": {
     "hp": 270,
     "dmg": 0,
     "exp": 22,
     "type": "Neutral"
    },
    "legendary": {
     "hp": 810,
     "dmg": 0,
     "exp": 206,
     "type": "Neutral"
    },
    "mythic": {
     "hp": 2430,
     "dmg": 0,
     "exp": 3100,
     "type": "Neutral"
    },
    "ultra": {
     "hp": 7290,
     "dmg": 0,
     "exp": 130000,
     "type": "Neutral"
    },
    "super": {
     "hp": 21870,
     "dmg": 0,
     "exp": 6600000,
     "type": "Neutral"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Neutral"
    },
    "unique": {
     "hp": 65610,
     "dmg": 0,
     "exp": 6600000,
     "type": "Neutral"
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
   "biome": "",
   "hp": 10,
   "dmg": 0,
   "speed": 35,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Passive",
   "desc": "This shape...it looks familiar...",
   "spawn": "A Super Square has spawned somewhere!",
   "rarities": {
    "common": {
     "hp": 10,
     "dmg": 0,
     "exp": 1,
     "type": "Passive"
    },
    "unusual": {
     "hp": 30,
     "dmg": 0,
     "exp": 1,
     "type": "Passive"
    },
    "rare": {
     "hp": 90,
     "dmg": 0,
     "exp": 1,
     "type": "Passive"
    },
    "epic": {
     "hp": 270,
     "dmg": 0,
     "exp": 1,
     "type": "Passive"
    },
    "legendary": {
     "hp": 810,
     "dmg": 0,
     "exp": 1,
     "type": "Passive"
    },
    "mythic": {
     "hp": 2430,
     "dmg": 0,
     "exp": 1,
     "type": "Passive"
    },
    "ultra": {
     "hp": 7290,
     "dmg": 0,
     "exp": 1,
     "type": "Passive"
    },
    "super": {
     "hp": 21870,
     "dmg": 0,
     "exp": 1,
     "type": "Passive"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Passive"
    },
    "unique": {
     "hp": 65610,
     "dmg": 0,
     "exp": 1,
     "type": "Passive"
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
   "biome": "",
   "hp": 10,
   "dmg": 0,
   "speed": 45,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Neutral",
   "desc": "Cute and harmless... if left unprovoked.",
   "spawn": "A Super Ladybug has spawned somewhere!",
   "rarities": {
    "common": {
     "hp": 10,
     "dmg": 0,
     "exp": 1,
     "type": "Neutral"
    },
    "unusual": {
     "hp": 30,
     "dmg": 0,
     "exp": 1,
     "type": "Neutral"
    },
    "rare": {
     "hp": 90,
     "dmg": 0,
     "exp": 4,
     "type": "Neutral"
    },
    "epic": {
     "hp": 270,
     "dmg": 0,
     "exp": 32,
     "type": "Neutral"
    },
    "legendary": {
     "hp": 810,
     "dmg": 0,
     "exp": 297,
     "type": "Neutral"
    },
    "mythic": {
     "hp": 2430,
     "dmg": 0,
     "exp": 4200,
     "type": "Neutral"
    },
    "ultra": {
     "hp": 7290,
     "dmg": 0,
     "exp": 198000,
     "type": "Neutral"
    },
    "super": {
     "hp": 21870,
     "dmg": 0,
     "exp": 9900000,
     "type": "Neutral"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Neutral"
    },
    "unique": {
     "hp": 65610,
     "dmg": 0,
     "exp": 9900000,
     "type": "Neutral"
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
   "biome": "",
   "hp": 10,
   "dmg": 0,
   "speed": 45,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Neutral",
   "desc": "Shiny, cute and mostly harmless.",
   "spawn": "A Super Ladybug has spawned somewhere!",
   "rarities": {
    "common": {
     "hp": 10,
     "dmg": 0,
     "exp": 2,
     "type": "Neutral"
    },
    "unusual": {
     "hp": 30,
     "dmg": 0,
     "exp": 2,
     "type": "Neutral"
    },
    "rare": {
     "hp": 90,
     "dmg": 0,
     "exp": 12,
     "type": "Neutral"
    },
    "epic": {
     "hp": 270,
     "dmg": 0,
     "exp": 94,
     "type": "Neutral"
    },
    "legendary": {
     "hp": 810,
     "dmg": 0,
     "exp": 1100,
     "type": "Neutral"
    },
    "mythic": {
     "hp": 2430,
     "dmg": 0,
     "exp": 13500,
     "type": "Neutral"
    },
    "ultra": {
     "hp": 7290,
     "dmg": 0,
     "exp": 802000,
     "type": "Neutral"
    },
    "super": {
     "hp": 21870,
     "dmg": 0,
     "exp": 28000000,
     "type": "Neutral"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Neutral"
    },
    "unique": {
     "hp": 65610,
     "dmg": 0,
     "exp": 28000000,
     "type": "Neutral"
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
   "biome": "",
   "hp": 15,
   "dmg": 40,
   "speed": 60,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Hostile",
   "desc": "Spooky.",
   "spawn": "A Super Spider has spawned somewhere!",
   "rarities": {
    "common": {
     "hp": 15,
     "dmg": 40,
     "exp": 1,
     "type": "Hostile"
    },
    "unusual": {
     "hp": 45,
     "dmg": 120,
     "exp": 2,
     "type": "Hostile"
    },
    "rare": {
     "hp": 135,
     "dmg": 360,
     "exp": 5,
     "type": "Hostile"
    },
    "epic": {
     "hp": 405,
     "dmg": 1080,
     "exp": 41,
     "type": "Hostile"
    },
    "legendary": {
     "hp": 1215,
     "dmg": 3240,
     "exp": 379,
     "type": "Hostile"
    },
    "mythic": {
     "hp": 3645,
     "dmg": 9720,
     "exp": 5300,
     "type": "Hostile"
    },
    "ultra": {
     "hp": 10935,
     "dmg": 29160,
     "exp": 268000,
     "type": "Hostile"
    },
    "super": {
     "hp": 32805,
     "dmg": 87480,
     "exp": 13000000,
     "type": "Hostile"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Hostile"
    },
    "unique": {
     "hp": 98415,
     "dmg": 262440,
     "exp": 13000000,
     "type": "Hostile"
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
   "biome": "",
   "hp": 15,
   "dmg": 5,
   "speed": 60,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Hostile",
   "desc": "IT STINGS!",
   "spawn": "A Super Scorpion has spawned somewhere!",
   "rarities": {
    "common": {
     "hp": 15,
     "dmg": 5,
     "exp": 1,
     "type": "Hostile"
    },
    "unusual": {
     "hp": 45,
     "dmg": 25,
     "exp": 2,
     "type": "Hostile"
    },
    "rare": {
     "hp": 135,
     "dmg": 125,
     "exp": 5,
     "type": "Hostile"
    },
    "epic": {
     "hp": 405,
     "dmg": 1080,
     "exp": 41,
     "type": "Hostile"
    },
    "legendary": {
     "hp": 1215,
     "dmg": 3125,
     "exp": 379,
     "type": "Hostile"
    },
    "mythic": {
     "hp": 3645,
     "dmg": 15625,
     "exp": 5200,
     "type": "Hostile"
    },
    "ultra": {
     "hp": 10935,
     "dmg": 78125,
     "exp": 260000,
     "type": "Hostile"
    },
    "super": {
     "hp": 32805,
     "dmg": 390625,
     "exp": 13000000,
     "type": "Hostile"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Hostile"
    },
    "unique": {
     "hp": 98415,
     "dmg": 1953125,
     "exp": 13000000,
     "type": "Hostile"
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
   "biome": "",
   "hp": 20,
   "dmg": 0,
   "speed": 60,
   "size": 18,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Hostile",
   "desc": "This ant is on fireeeeeeeeeeeeee.",
   "spawn": "A Super Soldier Fire Ant has spawned somewhere!",
   "rarities": {
    "common": {
     "hp": 20,
     "dmg": 0,
     "exp": 1,
     "type": "Hostile"
    },
    "unusual": {
     "hp": 60,
     "dmg": 0,
     "exp": 2,
     "type": "Hostile"
    },
    "rare": {
     "hp": 180,
     "dmg": 0,
     "exp": 6,
     "type": "Hostile"
    },
    "epic": {
     "hp": 540,
     "dmg": 0,
     "exp": 44,
     "type": "Hostile"
    },
    "legendary": {
     "hp": 1620,
     "dmg": 0,
     "exp": 400,
     "type": "Hostile"
    },
    "mythic": {
     "hp": 4860,
     "dmg": 0,
     "exp": 5400,
     "type": "Hostile"
    },
    "ultra": {
     "hp": 14580,
     "dmg": 0,
     "exp": 276000,
     "type": "Hostile"
    },
    "super": {
     "hp": 43740,
     "dmg": 0,
     "exp": 14000000,
     "type": "Hostile"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Hostile"
    },
    "unique": {
     "hp": 131220,
     "dmg": 0,
     "exp": 14000000,
     "type": "Hostile"
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
   "biome": "",
   "hp": 0,
   "dmg": 0,
   "speed": 30,
   "size": 16,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Summon",
   "desc": "What could be in here?",
   "spawn": "A Super Fire Ant Burrow has spawned somewhere!",
   "rarities": {
    "common": {
     "hp": 0,
     "dmg": 0,
     "exp": 1,
     "type": "Summon"
    },
    "unusual": {
     "hp": 0,
     "dmg": 0,
     "exp": 1,
     "type": "Summon"
    },
    "rare": {
     "hp": 0,
     "dmg": 0,
     "exp": 6,
     "type": "Summon"
    },
    "epic": {
     "hp": 0,
     "dmg": 0,
     "exp": 54,
     "type": "Summon"
    },
    "legendary": {
     "hp": 0,
     "dmg": 0,
     "exp": 497,
     "type": "Summon"
    },
    "mythic": {
     "hp": 0,
     "dmg": 0,
     "exp": 6300,
     "type": "Summon"
    },
    "ultra": {
     "hp": 0,
     "dmg": 0,
     "exp": 343000,
     "type": "Summon"
    },
    "super": {
     "hp": 0,
     "dmg": 0,
     "exp": 16000000,
     "type": "Summon"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Summon"
    },
    "unique": {
     "hp": 0,
     "dmg": 0,
     "exp": 16000000,
     "type": "Summon"
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
   "biome": "",
   "hp": 40,
   "dmg": 0,
   "speed": 35,
   "size": 21,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Passive",
   "desc": "Darude (1999)",
   "spawn": "A Super Sandstorm has spawned somewhere!",
   "rarities": {
    "common": {
     "hp": 40,
     "dmg": 0,
     "exp": 1,
     "type": "Passive"
    },
    "unusual": {
     "hp": 120,
     "dmg": 0,
     "exp": 1,
     "type": "Passive"
    },
    "rare": {
     "hp": 360,
     "dmg": 0,
     "exp": 4,
     "type": "Passive"
    },
    "epic": {
     "hp": 1080,
     "dmg": 0,
     "exp": 30,
     "type": "Passive"
    },
    "legendary": {
     "hp": 3240,
     "dmg": 0,
     "exp": 308,
     "type": "Passive"
    },
    "mythic": {
     "hp": 9720,
     "dmg": 0,
     "exp": 4700,
     "type": "Passive"
    },
    "ultra": {
     "hp": 29160,
     "dmg": 0,
     "exp": 198000,
     "type": "Passive"
    },
    "super": {
     "hp": 87480,
     "dmg": 0,
     "exp": 10000000,
     "type": "Passive"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Passive"
    },
    "unique": {
     "hp": 262440,
     "dmg": 0,
     "exp": 10000000,
     "type": "Passive"
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
   "biome": "",
   "hp": 5,
   "dmg": 0,
   "speed": 35,
   "size": 16,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Passive",
   "desc": "Pop",
   "spawn": "A Super Bubble has spawned somewhere!",
   "rarities": {
    "common": {
     "hp": 5,
     "dmg": 0,
     "exp": 1,
     "type": "Passive"
    },
    "unusual": {
     "hp": 15,
     "dmg": 0,
     "exp": 2,
     "type": "Passive"
    },
    "rare": {
     "hp": 45,
     "dmg": 0,
     "exp": 9,
     "type": "Passive"
    },
    "epic": {
     "hp": 135,
     "dmg": 0,
     "exp": 68,
     "type": "Passive"
    },
    "legendary": {
     "hp": 405,
     "dmg": 0,
     "exp": 645,
     "type": "Passive"
    },
    "mythic": {
     "hp": 1215,
     "dmg": 0,
     "exp": 7600,
     "type": "Passive"
    },
    "ultra": {
     "hp": 3645,
     "dmg": 0,
     "exp": 432000,
     "type": "Passive"
    },
    "super": {
     "hp": 10935,
     "dmg": 0,
     "exp": 16000000,
     "type": "Passive"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Passive"
    },
    "unique": {
     "hp": 32805,
     "dmg": 0,
     "exp": 16000000,
     "type": "Passive"
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
   "biome": "",
   "hp": 20,
   "dmg": 5,
   "speed": 35,
   "size": 18,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Passive",
   "desc": "GOTTA RUN.",
   "spawn": "A Super Bumble Bee has spawned somewhere!",
   "rarities": {
    "common": {
     "hp": 20,
     "dmg": 5,
     "exp": 1,
     "type": "Passive"
    },
    "unusual": {
     "hp": 60,
     "dmg": 25,
     "exp": 1,
     "type": "Passive"
    },
    "rare": {
     "hp": 180,
     "dmg": 125,
     "exp": 10,
     "type": "Passive"
    },
    "epic": {
     "hp": 540,
     "dmg": 625,
     "exp": 93,
     "type": "Passive"
    },
    "legendary": {
     "hp": 1620,
     "dmg": 3125,
     "exp": 877,
     "type": "Passive"
    },
    "mythic": {
     "hp": 4860,
     "dmg": 15625,
     "exp": 10600,
     "type": "Passive"
    },
    "ultra": {
     "hp": 14580,
     "dmg": 78125,
     "exp": 593000,
     "type": "Passive"
    },
    "super": {
     "hp": 43740,
     "dmg": 390625,
     "exp": 24000000,
     "type": "Passive"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Passive"
    },
    "unique": {
     "hp": 131220,
     "dmg": 1953125,
     "exp": 24000000,
     "type": "Passive"
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
   "biome": "",
   "hp": 10,
   "dmg": 50,
   "speed": 45,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Neutral",
   "desc": "Not an advertisement.",
   "spawn": "A Super Shell has spawned somewhere!",
   "rarities": {
    "common": {
     "hp": 10,
     "dmg": 50,
     "exp": 1,
     "type": "Neutral"
    },
    "unusual": {
     "hp": 30,
     "dmg": 250,
     "exp": 1,
     "type": "Neutral"
    },
    "rare": {
     "hp": 90,
     "dmg": 1250,
     "exp": 5,
     "type": "Neutral"
    },
    "epic": {
     "hp": 270,
     "dmg": 6250,
     "exp": 38,
     "type": "Neutral"
    },
    "legendary": {
     "hp": 810,
     "dmg": 31250,
     "exp": 351,
     "type": "Neutral"
    },
    "mythic": {
     "hp": 2430,
     "dmg": 156250,
     "exp": 5000,
     "type": "Neutral"
    },
    "ultra": {
     "hp": 7290,
     "dmg": 781250,
     "exp": 232000,
     "type": "Neutral"
    },
    "super": {
     "hp": 21870,
     "dmg": 3906250,
     "exp": 12000000,
     "type": "Neutral"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Neutral"
    },
    "unique": {
     "hp": 65610,
     "dmg": 19531250,
     "exp": 12000000,
     "type": "Neutral"
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
   "biome": "",
   "hp": 20,
   "dmg": 0,
   "speed": 60,
   "size": 18,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Hostile",
   "desc": "His name is Patrick.",
   "spawn": "A Super Starfish has spawned somewhere!",
   "rarities": {
    "common": {
     "hp": 20,
     "dmg": 0,
     "exp": 1,
     "type": "Hostile"
    },
    "unusual": {
     "hp": 60,
     "dmg": 0,
     "exp": 1,
     "type": "Hostile"
    },
    "rare": {
     "hp": 180,
     "dmg": 0,
     "exp": 5,
     "type": "Hostile"
    },
    "epic": {
     "hp": 540,
     "dmg": 0,
     "exp": 35,
     "type": "Hostile"
    },
    "legendary": {
     "hp": 1620,
     "dmg": 0,
     "exp": 322,
     "type": "Hostile"
    },
    "mythic": {
     "hp": 4860,
     "dmg": 0,
     "exp": 4700,
     "type": "Hostile"
    },
    "ultra": {
     "hp": 14580,
     "dmg": 0,
     "exp": 207000,
     "type": "Hostile"
    },
    "super": {
     "hp": 43740,
     "dmg": 0,
     "exp": 10000000,
     "type": "Hostile"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Hostile"
    },
    "unique": {
     "hp": 131220,
     "dmg": 0,
     "exp": 10000000,
     "type": "Hostile"
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
   "biome": "",
   "hp": 25,
   "dmg": 0,
   "speed": 60,
   "size": 19,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Hostile",
   "desc": "Mr. Crab.",
   "spawn": "A Super Crab has spawned somewhere!",
   "rarities": {
    "common": {
     "hp": 25,
     "dmg": 0,
     "exp": 1,
     "type": "Hostile"
    },
    "unusual": {
     "hp": 75,
     "dmg": 0,
     "exp": 1,
     "type": "Hostile"
    },
    "rare": {
     "hp": 225,
     "dmg": 0,
     "exp": 4,
     "type": "Hostile"
    },
    "epic": {
     "hp": 675,
     "dmg": 0,
     "exp": 28,
     "type": "Hostile"
    },
    "legendary": {
     "hp": 2025,
     "dmg": 0,
     "exp": 256,
     "type": "Hostile"
    },
    "mythic": {
     "hp": 6075,
     "dmg": 0,
     "exp": 3600,
     "type": "Hostile"
    },
    "ultra": {
     "hp": 18225,
     "dmg": 0,
     "exp": 169000,
     "type": "Hostile"
    },
    "super": {
     "hp": 54675,
     "dmg": 0,
     "exp": 8400000,
     "type": "Hostile"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Hostile"
    },
    "unique": {
     "hp": 164025,
     "dmg": 0,
     "exp": 8400000,
     "type": "Hostile"
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
   "biome": "",
   "hp": 25,
   "dmg": 7,
   "speed": 60,
   "size": 19,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Hostile",
   "desc": "Makes the most delicious jam.",
   "spawn": "You hear lightning strikes coming from a far distance...",
   "rarities": {
    "common": {
     "hp": 25,
     "dmg": 7,
     "exp": 1,
     "type": "Hostile"
    },
    "unusual": {
     "hp": 75,
     "dmg": 21,
     "exp": 1,
     "type": "Hostile"
    },
    "rare": {
     "hp": 225,
     "dmg": 63,
     "exp": 5,
     "type": "Hostile"
    },
    "epic": {
     "hp": 675,
     "dmg": 189,
     "exp": 36,
     "type": "Hostile"
    },
    "legendary": {
     "hp": 2025,
     "dmg": 567,
     "exp": 329,
     "type": "Hostile"
    },
    "mythic": {
     "hp": 6075,
     "dmg": 1701,
     "exp": 4700,
     "type": "Hostile"
    },
    "ultra": {
     "hp": 18225,
     "dmg": 5103,
     "exp": 222000,
     "type": "Hostile"
    },
    "super": {
     "hp": 54675,
     "dmg": 15309,
     "exp": 11000000,
     "type": "Hostile"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Hostile"
    },
    "unique": {
     "hp": 164025,
     "dmg": 45927,
     "exp": 11000000,
     "type": "Hostile"
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
   "biome": "",
   "hp": 30,
   "dmg": 0,
   "speed": 45,
   "size": 19,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Friendly",
   "desc": "Wrong game, bud.",
   "spawn": "A Super Digger has spawned somewhere!",
   "rarities": {
    "common": {
     "hp": 30,
     "dmg": 0,
     "exp": 1,
     "type": "Friendly"
    },
    "unusual": {
     "hp": 90,
     "dmg": 0,
     "exp": 1,
     "type": "Friendly"
    },
    "rare": {
     "hp": 270,
     "dmg": 0,
     "exp": 3,
     "type": "Friendly"
    },
    "epic": {
     "hp": 810,
     "dmg": 0,
     "exp": 30,
     "type": "Friendly"
    },
    "legendary": {
     "hp": 2430,
     "dmg": 0,
     "exp": 279,
     "type": "Friendly"
    },
    "mythic": {
     "hp": 7290,
     "dmg": 0,
     "exp": 4100,
     "type": "Friendly"
    },
    "ultra": {
     "hp": 21870,
     "dmg": 0,
     "exp": 184000,
     "type": "Friendly"
    },
    "super": {
     "hp": 65610,
     "dmg": 0,
     "exp": 9300000,
     "type": "Friendly"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Friendly"
    },
    "unique": {
     "hp": 196830,
     "dmg": 0,
     "exp": 9300000,
     "type": "Friendly"
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
   "biome": "",
   "hp": 10,
   "dmg": 0,
   "speed": 0,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Obstacle",
   "desc": "Bob.",
   "spawn": "A Super Sponge has spawned somewhere!",
   "rarities": {
    "common": {
     "hp": 10,
     "dmg": 0,
     "exp": 1,
     "type": "Obstacle"
    },
    "unusual": {
     "hp": 30,
     "dmg": 0,
     "exp": 1,
     "type": "Obstacle"
    },
    "rare": {
     "hp": 90,
     "dmg": 0,
     "exp": 5,
     "type": "Obstacle"
    },
    "epic": {
     "hp": 270,
     "dmg": 0,
     "exp": 33,
     "type": "Obstacle"
    },
    "legendary": {
     "hp": 810,
     "dmg": 0,
     "exp": 297,
     "type": "Obstacle"
    },
    "mythic": {
     "hp": 2430,
     "dmg": 0,
     "exp": 4200,
     "type": "Obstacle"
    },
    "ultra": {
     "hp": 7290,
     "dmg": 0,
     "exp": 198000,
     "type": "Obstacle"
    },
    "super": {
     "hp": 21870,
     "dmg": 0,
     "exp": 9900000,
     "type": "Obstacle"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Obstacle"
    },
    "unique": {
     "hp": 65610,
     "dmg": 0,
     "exp": 9900000,
     "type": "Obstacle"
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
   "biome": "",
   "hp": 10,
   "dmg": 7,
   "speed": 60,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Hostile",
   "desc": "Slurp slurp.",
   "spawn": "A Super Leech has spawned somewhere!",
   "rarities": {
    "common": {
     "hp": 10,
     "dmg": 7,
     "exp": 1,
     "type": "Hostile"
    },
    "unusual": {
     "hp": 30,
     "dmg": 21,
     "exp": 2,
     "type": "Hostile"
    },
    "rare": {
     "hp": 90,
     "dmg": 63,
     "exp": 5,
     "type": "Hostile"
    },
    "epic": {
     "hp": 270,
     "dmg": 189,
     "exp": 41,
     "type": "Hostile"
    },
    "legendary": {
     "hp": 810,
     "dmg": 567,
     "exp": 379,
     "type": "Hostile"
    },
    "mythic": {
     "hp": 2430,
     "dmg": 1701,
     "exp": 5200,
     "type": "Hostile"
    },
    "ultra": {
     "hp": 7290,
     "dmg": 5103,
     "exp": 260000,
     "type": "Hostile"
    },
    "super": {
     "hp": 21870,
     "dmg": 15309,
     "exp": 13000000,
     "type": "Hostile"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Hostile"
    },
    "unique": {
     "hp": 65610,
     "dmg": 45927,
     "exp": 13000000,
     "type": "Hostile"
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
   "biome": "",
   "hp": 10,
   "dmg": 7,
   "speed": 45,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Technical",
   "desc": "Slurp slurp.",
   "spawn": "",
   "rarities": {
    "common": {
     "hp": 10,
     "dmg": 7,
     "exp": 1,
     "type": "Technical"
    },
    "unusual": {
     "hp": 30,
     "dmg": 21,
     "exp": 1,
     "type": "Technical"
    },
    "rare": {
     "hp": 90,
     "dmg": 63,
     "exp": 1,
     "type": "Technical"
    },
    "epic": {
     "hp": 270,
     "dmg": 189,
     "exp": 1,
     "type": "Technical"
    },
    "legendary": {
     "hp": 810,
     "dmg": 567,
     "exp": 1,
     "type": "Technical"
    },
    "mythic": {
     "hp": 2430,
     "dmg": 1701,
     "exp": 1,
     "type": "Technical"
    },
    "ultra": {
     "hp": 7290,
     "dmg": 5103,
     "exp": 1,
     "type": "Technical"
    },
    "super": {
     "hp": 21870,
     "dmg": 15309,
     "exp": 1,
     "type": "Technical"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Technical"
    },
    "unique": {
     "hp": 65610,
     "dmg": 45927,
     "exp": 1,
     "type": "Technical"
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
   "biome": "",
   "hp": 15,
   "dmg": 25,
   "speed": 0,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Obstacle",
   "desc": "Puffy.",
   "spawn": "A Super Dandelion has spawned somewhere!",
   "rarities": {
    "common": {
     "hp": 15,
     "dmg": 25,
     "exp": 1,
     "type": "Obstacle"
    },
    "unusual": {
     "hp": 45,
     "dmg": 125,
     "exp": 1,
     "type": "Obstacle"
    },
    "rare": {
     "hp": 135,
     "dmg": 625,
     "exp": 3,
     "type": "Obstacle"
    },
    "epic": {
     "hp": 405,
     "dmg": 3125,
     "exp": 23,
     "type": "Obstacle"
    },
    "legendary": {
     "hp": 1215,
     "dmg": 15625,
     "exp": 211,
     "type": "Obstacle"
    },
    "mythic": {
     "hp": 3645,
     "dmg": 78125,
     "exp": 2800,
     "type": "Obstacle"
    },
    "ultra": {
     "hp": 10935,
     "dmg": 390625,
     "exp": 146000,
     "type": "Obstacle"
    },
    "super": {
     "hp": 32805,
     "dmg": 1953125,
     "exp": 7100000,
     "type": "Obstacle"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Obstacle"
    },
    "unique": {
     "hp": 98415,
     "dmg": 9765625,
     "exp": 7100000,
     "type": "Obstacle"
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
   "biome": "",
   "hp": 20,
   "dmg": 0,
   "speed": 35,
   "size": 18,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Passive",
   "desc": "This ant is on fireeeeeeeeeeeeee.",
   "spawn": "A Super Baby Fire Ant has spawned somewhere!",
   "rarities": {
    "common": {
     "hp": 20,
     "dmg": 0,
     "exp": 1,
     "type": "Passive"
    },
    "unusual": {
     "hp": 60,
     "dmg": 0,
     "exp": 2,
     "type": "Passive"
    },
    "rare": {
     "hp": 180,
     "dmg": 0,
     "exp": 9,
     "type": "Passive"
    },
    "epic": {
     "hp": 540,
     "dmg": 0,
     "exp": 67,
     "type": "Passive"
    },
    "legendary": {
     "hp": 1620,
     "dmg": 0,
     "exp": 615,
     "type": "Passive"
    },
    "mythic": {
     "hp": 4860,
     "dmg": 0,
     "exp": 8200,
     "type": "Passive"
    },
    "ultra": {
     "hp": 14580,
     "dmg": 0,
     "exp": 420000,
     "type": "Passive"
    },
    "super": {
     "hp": 43740,
     "dmg": 0,
     "exp": 20000000,
     "type": "Passive"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Passive"
    },
    "unique": {
     "hp": 131220,
     "dmg": 0,
     "exp": 20000000,
     "type": "Passive"
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
   "biome": "",
   "hp": 20,
   "dmg": 0,
   "speed": 45,
   "size": 18,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Neutral",
   "desc": "This ant is on fireeeeeeeeeeeeee.",
   "spawn": "A Super Worker Fire Ant has spawned somewhere!",
   "rarities": {
    "common": {
     "hp": 20,
     "dmg": 0,
     "exp": 1,
     "type": "Neutral"
    },
    "unusual": {
     "hp": 60,
     "dmg": 0,
     "exp": 1,
     "type": "Neutral"
    },
    "rare": {
     "hp": 180,
     "dmg": 0,
     "exp": 4,
     "type": "Neutral"
    },
    "epic": {
     "hp": 540,
     "dmg": 0,
     "exp": 31,
     "type": "Neutral"
    },
    "legendary": {
     "hp": 1620,
     "dmg": 0,
     "exp": 279,
     "type": "Neutral"
    },
    "mythic": {
     "hp": 4860,
     "dmg": 0,
     "exp": 4100,
     "type": "Neutral"
    },
    "ultra": {
     "hp": 14580,
     "dmg": 0,
     "exp": 184000,
     "type": "Neutral"
    },
    "super": {
     "hp": 43740,
     "dmg": 0,
     "exp": 9300000,
     "type": "Neutral"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Neutral"
    },
    "unique": {
     "hp": 131220,
     "dmg": 0,
     "exp": 9300000,
     "type": "Neutral"
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
   "biome": "",
   "hp": 20,
   "dmg": 0,
   "speed": 60,
   "size": 18,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Hostile",
   "desc": "This ant is on fireeeeeeeeeeeeee.",
   "spawn": "A Super Queen Fire Ant has spawned somewhere!",
   "rarities": {
    "common": {
     "hp": 20,
     "dmg": 0,
     "exp": 1,
     "type": "Hostile"
    },
    "unusual": {
     "hp": 60,
     "dmg": 0,
     "exp": 1,
     "type": "Hostile"
    },
    "rare": {
     "hp": 180,
     "dmg": 0,
     "exp": 4,
     "type": "Hostile"
    },
    "epic": {
     "hp": 540,
     "dmg": 0,
     "exp": 31,
     "type": "Hostile"
    },
    "legendary": {
     "hp": 1620,
     "dmg": 0,
     "exp": 287,
     "type": "Hostile"
    },
    "mythic": {
     "hp": 4860,
     "dmg": 0,
     "exp": 4400,
     "type": "Hostile"
    },
    "ultra": {
     "hp": 14580,
     "dmg": 0,
     "exp": 343000,
     "type": "Hostile"
    },
    "super": {
     "hp": 43740,
     "dmg": 0,
     "exp": 16000000,
     "type": "Hostile"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Hostile"
    },
    "unique": {
     "hp": 131220,
     "dmg": 0,
     "exp": 16000000,
     "type": "Hostile"
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
   "biome": "",
   "hp": 3,
   "dmg": 0,
   "speed": 30,
   "size": 16,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Summon",
   "desc": "Not yet an ant but perhaps soon.",
   "spawn": "A Super Ant Egg has spawned somewhere!",
   "rarities": {
    "common": {
     "hp": 3,
     "dmg": 0,
     "exp": 1,
     "type": "Summon"
    },
    "unusual": {
     "hp": 9,
     "dmg": 0,
     "exp": 1,
     "type": "Summon"
    },
    "rare": {
     "hp": 27,
     "dmg": 0,
     "exp": 3,
     "type": "Summon"
    },
    "epic": {
     "hp": 81,
     "dmg": 0,
     "exp": 21,
     "type": "Summon"
    },
    "legendary": {
     "hp": 243,
     "dmg": 0,
     "exp": 190,
     "type": "Summon"
    },
    "mythic": {
     "hp": 729,
     "dmg": 0,
     "exp": 2600,
     "type": "Summon"
    },
    "ultra": {
     "hp": 2187,
     "dmg": 0,
     "exp": 130000,
     "type": "Summon"
    },
    "super": {
     "hp": 6561,
     "dmg": 0,
     "exp": 6500000,
     "type": "Summon"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Summon"
    },
    "unique": {
     "hp": 19683,
     "dmg": 0,
     "exp": 6500000,
     "type": "Summon"
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
   "biome": "",
   "hp": 3,
   "dmg": 0,
   "speed": 30,
   "size": 16,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Summon",
   "desc": "This ant is not yet on fire.",
   "spawn": "A Super Fire Ant Egg has spawned somewhere!",
   "rarities": {
    "common": {
     "hp": 3,
     "dmg": 0,
     "exp": 1,
     "type": "Summon"
    },
    "unusual": {
     "hp": 9,
     "dmg": 0,
     "exp": 1,
     "type": "Summon"
    },
    "rare": {
     "hp": 27,
     "dmg": 0,
     "exp": 3,
     "type": "Summon"
    },
    "epic": {
     "hp": 81,
     "dmg": 0,
     "exp": 21,
     "type": "Summon"
    },
    "legendary": {
     "hp": 243,
     "dmg": 0,
     "exp": 190,
     "type": "Summon"
    },
    "mythic": {
     "hp": 729,
     "dmg": 0,
     "exp": 2600,
     "type": "Summon"
    },
    "ultra": {
     "hp": 2187,
     "dmg": 0,
     "exp": 130000,
     "type": "Summon"
    },
    "super": {
     "hp": 6561,
     "dmg": 0,
     "exp": 6500000,
     "type": "Summon"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Summon"
    },
    "unique": {
     "hp": 19683,
     "dmg": 0,
     "exp": 6500000,
     "type": "Summon"
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
   "biome": "",
   "hp": 10,
   "dmg": 90,
   "speed": 60,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Hostile",
   "desc": "Hzzzzzzzzzzzz.",
   "spawn": "A Super Fly has spawned somewhere!",
   "rarities": {
    "common": {
     "hp": 10,
     "dmg": 90,
     "exp": 1,
     "type": "Hostile"
    },
    "unusual": {
     "hp": 30,
     "dmg": 90,
     "exp": 2,
     "type": "Hostile"
    },
    "rare": {
     "hp": 90,
     "dmg": 90,
     "exp": 7,
     "type": "Hostile"
    },
    "epic": {
     "hp": 270,
     "dmg": 90,
     "exp": 53,
     "type": "Hostile"
    },
    "legendary": {
     "hp": 810,
     "dmg": 90,
     "exp": 486,
     "type": "Hostile"
    },
    "mythic": {
     "hp": 2430,
     "dmg": 90,
     "exp": 6900,
     "type": "Hostile"
    },
    "ultra": {
     "hp": 7290,
     "dmg": 90,
     "exp": 328000,
     "type": "Hostile"
    },
    "super": {
     "hp": 21870,
     "dmg": 90,
     "exp": 16000000,
     "type": "Hostile"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Hostile"
    },
    "unique": {
     "hp": 65610,
     "dmg": 90,
     "exp": 16000000,
     "type": "Hostile"
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
   "biome": "",
   "hp": 30,
   "dmg": 0,
   "speed": 45,
   "size": 19,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Neutral",
   "desc": "It's not a leaf, but it is a bug.",
   "spawn": "A Super Leafbug has spawned somewhere!",
   "rarities": {
    "common": {
     "hp": 30,
     "dmg": 0,
     "exp": 1,
     "type": "Neutral"
    },
    "unusual": {
     "hp": 90,
     "dmg": 0,
     "exp": 2,
     "type": "Neutral"
    },
    "rare": {
     "hp": 270,
     "dmg": 0,
     "exp": 5,
     "type": "Neutral"
    },
    "epic": {
     "hp": 810,
     "dmg": 0,
     "exp": 41,
     "type": "Neutral"
    },
    "legendary": {
     "hp": 2430,
     "dmg": 0,
     "exp": 379,
     "type": "Neutral"
    },
    "mythic": {
     "hp": 7290,
     "dmg": 0,
     "exp": 5200,
     "type": "Neutral"
    },
    "ultra": {
     "hp": 21870,
     "dmg": 0,
     "exp": 260000,
     "type": "Neutral"
    },
    "super": {
     "hp": 65610,
     "dmg": 0,
     "exp": 13000000,
     "type": "Neutral"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Neutral"
    },
    "unique": {
     "hp": 196830,
     "dmg": 0,
     "exp": 13000000,
     "type": "Neutral"
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
   "biome": "",
   "hp": 20,
   "dmg": 2,
   "speed": 60,
   "size": 18,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Hostile",
   "desc": "You better pray you don't become dinner.",
   "spawn": "A Super Mantis has spawned somewhere!",
   "rarities": {
    "common": {
     "hp": 20,
     "dmg": 2,
     "exp": 1,
     "type": "Hostile"
    },
    "unusual": {
     "hp": 60,
     "dmg": 12,
     "exp": 2,
     "type": "Hostile"
    },
    "rare": {
     "hp": 180,
     "dmg": 62,
     "exp": 5,
     "type": "Hostile"
    },
    "epic": {
     "hp": 540,
     "dmg": 312,
     "exp": 41,
     "type": "Hostile"
    },
    "legendary": {
     "hp": 1620,
     "dmg": 1600,
     "exp": 379,
     "type": "Hostile"
    },
    "mythic": {
     "hp": 4860,
     "dmg": 7800,
     "exp": 5200,
     "type": "Hostile"
    },
    "ultra": {
     "hp": 14580,
     "dmg": 1458,
     "exp": 260000,
     "type": "Hostile"
    },
    "super": {
     "hp": 43740,
     "dmg": 4374,
     "exp": 13000000,
     "type": "Hostile"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Hostile"
    },
    "unique": {
     "hp": 131220,
     "dmg": 13122,
     "exp": 13000000,
     "type": "Hostile"
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
   "biome": "",
   "hp": 10,
   "dmg": 0,
   "speed": 35,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Passive",
   "desc": "Weak and defenseless, but big dreams. These creatures appear to be connected somehow.",
   "spawn": "A Super Baby Termite has spawned somewhere!",
   "rarities": {
    "common": {
     "hp": 10,
     "dmg": 0,
     "exp": 1,
     "type": "Passive"
    },
    "unusual": {
     "hp": 30,
     "dmg": 0,
     "exp": 1,
     "type": "Passive"
    },
    "rare": {
     "hp": 90,
     "dmg": 0,
     "exp": 4,
     "type": "Passive"
    },
    "epic": {
     "hp": 270,
     "dmg": 0,
     "exp": 28,
     "type": "Passive"
    },
    "legendary": {
     "hp": 810,
     "dmg": 0,
     "exp": 256,
     "type": "Passive"
    },
    "mythic": {
     "hp": 2430,
     "dmg": 0,
     "exp": 3600,
     "type": "Passive"
    },
    "ultra": {
     "hp": 7290,
     "dmg": 0,
     "exp": 169000,
     "type": "Passive"
    },
    "super": {
     "hp": 21870,
     "dmg": 0,
     "exp": 8400000,
     "type": "Passive"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Passive"
    },
    "unique": {
     "hp": 65610,
     "dmg": 0,
     "exp": 8400000,
     "type": "Passive"
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
   "biome": "",
   "hp": 10,
   "dmg": 0,
   "speed": 45,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Neutral",
   "desc": "It's a bit temperamental, probably from working all the time. These creatures appear to be connected somehow.",
   "spawn": "A Super Worker Termite has spawned somewhere!",
   "rarities": {
    "common": {
     "hp": 10,
     "dmg": 0,
     "exp": 1,
     "type": "Neutral"
    },
    "unusual": {
     "hp": 30,
     "dmg": 0,
     "exp": 1,
     "type": "Neutral"
    },
    "rare": {
     "hp": 90,
     "dmg": 0,
     "exp": 3,
     "type": "Neutral"
    },
    "epic": {
     "hp": 270,
     "dmg": 0,
     "exp": 23,
     "type": "Neutral"
    },
    "legendary": {
     "hp": 810,
     "dmg": 0,
     "exp": 206,
     "type": "Neutral"
    },
    "mythic": {
     "hp": 2430,
     "dmg": 0,
     "exp": 3100,
     "type": "Neutral"
    },
    "ultra": {
     "hp": 7290,
     "dmg": 0,
     "exp": 130000,
     "type": "Neutral"
    },
    "super": {
     "hp": 21870,
     "dmg": 0,
     "exp": 6600000,
     "type": "Neutral"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Neutral"
    },
    "unique": {
     "hp": 65610,
     "dmg": 0,
     "exp": 6600000,
     "type": "Neutral"
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
   "biome": "",
   "hp": 10,
   "dmg": 0,
   "speed": 60,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Hostile",
   "desc": "It's got wings and it's ready to use them. These creatures appear to be connected somehow.",
   "spawn": "A Super Soldier Termite has spawned somewhere!",
   "rarities": {
    "common": {
     "hp": 10,
     "dmg": 0,
     "exp": 1,
     "type": "Hostile"
    },
    "unusual": {
     "hp": 30,
     "dmg": 0,
     "exp": 1,
     "type": "Hostile"
    },
    "rare": {
     "hp": 90,
     "dmg": 0,
     "exp": 4,
     "type": "Hostile"
    },
    "epic": {
     "hp": 270,
     "dmg": 0,
     "exp": 28,
     "type": "Hostile"
    },
    "legendary": {
     "hp": 810,
     "dmg": 0,
     "exp": 256,
     "type": "Hostile"
    },
    "mythic": {
     "hp": 2430,
     "dmg": 0,
     "exp": 3600,
     "type": "Hostile"
    },
    "ultra": {
     "hp": 7290,
     "dmg": 0,
     "exp": 169000,
     "type": "Hostile"
    },
    "super": {
     "hp": 21870,
     "dmg": 0,
     "exp": 8400000,
     "type": "Hostile"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Hostile"
    },
    "unique": {
     "hp": 65610,
     "dmg": 0,
     "exp": 8400000,
     "type": "Hostile"
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
   "biome": "",
   "hp": 10,
   "dmg": 0,
   "speed": 45,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Neutral",
   "desc": "The one who oversees all.",
   "spawn": "A Super Termite Overmind has spawned somewhere!",
   "rarities": {
    "common": {
     "hp": 10,
     "dmg": 0,
     "exp": 1,
     "type": "Neutral"
    },
    "unusual": {
     "hp": 30,
     "dmg": 0,
     "exp": 2,
     "type": "Neutral"
    },
    "rare": {
     "hp": 90,
     "dmg": 0,
     "exp": 10,
     "type": "Neutral"
    },
    "epic": {
     "hp": 270,
     "dmg": 0,
     "exp": 78,
     "type": "Neutral"
    },
    "legendary": {
     "hp": 810,
     "dmg": 0,
     "exp": 742,
     "type": "Neutral"
    },
    "mythic": {
     "hp": 2430,
     "dmg": 0,
     "exp": 8500,
     "type": "Neutral"
    },
    "ultra": {
     "hp": 7290,
     "dmg": 0,
     "exp": 704000,
     "type": "Neutral"
    },
    "super": {
     "hp": 21870,
     "dmg": 0,
     "exp": 28000000,
     "type": "Neutral"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Neutral"
    },
    "unique": {
     "hp": 65610,
     "dmg": 0,
     "exp": 28000000,
     "type": "Neutral"
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
   "biome": "",
   "hp": 0,
   "dmg": 0,
   "speed": 45,
   "size": 16,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Technical",
   "desc": "Termites go in, and come out. Can't explain that.",
   "spawn": "A Super Termite Mound has spawned somewhere!",
   "rarities": {
    "common": {
     "hp": 0,
     "dmg": 0,
     "exp": 1,
     "type": "Technical"
    },
    "unusual": {
     "hp": 0,
     "dmg": 0,
     "exp": 2,
     "type": "Technical"
    },
    "rare": {
     "hp": 0,
     "dmg": 0,
     "exp": 7,
     "type": "Technical"
    },
    "epic": {
     "hp": 0,
     "dmg": 0,
     "exp": 54,
     "type": "Technical"
    },
    "legendary": {
     "hp": 0,
     "dmg": 0,
     "exp": 495,
     "type": "Technical"
    },
    "mythic": {
     "hp": 0,
     "dmg": 0,
     "exp": 7000,
     "type": "Technical"
    },
    "ultra": {
     "hp": 0,
     "dmg": 0,
     "exp": 335000,
     "type": "Technical"
    },
    "super": {
     "hp": 0,
     "dmg": 0,
     "exp": 17000000,
     "type": "Technical"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Technical"
    },
    "unique": {
     "hp": 0,
     "dmg": 0,
     "exp": 17000000,
     "type": "Technical"
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
   "biome": "",
   "hp": 3,
   "dmg": 0,
   "speed": 30,
   "size": 16,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Summon",
   "desc": "Not yet a termite but perhaps soon.",
   "spawn": "A Super Termite Egg has spawned somewhere!",
   "rarities": {
    "common": {
     "hp": 3,
     "dmg": 0,
     "exp": 1,
     "type": "Summon"
    },
    "unusual": {
     "hp": 9,
     "dmg": 0,
     "exp": 1,
     "type": "Summon"
    },
    "rare": {
     "hp": 27,
     "dmg": 0,
     "exp": 4,
     "type": "Summon"
    },
    "epic": {
     "hp": 81,
     "dmg": 0,
     "exp": 28,
     "type": "Summon"
    },
    "legendary": {
     "hp": 243,
     "dmg": 0,
     "exp": 256,
     "type": "Summon"
    },
    "mythic": {
     "hp": 729,
     "dmg": 0,
     "exp": 3600,
     "type": "Summon"
    },
    "ultra": {
     "hp": 2187,
     "dmg": 0,
     "exp": 169000,
     "type": "Summon"
    },
    "super": {
     "hp": 6561,
     "dmg": 0,
     "exp": 8400000,
     "type": "Summon"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Summon"
    },
    "unique": {
     "hp": 19683,
     "dmg": 0,
     "exp": 8400000,
     "type": "Summon"
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
   "biome": "",
   "hp": 10,
   "dmg": 0,
   "speed": 0,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Obstacle",
   "desc": "Don't misunderestimate me.",
   "spawn": "A Super Bush has spawned somewhere!",
   "rarities": {
    "common": {
     "hp": 10,
     "dmg": 0,
     "exp": 1,
     "type": "Obstacle"
    },
    "unusual": {
     "hp": 30,
     "dmg": 0,
     "exp": 1,
     "type": "Obstacle"
    },
    "rare": {
     "hp": 90,
     "dmg": 0,
     "exp": 4,
     "type": "Obstacle"
    },
    "epic": {
     "hp": 270,
     "dmg": 0,
     "exp": 31,
     "type": "Obstacle"
    },
    "legendary": {
     "hp": 810,
     "dmg": 0,
     "exp": 387,
     "type": "Obstacle"
    },
    "mythic": {
     "hp": 2430,
     "dmg": 0,
     "exp": 6100,
     "type": "Obstacle"
    },
    "ultra": {
     "hp": 7290,
     "dmg": 0,
     "exp": 329000,
     "type": "Obstacle"
    },
    "super": {
     "hp": 21870,
     "dmg": 0,
     "exp": 15000000,
     "type": "Obstacle"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Obstacle"
    },
    "unique": {
     "hp": 65610,
     "dmg": 0,
     "exp": 15000000,
     "type": "Obstacle"
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
   "biome": "",
   "hp": 20,
   "dmg": 0,
   "speed": 45,
   "size": 18,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Neutral",
   "desc": "Gotta go FAST… until they get tired.",
   "spawn": "A Super Roach has spawned somewhere!",
   "rarities": {
    "common": {
     "hp": 20,
     "dmg": 0,
     "exp": 1,
     "type": "Neutral"
    },
    "unusual": {
     "hp": 60,
     "dmg": 0,
     "exp": 1,
     "type": "Neutral"
    },
    "rare": {
     "hp": 180,
     "dmg": 0,
     "exp": 3,
     "type": "Neutral"
    },
    "epic": {
     "hp": 540,
     "dmg": 0,
     "exp": 28,
     "type": "Neutral"
    },
    "legendary": {
     "hp": 1620,
     "dmg": 0,
     "exp": 256,
     "type": "Neutral"
    },
    "mythic": {
     "hp": 4860,
     "dmg": 0,
     "exp": 3600,
     "type": "Neutral"
    },
    "ultra": {
     "hp": 14580,
     "dmg": 0,
     "exp": 169000,
     "type": "Neutral"
    },
    "super": {
     "hp": 43740,
     "dmg": 0,
     "exp": 8400000,
     "type": "Neutral"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Neutral"
    },
    "unique": {
     "hp": 131220,
     "dmg": 0,
     "exp": 8400000,
     "type": "Neutral"
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
   "biome": "",
   "hp": 10,
   "dmg": 0,
   "speed": 45,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Neutral",
   "desc": "Easily scared, be nice.",
   "spawn": "A Super Moth has spawned somewhere!",
   "rarities": {
    "common": {
     "hp": 10,
     "dmg": 0,
     "exp": 1,
     "type": "Neutral"
    },
    "unusual": {
     "hp": 30,
     "dmg": 0,
     "exp": 2,
     "type": "Neutral"
    },
    "rare": {
     "hp": 90,
     "dmg": 0,
     "exp": 5,
     "type": "Neutral"
    },
    "epic": {
     "hp": 270,
     "dmg": 0,
     "exp": 41,
     "type": "Neutral"
    },
    "legendary": {
     "hp": 810,
     "dmg": 0,
     "exp": 379,
     "type": "Neutral"
    },
    "mythic": {
     "hp": 2430,
     "dmg": 0,
     "exp": 5200,
     "type": "Neutral"
    },
    "ultra": {
     "hp": 7290,
     "dmg": 0,
     "exp": 260000,
     "type": "Neutral"
    },
    "super": {
     "hp": 21870,
     "dmg": 0,
     "exp": 13000000,
     "type": "Neutral"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Neutral"
    },
    "unique": {
     "hp": 65610,
     "dmg": 0,
     "exp": 13000000,
     "type": "Neutral"
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
   "biome": "",
   "hp": 5,
   "dmg": 13,
   "speed": 45,
   "size": 16,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Neutral",
   "desc": "Oooooh shiny.",
   "spawn": "There's a bright light in the horizon...",
   "rarities": {
    "common": {
     "hp": 5,
     "dmg": 13,
     "exp": 1,
     "type": "Neutral"
    },
    "unusual": {
     "hp": 15,
     "dmg": 39,
     "exp": 2,
     "type": "Neutral"
    },
    "rare": {
     "hp": 45,
     "dmg": 117,
     "exp": 7,
     "type": "Neutral"
    },
    "epic": {
     "hp": 135,
     "dmg": 351,
     "exp": 49,
     "type": "Neutral"
    },
    "legendary": {
     "hp": 405,
     "dmg": 1053,
     "exp": 445,
     "type": "Neutral"
    },
    "mythic": {
     "hp": 1215,
     "dmg": 3159,
     "exp": 6200,
     "type": "Neutral"
    },
    "ultra": {
     "hp": 3645,
     "dmg": 9477,
     "exp": 299000,
     "type": "Neutral"
    },
    "super": {
     "hp": 10935,
     "dmg": 28431,
     "exp": 15000000,
     "type": "Neutral"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Neutral"
    },
    "unique": {
     "hp": 32805,
     "dmg": 85293,
     "exp": 15000000,
     "type": "Neutral"
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
   "biome": "",
   "hp": 30,
   "dmg": 0,
   "speed": 60,
   "size": 19,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Hostile",
   "desc": "Scourge that spawns in the other plane.",
   "spawn": "You sense ominous vibrations coming from a different realm...",
   "rarities": {
    "common": {
     "hp": 30,
     "dmg": 0,
     "exp": 1,
     "type": "Hostile"
    },
    "unusual": {
     "hp": 90,
     "dmg": 0,
     "exp": 1,
     "type": "Hostile"
    },
    "rare": {
     "hp": 270,
     "dmg": 0,
     "exp": 3,
     "type": "Hostile"
    },
    "epic": {
     "hp": 810,
     "dmg": 0,
     "exp": 18,
     "type": "Hostile"
    },
    "legendary": {
     "hp": 2430,
     "dmg": 0,
     "exp": 165,
     "type": "Hostile"
    },
    "mythic": {
     "hp": 7290,
     "dmg": 0,
     "exp": 2500,
     "type": "Hostile"
    },
    "ultra": {
     "hp": 21870,
     "dmg": 0,
     "exp": 95200,
     "type": "Hostile"
    },
    "super": {
     "hp": 65610,
     "dmg": 0,
     "exp": 4800000,
     "type": "Hostile"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Hostile"
    },
    "unique": {
     "hp": 196830,
     "dmg": 0,
     "exp": 4800000,
     "type": "Hostile"
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
   "biome": "",
   "hp": 50,
   "dmg": 5,
   "speed": 60,
   "size": 22,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Hostile",
   "desc": "They are ANGRY.",
   "spawn": "A Super Wasp has spawned somewhere!",
   "rarities": {
    "common": {
     "hp": 50,
     "dmg": 5,
     "exp": 1,
     "type": "Hostile"
    },
    "unusual": {
     "hp": 150,
     "dmg": 25,
     "exp": 2,
     "type": "Hostile"
    },
    "rare": {
     "hp": 450,
     "dmg": 125,
     "exp": 8,
     "type": "Hostile"
    },
    "epic": {
     "hp": 1350,
     "dmg": 625,
     "exp": 69,
     "type": "Hostile"
    },
    "legendary": {
     "hp": 4050,
     "dmg": 3125,
     "exp": 647,
     "type": "Hostile"
    },
    "mythic": {
     "hp": 12150,
     "dmg": 15625,
     "exp": 8200,
     "type": "Hostile"
    },
    "ultra": {
     "hp": 36450,
     "dmg": 78125,
     "exp": 431000,
     "type": "Hostile"
    },
    "super": {
     "hp": 109350,
     "dmg": 390625,
     "exp": 19000000,
     "type": "Hostile"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Hostile"
    },
    "unique": {
     "hp": 328050,
     "dmg": 1953125,
     "exp": 19000000,
     "type": "Hostile"
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
   "biome": "",
   "hp": 10,
   "dmg": 0,
   "speed": 45,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "NPC",
   "desc": "How do you have this in your gallery?",
   "spawn": "",
   "rarities": {
    "common": {
     "hp": 10,
     "dmg": 0,
     "exp": 1,
     "type": "NPC"
    },
    "unusual": {
     "hp": 30,
     "dmg": 0,
     "exp": 1,
     "type": "NPC"
    },
    "rare": {
     "hp": 90,
     "dmg": 0,
     "exp": 1,
     "type": "NPC"
    },
    "epic": {
     "hp": 270,
     "dmg": 0,
     "exp": 1,
     "type": "NPC"
    },
    "legendary": {
     "hp": 810,
     "dmg": 0,
     "exp": 1,
     "type": "NPC"
    },
    "mythic": {
     "hp": 2400,
     "dmg": 0,
     "exp": 1,
     "type": "NPC"
    },
    "ultra": {
     "hp": 7300,
     "dmg": 0,
     "exp": 1,
     "type": "NPC"
    },
    "super": {
     "hp": 21900,
     "dmg": 0,
     "exp": 1,
     "type": "NPC"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "NPC"
    },
    "unique": {
     "hp": 65600,
     "dmg": 0,
     "exp": 1,
     "type": "NPC"
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
   "biome": "",
   "hp": 15,
   "dmg": 80,
   "speed": 60,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Hostile",
   "desc": "Scourge that spawns in the other plane.",
   "spawn": "You sense ominous vibrations coming from a different realm...",
   "rarities": {
    "common": {
     "hp": 15,
     "dmg": 80,
     "exp": 1,
     "type": "Hostile"
    },
    "unusual": {
     "hp": 45,
     "dmg": 240,
     "exp": 1,
     "type": "Hostile"
    },
    "rare": {
     "hp": 135,
     "dmg": 720,
     "exp": 2,
     "type": "Hostile"
    },
    "epic": {
     "hp": 405,
     "dmg": 2160,
     "exp": 14,
     "type": "Hostile"
    },
    "legendary": {
     "hp": 1215,
     "dmg": 6480,
     "exp": 130,
     "type": "Hostile"
    },
    "mythic": {
     "hp": 3645,
     "dmg": 19440,
     "exp": 2000,
     "type": "Hostile"
    },
    "ultra": {
     "hp": 10935,
     "dmg": 58320,
     "exp": 85700,
     "type": "Hostile"
    },
    "super": {
     "hp": 32805,
     "dmg": 174960,
     "exp": 4500000,
     "type": "Hostile"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Hostile"
    },
    "unique": {
     "hp": 98415,
     "dmg": 524880,
     "exp": 4500000,
     "type": "Hostile"
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
   "biome": "",
   "hp": 30,
   "dmg": 0,
   "speed": 60,
   "size": 19,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Hostile",
   "desc": "Scourge that spawns in the other plane.",
   "spawn": "You sense ominous vibrations coming from a different realm...",
   "rarities": {
    "common": {
     "hp": 30,
     "dmg": 0,
     "exp": 1,
     "type": "Hostile"
    },
    "unusual": {
     "hp": 90,
     "dmg": 0,
     "exp": 1,
     "type": "Hostile"
    },
    "rare": {
     "hp": 270,
     "dmg": 0,
     "exp": 1,
     "type": "Hostile"
    },
    "epic": {
     "hp": 810,
     "dmg": 0,
     "exp": 3,
     "type": "Hostile"
    },
    "legendary": {
     "hp": 2430,
     "dmg": 0,
     "exp": 26,
     "type": "Hostile"
    },
    "mythic": {
     "hp": 7290,
     "dmg": 0,
     "exp": 386,
     "type": "Hostile"
    },
    "ultra": {
     "hp": 21870,
     "dmg": 0,
     "exp": 12500,
     "type": "Hostile"
    },
    "super": {
     "hp": 65610,
     "dmg": 0,
     "exp": 613000,
     "type": "Hostile"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Hostile"
    },
    "unique": {
     "hp": 196830,
     "dmg": 0,
     "exp": 613000,
     "type": "Hostile"
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
   "biome": "",
   "hp": 30,
   "dmg": 0,
   "speed": 60,
   "size": 19,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Hostile",
   "desc": "Scourge that spawns in the other plane.",
   "spawn": "",
   "rarities": {
    "common": {
     "hp": 30,
     "dmg": 0,
     "exp": 1,
     "type": "Hostile"
    },
    "unusual": {
     "hp": 90,
     "dmg": 0,
     "exp": 1,
     "type": "Hostile"
    },
    "rare": {
     "hp": 270,
     "dmg": 0,
     "exp": 1,
     "type": "Hostile"
    },
    "epic": {
     "hp": 810,
     "dmg": 0,
     "exp": 3,
     "type": "Hostile"
    },
    "legendary": {
     "hp": 2430,
     "dmg": 0,
     "exp": 26,
     "type": "Hostile"
    },
    "mythic": {
     "hp": 7290,
     "dmg": 0,
     "exp": 386,
     "type": "Hostile"
    },
    "ultra": {
     "hp": 21870,
     "dmg": 0,
     "exp": 12500,
     "type": "Hostile"
    },
    "super": {
     "hp": 65610,
     "dmg": 0,
     "exp": 613000,
     "type": "Hostile"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Hostile"
    },
    "unique": {
     "hp": 196830,
     "dmg": 0,
     "exp": 613000,
     "type": "Hostile"
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
   "biome": "",
   "hp": 50,
   "dmg": 2,
   "speed": 60,
   "size": 22,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Hostile",
   "desc": "Scourge that spawns in the other plane.",
   "spawn": "You sense ominous vibrations coming from a different realm...",
   "rarities": {
    "common": {
     "hp": 50,
     "dmg": 2,
     "exp": 1,
     "type": "Hostile"
    },
    "unusual": {
     "hp": 150,
     "dmg": 12,
     "exp": 2,
     "type": "Hostile"
    },
    "rare": {
     "hp": 450,
     "dmg": 62,
     "exp": 7,
     "type": "Hostile"
    },
    "epic": {
     "hp": 1350,
     "dmg": 312,
     "exp": 54,
     "type": "Hostile"
    },
    "legendary": {
     "hp": 4050,
     "dmg": 1600,
     "exp": 503,
     "type": "Hostile"
    },
    "mythic": {
     "hp": 12150,
     "dmg": 1215,
     "exp": 6200,
     "type": "Hostile"
    },
    "ultra": {
     "hp": 36450,
     "dmg": 3645,
     "exp": 329000,
     "type": "Hostile"
    },
    "super": {
     "hp": 109350,
     "dmg": 10935,
     "exp": 14000000,
     "type": "Hostile"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Hostile"
    },
    "unique": {
     "hp": 328050,
     "dmg": 32805,
     "exp": 14000000,
     "type": "Hostile"
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
   "biome": "",
   "hp": 0,
   "dmg": 0,
   "speed": 45,
   "size": 16,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "NPC",
   "desc": "",
   "spawn": "",
   "rarities": {
    "common": {
     "hp": 0,
     "dmg": 0,
     "exp": 1,
     "type": "NPC"
    },
    "unusual": {
     "hp": 0,
     "dmg": 0,
     "exp": 1,
     "type": "NPC"
    },
    "rare": {
     "hp": 0,
     "dmg": 0,
     "exp": 1,
     "type": "NPC"
    },
    "epic": {
     "hp": 0,
     "dmg": 0,
     "exp": 1,
     "type": "NPC"
    },
    "legendary": {
     "hp": 0,
     "dmg": 0,
     "exp": 1,
     "type": "NPC"
    },
    "mythic": {
     "hp": 0,
     "dmg": 0,
     "exp": 1,
     "type": "NPC"
    },
    "ultra": {
     "hp": 0,
     "dmg": 0,
     "exp": 1,
     "type": "NPC"
    },
    "super": {
     "hp": 0,
     "dmg": 0,
     "exp": 1,
     "type": "NPC"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "NPC"
    },
    "unique": {
     "hp": 0,
     "dmg": 0,
     "exp": 1,
     "type": "NPC"
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
   "biome": "",
   "hp": 15,
   "dmg": 0,
   "speed": 45,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "NPC",
   "desc": "This can happen to YOU.",
   "spawn": "You hear someone whisper faintly... \"just... one more game...\"",
   "rarities": {
    "common": {
     "hp": 15,
     "dmg": 0,
     "exp": 1,
     "type": "NPC"
    },
    "unusual": {
     "hp": 45,
     "dmg": 0,
     "exp": 2,
     "type": "NPC"
    },
    "rare": {
     "hp": 135,
     "dmg": 0,
     "exp": 10,
     "type": "NPC"
    },
    "epic": {
     "hp": 405,
     "dmg": 0,
     "exp": 82,
     "type": "NPC"
    },
    "legendary": {
     "hp": 1215,
     "dmg": 0,
     "exp": 757,
     "type": "NPC"
    },
    "mythic": {
     "hp": 3645,
     "dmg": 0,
     "exp": 10500,
     "type": "NPC"
    },
    "ultra": {
     "hp": 10935,
     "dmg": 0,
     "exp": 725000,
     "type": "NPC"
    },
    "super": {
     "hp": 32805,
     "dmg": 0,
     "exp": 36000000,
     "type": "NPC"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "NPC"
    },
    "unique": {
     "hp": 98415,
     "dmg": 0,
     "exp": 36000000,
     "type": "NPC"
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
   "biome": "",
   "hp": 0,
   "dmg": 0,
   "speed": 45,
   "size": 16,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "NPC",
   "desc": "",
   "spawn": "",
   "rarities": {
    "common": {
     "hp": 0,
     "dmg": 0,
     "exp": 1,
     "type": "NPC"
    },
    "unusual": {
     "hp": 0,
     "dmg": 0,
     "exp": 1,
     "type": "NPC"
    },
    "rare": {
     "hp": 0,
     "dmg": 0,
     "exp": 1,
     "type": "NPC"
    },
    "epic": {
     "hp": 0,
     "dmg": 0,
     "exp": 1,
     "type": "NPC"
    },
    "legendary": {
     "hp": 0,
     "dmg": 0,
     "exp": 1,
     "type": "NPC"
    },
    "mythic": {
     "hp": 0,
     "dmg": 0,
     "exp": 1,
     "type": "NPC"
    },
    "ultra": {
     "hp": 0,
     "dmg": 0,
     "exp": 1,
     "type": "NPC"
    },
    "super": {
     "hp": 0,
     "dmg": 0,
     "exp": 1,
     "type": "NPC"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "NPC"
    },
    "unique": {
     "hp": 0,
     "dmg": 0,
     "exp": 1,
     "type": "NPC"
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
   "biome": "",
   "hp": 5,
   "dmg": 13,
   "speed": 45,
   "size": 16,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Neutral",
   "desc": "There's something magical about this one.",
   "spawn": "A Super Firefly has spawned somewhere!",
   "rarities": {
    "common": {
     "hp": 5,
     "dmg": 13,
     "exp": 1,
     "type": "Neutral"
    },
    "unusual": {
     "hp": 15,
     "dmg": 39,
     "exp": 2,
     "type": "Neutral"
    },
    "rare": {
     "hp": 45,
     "dmg": 117,
     "exp": 9,
     "type": "Neutral"
    },
    "epic": {
     "hp": 135,
     "dmg": 351,
     "exp": 69,
     "type": "Neutral"
    },
    "legendary": {
     "hp": 405,
     "dmg": 1053,
     "exp": 658,
     "type": "Neutral"
    },
    "mythic": {
     "hp": 1215,
     "dmg": 3159,
     "exp": 7700,
     "type": "Neutral"
    },
    "ultra": {
     "hp": 3645,
     "dmg": 9477,
     "exp": 442000,
     "type": "Neutral"
    },
    "super": {
     "hp": 10935,
     "dmg": 28431,
     "exp": 17000000,
     "type": "Neutral"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Neutral"
    },
    "unique": {
     "hp": 32805,
     "dmg": 85293,
     "exp": 17000000,
     "type": "Neutral"
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
   "biome": "",
   "hp": 20,
   "dmg": 0,
   "speed": 45,
   "size": 18,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "NPC",
   "desc": "",
   "spawn": "",
   "rarities": {
    "common": {
     "hp": 20,
     "dmg": 0,
     "exp": 1,
     "type": "NPC"
    },
    "unusual": {
     "hp": 60,
     "dmg": 0,
     "exp": 1,
     "type": "NPC"
    },
    "rare": {
     "hp": 180,
     "dmg": 0,
     "exp": 1,
     "type": "NPC"
    },
    "epic": {
     "hp": 540,
     "dmg": 0,
     "exp": 1,
     "type": "NPC"
    },
    "legendary": {
     "hp": 1620,
     "dmg": 0,
     "exp": 1,
     "type": "NPC"
    },
    "mythic": {
     "hp": 4860,
     "dmg": 0,
     "exp": 1,
     "type": "NPC"
    },
    "ultra": {
     "hp": 14580,
     "dmg": 0,
     "exp": 1,
     "type": "NPC"
    },
    "super": {
     "hp": 43740,
     "dmg": 0,
     "exp": 1,
     "type": "NPC"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "NPC"
    },
    "unique": {
     "hp": 131220,
     "dmg": 0,
     "exp": 1,
     "type": "NPC"
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
   "biome": "",
   "hp": 30,
   "dmg": 0,
   "speed": 45,
   "size": 19,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Neutral",
   "desc": "This one has a different pattern... what does that mean?",
   "spawn": "A Super Beetle has spawned somewhere!",
   "rarities": {
    "common": {
     "hp": 30,
     "dmg": 0,
     "exp": 1,
     "type": "Neutral"
    },
    "unusual": {
     "hp": 90,
     "dmg": 0,
     "exp": 2,
     "type": "Neutral"
    },
    "rare": {
     "hp": 270,
     "dmg": 0,
     "exp": 7,
     "type": "Neutral"
    },
    "epic": {
     "hp": 810,
     "dmg": 0,
     "exp": 54,
     "type": "Neutral"
    },
    "legendary": {
     "hp": 2430,
     "dmg": 0,
     "exp": 522,
     "type": "Neutral"
    },
    "mythic": {
     "hp": 7290,
     "dmg": 0,
     "exp": 6000,
     "type": "Neutral"
    },
    "ultra": {
     "hp": 21870,
     "dmg": 0,
     "exp": 336000,
     "type": "Neutral"
    },
    "super": {
     "hp": 65610,
     "dmg": 0,
     "exp": 12000000,
     "type": "Neutral"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Neutral"
    },
    "unique": {
     "hp": 196830,
     "dmg": 0,
     "exp": 12000000,
     "type": "Neutral"
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
   "biome": "",
   "hp": 30,
   "dmg": 0,
   "speed": 60,
   "size": 19,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Hostile",
   "desc": "It's supposed to eat dirt but this one's eating flowers.",
   "spawn": "A Super Worm has spawned somewhere!",
   "rarities": {
    "common": {
     "hp": 30,
     "dmg": 0,
     "exp": 1,
     "type": "Hostile"
    },
    "unusual": {
     "hp": 90,
     "dmg": 0,
     "exp": 1,
     "type": "Hostile"
    },
    "rare": {
     "hp": 270,
     "dmg": 0,
     "exp": 4,
     "type": "Hostile"
    },
    "epic": {
     "hp": 810,
     "dmg": 0,
     "exp": 27,
     "type": "Hostile"
    },
    "legendary": {
     "hp": 2430,
     "dmg": 0,
     "exp": 247,
     "type": "Hostile"
    },
    "mythic": {
     "hp": 7290,
     "dmg": 0,
     "exp": 3700,
     "type": "Hostile"
    },
    "ultra": {
     "hp": 21870,
     "dmg": 0,
     "exp": 160000,
     "type": "Hostile"
    },
    "super": {
     "hp": 65610,
     "dmg": 0,
     "exp": 8100000,
     "type": "Hostile"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Hostile"
    },
    "unique": {
     "hp": 196830,
     "dmg": 0,
     "exp": 8100000,
     "type": "Hostile"
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
   "biome": "",
   "hp": 5,
   "dmg": 0,
   "speed": 0,
   "size": 16,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Obstacle",
   "desc": "You're not supposed to see this text. I'm calling the police.",
   "spawn": "",
   "rarities": {
    "common": {
     "hp": 5,
     "dmg": 0,
     "exp": 1,
     "type": "Obstacle"
    },
    "unusual": {
     "hp": 15,
     "dmg": 0,
     "exp": 1,
     "type": "Obstacle"
    },
    "rare": {
     "hp": 45,
     "dmg": 0,
     "exp": 1,
     "type": "Obstacle"
    },
    "epic": {
     "hp": 135,
     "dmg": 0,
     "exp": 1,
     "type": "Obstacle"
    },
    "legendary": {
     "hp": 405,
     "dmg": 0,
     "exp": 1,
     "type": "Obstacle"
    },
    "mythic": {
     "hp": 1215,
     "dmg": 0,
     "exp": 1,
     "type": "Obstacle"
    },
    "ultra": {
     "hp": 3645,
     "dmg": 0,
     "exp": 1,
     "type": "Obstacle"
    },
    "super": {
     "hp": 10935,
     "dmg": 0,
     "exp": 1,
     "type": "Obstacle"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Obstacle"
    },
    "unique": {
     "hp": 32805,
     "dmg": 0,
     "exp": 1,
     "type": "Obstacle"
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
   "biome": "",
   "hp": 10,
   "dmg": 0,
   "speed": 60,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Hostile",
   "desc": "Someone has been making these mechanical flowers... What could this mean?",
   "spawn": "A Super Mecha Flower has spawned somewhere!",
   "rarities": {
    "common": {
     "hp": 10,
     "dmg": 0,
     "exp": 1,
     "type": "Hostile"
    },
    "unusual": {
     "hp": 30,
     "dmg": 0,
     "exp": 2,
     "type": "Hostile"
    },
    "rare": {
     "hp": 90,
     "dmg": 0,
     "exp": 7,
     "type": "Hostile"
    },
    "epic": {
     "hp": 270,
     "dmg": 0,
     "exp": 54,
     "type": "Hostile"
    },
    "legendary": {
     "hp": 810,
     "dmg": 0,
     "exp": 522,
     "type": "Hostile"
    },
    "mythic": {
     "hp": 2430,
     "dmg": 0,
     "exp": 6000,
     "type": "Hostile"
    },
    "ultra": {
     "hp": 7290,
     "dmg": 0,
     "exp": 341000,
     "type": "Hostile"
    },
    "super": {
     "hp": 21870,
     "dmg": 0,
     "exp": 12000000,
     "type": "Hostile"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Hostile"
    },
    "unique": {
     "hp": 65610,
     "dmg": 0,
     "exp": 12000000,
     "type": "Hostile"
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
   "biome": "",
   "hp": 50,
   "dmg": 5,
   "speed": 60,
   "size": 22,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Hostile",
   "desc": "They're MECHA ANGRY.",
   "spawn": "A Super Wasp has spawned somewhere!",
   "rarities": {
    "common": {
     "hp": 50,
     "dmg": 5,
     "exp": 1,
     "type": "Hostile"
    },
    "unusual": {
     "hp": 150,
     "dmg": 25,
     "exp": 1,
     "type": "Hostile"
    },
    "rare": {
     "hp": 450,
     "dmg": 125,
     "exp": 4,
     "type": "Hostile"
    },
    "epic": {
     "hp": 1350,
     "dmg": 625,
     "exp": 36,
     "type": "Hostile"
    },
    "legendary": {
     "hp": 4050,
     "dmg": 3125,
     "exp": 335,
     "type": "Hostile"
    },
    "mythic": {
     "hp": 12150,
     "dmg": 15625,
     "exp": 6700,
     "type": "Hostile"
    },
    "ultra": {
     "hp": 36450,
     "dmg": 78125,
     "exp": 475000,
     "type": "Hostile"
    },
    "super": {
     "hp": 109350,
     "dmg": 390625,
     "exp": 20000000,
     "type": "Hostile"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Hostile"
    },
    "unique": {
     "hp": 328050,
     "dmg": 1953125,
     "exp": 20000000,
     "type": "Hostile"
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
   "biome": "",
   "hp": 30,
   "dmg": 0,
   "speed": 60,
   "size": 19,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Hostile",
   "desc": "Mecha Spooky.",
   "spawn": "A Super Spider has spawned somewhere!",
   "rarities": {
    "common": {
     "hp": 30,
     "dmg": 0,
     "exp": 1,
     "type": "Hostile"
    },
    "unusual": {
     "hp": 90,
     "dmg": 0,
     "exp": 1,
     "type": "Hostile"
    },
    "rare": {
     "hp": 270,
     "dmg": 0,
     "exp": 5,
     "type": "Hostile"
    },
    "epic": {
     "hp": 810,
     "dmg": 0,
     "exp": 40,
     "type": "Hostile"
    },
    "legendary": {
     "hp": 2430,
     "dmg": 0,
     "exp": 363,
     "type": "Hostile"
    },
    "mythic": {
     "hp": 7290,
     "dmg": 0,
     "exp": 5300,
     "type": "Hostile"
    },
    "ultra": {
     "hp": 21870,
     "dmg": 0,
     "exp": 236000,
     "type": "Hostile"
    },
    "super": {
     "hp": 65610,
     "dmg": 0,
     "exp": 12000000,
     "type": "Hostile"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Hostile"
    },
    "unique": {
     "hp": 196830,
     "dmg": 0,
     "exp": 12000000,
     "type": "Hostile"
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
   "biome": "",
   "hp": 30,
   "dmg": 0,
   "speed": 45,
   "size": 19,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Neutral",
   "desc": "This one has a special color to it...",
   "spawn": "A Super Leafbug has spawned somewhere!",
   "rarities": {
    "common": {
     "hp": 30,
     "dmg": 0,
     "exp": 1,
     "type": "Neutral"
    },
    "unusual": {
     "hp": 90,
     "dmg": 0,
     "exp": 1,
     "type": "Neutral"
    },
    "rare": {
     "hp": 270,
     "dmg": 0,
     "exp": 6,
     "type": "Neutral"
    },
    "epic": {
     "hp": 810,
     "dmg": 0,
     "exp": 47,
     "type": "Neutral"
    },
    "legendary": {
     "hp": 2430,
     "dmg": 0,
     "exp": 455,
     "type": "Neutral"
    },
    "mythic": {
     "hp": 7290,
     "dmg": 0,
     "exp": 5000,
     "type": "Neutral"
    },
    "ultra": {
     "hp": 21870,
     "dmg": 0,
     "exp": 354000,
     "type": "Neutral"
    },
    "super": {
     "hp": 65610,
     "dmg": 0,
     "exp": 16000000,
     "type": "Neutral"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Neutral"
    },
    "unique": {
     "hp": 196830,
     "dmg": 0,
     "exp": 16000000,
     "type": "Neutral"
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
   "biome": "",
   "hp": 15,
   "dmg": 5,
   "speed": 60,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Hostile",
   "desc": "Dr. Crab.",
   "spawn": "A Super Crab has spawned somewhere!",
   "rarities": {
    "common": {
     "hp": 15,
     "dmg": 5,
     "exp": 1,
     "type": "Hostile"
    },
    "unusual": {
     "hp": 45,
     "dmg": 15,
     "exp": 2,
     "type": "Hostile"
    },
    "rare": {
     "hp": 135,
     "dmg": 45,
     "exp": 9,
     "type": "Hostile"
    },
    "epic": {
     "hp": 405,
     "dmg": 135,
     "exp": 74,
     "type": "Hostile"
    },
    "legendary": {
     "hp": 1215,
     "dmg": 405,
     "exp": 692,
     "type": "Hostile"
    },
    "mythic": {
     "hp": 3645,
     "dmg": 1215,
     "exp": 8500,
     "type": "Hostile"
    },
    "ultra": {
     "hp": 10935,
     "dmg": 3645,
     "exp": 466000,
     "type": "Hostile"
    },
    "super": {
     "hp": 32805,
     "dmg": 10935,
     "exp": 20000000,
     "type": "Hostile"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Hostile"
    },
    "unique": {
     "hp": 98415,
     "dmg": 32805,
     "exp": 20000000,
     "type": "Hostile"
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
   "biome": "",
   "hp": 0,
   "dmg": 0,
   "speed": 45,
   "size": 16,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "NPC",
   "desc": "",
   "spawn": "A Super Assembler has spawned somewhere!",
   "rarities": {
    "common": {
     "hp": 0,
     "dmg": 0,
     "exp": 1,
     "type": "NPC"
    },
    "unusual": {
     "hp": 0,
     "dmg": 0,
     "exp": 1,
     "type": "NPC"
    },
    "rare": {
     "hp": 0,
     "dmg": 0,
     "exp": 1,
     "type": "NPC"
    },
    "epic": {
     "hp": 0,
     "dmg": 0,
     "exp": 1,
     "type": "NPC"
    },
    "legendary": {
     "hp": 0,
     "dmg": 0,
     "exp": 1,
     "type": "NPC"
    },
    "mythic": {
     "hp": 0,
     "dmg": 0,
     "exp": 1,
     "type": "NPC"
    },
    "ultra": {
     "hp": 0,
     "dmg": 0,
     "exp": 1,
     "type": "NPC"
    },
    "super": {
     "hp": 0,
     "dmg": 0,
     "exp": 1,
     "type": "NPC"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "NPC"
    },
    "unique": {
     "hp": 0,
     "dmg": 0,
     "exp": 1,
     "type": "NPC"
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
   "biome": "",
   "hp": 4,
   "dmg": 15,
   "speed": 0,
   "size": 16,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Obstacle",
   "desc": "Under no circumstances let this thing spill. We cannot risk another mutant insect this month.",
   "spawn": "A Super Barrel has spawned somewhere!",
   "rarities": {
    "common": {
     "hp": 4,
     "dmg": 15,
     "exp": 1,
     "type": "Obstacle"
    },
    "unusual": {
     "hp": 12,
     "dmg": 45,
     "exp": 1,
     "type": "Obstacle"
    },
    "rare": {
     "hp": 36,
     "dmg": 135,
     "exp": 3,
     "type": "Obstacle"
    },
    "epic": {
     "hp": 108,
     "dmg": 405,
     "exp": 25,
     "type": "Obstacle"
    },
    "legendary": {
     "hp": 324,
     "dmg": 1215,
     "exp": 231,
     "type": "Obstacle"
    },
    "mythic": {
     "hp": 972,
     "dmg": 3645,
     "exp": 3000,
     "type": "Obstacle"
    },
    "ultra": {
     "hp": 2916,
     "dmg": 10935,
     "exp": 160000,
     "type": "Obstacle"
    },
    "super": {
     "hp": 8748,
     "dmg": 32805,
     "exp": 7700000,
     "type": "Obstacle"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Obstacle"
    },
    "unique": {
     "hp": 26244,
     "dmg": 98415,
     "exp": 7700000,
     "type": "Obstacle"
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
   "biome": "",
   "hp": 30,
   "dmg": 1,
   "speed": 60,
   "size": 19,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Hostile",
   "desc": "This one seems like it shouldn't be alive...",
   "spawn": "A Super Beetle has spawned somewhere!",
   "rarities": {
    "common": {
     "hp": 30,
     "dmg": 1,
     "exp": 1,
     "type": "Hostile"
    },
    "unusual": {
     "hp": 90,
     "dmg": 2,
     "exp": 1,
     "type": "Hostile"
    },
    "rare": {
     "hp": 270,
     "dmg": 3,
     "exp": 4,
     "type": "Hostile"
    },
    "epic": {
     "hp": 810,
     "dmg": 4,
     "exp": 28,
     "type": "Hostile"
    },
    "legendary": {
     "hp": 2430,
     "dmg": 5,
     "exp": 256,
     "type": "Hostile"
    },
    "mythic": {
     "hp": 7290,
     "dmg": 6,
     "exp": 4100,
     "type": "Hostile"
    },
    "ultra": {
     "hp": 21870,
     "dmg": 7,
     "exp": 260000,
     "type": "Hostile"
    },
    "super": {
     "hp": 65610,
     "dmg": 8,
     "exp": 13000000,
     "type": "Hostile"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Hostile"
    },
    "unique": {
     "hp": 196830,
     "dmg": 9,
     "exp": 13000000,
     "type": "Hostile"
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
   "biome": "",
   "hp": 30,
   "dmg": 1,
   "speed": 60,
   "size": 19,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Hostile",
   "desc": "That thing on its head looks valuable... We should steal it.",
   "spawn": "A Super Beetle has spawned somewhere!",
   "rarities": {
    "common": {
     "hp": 30,
     "dmg": 1,
     "exp": 1,
     "type": "Hostile"
    },
    "unusual": {
     "hp": 90,
     "dmg": 2,
     "exp": 1,
     "type": "Hostile"
    },
    "rare": {
     "hp": 270,
     "dmg": 3,
     "exp": 6,
     "type": "Hostile"
    },
    "epic": {
     "hp": 810,
     "dmg": 4,
     "exp": 47,
     "type": "Hostile"
    },
    "legendary": {
     "hp": 2430,
     "dmg": 5,
     "exp": 455,
     "type": "Hostile"
    },
    "mythic": {
     "hp": 7290,
     "dmg": 6,
     "exp": 8000,
     "type": "Hostile"
    },
    "ultra": {
     "hp": 21870,
     "dmg": 7,
     "exp": 604000,
     "type": "Hostile"
    },
    "super": {
     "hp": 65610,
     "dmg": 8,
     "exp": 20000000,
     "type": "Hostile"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Hostile"
    },
    "unique": {
     "hp": 196830,
     "dmg": 9,
     "exp": 20000000,
     "type": "Hostile"
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
   "biome": "",
   "hp": 3,
   "dmg": 0,
   "speed": 0,
   "size": 16,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Obstacle",
   "desc": "Huh, what could be in here?",
   "spawn": "A Super Tomb has spawned somewhere!",
   "rarities": {
    "common": {
     "hp": 3,
     "dmg": 0,
     "exp": 2,
     "type": "Obstacle"
    },
    "unusual": {
     "hp": 9,
     "dmg": 0,
     "exp": 3,
     "type": "Obstacle"
    },
    "rare": {
     "hp": 27,
     "dmg": 0,
     "exp": 12,
     "type": "Obstacle"
    },
    "epic": {
     "hp": 81,
     "dmg": 0,
     "exp": 99,
     "type": "Obstacle"
    },
    "legendary": {
     "hp": 243,
     "dmg": 0,
     "exp": 931,
     "type": "Obstacle"
    },
    "mythic": {
     "hp": 729,
     "dmg": 0,
     "exp": 11100,
     "type": "Obstacle"
    },
    "ultra": {
     "hp": 2187,
     "dmg": 0,
     "exp": 630000,
     "type": "Obstacle"
    },
    "super": {
     "hp": 6561,
     "dmg": 0,
     "exp": 25000000,
     "type": "Obstacle"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Obstacle"
    },
    "unique": {
     "hp": 19683,
     "dmg": 0,
     "exp": 25000000,
     "type": "Obstacle"
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
   "biome": "",
   "hp": 30,
   "dmg": 0,
   "speed": 60,
   "size": 19,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Hostile",
   "desc": "Those annoying little things that eat clothes. It also loves garbage.",
   "spawn": "A Super Silver Fish has spawned somewhere!",
   "rarities": {
    "common": {
     "hp": 30,
     "dmg": 0,
     "exp": 1,
     "type": "Hostile"
    },
    "unusual": {
     "hp": 90,
     "dmg": 0,
     "exp": 2,
     "type": "Hostile"
    },
    "rare": {
     "hp": 270,
     "dmg": 0,
     "exp": 8,
     "type": "Hostile"
    },
    "epic": {
     "hp": 810,
     "dmg": 0,
     "exp": 60,
     "type": "Hostile"
    },
    "legendary": {
     "hp": 2430,
     "dmg": 0,
     "exp": 563,
     "type": "Hostile"
    },
    "mythic": {
     "hp": 7290,
     "dmg": 0,
     "exp": 6900,
     "type": "Hostile"
    },
    "ultra": {
     "hp": 21870,
     "dmg": 0,
     "exp": 381000,
     "type": "Hostile"
    },
    "super": {
     "hp": 65610,
     "dmg": 0,
     "exp": 16000000,
     "type": "Hostile"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Hostile"
    },
    "unique": {
     "hp": 196830,
     "dmg": 0,
     "exp": 16000000,
     "type": "Hostile"
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
   "biome": "",
   "hp": 3,
   "dmg": 0,
   "speed": 0,
   "size": 16,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Obstacle",
   "desc": "Someone's treasure...",
   "spawn": "A Super Garbage has spawned somewhere!",
   "rarities": {
    "common": {
     "hp": 3,
     "dmg": 0,
     "exp": 1,
     "type": "Obstacle"
    },
    "unusual": {
     "hp": 9,
     "dmg": 0,
     "exp": 2,
     "type": "Obstacle"
    },
    "rare": {
     "hp": 27,
     "dmg": 0,
     "exp": 5,
     "type": "Obstacle"
    },
    "epic": {
     "hp": 81,
     "dmg": 0,
     "exp": 41,
     "type": "Obstacle"
    },
    "legendary": {
     "hp": 243,
     "dmg": 0,
     "exp": 379,
     "type": "Obstacle"
    },
    "mythic": {
     "hp": 729,
     "dmg": 0,
     "exp": 5200,
     "type": "Obstacle"
    },
    "ultra": {
     "hp": 2187,
     "dmg": 0,
     "exp": 260000,
     "type": "Obstacle"
    },
    "super": {
     "hp": 6561,
     "dmg": 0,
     "exp": 13000000,
     "type": "Obstacle"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Obstacle"
    },
    "unique": {
     "hp": 19683,
     "dmg": 0,
     "exp": 13000000,
     "type": "Obstacle"
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
   "biome": "",
   "hp": 10,
   "dmg": 0,
   "speed": 60,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Hostile",
   "desc": "How did they end up here?",
   "spawn": "A Super Soldier Ant has spawned somewhere!",
   "rarities": {
    "common": {
     "hp": 10,
     "dmg": 0,
     "exp": 1,
     "type": "Hostile"
    },
    "unusual": {
     "hp": 30,
     "dmg": 0,
     "exp": 1,
     "type": "Hostile"
    },
    "rare": {
     "hp": 90,
     "dmg": 0,
     "exp": 6,
     "type": "Hostile"
    },
    "epic": {
     "hp": 270,
     "dmg": 0,
     "exp": 47,
     "type": "Hostile"
    },
    "legendary": {
     "hp": 810,
     "dmg": 0,
     "exp": 455,
     "type": "Hostile"
    },
    "mythic": {
     "hp": 2430,
     "dmg": 0,
     "exp": 8000,
     "type": "Hostile"
    },
    "ultra": {
     "hp": 7290,
     "dmg": 0,
     "exp": 604000,
     "type": "Hostile"
    },
    "super": {
     "hp": 21870,
     "dmg": 0,
     "exp": 20000000,
     "type": "Hostile"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Hostile"
    },
    "unique": {
     "hp": 65610,
     "dmg": 0,
     "exp": 20000000,
     "type": "Hostile"
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
   "biome": "",
   "hp": 10,
   "dmg": 0,
   "speed": 45,
   "size": 17,
   "tier": 1,
   "boss": false,
   "color": "#bbbbbb",
   "type": "Neutral",
   "desc": "A tormented soul, freeing it is the best you can do for it.",
   "spawn": "A Super Ghost has spawned somewhere!",
   "rarities": {
    "common": {
     "hp": 10,
     "dmg": 0,
     "exp": 1,
     "type": "Neutral"
    },
    "unusual": {
     "hp": 30,
     "dmg": 0,
     "exp": 1,
     "type": "Neutral"
    },
    "rare": {
     "hp": 90,
     "dmg": 0,
     "exp": 1,
     "type": "Neutral"
    },
    "epic": {
     "hp": 270,
     "dmg": 0,
     "exp": 1,
     "type": "Neutral"
    },
    "legendary": {
     "hp": 810,
     "dmg": 0,
     "exp": 1,
     "type": "Neutral"
    },
    "mythic": {
     "hp": 2430,
     "dmg": 0,
     "exp": 1,
     "type": "Neutral"
    },
    "ultra": {
     "hp": 7290,
     "dmg": 0,
     "exp": 1,
     "type": "Neutral"
    },
    "super": {
     "hp": 21870,
     "dmg": 0,
     "exp": 1,
     "type": "Neutral"
    },
    "eternal": {
     "hp": 0,
     "dmg": 0,
     "exp": 0,
     "type": "Neutral"
    },
    "unique": {
     "hp": 65610,
     "dmg": 0,
     "exp": 1,
     "type": "Neutral"
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
