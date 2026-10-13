# DXF Hole Extractor v6.80.0
**目前版本：6.80.0**

> **Human-Logic Driven Geometry Inference／以人類推導邏輯為最高規格的幾何推導版**

本專案的目的，是從 DXF 工程圖自身的幾何關係推導工件尺寸與 CNC 孔位：

```text
face / diameter / x / y / z
```

核心原則不是「從圖面找出一個看起來像答案的數字」，而是建立完整、可追溯的幾何證據鏈。

---

## 1. 最高規格：人類完整推導邏輯

**本節不是建議，而是本專案的正式規格。**

專案目前所有演算法與後續優化，都應從這套人類已驗證的圖面推導邏輯衍伸。若既有程式與本節衝突，優先檢查程式並修正程式；不得反過來為了迎合舊程式而改寫人類邏輯。

### 1.1 主流程十步

1. **集群**
   - 將所有閉合線抓成一個集群，包含內部所有特徵。
   - 閉合線包含 `LWPOLYLINE`、`POLYLINE`，以及由多條 `LINE` 串接形成的封閉迴圈。

2. **主視圖／副視圖分類**
   - 使用 X（水平）方向距離判斷。
   - X 距離最大者為主視圖。
   - 主視圖若不只一個，依 Y 大小區分，優先 Y 較大的集群作為主視圖。

3. **主視圖 X 原點**
   - 收集 X 方向尺寸線，取得最大距離。
   - 先比對 X1（小值）與 X2（大值）的**真實幾何距離**和尺寸線顯示字串。
   - 若不符，視為可能的中斷視圖，只做標記，不做尺寸偏移修正。
   - X1 為 X 原點。

4. **主視圖 Y 原點**
   - 依主視圖最大的 Y 點座標建立 Y 原點。

5. **副視圖按比例還原**
   - 先排除集群內 Y（垂直）距離小於主視圖 Y 距離的候選，降低運算量。
   - 副視圖的倍率由世界座標下的幾何盒尺寸推導。
   - 尺寸線可以提供**倍率資訊**，但不是材料盒存在與否的證據，也不是孔位量測值。
   - 多個同類副視圖可使用眾數建立穩定倍率，不使用平均值。
   - 所有副視圖都先完成比例還原，再進入盒子與孔位推導。

6. **抓出斷面圖**
   - 副視圖中，盒子**某一個方向**等於主視圖 Y（垂直）者，視為斷面圖候選。
   - 此判定不依賴圖面排版位置；斷面可位於上下左右。
   - **斷面盒的物理軸由「哪一個方向等於主視圖 Y」決定，不可假設畫面上的垂直方向就是工件 Y。**
     鋁擠型斷面常以型材自身姿態旋轉 90° 繪製（Y 畫成水平）；此時盒寬是 Y、盒高才是 Z。
     判反的後果是 Z 直接取到材料寬度，之後所有以 Z 為基準的推導一起錯。
   - 同一條原則適用於「用剖面詳圖的水平 DIMENSION 推 FRONT 深度」：
     必須先確認該詳圖的水平方向真的是Z 軸；與主視圖等長的群集是同一支
     工件的另一個縱向視圖，不是橫斷面詳圖。

7. **抓孔位**
   - 抓不到任何斷面時：只提取主視圖圓，設定為 `FRONT`，矩形不提取；此路徑信心度降低。
   - 有斷面時：抓圓、矩形、類矩形（2 條線）、45° 梯形。
   - 主視圖圓：`FRONT` / `BACK`。
   - 主視圖矩形／類矩形／45° 梯形：`TOP` / `BOTTOM`。
   - 斷面圖：以**盒子象限法**與材料盒幾何判定面向；矩形尺寸只作快速分面向，不先對位置。
   - **線型可見性是圖面自己畫出來的面向證據**：看不到的特徵畫隱藏線。
     同心異徑圓若**整群**都是隱藏線，代表連最大的開口都不在近側面，該特徵加工於 `BACK`；
     整群實線則開口在近側面，為 `FRONT`。
     此規則只有在同一張圖的同一組孔徑同時出現兩種畫法（訊號具鑑別力）時才成立；
     強度低於剖面 marker／template，剖面若有直接證據仍優先。

8. **正式抓取位置**
   - 全部採水平投影，比對特徵的 Y 相對座標。
   - 第一優先：剖面線與 `A-A`、`B-B`、`1-1` 等標記建立的投影關係。
   - 第二優先：尺寸線箭頭相連位置建立投影關係。
   - 第三優先：主視圖剩餘特徵與斷面特徵做幾何比對。
   - **以上定位證據都必須建立在先前已成立的材料盒／斷面盒之上。**

9. **座標轉換**
   - `FRONT`、`BACK`、`TOP`、`BOTTOM` 各自依其物理方向做轉換。
   - `z` 是 XYZ 孔位座標，不是Z 座標，也不是材料厚度。

10. **同一 X/Y 可有多孔**
    - 同一 X、Y 座標不代表只有一個孔。
    - 必須與斷面圖逐一比對，保留不同 Z 的合法分支。
    - 例如同心 Ø30 + Ø13 可能是左右兩片牆各一個孔，而非單一沉頭孔。
    - 反向同樣要有證據：**同心群整群線型一致，代表這些開口都在同一面**
      （錐孔／沉頭孔的大端與貫通端），只輸出一顆孔，孔徑取貫通端（最小徑）。
      「拆成兩片牆各一孔」需要斷面或線型對照支持，不能只憑同心拓撲樣板。

### 1.2 必須遵守的推導原則

- **孔位證據以盒子幾何為核心。**
- **不得用 DIMENSION 當作「這是不是正確材料盒」的候選證據。**
- 尺寸線在允許的地方，只能用來取得縮放倍率或尺寸關聯資訊；不能直接拿尺寸文字當孔位座標、深度或材料厚度。
- 副視圖沒有足夠材料盒幾何時，優先修正「如何找到盒子」，而不是增加更多尺寸線特例。
- 盒子選定後，再由盒子的中心、邊界、象限、特徵中心與投影關係推導孔位。
- `z` 是孔的 XYZ 位置座標，不能用「Z 座標不應超過材料厚度」之類的假設否決幾何證據。
- 同一主視圖座標可能存在多個孔，不能以 XY 去重取代斷面幾何比對。
- 圖面排版位置只能是輔助資訊；不能假設「上方一定是 TOP、右邊一定是 FRONT」。
- 優先使用已驗證正確的核心函式；局部缺陷先局部修復。
- 數字診斷不能取代視覺判讀。遇到集群、盒子或斷面異常，先截圖確認圖面結構，再寫診斷程式。

---

## 2. 盒子優先

將「材料盒」提升為副視圖與孔位推導的核心資料結構。

### 2.1 盒子是什麼

盒子不是任意 `bbox`，而是能由圖面幾何證明為「材料輪廓」的幾何容器，例如：

- 封閉多邊形／`REGION_PROFILE`。
- 已驗證的材料輪廓。
- 多個同形、同尺度的重複剖面盒。
- 某些圖面中由開放式外框與材料邊界共同形成、可由幾何關係重建的材料盒。

### 2.2 盒子選擇原則

```text
圖面實體
  ↓
材料輪廓候選
  ↓
空間關係 + 尺寸比例 + 輪廓形狀 + 重複性
  ↓
成立材料盒
  ↓
盒子倍率／物理軸
  ↓
盒內孔／marker／section 特徵
  ↓
面向 + X/Y/Z
```

**禁止反過來：**

```text
DIMENSION
  ↓
猜這個盒子是不是正確盒子
  ↓
再用盒子配孔
```

### 2.3 重複剖面盒

例如 PYN01-B05：多張 `2-2 ~ 6-6` 剖面具有相同材料輪廓，世界座標盒子為：

```text
219 × 450
```

主視圖材料 Y 為：

```text
150
```

因此由幾何尺寸得到：

```text
scale = 450 / 150 = 3
Z     = 219 / 3    = 73
```

這個 `73` 是材料盒幾何還原的結果，不是尺寸線直接提供的孔位答案。

---

## 3. 座標轉換範例：PYN02-L38A

BACK 的 Y 很簡單，應直接由主視圖座標與主視圖材料 Y 距離完成：

```text
主視圖孔心 Y = -55
主視圖 Y 距離 = 132
面向 = BACK

(132 + (-55)) × -1 = -77
```

因此 `-77` 是正確結果。

這個例子也明確說明：

> **主視圖的孔心座標本身就是正式位置證據。**

不要為了追求某個看似「比較合理」的數字而讓尺寸線或猜測覆蓋幾何結果。

---

## 4. 目前已驗證的重要函式

以下函式曾經過實際案例驗證，除非找到新的直接證據，否則不應任意重寫：

| 用途 | 函式 | 位置 |
|---|---|---|
| 主視圖材料盒 | `get_front_view_material_height()` | `dimensions/size_analyzer.py` |
| 斷面材料盒 | `find_material_profile_detail()` | `views/side_view_analyzer.py` |
| 主視圖選擇 | `discover_view_sections()` | `views/multi_view_pipeline.py` |
| 盒子象限法分面向 | `classify_face_by_box_quadrant()` | `geometry/section_face_orientation.py` |
| Near-End → Far-Edge | `feature_to_far_edge_distance()` | `geometry/section_feature_geometry.py` |
| 斷面盒（LINE＋ARC 拓撲重建） | `_reconstruct_y_matched_profile()` | `views/side_view_analyzer.py` |
| 正投影對齊證據 | `front_material_edge_ys()`／`is_projection_aligned()` | `views/side_view_analyzer.py` |
| REGION 的 SAT 文字 ACIS | `parse_sat_records()`／`load_region_bodies()` | `geometry/acis_sat.py`、`geometry/region_profile.py` |

主視圖與斷面圖採不同材料盒推導方式：主視圖外框不一定是封閉多邊形；斷面圖則優先使用封閉輪廓。

---

## 5. 測試策略：永遠分次、多輪

**禁止為了方便而一次執行全部 DXF regression。**

原因很實際：個別 DXF 可能因幾何解析、檔案大小或環境因素耗時過長，會浪費整輪診斷時間，也會讓真正的失敗案例被等待時間掩蓋。

### 5.1 Unit test

先測與本次修改直接相關的測試模組或測試函式：

```bash
python3 -m pytest tests/unit/test_side_view_face_markers.py -q
```

必要時再擴大到其他 unit 模組。

### 5.2 DXF regression

一次只跑一個案例：

```bash
python3 tests/run_regression.py PYN01-B05
python3 tests/run_regression.py PYN02-L38A
```

`tests/run_regression.py` 已設計成單案例入口；**不得恢復 `all` 全案入口**。

### 5.3 建議回歸順序

修改盒子／斷面邏輯時，優先使用能代表不同圖面結構的案例：

```text
PYN01-B05       重複剖面盒／上下排版
PYN02-L38A      主視圖座標轉換
PYN13-Z34B      側視盒與面向
TN02-2041A      完整視圖與薄盒干擾
TN56W-010       左右材料盒／開放式輪廓
YCN007-CC201    34/34 穩定基準
E73-43          旋轉 90° 斷面盒／隱藏線面向
PYN64-B11       全實線異徑同心網格（確認未被線型規則吃掉）
YCN043-Y003     主視圖矩形 ↔ 剖面標記逐孔配對／FRONT 只穿前壁
NTN007-622A     BOTTOM Y 基準取外框右緣
PYN13-Z26A      BOTTOM Y 基準取輪廓內部結構牆
```

每修改一次，只增加少量案例；確認穩定後再進下一輪。

---

## 6. 診斷規則：先摘要，再看圖，最後才寫程式

**不要一開始就寫臨時腳本撈幾何。** 兩個工具（完整說明見 `tools/README.md`）：

```bash
# 先用數字摘要知道圖裡有什麼：孔徑分布、幾張斷面、管線的盲點在哪
python3 tools/dxf_digest.py <dxf>
python3 tools/dxf_digest.py <dxf> --only marker_position
python3 tools/dxf_digest.py <dxf> --bbox X1 Y1 X2 Y2 --raw

# 數字看不懂、或要確認線型與位置關係時才截圖
python3 tools/dxf_screenshot.py <dxf> -o out.png --width 2800 --height 2400 --dark
python3 tools/dxf_screenshot.py <dxf> -o out.png --bbox X1 Y1 X2 Y2 --padding 5 --dark
```

兩者都只協助理解 DXF 幾何，不參與正式 inference。

`dxf_digest.py` 有三條不可違背的設計原則，改它之前務必先讀
`tools/README.md`：**不走 production 的過濾路徑**（否則會跟管線一起瞎，
TRA041-H33 的根因就是管線看不見 10 張詳圖的材料輪廓）、**只報量測不報結論**
（印 `linetype=HIDDEN`，不印 `face=BACK`）、**不靜默轉換座標**（原點是推導值，
一律標注並保留 `world = local + origin` 的可逆關係）。

當數字診斷說「沒有副視圖」、「找不到比例」或「候選不存在」時，不應立即把它當成事實；先確認集群是否被表格框線、圖框、文字框或排版線合併。

---

## 7. 不可信的做法（禁止重複）

- 用 DIMENSION 顯示值直接當孔位 Y/Z。
- 用 DIMENSION 是否存在決定「哪個材料盒是真的」。
- 用固定案例名稱、檔名、座標、孔徑或孔數補答案。
- 因為某個 Z 大於材料厚度就否決結果。
- 只因為副視圖位於右側／左側／上方／下方，就直接指定 FRONT/BACK/TOP/BOTTOM。
- 發現一個案例失敗就整條 pipeline 重寫，而沒有先檢查既有已驗證函式。

---

## 8. 架構

```text
DXF
 ↓
dxfio / INSERT 展開 / frame filter
 ↓
view clustering
 ↓
主視圖材料盒／副視圖材料盒
 ↓
scale / physical-axis restoration
 ↓
hole candidate generation
 ↓
section / marker / feature geometry
 ↓
face + diameter + X/Y/Z inference
 ↓
evidence resolution / provenance
 ↓
HoleResult / review / regression
```

### 8.1 DWG → DXF

載入 DWG 時**優先使用內建外掛 purejs-dwg2dxf**（`dxf_hole_extractor/plugins/dwg2dxf/`，
純 Python、免安裝 ODA）；外掛失敗或以 `DXF_HOLE_EXTRACTOR_DWG2DXF_DISABLE=1` 停用時，
才依序退回 ODAFileConverter 等外部 converter。外掛的 `core/` 是另一個專案的原樣複本，
以 `python tools/sync_dwg2dxf.py <purejs-dwg2dxf-py 根目錄>` 整包更新，不在本專案內修改。
說明見 `dxf_hole_extractor/plugins/dwg2dxf/README.md`。

詳細模組責任請參閱：

- [`docs/architecture.md`](docs/architecture.md)
- [`docs/service.md`](docs/service.md)
- [`docs/oda-conversion.md`](docs/oda-conversion.md)

---

## 9. 開發規則

任何 inference path 修改，都必須在開發紀錄中說明：

1. 使用哪個圖面幾何線索。
2. 如何由線索建立材料盒。
3. 如何由盒子推導倍率與物理軸。
4. 如何由盒內特徵推出面向與 X/Y/Z。
5. 哪些證據仍不足，以及為何不能猜。
6. 本輪只跑哪些單案例／小批次 regression。

`tests/fixtures/regression/*/expected.json` 只能作為 regression oracle，不得進入正式 inference。

---