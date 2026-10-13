## 6.80.0 - 2026-10-12

### Fixed

- **GUI／CLI 開啟 budweiser2018.dwg 報錯**（`Invalid DXF attribute "invisible"／"layer" for entity PLANESURFACE`）：
  ezdxf 不支援的實體（PLANESURFACE 等）會以 `DXFTagStorage` 載入、沒有 layer 等圖形屬性。
  - `get_all_wcs_entities()` 略過 ezdxf namespace 不支援 `layer` 的實體；本專案虛擬實體（REGION_PROFILE）照常保留。
  - 6.76.0 新增的頂層 invisible 判定改為捕捉所有例外（不支援該屬性的實體視為可見）。
  - 驗證：CLI 與 GUI（AnalysisWorker＋MainWindow 結果處理＋預覽繪製）完整跑完，無例外。
- **保底候選補上 provenance**：`unclaimed_front_view_candidates` 產生的候選附上來源實體 evidence，
  並與其他孔一樣轉成 domain candidate。

### Verification

- 回歸 49 案逐案全數通過；pytest 389 passed，失敗 4 項同 6.73.27 原始封包。

### Version

`6.80.0`

## 6.79.0 - 2026-10-12

### Changed — 移除「只有 0 顆孔才啟用」的條件，全部改為幾何證據判定

「結果為空才跑」本身是一種與圖面幾何無關的條件（另一類硬編碼），本版改成每張圖都依同一套
幾何邏輯判定：

- **幾何 X 總長**（`dimension_parser._geometric_x_fallback`）：移除 0 孔重跑機制
  （`GEOMETRIC_X_FALLBACK_ENABLED` 與 `extract_all_holes` 重跑皆刪除），改為兩條件同時成立才改用盒子：
  1. 選出的 DIMENSION **沒有材料邊支撐**（無任何水平幾何邊兩端與尺寸兩端對齊）；
  2. 存在**材料盒 X 邊**（兩條以上不同高度、兩端對齊的水平邊＝盒子上下緣）且長度 ≥ 尺寸 2 倍。
  單一長線（引線、表格線、圖框殘線）不構成盒子證據——這正是 6.78.0 無條件版在 C3N054-Q001、
  PYN02-L38A 失敗的原因。回歸 49 案中無支撐尺寸的盒邊比值都 ≤ 1.03，炸開總長的圖面為 4～50 倍。
- **主視圖孔幾何保底**（`front_view_fallback.unclaimed_front_view_candidates`）：不再只在 0 孔時啟用，
  改為「主視圖上未被任何證據路徑解釋的圓／側面投影豎線對」都列為候選；同 X、同孔徑已有孔即視為
  已解釋，不重複、不改動既有孔。面向（與側面投影的 Y）以結構化 `unresolved` issue 宣告，
  經通用信心公式降為低信心（約 0.2～0.3）。

### Tests

- `test_nkn04_01`、`test_pyn13_z14b` 為逐孔完全相等的 oracle 測試，改為排除
  `is_front_view_fallback()` 的低信心候選後比對（標準孔仍須完全相同；允許孔數增加）。
- `test_geometric_x_fallback.py` 改為驗證兩個幾何條件。

### Verification

- 回歸 49 案逐案全數通過（標準孔位全部保留；10 案多出低信心候選，列於「低信心額外候選」）。
- 第二批 31 張：25/31 有孔位（與 6.78.0 相同）；第一批 36 張既有孔位不變，10 張多出低信心候選。
- pytest 388 passed，失敗 4 項同 6.73.27 原始封包。

### Version

`6.79.0`

## 6.78.0 - 2026-10-12

### Added

- **幾何 X 總長退路**（`dimension_parser._geometric_x_fallback`，README 第 2 步「X 距離最大者為主視圖」）：
  總長尺寸已被炸開成 LINE＋MTEXT、不是 DIMENSION 物件時，原本會選到局部小尺寸（例 19.5）當 X，
  主視圖整個選錯。退路改以最長單一水平材料邊的跨距當 X 總長與原點。
  - 觸發條件：DIMENSION 結果不存在，或不到最長水平邊的一半。
  - **只在整條推導 0 顆孔後的重跑中啟用**（`GEOMETRIC_X_FALLBACK_ENABLED`，由 `extract_all_holes()`
    第二次執行時開啟）；重跑仍為 0 顆或失敗時回傳第一次結果。
  - 試過無條件啟用：回歸 C3N054-Q001、PYN02-L38A 圖上另有比工件長一倍以上的水平線，
    X 會被換錯而失敗，因此改為只在 0 顆孔時重跑；既有有孔圖面（含全部回歸）只跑第一次，行為不變。

### Verification

- 第二批 31 張：有孔位 22 → 25/31（TN02-B004A X=1014、FRONT Ø4.2 於 57 起每 300、BOTTOM Ø5.5 兩端，
  與圖面尺寸一致；TN02-B065、TN01-A3070A 亦恢復）。剩 6 張：主視圖為鈑金側邊（厚 1.6）或
  孔只畫在斷面／放大詳圖。
- 第一批 36 張輸出不變；回歸 49 案逐案全數通過；pytest 388 passed，失敗 4 項同原始封包。

### Version

`6.78.0`

## 6.77.0 - 2026-10-12

### Added

- **側面投影孔記號保底**（`front_view_fallback.front_view_edge_on_marks`）：主視圖沒有任何
  CIRCLE、且圓孔保底也沒有結果時，辨識「一對等長平行豎線」（長度＝牆厚、間距＝孔徑，
  LINE 或多段線邊皆可；中心線因長度不同不會配對；需互為最近鄰、間距 1～30mm）。
  貼材料上緣→TOP、下緣→BOTTOM；X＝兩線中點、孔徑＝間距、Z＝線長。主視圖量不到孔在
  Z 方向的位置，Y 取 -Z/2 並於 note 明講。note 含 `FALLBACK`，低信心、需人工確認。
- 與 6.76.0 相同：只在最終結果為空時啟用，回歸案例的標準孔不受影響。

### Verification

- 第二批 31 張：有孔位 20 → 22/31（另有 TN06G-A3015A、F-M017、L1903-714、J03-Y013 由此路徑產生；
  L1903-714 X=9.5／139.5、J03-Y013 X=48 起每 300 與圖面尺寸一致）。剩 9 張屬主視圖選錯或孔不在主視圖。
- 第一批 36 張輸出不變；回歸 49 案逐案全數通過；pytest 386 passed，失敗 4 項同原始封包。

### Version

`6.77.0`

## 6.76.0 - 2026-10-12

### Fixed

- **頂層 invisible 實體不再參與分析**：`get_all_wcs_entities()` 跳過 Modelspace 頂層
  DXF invisible 旗標（group 60 = 1）的實體。實測圖面留有一份隱藏的舊主視圖與尺寸延伸線，
  顯示上不存在卻被選成主視圖，畫著孔的真正視圖被當成副視圖、孔位全失。只作用於頂層；
  動態圖塊內部的 invisible 幾何仍保留給 dynamic_visibility（6.73.26）在候選層判斷。
- **整條推導 0 顆孔時的主視圖圓保底**（`holes/front_view_fallback.py`，README §1.1 第 7 步）：
  側視盒存在但沒有任何面向證據（薄板、單純通孔）時，FRONT/BACK 依規則拒絕猜測，
  整張圖 0 顆。此時把圓心落在主視圖材料盒內的圓列為 FRONT 候選；同心群取最小徑；
  排除 < 1mm 的中心符號與材料盒外的圓。note 含 `FALLBACK`，一律低信心、需人工確認。
  **只在最終結果為空時啟用**，任何證據路徑產生過孔就完全不介入。

### Verification

- 使用者第二批 31 張「無孔位」DWG（僅驗證、未納入測試）：有孔位 1/31 → 20/31。
  其餘 11 張的孔不是以 CIRCLE 繪製（中心十字、點、斷面 marker），或 X 總長尺寸不在
  DIMENSION 中（主視圖選錯），依「不硬修」保留。
- 第一批 36 張：側視圖 25 → 28（invisible 修正的附帶效果），既有輸出不變。
- 回歸 49 案逐案全數通過；pytest 385 passed，失敗 4 項同 6.73.27 原始封包。
- 新增 `tests/unit/test_invisible_and_fallback.py`（合成圖面）。

### Version

`6.76.0`

## 6.75.0 - 2026-10-12

### Changed

- **`tools/index.html` 改為最小單機看圖器**：移除 three-dxf-viewer（CDN 依賴），改由
  `tools/build_viewer.py` 把 CAD-Viewer 的顯示核心與 `tools/viewer_src/` 外殼組成單一 HTML。
  只保留看圖：開檔／拖放、滾輪縮放、拖曳平移、全圖、背景、線寬；不含面板、編輯、DWG 轉檔。
- **GUI／截圖工具顯示規則對齊 CAD-Viewer**（新增 `gui/cad_display.py`，純 Python 移植）：
  - 深色背景改為 CAD-Viewer 預設 `#212830`。
  - 顏色：保留原色、只調整純黑白（`theme_color` 與 JS `themeColor` 14 組值逐一相同）；
    取代 ezdxf `COLOR_SWAP_BW`（淺底時會把純黑換成白色而看不見）。
  - `$LWDISPLAY` 關閉時一律細線；開啟才依 DXF 線寬。
  - REGION 以實體自身顏色（真彩色→ACI→ByLayer）1 像素細線繪製，不再固定黑白粗線；
    `RegionProfileEntity.dxf` 新增 `color`／`true_color`。
  - 附帶中文字型缺少時改用系統中文字型，中文不再顯示成方框。

### Verification

- 回歸 49 案逐案全數通過；pytest 382 passed，失敗 4 項同 6.73.27 原始封包。
- headless Chromium 開啟 `tools/index.html` 載入含 SAT 面域的 DXF：無 JS 錯誤，縮放／平移正常。

### Version

`6.75.0`

## 6.74.0 - 2026-10-12

### Fixed

- **側視圖找不到（側視斷面以 LINE＋圓角 ARC 畫成）**：`find_material_profile_detail()` 只看單一實體，
  斷面若由數百條 LINE 與圓角 ARC 首尾相接畫成（沒有 closed LWPOLYLINE／REGION），只會挑到斷面內
  3×26 之類的小卡槽框，被最小尺寸門檻淘汰後整張圖退回「無側視圖」。
  - `closed_loops_from_entities(include_arcs=True)`：ARC 折線化（端點精確）後一起做平面圖面環走訪；
    預設 False，既有呼叫端行為不變。
  - `_reconstruct_y_matched_profile()`：相鄰群集的單一實體輪廓兩個方向都對不上主視圖 Y 時，改用線段
    拓撲重建，只接受「某一方向等於主視圖 Y（≤1%）」的封閉盒（README 第 6 步斷面盒定義）。
- **正投影對齊證據**：`front_material_edge_ys()`／`is_projection_aligned()`。側視盒上、下緣**同時**
  落在主視圖長水平線（≥ X 總長 50%）上、且盒高 ≥ 主視圖量測高度 75%，即視為同一支材料的投影斷面：
  - 主視圖量到的高度被附件／襯條線撐大時（例：主視圖 148、斷面 140），頂層 REGION 與重建盒仍可入選；
    並與既有「封閉外框 == 側視圖」同一原則，以雙重幾何證據覆蓋主視圖 Y。
  - 薄板斷面以開放 LINE＋ARC 畫成、拼不出封閉環時，群集盒對齊即成立；`_connected_section_bbox()`
    以端點連通元件排除只「指到」斷面邊上的引線，避免 Z 被引線撐寬。
  - 只對齊一緣、或只跨兩條內部肋線的小盒（盒高 < 75%）不算，避免把局部特徵當斷面
    （由回歸案例 SY2238-10、TN60W-002 驗證此門檻必要）。
- **REGION 的 SAT 文字 ACIS**：新增 `geometry/acis_sat.py`，把 SAT 轉成與 SAB 同形狀的記錄，
  `region_profile` 既有拓撲走訪原封不動套用。
  - ezdxf 對 R2013+ DXF 會丟棄內嵌 SAT（`acis_data` 為空），改由原始 DXF 依 handle 補讀
    （含 `virtual_entities()` 複本經 `source_of_copy` 回溯）。
  - **舊版 SAT 整數座標**：只有 SAT 版本 ≥ 700 才略過第一個指標後的 history id；
    SAT 400 的 `point $-1 0 0 0` 不會再被吃掉一個座標。

### Added

- **內建 DWG 外掛 purejs-dwg2dxf 4.0.1**（`plugins/dwg2dxf/`），`oda_convert()` 優先使用，
  失敗才退回 ODA 等外部 converter；診斷事件 backend 名稱為 `purejs_dwg2dxf`。
  GUI 設定視窗顯示外掛狀態；HTTP 服務在外掛可用時不再要求設定 ODA。
  - 4.0.1 修正：舊版 DWG 的 SAT 面域在輸出 R2013+ DXF 時遺失（只有 SAB 走 ACDSDATA，SAT 一律內嵌）。
  - `tools/sync_dwg2dxf.py`：整包同步上游 `dwg2dxf/` 到外掛 `core/`。
  - `DXF_HOLE_EXTRACTOR_DWG2DXF_PATH`（外部覆寫）、`DXF_HOLE_EXTRACTOR_DWG2DXF_DISABLE`（停用）。

### Verification

- 使用者提供的 36 張「無側視圖」DWG（**僅作驗證、未納入專案測試**）：以外掛轉檔後，
  側視圖由 0/36 → 25/36；成功案例逐張截圖目視確認尺寸（鋁擠型 70×166、70×140、L 角材 65×65／20×20、
  4mm 板 4×62、薄板 47×87 等）。未找到的 11 張屬圖面本身不一致（側視與主視圖錯位 12mm、
  主視圖非 1:1 等）或主視圖 Y 量不到，依「不硬修」原則保留。
- 36 張全部完整跑完 `extract_all_holes()`，無例外。
- 回歸 49 案逐案執行全數通過；pytest 367 passed，失敗 4 項與 6.73.27 原始封包相同
  （performance baseline 缺檔、OpenAPI schema、provenance、cross-view corroboration）。
- 新增單元測試：`test_acis_sat_region.py`、`test_side_view_line_arc_projection.py`
  （皆為合成圖面）、`test_dwg2dxf_plugin.py`；`test_contracts` 硬編碼稽核排除外掛 `core/`（第三方原樣複本）。
- 未新增任何案例名稱、固定座標、固定孔徑或圖層特判。

### Version

`6.74.0`

## 6.73.27 - 2026-10-05

### Fixed

- **實體座標系（OCS）統一換成世界座標**：擠出方向為 (0,0,-1) 的平面圖元（CIRCLE／ARC／LWPOLYLINE／HATCH／SOLID／TRACE／TEXT／ATTRIB）把座標存在 OCS，X 軸與世界座標相反。過去頂層實體原樣輸出、鏡像 INSERT 手動展開時也直接把 OCS 座標當區塊座標套矩陣，下游讀 `dxf.center`／`get_points()` 都拿到鏡像位置。
  - 新增 `dxfio.dxf_loader._normalize_ocs()`，在頂層輸出、`virtual_entities()` 輸出、手動鏡像展開三條路徑上一律換成「世界座標等價、擠出方向 (0,0,1)」的副本。換算規則為 X 取負、角度 180°−θ（圓弧起訖對調）、bulge 變號，HATCH 邊界逐條換算。ezdxf 的 `transform()` 遇到 Z 鏡射會保留擠出方向，不能用來做這件事。
  - 驗證：以 ezdxf `ocs().to_wcs()` 為基準，回歸 49 案共 62,416 個 LINE 端點／多段線頂點／圓心，修正前 10 點遺漏、42 點錯位（SMC-N01-P002、PYN73-C02），修正後 0／0。
- **圖框覆蓋率改用世界座標量整體範圍**：`frame_filter.detect_frame_block()` 量整體範圍時直接讀頂層實體的 OCS 座標。SMC-N01-P002 有 30 個 Ø7 圓被量到 X≈-12000 的圖面外，整體寬度被撐成 33,000，圖框（面積是第二名的 22.8 倍）的覆蓋率被稀釋成 19% 而判定失敗，剖面詳圖因此和圖框標題欄線黏成同一群。改用既有的 `_wcs_bbox_of_entity()` 後圖框正確排除。
  - SMC-N01-P002 原本是靠上述兩個座標錯誤互相抵消才通過；兩者都修正後仍通過，且推導鏈建立在正確的幾何上。

### Regression

- 49 案逐案執行 `tests/run_regression.py`，全數通過。
- CNC 模擬器 JS 版（dxf3d 4.0.0）同步：座標換算改由共用的 `web/src/core/dxf/wcs.js` 計算，49 案輸出與本版逐孔一致。
- 未新增任何案例名稱、固定座標、固定孔徑或圖層特判。

### Version

`6.73.27`

## 6.73.26 - 2026-09-29

### Fixed

- **AutoCAD 動態圖塊 visibility variant 不再被展平成多顆孔**：新增 `dxfio.dynamic_visibility`，從 INSERT 的 `AcDbBlockRepresentation`、`BLOCKVISIBILITYPARAMETER` 與 `AppDataCache` 解析保存的 current state；對 anonymous evaluated `*U...` block 則使用 DXF entity 的 `invisible` flag。這份資訊只作為 provenance，真正過濾發生在 TOP/BOTTOM marker candidate 層，因此不會因載入層刪除 hidden geometry 而破壞尺寸／視圖分群。
  - CJN38-32：同一個動態圖塊含 7 個互斥圓孔狀態，修正後只保留目前 DXF 保存的可見狀態，輸出 3 顆 TOP 孔（來源幾何量測為 Ø5.5；回歸 oracle 為 Ø5.6，差 0.1mm，在既有 ±0.2mm 驗收容差內），不靠案例名稱、固定座標或固定孔徑。

### Regression

- 第一批 5 案：CJN38-32、NKN04-01、WBN7-CP03、FWN15-AH01、PYN02-L38A，5/5 PASS。
- 第二批 5 案：TN01A-A3028RA、YCN001-BC011、TRA039-H06、TN56W-010(20260903)、YCN007-CC201，5/5 PASS。
- 單元測試：新增 `tests/unit/test_dynamic_visibility.py`，與既有 marker provenance 測試合計 8 passed。
- 不在回歸測試中一次跑完整案例集合；所有本輪 regression 均逐案執行，每批 5 案。

### Version

`6.73.26`

## 6.73.25 - 2026-09-25

### Fixed

- **圖框判定的鏡像 INSERT bbox**：`frame_filter._iter_insert_candidates()` 以 `virtual_entities()` 展開後直接讀 `get_points()`／`dxf.center`，對 X／Y scale 為負的鏡像 INSERT 會拿到 OCS 座標（擠出方向 (0,0,-1)，X 與世界座標相反），把區塊 bbox 誤算成橫跨正負兩側的巨大範圍，使真正的圖框無法以面積壓倒性勝出而未被排除。新增 `_wcs_bbox_of_entity()`，擠出方向不是 +Z 時逐點經 `ocs().to_wcs()` 轉回世界座標；純幾何座標轉換，不依賴圖層或區塊名稱。
  - TRA040-H25：修正前是「圖框沒被排除、恰好讓圖章圓不形成獨立視圖」而偶然通過；修正後圖框正確排除，仍由既有「次要視圖種子群集本身必須含 CIRCLE」規則正確排除圖章圓，結果不變但不再依賴錯誤的圖框判定。
- **側視面向的版面退路只校正弱證據**：`infer_side_view_face_from_bbox()`（detached 側視盒相對主視圖的左右排版）只是版面慣例，不是逐孔幾何證據。改為只有 FRONT/BACK 候選全部是 `SECTION VIEW CONVERSION` 弱剖面轉換時，才允許用它整批鏡射；候選已有同心群實線／隱藏線等逐孔直接證據時不覆蓋。
  - PYN73-C02：圖框正確排除後，主視圖改為真正的工件視圖，暴露此規則會把可見性拓撲判定的 FRONT Ø5.2 整批鏡射成 BACK；加上限制後回到正確答案。

### Regression

- 48 案全數通過（逐案執行 `tests/run_regression.py`）。
- 單元測試：新增 `tests/unit/test_frame_filter_mirrored_insert.py`；既有 4 項失敗（`docs/performance-baseline.json` 缺檔、OpenAPI schema、provenance、cross-view corroboration）在 6.73.24 原始封包即已存在，本版未新增失敗。
- JS 版（dxf3d 3.2.0）同步對齊本版，48 案全數通過。
- 未新增任何案例名稱、固定座標、固定孔徑或圖層特判。

### Version

`6.73.25`

## 6.73.24 - 2026-09-24

### Fixed

- 主視圖以 HATCH 表示孔位 marker、且視圖分群因 HATCH 缺少一般 bbox 未吸收該實體時，改由 marker 幾何 bbox 明確落在主材料盒內的條件補回；不依賴圖層、檔名或固定座標。
- 寬矩形樣板若由兩個共邊 quadrilateral HATCH 構成可辨識的複合錐孔，孔徑改由窄端 half-edge 的純幾何推導值取得；無法辨識 taper 時才退回原有寬軸 legacy 證據。

### Regression

- 新增 YCN006-BC003 回歸案例；6 顆 BOTTOM 孔與 oracle 完全吻合。
- 既有回歸案例與新增案例合計 48 案，正式回歸依每批 8 案執行。
- 未新增任何案例名稱、固定座標、固定孔徑或圖層特判。

### Version

`6.73.24`

## 6.73.23 - 2026-09-24

### Fixed

- FRONT/BACK marker 配對時，Y 座標不再由單一剖面 marker 的繪圖高度直接覆寫主視圖真圓心。只有當同徑的對面 marker 與對面主視圖 CIRCLE 在同一高度形成完整跨面幾何閉環時，才使用 marker 高度作為 canonical Y 證據；否則維持主視圖 CIRCLE 的實際圓心。
- 這個規則同時保留 PYN46-B51 的跨投影列偏移、TRA041-H33 的真圓心位置與 YCN007-CC201 的 0.1mm 精確值，不使用案例名稱、固定座標或固定孔徑特判。

### Regression

- 全部 47 個 regression fixture 已依要求分成 6 批執行：8/8、8/8、8/8、8/8、8/8、7/7，總計 47/47 PASS。
- 核心幾何契約與面向／多 Z 介面測試：18 passed、1 skipped。
- C3N405-1AE05：8 顆 oracle 仍完全吻合。
- 非答案額外候選仍依既有 confidence 政策處理，不因本次修正強制壓成唯一候選。

### Version

`6.73.23`

## 6.73.22 - 2026-09-24

### Fixed

- 修正完整 X-span 視圖互相正交時的 FRONT/BACK Y 軸鏡射判定：只有當另一個同截面、同 X-span 的完整投影本身沒有直接 CIRCLE（純幾何方位參考）時，才啟用 marker 高度的 Y 鏡射；若另一投影也含直接孔圓，保留既有側視排版面向語意。
- 保留跨視圖 marker 由主視圖圓列回填真實孔徑的幾何交叉證據，並允許同一 `(直徑, 高度)` 同時對應 FRONT/BACK 兩組 marker。

### Regression

- C3N405-1AE05 上傳附件：8/8 oracle 完全吻合；輸出 Ø6.5、FRONT y=-71.5、BACK y=-10.0、z=96.0。
- 第二批 5 案：NKN04-01、WBN7-CP03、FWN15-AH01、PYN02-L38A、E73-43 全部 PASS。
- FWN15-AH01 保留 12 顆 oracle 正解；額外 TOP Ø4.2×2 維持低 confidence，符合「可存在非答案孔但低信心」回歸政策。

### Version

`6.73.22`

## 6.73.21 - 2026-09-23

### Fixed

- 修正 6.73.20 的側視 marker 收緊回歸：block 展開的合法材料牆 marker 不再因來源型別被誤排除；其可信度改由材料牆相對幾何位置判斷。
- 同一個 DXF 實體若同時產生 FRONT 與 BACK marker，視為面向語意衝突並降級，不讓對稱 block／示意圖直接成為高信心面向證據。
- 保留「直接實體可使用較寬鬆的牆內側中心距離、block marker 使用較保守的牆邊相對距離」的幾何層級，避免把 NKN04 的示意 marker 與 WBN7 的真實牆面 marker 混為一談。

### Regression

- WBN7-CP03：修正 8 顆 Ø6 BACK 面向回歸，PASS。
- NKN04-01：防止對稱 block marker 再度製造高信心額外孔，PASS。
- FWN15-AH01：12/12 oracle 對應，額外候選維持低 confidence，PASS。
- 最終修正版再分 3 批各 5 案回歸，共 15/15 PASS。

### Version

`6.73.21`

## 6.73.20 - 2026-09-23

### Fixed

- 以幾何交叉證據修正同軸異徑 FRONT 孔：只有當兩徑同心特徵在至少兩個 X 位置重複，並在同一高度找到非 block 側視弱深度 marker 時，才由該 marker 決定開口面向；不再使用「大徑=FRONT、小徑=BACK」的無證據裁決。
- 同軸複合孔的小徑採材料厚度 Z 並保留完整 provenance；大徑採側視弱深度候選且附 `missing_cross_view_support`，因此錯誤／不確定的 Z 只會降低 confidence，不會把正確孔整顆丟掉。
- 完整 TOP/BOTTOM 視圖改用長邊幾何重建實際材料盒；當同徑完整視圖已直接觀測到至少兩個 X 錨點時，會覆寫同面同徑較弱的 annotation 投影，避免將標註框位置當成真正孔位。
- 保留零寬／零高 LINE 的 bbox 作為材料外框證據，避免長直邊因幾何退化被錯誤丟棄。

### Regression

- 新增 `FWN15-AH01` regression fixture，以附件 `FWN15-AH01_holes.json` 作為 oracle。
- 依 5 案一批進行多批回歸；額外候選若 confidence 低於既有自動檢查門檻，不視為回歸失敗。
- 正確的 FWN15 候選：12 顆，其中 2 顆 Ø9.2 依 oracle 為低信心；目前輸出對應正確位置，兩顆 Ø9.2 confidence 低，其他正確候選為高 confidence。

### Version

`6.73.20`

## 6.73.19 - 2026-09-23

### Fixed

- 修復 `SY2238-10` 主視圖選擇：當 X 總長 DIMENSION 的端點落在圖框／標題欄 cluster，而真正工件主視圖只差端部尺寸延伸量時，不再讓「完整包含尺寸端點」的圖框 cluster 搶走主視圖。
- 新增通用的「近似 X 跨度候選」退路：只有原候選跨度明顯偏離 X 總長時才啟用，候選需與尺寸線有足夠 X 重疊，再以 FRONT-like 幾何證據解開同跨度候選。未使用案例座標、檔名或孔徑常數。
- 新增 `SY2238-10` 主視圖選擇回歸測試。

### Regression

- `SY2238-10`: 8/8 PASS。
- 分批 5 案：`FWN01-A05B`、`PYN01-B05`、`TRA039-H06`、`WBN7-CP03`、`SY2238-10`：5/5 PASS。
- 相關單元測試：7/7 PASS。

## 6.73.18 - 2026-09-23

### 版本定位

> **同心異徑圓的面向判定改為「線型拓撲 + 獨立側視 marker」交叉推導，並阻止已消耗
> 的強證據透過孤兒 marker 路徑重生。**

- `holes/hole_classifier.py` 新增一般化 mixed-visibility 拓撲：同一圓心兩種直徑的實線／
  隱藏線可表達同一 XY 投影上的 FRONT／BACK 兩面孔；只有可見／隱藏端能與獨立面向
  證據形成一致模式時才提升，無面向證據則保留既有 construction fallback。
- 完整 hidden geometry 進入 visibility 分析，但已被剖面 marker 點名的直徑會保留既有
  marker 路徑；避免把真正對側孔誤吃成同面 construction。
- 後續 marker 配對改用 visibility 已消耗後的 CIRCLE pool；orphan marker 若投影已由
  強拓撲消耗，或與已驗證側視面向衝突，不再借用 X 重生孔。
- 新增 `FWN01-A05B` regression fixture；附件標準答案共 39 顆，座標集合與輸出 39/39
  完全相符；正確候選 confidence 最低 0.82，無 warning/review。
- 新增 mixed-visibility 與 marker-protection 單元測試；未加入檔名、固定座標、固定孔徑
  或固定倍率特判。

## 6.73.17 - 2026-09-23

- 修正極薄側視材料盒辨識：當候選盒某一方向由主視圖材料高度
  以既有相對誤差證明一致時，不再用固定的最小毫米尺寸誤擋合法薄壁斷面。
- 修正圖框 INSERT 偵測：最大 INSERT 若未在兩個方向覆蓋圖面整體的重要範圍，
  不再僅因面積壓倒第二名就排除，避免把零件側視圖圖塊誤當圖框。
- 本次沒有新增案例特判或固定座標。

## 6.73.16 - 2026-09-23

### 版本定位

> **跨視圖 construction 圓恢復改為幾何推導：詳圖 marker 先依每張圖自己的推導倍率
> 正規化，再作同心圓的跨視圖佐證；孔位 MLEADER 同時支援「工作孔」標註語法。**

- `holes/face_lookup.py` 的詳圖 marker 邊長不再直接使用放大後繪圖尺寸；每張詳圖呼叫既有 `detect_detail_view_scale()`，依尺寸線、正視圖 Y 與實際孔徑幾何交叉驗證得到倍率後，再換算回 1:1。
- `holes/face_lookup.py` 的孔位 MLEADER parser 擴充 `ØN工作孔`／`%%CN工作孔`，文字仍僅作 marker 導航，正式孔徑仍由 marker/CIRCLE 幾何交叉驗證。
- `SMC-N01-P002` 實圖回歸新增完整 68 顆 oracle；B-B／F-F 所對應的 3 顆 Ø30 與 1 顆 Ø22 construction 圓可由跨視圖幾何證據恢復。
- 沒有加入案例特定座標、檔名、圖層或固定倍率；倍率與孔徑均由圖面幾何現場推導。
- SMC 回歸同時驗證正確孔位 confidence 全數達到自動檢查門檻，且複合錐孔不重新產生 FRONT Ø11.2。

## 6.73.15 - 2026-09-22

### 版本定位

> **複合錐孔 HATCH 幾何判定修正：由兩個 quadrilateral path 的共同邊與對稱 half-edge
> 直接推導窄徑，不再把 bbox 外徑誤當成獨立孔。**

- `holes/face_lookup.py` 新增 compound taper HATCH 純幾何辨識：要求兩個四邊形
  path 共用一條邊，且共同邊兩端各形成共線、反向、近似等長的 half-edge；兩端直徑
  不同時視為 taper/countersink，正式孔徑取窄端。
- 不讀案例名稱、座標、圖層、entity handle 或孔徑字串；保留原本 LWPOLYLINE／
  單一路徑 HATCH 的 fallback 規則。
- 新增 compound taper 最小單元測試與 `SMC-N01-P002` 真實 DXF regression fixture。
- SMC targeted regression：複合錐孔的額外 `FRONT Ø11.2` 候選由 9 筆降為 0；
  本版未同時混入尚未驗證的 FRONT/BACK 與 Z 推導修正。
- 既有 42 案 regression 完成兩輪：Round 1、Round 2 均為 42/42 PASS；長時間案例於 batch timeout 後以單案例續跑。

## 6.73.14 - 2026-09-21

### 版本定位

> **回歸診斷輸出穩定性修正：NumPy scalar 不再使 regression report JSON 序列化失敗。**

- `regression_diff` 新增遞迴 JSON-safe 正規化，將 `numpy.bool_`、NumPy numeric scalar 與容器安全轉成標準 JSON 型別。
- regression runner 的 geometry／stage diff 輸出共用相同正規化，避免「孔位實際 PASS、報告器卻因序列化例外顯示 FAIL」。
- PYN02-L38A、PYN13-Z34B-20260831 等既有案例已驗證報告輸出可正常完成。
- 完整 42 案 regression：42/42 PASS。

## 6.73.13 - 2026-09-21

- 修正 NKN01 類圖面的側視圖面向：完整側視圖位於主視圖右側時判定 FRONT，位於左側時判定 BACK。
- 完整 X 跨度候選若無法直接由 Y/Z 尺寸辨識角色，改以已辨識 `REGION_PROFILE` 與孔圓的幾何關係判斷是否屬詳圖／剖面 callout；避免把詳圖圓升級成 TOP/BOTTOM，同時保留真正完整 TOP/BOTTOM 視圖的幾何 fallback。
- 新增 NKN01-VP14 回歸契約，保護側視圖左右方向與詳圖 callout 排除邏輯。

## 6.73.12 - 2026-09-21

### 版本定位

> **面向座標軸語意安全網修正：TOP/BOTTOM 的輸出 y 屬於工件 Z 軸，不能以
> FRONT/BACK 所使用的工件 Y 寬度做最終合法範圍裁切。**

- 候選最終裁決新增 face-specific `y_limit`：`FRONT/BACK` 使用工件 Y 尺寸，
  `TOP/BOTTOM` 使用工件 Z 尺寸；未提供 Z limit 時維持既有呼叫相容性。
- NKN04-01 揭露的疊合 marker + 無數量尾碼 MLEADER 案例納入正式 regression fixture。
  MLEADER 只作幾何 marker ownership 的導航，孔數仍由主視圖 X × 側視圖 Y 的實際 marker
  交叉投影決定。
- NKN04-01 驗證結果：8 顆孔全部通過（BOTTOM Ø7 ×4、FRONT Ø11 ×4）。

## 6.73.11 - 2026-09-21

### 版本定位

> **GUI 高亮改以「面向 frame 原點 + 該面向 XYZ 座標投影」為唯一逐孔定位邏輯。**

- `FRONT/BACK` pattern matcher 僅處理 `FRONT/BACK`；`TOP/BOTTOM` 不再進入同一個
  `(X,Y)` matcher，避免因 X 排列相同而把 BOTTOM 錨點誤配到 FRONT 圓列。
- `TOP/BOTTOM` 由主視圖 marker 或 `(X,Z)` 幾何建立自己的畫布 frame；frame 一旦定位，
  每顆孔只依 `origin + face(X/Y/Z) × sign` 投影，高亮不再另行猜測畫面位置。
- 未加入新的案例回歸 fixture；本次附帶 YCN002-BC006 僅作人工驗證，不納入測試資料。

## 6.73.10 - 2026-09-21

### 版本定位

> **主視圖材料盒與面向證據的幾何佐證修正：封閉外輪廓只在與獨立側視圖
> 材料高度一致時提升為 Y 的直接證據；一致的孔徑面向 marker 優先於
> 僅由側視圖排版位置推得的整體 FRONT/BACK 方位。**

- `size_analyzer` 新增通用的「完整 X 跨度封閉輪廓」量測器；它不依賴檔名、圖層、
  座標或固定孔徑。為避免巢狀／詳圖外框改變既有側視圖選擇，先沿用原本 Y
  候選完成 `find_side_view()`，再只有在封閉外框高度與獨立側視圖材料高度一致
  時覆蓋原水平線結果。
- `front_back_stage.reconcile_uniform_front_back_orientation()` 接受已通過上游
  幾何掃描的 face markers；當與候選孔徑相符的 marker 面向一致時，保留該直接面向
  證據，不再被僅由側視圖左右位置推得的整批鏡射覆蓋；marker 互相衝突時仍不搶裁決。
- 新增 `YCN006-BC005` 真實 DXF + oracle 回歸與封閉斜邊材料盒單元契約，並保留
  `TN02-2041A` 作為巢狀外框副作用回歸。

## 6.73.9 - 2026-09-18

### 版本定位

> **GUI 高亮全面改為座標驅動：孔位的畫面位置由分析座標與圖面可見幾何的
> 相對關係推導，不再讓 provenance / entity handle 決定要高亮哪一個圖元。**

- `normalized_highlight_records()` 移除 provenance entity 作為高亮座標來源；provenance 僅保留給證據追溯與人工檢查。
- `TOP/BOTTOM` 主視圖優先使用實際 marker 的座標；marker 不足時，以 `X,Z` 的整組座標樣式匹配 normalized.dxf 可見圓心。
- 坐標 fallback 不以孔徑作候選硬過濾，避免圖面符號直徑與分析孔徑略有差異時遺失可見座標證據。
- 新增 PYN13-Z14B 與 N13-S06 GUI 回歸，明確驗證高亮不得依賴 provenance entity 身分。

## 6.73.8 - 2026-09-18

### 版本定位

> **四個歷史回歸案例修復：主視圖 marker、重複邊緣列與跨視圖弱證據分離，
> 只用圖面幾何決定候選是否存在；證據不足時降低 confidence，而不是直接丟棄主視圖候選。**

- `wide_marker_top_bottom`：主視圖 marker 在材料盒內但無法唯一判定 TOP/BOTTOM 時，仍保留由剖面樣板提供的候選；只有取得唯一面向證據時才做 face filter。材料盒外 marker 才直接排除。
- `repeated_edge_marker_row`：正方形 marker 不具貼邊方向資訊，因此不再僅靠重複排列與 DIMENSION 推導 TOP/BOTTOM；保留不等距列必須由相鄰 gap 尺寸自行證明的幾何規則。
- `YCN001-BC011`：主視圖存在但沒有斷面佐證的 BOTTOM Ø20 保留為低信心候選，標記 `missing_cross_view_support`，不得自動接受。
- 新增 `NTN007-622A`、`TN108-B256A`、`WBN2-C215`、`YCN001-BC011` 完整 oracle 回歸，並保留 `PYN13-Z14B-20260831` 附件回歸。

## 6.73.7 - 2026-09-18

### 版本定位

> **不等距孔列與跨視圖樣板證據收斂修正：改以圖面自身尺寸／象限幾何決定孔列、面向與偏移，不再用同孔徑把 TOP/BOTTOM 樣板套到所有 X。**

- `repeated_edge_marker_row` 支援不等距 marker 列，但要求每個相鄰 X gap 都有直接 DIMENSION 證明；不靠案例座標或固定拓撲。
- 邊緣偏移 DIMENSION 必須同時連到 marker 與對應材料盒邊，避免 marker 附近的其它尺寸搶走證據。
- 重複列 Z 優先採主視圖 marker 的實際幾何深度；完整樣板高度僅作 fallback。
- `wide_marker_top_bottom` 先以主視圖材料盒象限判定 marker 面向，再只套用相同 face 的剖面樣板；TOP／BOTTOM 證據可互補合併。
- 新增 `PYN13-Z14B-20260831` 附件回歸 fixture 與單元幾何契約測試。

## 6.73.6 - 2026-09-18

### 版本定位

> **跨視圖幾何佐證小版本修正：不再要求垂直剖面線必須跨越整個材料高度，改以 marker 與獨立幾何的實際相交關係判定支持。**

- `wide_marker_top_bottom` 新增結構化 `FrontViewMarker`，保留 marker bbox 供後續幾何判定使用。
- 短垂直中心線只要在幾何上進入 marker bbox，即可成為跨視圖剖面位置證據；不讀 DXF 文字、圖層、block 名稱或案例資料。
- 沒有獨立跨視圖幾何支持的寬矩形候選仍可保留，但附加 `missing_cross_view_support`，confidence 降低，GUI 不自動勾選。
- 新增真實 `YCN001-BC011` confidence regression，鎖定缺少斷面幾何支持的額外候選維持低信心；`NTN007-622A` 驗證短中心線不能被誤判為無支持。

## 6.73.5 - 2026-09-18

### 版本定位

> **API／GUI assessment 一致性小版本修正：GUI 直接沿用分析階段已計算完成的
> status、confidence、warnings，避免重新建立不完整 provenance 時讓同一候選的
> review 判定發生分裂。**

- `gui.review.assess_hole()` 收到已含 `assessment` 的 API/export row 時，直接以
  序列化 assessment 作為 GUI review 狀態的權威來源；不再只靠頂層欄位重新建構 evidence。
- 沒有 `assessment` 的舊版／人工 JSON 仍保留原本 domain fallback。
- 新增 E73-43 真實 fixture 的跨介面一致性 regression，鎖定 `accepted / 0.7`
  不得在 GUI 重新評估時變成 REVIEW。

## 6.73.5 - 2026-09-18

### 版本定位

> **GUI／API assessment 一致性小版本修正：GUI 優先使用分析階段已計算完成的
> assessment，避免因重新建構 JSON row 而遺失 provenance，造成同一候選在 API 與 GUI
> 出現不同 confidence／review 狀態。**

- `gui.review.assess_hole()` 若收到 API/export row 已帶有 `assessment`，直接沿用
  domain 已計算的 `status`、`confidence`、`warnings`，不再用頂層 note 重建 evidence。
- 舊版／人工建立、沒有 `assessment` 的 JSON 仍保留原本 domain fallback。
- 新增跨介面 regression：E73-43 的 `accepted / 0.7` 必須在 GUI 保持可自動勾選。

## 6.73.4 - 2026-09-18

### 版本定位

> **confidence／evidence 分類小版本修正：讓證據衝突候選真正降為低信心，
> 同時避免合法的幾何補充說明使正確候選意外退回 FALLBACK。**

- `result_domain._confidence_for()` 新增通用風險扣分：evidence conflict、未解決裁決、
  欄位來源缺失與幾何異常會降低 confidence；不依案例、座標或固定孔徑。
- 純資訊性的 `deterministic_tie_break`／`merge_within_tolerance` 不再單獨把候選
  升級成 REVIEW；真正風險仍會進人工複核。
- `NO CONVERSION` evidence 改依穩定幾何語意 token 分類，而非要求完整括號文字
  精確相等；例如 `完整異徑同心孔網格：較大徑近側開口` 仍維持
  `SECTION_TEMPLATE`。
- TN56W-010(20260903) 的 8 顆正確 FRONT 孔由 `0.55 / REVIEW` 恢復為
  `0.85 / ACCEPTED`；WBN2-C215、WBN4-C019R、WBN7-CP03 維持既有正確答案。
- 新增 conflict confidence 與 semantic suffix regression 單元測試。

## 6.73.3 - 2026-09-18

### 版本定位

> **confidence／provenance 小版本修正：讓既有幾何可見性拓撲正確反映為可接受
> 的證據等級，避免正確候選因 note 後綴解析遺失而被誤標成低信心。**

- 新增 `VISIBILITY_TOPOLOGY` 證據等級，介於一般幾何與明確 FRONT marker
  之間；同心孔群的實線／隱藏線可見性與 construction 圖元排除屬於可追溯
  的幾何拓撲證據，不再一律落入弱證據。
- `NO CONVERSION（…）` 的量測欄位判定改用完整 raw note，不再因 evidence
  rule 為了穩定比較而移除括號後綴後，錯失該規則的實際量測語意。
- 因此 WBN2-C215 的正確 BACK Ø4.3 候選由 `0.32 / REVIEW` 提升為
  `0.70 / ACCEPTED`；沒有使用案例名稱、固定座標或固定孔徑。
- README 版本標題與目前版本摘要同步。

## 6.73.2

- GUI 新增共用的信心度自動勾選門檻，低信心候選預設不勾選。
- 保留 domain REVIEW 警告作為自動輸出的安全閘門，避免高分但有明確風險的候選被靜默輸出。
- 回歸測試與 GUI 共用同一個信心度門檻設定，避免測試策略與實際介面分歧。

## 6.73.1 - 2026-09-18

### 版本定位

> **側視剖面證據鏈小版本修正：補齊獨立側視來源、保留隱藏線真孔證據，
> 同時阻止 ByBlock 示意圓被跨視圖佐證誤升格；並修正 WBN2 詳圖倍率與巢狀
> 圖塊 marker 的幾何證據路徑。**

#### 1. FRONT/BACK 側視 marker 支援獨立側視來源

側視材料盒不再只接受內嵌於主視圖的來源；若幾何已證明其為完整的獨立
`adjacent_cluster` 或 `detached_region` 側視材料盒，且 marker 能與主視圖
孔徑與高度建立交叉對應，即可進入正式 FRONT/BACK 證據鏈。

這修正 WBN7-CP03 的 Ø6.0 / Ø5.5 側視證據遺失問題，其中正確 Z 分別為
54.0 / 52.0；同時避免把無法交叉驗證的結構標記直接升格為高信心候選。

#### 2. 側視 DIMENSION 證據可直接提供局部 Z 深度

當側視材料盒存在與物理 Z 軸跨度一致的 DIMENSION，且實際量測值明確小於
圖上跨度時，使用 DXF DIMENSION 的實際量測值作為局部加工深度證據；多筆
尺寸必須彼此一致才採用。

這讓 WBN4-C019R 可由圖面自身 DIMENSION 與側視 marker 推導正確的 FRONT/BACK
與 Z，而不依賴固定座標或案例名稱。

#### 3. 跨視圖恢復 construction CIRCLE 時保留 ByBlock 示意語意

側視 marker 可以把因隱藏線／DASHED 語意而從一般圓孔池排除的真孔重新帶回，
但 **ByBlock** 仍視為圖塊示意內容，不因跨視圖孔徑／高度巧合就恢復成正式孔。

此條件修正 NTN007-F11-1 的回歸，且不影響 WBN4-C019R 的 DASHED Ø22 真孔。

#### 4. WBN2-C215 的巢狀 marker 與詳圖倍率證據

修正巢狀圖塊統計時將父層真實 marker 與子圖塊裝飾圖例混在一起的問題；
並新增由詳圖多筆一致 DIMENSION 自行證明 2:1 倍率的獨立路徑，使材料 profile
未涵蓋完整詳圖高度時仍能正確取得 BOTTOM Ø4.3 的 Y/Z。

WBN2-C215、WBN7-CP03、WBN4-C019R 均已透過單案例 regression 驗證。

## 6.73.0 - 2026-09-17

### 版本定位

> **新增回歸案例 `YCN001-BC011`（16 顆孔）：修正量測整合階段用較弱重算
> 結果整批覆蓋既有強 BOTTOM 證據的問題，並修正跨視圖 marker 配對合併時
> 同 X、同孔徑但不同 Y 的孔互相覆蓋的問題。**

#### 1. `measurement_stage.py` 用較弱的重算結果整批覆蓋既有強 BOTTOM 證據

TOP/BOTTOM 推導階段已經由直接證據（例如剖面詳圖的直接 CIRCLE、或跨視圖
marker 逐孔配對）算出正確的 BOTTOM 孔位，但緊接著的量測整合階段
（`measurement_stage.py`）又會獨立呼叫較弱的 fallback 重新算一次
BOTTOM；舊版判斷「既有 BOTTOM 是否已有強證據」時只認 note 字首
「GEOMETRIC SECTION TEMPLATE」，只要既有證據換了個字首（例如
`SECTION VIEW CONVERSION`、`CROSS-VIEW MARKER PAIRING`），就會被誤判為
「沒有強證據」而整批刪除，換成較弱 fallback 算錯的結果。

`YCN001-BC011` 的 D-D 剖面兩顆不同高度的 Ø4.3 孔就是這樣被換成量錯位置
與孔徑的 `QUADRANT BOX FEATURE EXTENT` 候選。

修正時發現這個判斷不能只靠 `evidence_model.classify_evidence()` 的等級
一刀切：同屬 `SECTION_TEMPLATE` 等級的 `DETACHED TAB MARKER EVIDENCE`
規則，其產生路徑自身已明確自我標註「此幾何路徑驗證樣本有限，請人工
複核」，可信度低於同等級的其他規則；`TN56W-010(20260903)` 既有的錯誤
BOTTOM 候選正好是這條規則算出的（Y 超出工件座標範圍），套用寬鬆等級
判斷會誤擋正確的重算結果。另外，量測整合階段的第二個「強證據」檢查點
（`_replace_bottom_projection` 前）本身已經對每一顆候選做逐孔 ownership
比對，不需要、也不應該套用同一套寬鬆等級判斷——`TRA039-H06` 既有的
`SECTION VIEW CONVERSION`（等級甚至更高）候選本身是錯的（Y 值混雜了
其他 Z 高度剖面的候選），若在這個檢查點也套用寬鬆等級判斷會擋下正確的
逐孔取代。

修正：拆成兩個獨立判斷函式對應量測整合階段的兩個不同檢查點——
`_has_strong_bottom_geometry()`（整批覆蓋前，套用 `SECTION_TEMPLATE`
等級但排除 `DETACHED TAB MARKER EVIDENCE`）與
`_has_geometric_section_template_bottom()`（`_replace_bottom_projection`
前，維持原本只認 `GEOMETRIC SECTION TEMPLATE` 字首的窄判斷）。

#### 2. `cross_view_marker_pairing.merge_paired_holes()` 同 X、同孔徑但不同 Y 的兩顆孔互相覆蓋

跨視圖 marker 逐孔配對（`pair_top_bottom_markers()`）對同一 X 位置、
同孔徑但高度（Y）不同的兩顆獨立孔，各自都能唯一配對成功，但舊版
`merge_paired_holes()` 只用 `(face, diameter, x)` 當唯一鍵，找到第一個
鍵相符的既有候選就覆寫，兩個配對結果搶同一個既有候選，其中一顆的配對
證據就此消失。

修正：改用「鍵相符的既有候選有幾個」判斷同一顆孔，而非「Y 差距多少」
（Y 差距本身在合理範圍內可以很大，例如既有粗估與配對精算相差 6mm 以上
仍是同一顆孔的更新）——只有一個鍵相符的既有候選時，不論 Y 差多少都是
同一顆孔的更新；有多個時才用「Y 最接近」分配，且每個既有候選只能被
消耗一次，避免兩個配對結果搶同一個既有候選。

#### 3. 已知、接受的限制：`YCN001-BC011` 的 C-C 斷面長圓孔誤判為 BOTTOM Ø20

`wide_marker_top_bottom.py` 的「無真圓可查」legacy 寬矩形樣板規則，會把
C-C 斷面裡實際是長圓孔（oblong hole，本專案尚未支援辨識）的 20×3 標記
誤判成 `BOTTOM Ø20`。調查後發現用「`real_diameters` 是否為空」區分無法
成立——會連帶壞掉 `NTN007-622A` 的螺絲孔道辨識（結構上與此案例的長圓孔
在目前可取得的幾何訊號上完全無法區分）。經使用者確認此為專案目前辨識
範圍之外的案例，維持已知限制，不影響其它 15 顆孔的正確性。詳見
`tests/fixtures/regression/YCN001-BC011/NOTE.md`。

#### 驗證

- 全部 35 個回歸案例（`tests/run_regression.py`，逐一執行）：除
  `YCN001-BC011` 上述第 3 點已知限制外，全數通過，含本次新增與本次
  修正涉及的 `TN56W-010(20260903)`、`TRA039-H06`、`NTN007-622A`、
  `YCN001-BC011`。
- `pytest tests/unit tests/regression tests/service`：280 passed, 1 skipped，
  無回歸。

## 6.72.0 - 2026-09-16

### 版本定位

> **新增回歸案例 `TRA040-H25`（56 顆孔）：修正 GUI 預覽漏畫 REGION 剖面，
> 並打通「2:1 剖面詳圖對管線不可見」等四個真實推導盲點。**

#### 1. GUI 圖形顯示不完全（本輪的主要修正目標）

`ezdxf` 的 matplotlib 前端一律跳過 REGION（`skipped entity REGION: unsupported`），
因此預覽另外用專案自己的 ACIS 解析器補畫輪廓。但補畫的來源只有
`get_all_wcs_entities()`，而它**只在展開 INSERT 的路徑上**把 REGION 轉成
輪廓，直接放在 Modelspace 的頂層 REGION 原樣回傳、不會被轉換
（見 `dxf_loader.get_all_wcs_entities`）。兩者相加的結果就是「圖上有、
預覽沒有」：`TRA040-H25` 的 14 個頂層 REGION（11 張剖面詳圖的斷面
＋端部斷面）在預覽裡整批消失，只剩尺寸線與標註。

此外，`extract_region_profile()` 只保留面積最大的一圈（量測只需要材料
外輪廓），預覽沿用同一份資料，於是鋁擠型斷面的中空腔室、卡榫凹槽全部
沒有畫出來，剖面變成一塊實心剪影。

修正：
- `RegionProfileEntity` 新增 `outline_loops`，保留該 REGION 的**全部**封閉
  迴圈（量測仍只用 `profile_points`＝最大圈，分析行為完全不變）。
- `gui/render.py` 自己補上頂層 REGION 的轉換，並改為畫出每一個迴圈。
- 修正後「平移後圖面」與原始 DXF 的繪製內容完全一致（同為 590 條輪廓線，
  修正前分別是 571／557）。

#### 2. 2:1 剖面詳圖對整個管線不可見

`load_analysis_entities()` 把頂層 REGION 納入分析的入場條件寫死
「輪廓高度必須等於主視圖材料高度」，也就是只認 1:1 詳圖。`TRA040-H25`
的 11 張詳圖都標示 2:1（斷面高 476＝2×238），因此完全進不了分析；面向與
深度失去唯一的直接證據來源，`Ø13`／`Ø7` 被誤判成正面孔、`Ø6.5`／`Ø20`／
`Ø22` 的 Z 全部退回材料總厚。

修正：入場條件改認整數倍率（`_detail_height_magnification`，1~5 倍），
並要求**放大的斷面必須同尺寸重複出現**才採用
（`_repeated_magnified_profiles`）。重複性是本專案既有的材料盒判準
（README §2.1）。這條限制由實測反證支撐：`TN56W-010(20260903)` 只有單獨
一個 4:1 的 280×634 REGION，把它當詳圖會讓已驗證正確的 4 顆 `Ø7 FRONT`
被翻成 `BACK`。

#### 3. 同心群的建構線訊號要逐個判斷鑑別力

`_classify_concentric_groups()` 原本先把「`color=0`（ByBlock）」與
「非 CONTINUOUS 線型」OR 成一個布林值，再看群內是否有鑑別力。
`TRA040-H25` 的同心群是「`Ø4.3` 畫在 HIDDEN 圖層（背面真孔）＋ 同心的
`Ø9.5` 是 ByBlock 示意圓」，OR 之後整群都有訊號、看起來沒有鑑別力，
兩顆都被保留，於是多出 12 顆根本不存在的 `Ø9.5` 孔。

修正：改為**逐個訊號**判斷，`byblock` 優先。兩種訊號的製圖語意不同——
隱藏線常用來畫「這個視角看不到但確實存在」的真孔（NTN007-622A），
ByBlock 則是圖塊的示意內容。群內只有 `Ø9.5` 帶著 `byblock`，該訊號在
這群裡有鑑別力，示意圓因此被正確排除、HIDDEN 真孔保留。
（此 12 筆已由使用者確認為示意圓，oracle 亦同步移除。）

#### 4. 被相鄰幾何裁切的剖面標記

D-D 斷面裡貼著上緣的 `Ø20` 沉頭孔標記被凸緣裁掉一小段，2:1 圖面畫成
38.41（換算 19.2）而非 40（換算 20）。差 0.8mm 超過固定的 0.3mm 孔徑容差，
整個標記被丟棄，那 4 顆孔拿不到剖面 Z。

修正：孔徑比對在標準容差對不上時，允許放寬到「該候選孔徑 × 5%」，但
**只有主視圖真的有同孔徑、同高度的圓可以佐證時**才生效
（`_quadrant_from_corroborated_circle`）。同時 marker 的孔徑改採「盒子
象限法已比對成立的真實孔徑」，而不是標記量到的原始尺寸。

**刻意不採用「直接把容差放大」**：實測 `N201-BH001.dxf` 斷面正中央有一個
尺寸接近 `Ø15` 的型材中空腔室，單純放寬會讓它被認成標記，憑空多出 2 顆
`BACK Ø15` 孔；差別就在於主視圖有沒有對應的真圓。容差基準也必須是「候選
孔徑本身」而不是全圖最大孔徑——`TRA040-H25` 有一個 `Ø329.7` 的隱藏線輔助
圓，以它為基準會把容差放大到十幾 mm，連寬度方向都對得上。

#### 5. 其它

- 修正 v6.71.0 既有的失敗單元測試
  `test_batch_edit_arithmetic_expression_applies_to_selected_hole`：算式
  `2 * 3 + 4` 在 Python 端就被算成 10、根本沒走過解析器，而 10 又剛好等於
  該孔目前的 X，批次層正確判定「沒有變更」。改為以字串算式走
  `parse_batch_input()`，並用會真正改變數值的輸入。
- 新增 `tests/fixtures/regression/TRA040-H25`（56 顆孔）與其 `NOTE.md`。
- 新增 7 則單元測試：整數倍率入場、放大斷面的重複性要求、ByBlock／HIDDEN
  同心群的訊號鑑別力、被裁切標記的跨視圖佐證、REGION 全迴圈保留、
  頂層 REGION 預覽繪製，以及 GUI 字面 message key 的翻譯覆蓋。

#### 6. 驗證

分批執行全部 35 個 DXF regression 全數通過、`tests/unit`／`tests/regression`／
`tests/service` 275 passed 1 skipped、`test_contracts.py -k case_hardcodes`
與 `--quadrant` 契約測試通過。

## 6.71.0

- GUI 批次修改孔位支援四則運算式。
- 新增「絕對值／相對值」模式：絕對值直接設定；相對值以目前數值加上輸入結果。
- 補全本次 GUI 顯示文字、狀態訊息與相關日誌訊息的 i18n。


## 6.71.0

- PYN73-C02 的 FRONT 孔徑改為嚴格保留 DXF 幾何實測值：`Ø5.2` 輸出 `5.2`，不再依 `M5` 公稱規格改寫為 `5.0`。
- 移除 `tests/fixtures/supporting` 專用的測試與測試路徑 helper；既有 supporting 檔案不作為回歸 oracle。
## 6.70.1 - 2026-09-16

### PYN73-C02 孔位辨識修正

- 修正主視圖「實線真孔 + 隱藏建構圈」的混合同心孔在進入面向分類前，
  因 construction 圓被過濾而失去完整幾何證據的問題。
- 對重複出現的混合同心群，使用非 construction 圓的線型判定 FRONT/BACK，
  並以最小實線孔徑收斂為單一真孔。
- 整合既有的 `M<number>` 公稱規格解析：PYN73 的圖面標註「配M5沉頭釘孔」
  可將繪圖實徑 Ø5.2 正規化為公稱 Ø5.0；沒有寫死 `5.0` 常數。
- 新增 PYN73-C02 回歸案例，預期恢復 2 顆 FRONT M5 沉頭孔，連同原有 4 顆 TOP 孔共 6 顆。
- CLI / 回歸測試保留實際幾何 Z=69.9；fixture 以既有容差接受標稱 70.0。

## 6.70.0 - 2026-09-16

### 版本定位

> **GUI：新增多選批次修改；孔位高亮改由「盒子座標」即時投影，修改 X/Y/Z
> 或面向後會立刻跟著移動；輸出功能不再被「沒有勾選孔位」擋住。**

本輪只動 GUI 與其顯示邏輯，幾何推導核心（孔位 face/diameter/x/y/z 的判定）
完全沒有改動；33 個 DXF 回歸案例輸出逐筆不變。

#### 1. 多選批次修改（`gui/batch_edit.py`、`gui/batch_edit_dialog.py`）

表格支援多選後，新增「批次修改孔位…」（編輯選單、表格右鍵選單、`Ctrl+B`）。
彈窗有面向（下拉，預設空白）與孔徑／X／Y／Z（輸入框）：

- **空白＝不修改**，有值才寫入。整批只產生一個復原節點，按一次 `Ctrl+Z`
  就還原整批。
- **套用對象**：優先套用到表格裡反白選取的列；完全沒有反白時，才退回
  所有已勾選（會輸出）的孔位。
- **面向換成成對面向**（FRONT↔BACK／TOP↔BOTTOM）時，沿用既有的
  「面向 Y 轉換」開關決定 Y 要不要鏡射；但使用者若在彈窗裡也填了 Y，
  一律以填寫的值為準。
- 填的值與現值相同時不產生修改紀錄，避免假的人工修正事件混進
  correction fixture。
- 規則層（`batch_edit.py`）與 Qt 彈窗分離，因此批次修改的語意可以在沒有
  顯示環境的情況下單獨測試；寫入路徑與單格編輯共用同一個
  `_apply_review_modify()`，兩者產生的複核紀錄格式保證一致。

#### 2. 高亮改由盒子座標即時投影（`gui/highlight.py`）

以前「平移後圖面」的高亮固定畫在分析當下解析出來的錨點上，人工改了
X/Y/Z 之後高亮還停在原位；改完再重建快取又會拿被改過的數值回去比對原圖
幾何，反而配到別的圖元。

現在依使用者指定的模型處理：**每顆孔都對應一個盒子，X/Y/Z 是「從盒子原點
量出去的距離」**。分析完成時建立一次「盒子原點＋軸向」快取，之後每次
選取／修改都只做一次座標換算，不再重新掃描 DXF：

- X 一律依圖面（畫布 X ＝ 孔位 X，33 個案例實測一致）。
- FRONT/BACK 的畫布第二軸用孔位 **Y**；BACK 量自下緣（已鏡射），因此軸向
  相反。TOP/BOTTOM 用孔位 **Z**（Y 是厚度方向，平面看不出來，不參與定位）。
- 軸向優先由圖面實測推導（同面向兩顆以上不同數值時，由相對位移求得）；
  圖面沒有提供變化量時，才採盒子慣例（見 `_DEFAULT_Y_SIGN` 的說明：實測
  33 個案例，FRONT 恆為 +、BACK 恆為 −，而 TOP/BOTTOM 每張圖的同面向孔 Z
  值全部相同，圖面從未提供過斜率證據）。
- **面向轉換就是把工件轉個角度**：盒子沒變，只是換一邊量。改成別的面向時
  投影到目標面向的盒子；圖面完全沒有該面向時，由配對面向的盒子推導
  （`HighlightBoxTransform.paired()`）；連配對面向都沒有時，高亮留在原位，
  不亂猜。
- 未被人工修改的孔位，投影結果與分析當下完全相同（原點是由該孔自己的
  錨點反推，既有 `NKN01-VP14` 契約測試保護 7 顆孔逐一在 0.2mm 內）。
- 「孔位示意圖」（section_view_debug）維持原本行為不變。

#### 3. 輸出不再被「沒有勾選孔位」擋住

使用者回報：整張圖的孔位信心度都不足時全部預設不勾選，人工修正完卻發現
「一鍵輸出 V2」與「重新輸出」都是灰的，改好的版本反而輸不出來。

- 兩個輸出動作的啟用條件改為「有分析結果」，不再要求至少勾選一顆孔
  （`_set_busy()` 裡同樣的舊條件也一併修掉，否則分析一結束又會被關回去）。
- 有孔位但一顆都沒勾選時，輸出前明確詢問「要輸出全部 N 顆嗎？」，
  不靜默輸出空檔案；圖面本來就沒有孔時直接輸出（0 顆是合法結果）。

#### 4. 驗證

新增 `tests/unit/test_batch_edit.py`（13 項批次規則契約）與
`tests/unit/test_gui_window_batch.py`（8 項視窗層契約，缺 PySide6 時自動
跳過），並在 `tests/unit/test_gui.py` 補上盒子投影（跟隨修改、面向切換、
配對面推導、推不出來留在原位）與「GUI 每個字面 message key 都要有翻譯」
的契約測試。離屏（offscreen）實際驅動 MainWindow 跑過 `TN01A-A3028RA`
與 `YCN043-Y003` 兩張圖，確認批次修改、高亮跟隨、面向切換與輸出流程。
分批執行全部 33 個 DXF regression 全數通過（輸出逐筆不變）、
`tests/unit`/`tests/regression`/`tests/service` 269 passed 1 skipped、
`test_contracts.py -k case_hardcodes` 與 `--quadrant` 契約測試通過。

## 6.69.5 - 2026-09-15

### 版本定位

> **新增回歸案例 `TN01A-A3028RA`：修正主視圖選擇的絕對容差 bug，並修正剖面
> marker 交叉配對／同心建構圓／孔群鏡射延伸的三個真實缺陷。**

#### 1. 主視圖選擇：絕對容差改為與寬度成比例的容差

`views/multi_view_pipeline.py` 的 `discover_view_sections()` 原本用
`DIMENSION_TOLERANCE`（0.2mm，逐筆實體的繪圖精度容差）當作「兩個候選
主視圖的 X 跨度誤差是否夠接近，可以讓 `front_like` 訊號介入裁決」的門檻。
`TN01A-A3028RA` 的真正孔位視圖跨度誤差是 52.3mm（材料總長 4265mm 的
1.2%），遠大於 0.2mm，導致這個 tiebreak 在任何實際案例裡都形同虛設——
一個完全沒有孔、跨度誤差剛好 0.0mm 的「參考／尺寸專用視圖」永遠贏過真正
畫了孔的主視圖，material box 因此整個錯置（Y/Z 對調），孔位面向全部誤判
成 TOP。

修正：新增 `PRIMARY_VIEW_OVERSHOOT_TIE_RATIO`（沿用既有的
`FULL_VIEW_PROFILE_SPAN_TOLERANCE_RATIO = 0.05`），改用「與 X 尺寸線長度
成比例」的容差視窗，不再用固定毫米數。修正後主視圖正確選到有孔的視圖，
material box 由 (Y=70, Z=166) 更正為 (Y=166, Z=70)。

#### 2. 剖面 marker 交叉配對：孤兒 marker 不再跨剖切平面污染

`holes/face_lookup.py` 的 `find_orphan_marker_holes()` 用「同孔徑＋同高度」
向已解析孔位借用 X 座標，但沒有分辨「這個已解析孔位本身是靠哪一種證據
解出來的」。`TN01A-A3028RA` 有兩組孔徑／高度剛好相同的獨立孔群：一組
（x=93/118 等）完全靠通用剖面 marker（沒有專屬剖切面 `x_position`）解出
FRONT＋BACK；另一組（x=1563/1588，主視圖圓為 `DASHEDX2` 隱藏線型）已經
由**專屬剖切面**的 marker 正確解出 BACK-only。沒有專屬剖切面的孤兒 FRONT
marker 因為高度剛好相同，借用了後者的 X，生出一個 x=1563/1588 根本不存在
的 FRONT 孔。

修正：`FrontBackHole` 新增 `source_marker_x` 欄位，記錄該孔是否來自「專屬
剖切面」的 marker。沒有專屬剖切面的孤兒 marker，只能借用「同樣沒有專屬
剖切面」的已解析孔的 X；有專屬剖切面的孤兒 marker 不受此限制。

#### 3. 同心建構圓：沒有獨立證據不再誤判為獨立孔

`holes/front_back_stage.py` 的「重複獨立孔群」fallback
（`classify_repeated_front_hole_components`）只看單一孔徑自身的幾何拓樸，
沒有檢查這顆圓是否與「已由更強證據解析出的孔」同心。`TN01A-A3028RA` 有
一組 Ø5.2／Ø10 同心圓（只有 2 個中心，未達
`classify_concentric_grid_front_holes()` 要求的 2×2＝4 個完整網格中心），
Ø5.2 已由專屬剖面 marker 證實為 FRONT 孔，Ø10 沒有任何獨立證據，但因為
兩個 Ø10 圓剛好同 Y，被「Y 均一性」規則誤判成兩顆獨立 FRONT 孔。

修正：在「重複獨立孔群」fallback 之前，先排除「圓心與已解析孔位完全重合
但直徑不同」且沒有獨立證據支持的圓，視為建構／示意圓。

#### 4. 純拓樸推導孔群的鏡射延伸

`TN01A-A3028RA` 的 x=13/53/4213/4253（距上緣 46/81/116mm，共 12 顆 BACK
孔）完全沒有專屬剖面 marker、也沒有 DIMENSION 能獨立證實背面——但同一張
圖裡，x=93/118（X 間距 40/25mm，在既有 `PAIR_ISOLATION_WINDOW` 幾何連通
窗口內）與 x=4213/4253（距上緣高度列 46/81/116mm 與 x=13/53 逐一精確
重現）都能連結到已由獨立剖面 marker 證實「同一顆主視圖圓同時是 FRONT
（原始 Y）＋BACK（鏡射 Y）」的孔群。

新增 `_extend_confirmed_mirror_to_repeated_front()`：只有當純拓樸推導出的
FRONT 孔，能透過「X 幾何連通」或「高度列完全重現」連到同一張圖裡已由
marker 證實貫通的孔群時，才補上鏡射 BACK 孔；沒有這種連結證據的孔群不受
影響。**刻意不採用「同孔徑／同 Z 就套用」這種更寬鬆的規則**——`PYN13-
Z34B(20260831)` 有一組同孔徑同 Z、但既不相鄰、高度列也完全不同的孔群
（x=370.3/400.3），正確答案是它不貫通；套用寬鬆規則會誤增 4 顆多餘 BACK
孔，也是這次開發過程中先失敗、再收斂到「連通＋同構」這兩條更嚴格條件的
真實教訓。

#### 5. 驗證

新增 `tests/fixtures/regression/TN01A-A3028RA` 回歸案例（60 顆孔，
face/diameter/x/y/z 五元組與附件標準答案完全一致）。新增 2 則
`find_orphan_marker_holes()` 的專屬剖切面錨定單元測試。分批執行全部既有
32 個 regression fixtures（含 `PYN13-Z34B(20260831)`，用來抓第 4 點鏡射
延伸規則的誤傷）、`tests/unit`、`tests/regression`、`tests/service`
（244 passed, 1 skipped）、`test_contracts.py -k case_hardcodes` 與
`--quadrant` 契約測試，全數通過。

## 6.69.4 - 2026-09-15

### 版本定位

> 修復不同剖面詳圖具有相同孔徑／高度 marker 時，剖面面向證據被全圖交叉套用的問題。

#### 1. 幾何推導修正

剖面詳圖 marker 現在保留其所屬剖切平面的 X 錨點；主視圖孔位只有在與該
section 屬於同一幾何孔群時才消費該 section 的面向證據，避免 10-10 的
FRONT marker 被另一張詳圖的 BACK marker 污染。剖切平面取自剖切符號
`INSERT.insert.x`，不使用 attribute 文字位置。

#### 2. 去重修正

marker 語義去重納入 section X，避免不同剖面的同尺寸 marker 在收集階段互相
覆蓋。

#### 3. 驗證

`TN01-A3036LA` 僅作臨時驗證，不加入 regression fixture；修正後 46/46 筆
孔位五元組與附件標準答案完全一致。另以 TN29-B103A、TN02-A3054A、
PYN64-B11 及相關 marker 單元測試做小批回歸。

## 6.69.3 - 2026-09-15

### 版本定位

> 修復同一孔徑在同一剖面中存在多個合法 Y/Z 位置時，被「直徑唯一鍵」錯誤去重而漏孔。

#### 1. 幾何推導修正

原本 `build_top_bottom_templates()` 以 `diameter` 作為唯一鍵，當一個剖面
同時存在相同孔徑但不同 Y/Z 的合法 marker 時，後續 marker 會被視為重複資料。

現在只有在 `diameter + face + Y + Z + marker geometry` 全部一致時才去重；
因此相同孔徑的多個合法孔道位置會完整保留，再由正視圖同形 marker 的 X
證據投影回正式孔位。

#### 2. 新增回歸案例

加入 `TN108-B256A`，其標準答案為 4 顆 `BOTTOM Ø5.5`，同一 X 位置各有
Y=-18 與 Y=-52 兩個合法孔位。v6.69.2 實際只輸出 2 顆，此案例因此成功
抓到原本的漏孔缺陷。

## 6.69.1 - 2026-09-15

### 版本定位

> 修復無 CIRCLE 圖面中「主視圖以兩條短豎線＋中心線表示孔」的孔位推導。
> 不再把端部裝飾／邊界標記誤當成孔；改由剖面 marker 的幾何尺寸與主視圖
> 同尺寸 tick-pair 交叉驗證，恢復 TN29-B103A 的 4 顆 BOTTOM Ø5.5 孔。

#### 1. 幾何推導

TN29-B103A 主視圖的四個孔中心由成對短豎線的間距直接形成 5.5 mm
包絡，中心位置為 X=11.5、24.5、1044.5、1057.5；剖面材料盒右緣到
剖面 marker 中心的幾何距離為 17 mm，因此 BOTTOM 的 Y 為 -17。
marker 所在列到材料盒上緣的距離為 113 mm，因此 Z=113。
所有值均由圖面幾何關係推導，不依賴案例名稱、固定座標或固定孔徑。

#### 2. 回歸 oracle

更新 TN29-B103A 標準答案為附件提供的 4 顆孔，並新增 TN02-A3054A
附件作為獨立回歸案例；TN02 的 8 顆孔保持原有正確結果。

#### 3. 驗證策略

本輪只執行受影響的 TN29-B103A 與新增 TN02-A3054A 回歸案例，以及
相關單元／契約測試；不一次執行全部 DXF regression。

## 6.69.0 - 2026-09-15

### 版本定位

> **修復 `TN56W-010(20260903)`（既有未解案例）：異徑同心孔網格樣板不再預設
> 「較小徑＝對側牆開口」，沒有 HIDDEN 線型或其它獨立證據時改與大徑同面。**

#### 1. 使用了哪個圖面幾何線索

`TN56W-010(20260903)` 的 4 個孔位（x=2070.15 / 2246.15，y=-30.155 / -120.155）
在主視圖畫成 Ø7 與 Ø22 完全同心的兩顆 CIRCLE，`linetype` 全部是
`CONTINUOUS`（無 `HIDDEN` 線型可資區分）、`color` 也同為 3（大小徑相同，
非圖層語意）。圖面另外用兩支獨立 LEADER 分別標註「4-∅22孔」「4-∅7孔」，
證實這是兩個各自 4 顆的孔位家族，不是單一 4 孔家族的正／反面標註。
剖面詳圖附近的橫向 DIMENSION（30.15 / 38.35）只重述了 Ø22 那一顆的 Y，
沒有能單獨定出 Ø7 面向的獨立證據；`front_back_stage` 也已記錄「剖面詳圖與
直接配對皆沒有足夠證據」。

#### 2. 如何建立材料盒

沿用既有工件尺寸解析（X=6075、Y=158.5，取自主視圖），與本次修正無關；
FRONT Z=70 則已由剖面局部水平 DIMENSION 直接量得（4 條尺寸線一致，
倍率 4 倍），本身正確，不在本次修正範圍內。

#### 3. 如何由盒子推導倍率與物理軸

不涉及；本次只修正 `holes/hole_classifier.py`
的 `classify_concentric_grid_front_holes()` 面向判定，不改動倍率或軸向推導。

#### 4. 如何由盒內特徵推出面向與 X/Y/Z

`classify_concentric_grid_front_holes()` 舊版邏輯：「較大徑＝近側開口
（FRONT，不轉換）；較大徑同心的較小徑＝對側開口，CNC Y 以材料總寬鏡射後
判 BACK」。這條規則只用孔徑大小與同心拓撲，沒有任何線型／圖層／剖面證據
支持「對側開口」——它其實是一個沒有根據的猜測，只是在既有 regression 案例
（`PYN64-B11`）裡剛好與答案相符。

實測 `PYN64-B11` 才發現：該案例最終輸出的 `face` 其實不是來自這條規則，
而是來自 rank 更高的 `SECTION VIEW CONVERSION`（剖面詳圖有獨立證據，
獨立算出同一組 BACK + Y 鏡射座標，覆蓋掉這裡的猜測）。也就是說，這條
規則的猜測值從未真正決定過任何一個既有案例的最終答案；`TN56W-010`
是唯一「沒有更高證據可覆蓋、猜測直接變成最終答案」的案例，而它猜錯了。

修正：沒有 HIDDEN 線型或其它獨立證據時，較小徑的面向**改為與較大徑同面**
（同面階級孔／沉頭孔＋貫穿孔是同心複合孔更常見的實務情境），Y 座標仍照
原公式以材料總寬鏡射（`-y_total + abs(local_y)`）——鏡射公式本身已經過
`PYN64-B11` 與本案例雙重驗證，數值正確，只是面向標籤原本錯誤地固定成
BACK。

#### 5. 哪些證據仍不足，以及為何不能猜

- 孔徑大小＋同心拓撲本身無法分辨「同面階級孔」與「對側貫穿孔」，兩者在
  主視圖投影完全相同。修正後的預設值（同面）一樣是猜測，只是改成證據上
  更常見、且不再與唯一一個真正依賴這條規則的案例矛盾；若圖面另有
  HIDDEN 線型（`classify_visibility_split_compound_holes`）、剖面樣板或
  跨視圖證據，rank 更高的來源仍會覆蓋掉這裡的猜測。
- 沒有找到能讓這條規則本身變成「有憑有據」而非「猜測」的圖面證據
  （沒有可用的 HIDDEN 線型、沒有可用的剖面樣板）；因此仍標記為
  `EvidenceRank`（fallback／geometric 等級，不提升到 SECTION_TEMPLATE 以上），
  保留「日後有更好證據時仍可被覆蓋」的空間。

#### 6. 本輪跑哪些 regression

`tests/unit` + `tests/regression`：223 passed、1 skipped（含新修的 2 個
`test_concentric_grid_*` 單元測試，改成驗證「無獨立證據時同面」而非舊有的
「預設對側牆」）。`tests/service`：16 passed。契約測試
`test_contracts.py -k case_hardcodes`：1 passed。`--quadrant` 契約測試：PASS。
DXF regression 分 3 批逐案執行，28 個案例（含 `YCN043-Y003`）**全數 PASS**，
`TN56W-010(20260903)` 不再是既有未解案例；順帶確認 `YCN007-CC201` 從
v6.67.0 基準起就是通過的，並非另一個未解案例。

## 6.68.0 - 2026-09-15

### 版本定位

> **主視圖孔位矩形與剖面詳圖標記逐孔配對，讓「主視圖沒畫圓」的孔也拿得到孔徑與座標；
> 並讓剖面直接量到的孔深不再被材料盒總厚蓋掉。**

#### 1. 使用了哪個圖面幾何線索

YCN043-Y003：主視圖（1280 × 71.7，1:1）在材料盒內畫出孔位矩形，
圖面另有 A-A ~ E-E 五張 3 倍剖面詳圖。實測發現：**主視圖矩形與剖面標記
「距材料上緣的距離」完全相同**（28.2 / 46.7），代表這張圖的主視圖矩形畫在
真實面向軸位置，不是示意位置。

#### 2. 如何由線索建立材料盒

剖面詳圖倍率＝「詳圖材料輪廓高度 ÷ 主視圖材料高度」＝215.1 / 71.7 = 3；
主視圖材料盒由已解析的工件尺寸與 CNC 原點建立，兩者都不用尺寸線反推。

#### 3. 如何由盒子推導倍率與物理軸

主視圖的水平軸必為工件長度 X，這是視圖定義而非推測。因此主視圖矩形的
**水平寬度就是孔徑**、垂直範圍就是該孔在面向軸上的位置——尺寸軸不需要靠
比對已知孔徑去猜。

#### 4. 如何由盒內特徵推出面向與 X/Y/Z

新增 `holes/cross_view_marker_pairing.py`。剖面標記換算回 1:1 後，若寬、高
與某個主視圖矩形都相同、且距各自材料盒上緣的距離也相同，兩者就是同一顆孔的
兩個正投影。配對成立後座標全部由剖面盒量出：

- `face`：盒子象限法（標記中心在剖面盒上半＝TOP、下半＝BOTTOM）。
- `y`：TOP 量到盒左緣、BOTTOM 量到盒右緣（沿用既有鏡射慣例）。
- `z`：Near-End → Far-Edge。
- `x` 與孔徑：取自 1:1 主視圖矩形。

同一套配對也用在 FRONT/BACK：主視圖 CIRCLE 與剖面橫向標記若孔徑與高度都
唯一對上，該孔的 `z` 改採「近端→對側盒緣」的直接量測
（`hole_pipeline` 在 FRONT/BACK stage 之後套用 `apply_front_back_z()`）。

#### 5. 哪些證據仍不足，以及為何不能猜

- **主視圖矩形若畫在示意位置**，距上緣距離對不上剖面，配對直接退場，
  交回既有證據鏈——這是本路徑不會污染其它圖面的關鍵。
- **圖面另有完整 X 跨度的 TOP/BOTTOM 視圖並直接畫出圓孔時**（N13-S06），
  那些圓才是最直接的孔位身份與 GUI 顯示錨點，配對不介入。
- **BOTTOM 的 Y 基準有兩個候選時不猜**：型材斷面可能量到輪廓內部的結構牆
  （PYN13-Z26A），也可能量到外框右緣（NTN007-622A）。
  `find_internal_section_far_edge()` 找到的內部結構邊若與外框右緣不同，
  代表跨視圖配對本身沒有資訊能分辨，整顆孔交回既有證據鏈。
- 合併規則保守：既有候選與配對數值一致時原樣保留（保住指向真實 CIRCLE 的
  provenance），只有數值不一致才取代，沒有的才新增。

#### 6. 本輪跑哪些 regression

`tests/unit`（216）＋ `tests/regression`（7）全數通過；DXF regression 分 7 批
逐案執行，28 個既有案例全數 PASS，唯一失敗的 `TN56W-010(20260903)` 經與
原始 6.67.0 套件比對為**既有失敗**（差異內容完全相同），非本次造成。
新增 `YCN043-Y003` 案例並 PASS。

### 本次修正的三個缺陷（YCN043-Y003）

| 現象 | 根因 | 修正 |
|------|------|------|
| Ø14 通孔（x=250、1030）整顆消失 | `classify_face_by_box_quadrant()` 判尺寸軸時，`real_diameters` 只來自主視圖 CIRCLE；Ø14 在主視圖只畫矩形，對不上任何已知孔徑 | 改由跨視圖配對直接鎖定尺寸軸，不再依賴孔徑表 |
| Ø4 引孔的 `y` 取到 −28.2（主視圖矩形的世界 Y） | 同上落空後退到 `QUADRANT BOX OBLIQUE HOLE MEASUREMENT`，該路徑用主視圖盒量 Y，量到的是面向軸位置而非剖面橫向位置 | 配對後由剖面盒左緣量得 −35.3；斜孔量測因 Y 不一致而自動讓位 |
| FRONT 注膠孔 `z` 取到 66（材料總厚） | `_infer_front_z_from_section_geometry()` 與側視材料盒提升都會把 FRONT Z 拉成材料總厚 | 配對量到近端→對側盒緣＝63 後，以 `apply_front_back_z()` 只改 `z`，面向／X／Y 的既有證據鏈不動 |

### 開發工具（`tools/`，不參與 inference）

- `dxf_digest.py`
  - `marker_position` 一節在**沒有 REGION 的圖面**改用封閉多段線當參考框。
    YCN043-Y003 全圖 0 個 REGION，舊版此節永遠印「略過」，而它正是面向與
    孔位座標的原始量測依據。
  - 參考框排除「標記自己」：標記本身常是封閉多段線，會變成包住自己的最小
    輪廓，四個距離全部退化成自己的半寬半高。
  - `outlines` 一節的成員數改為吃 `--limit`（原本寫死只印 3 個）。
  - `texts` 一節改用 ezdxf 的 plain-text 還原，去掉 `{\fISOCPEUR|...}` 控制碼，
    「Ø14孔-2」「Ø5.5m孔-8」這類孔數線索才讀得到。
- `dxf_screenshot.py` 新增 `--grid / --grid-origin / --grid-invert-y`：
  疊一層以資料座標標註的量尺，直接讀出「這個標記距上緣幾 mm」。

## 6.67.0 - 2026-09-15

### 版本定位

本版本統一幾何孔位語意：凡孔位資料、證據、量測、推導或 GUI 指名的「深度」，
一律改稱 **Z 座標**，明確區分「座標位置」與「加工深度／加工工藝參數」。

- `MeasurementAxis` 僅保留 `X / Y / Z / DIAMETER`，不再提供 `DEPTH` 軸。
- `DepthMeasurement` 改為 `ZMeasurement`，相關 provenance / evidence / helper 全部改用 Z 命名。
- `FaceMarker.depth` 改為 `FaceMarker.z`。
- `depth_evidence.py` 改為 `z_evidence.py`。
- GUI、診斷、文件與測試名稱同步採用 Z 座標語意。
- 僅 INSERT 巢狀展開所需的 `depth / max_depth / current_depth` 保留原名，因其代表遞迴層級而非幾何 Z 座標。
- 本次不改變幾何推導公式；僅做領域語意與 API 命名一致化，並修正 `ZMeasurement` evidence 轉換時的型別順序問題。

# DXF Hole Extractor 開發變更紀錄

本檔案記錄「為什麼改、改了什麼、依據什麼證據、如何驗證」，而不只記錄檔案差異。

> **最高開發原則：人類完整推導邏輯是規格。**
>
> 所有優化都必須從該邏輯衍伸；遇到失敗案例時，優先尋找「盒子、比例、投影、座標轉換」哪一層的證據鏈斷裂，不用案例答案反推演算法。

---

## 6.66.9 - 2026-09-14

### 診斷日誌：補強面向與Z 座標證據鏈

本版本不改變孔位推導規則本身，專門把既有幾何決策的證據鏈結構化輸出，讓 GUI/CLI 可回答「為什麼這顆孔判 FRONT／BACK、Y 為何鏡射、Z 為何採這個值」。

- `HOLE.FACE.CONCENTRIC_GRID`：逐個異徑同心孔中心輸出大徑／小徑、原始 local Y、Y mirror 公式、材料總寬、最終座標，以及來源 entity。
- `DEPTH.FRONT.CANDIDATES`：列出所有通過幾何支援的水平 DIMENSION 候選與正交佐證數量。
- `DEPTH.FRONT.SELECT`：列出最終採用 Z、獨立重複次數、替代候選與裁決理由。
- GUI 現有結構化 details formatter 會直接展開上述資料，不再只顯示單句「BACK CONVERSION」或「Z=45」。
- H23 仍為新案例驗證，不加入 regression fixture。

## 6.66.8 - 2026-09-14

### 版本定位

> **修正 GUI 高亮：BACK 孔位若已由 provenance 對回實際繪製的圓，不得再被
> 「主視圖同直徑圓」的舊有防呆再鏡射一次，否則高亮會被搬回未鏡射的
> 原始 y，跑到圖面上根本沒有圓的位置。**

`dxf_hole_extractor/` 的孔位推導邏輯（面向、座標、深度）**零改動**；本版本
只修正 `gui/highlight.py` 的「分析座標 → 畫布座標」對照，不影響匯出的
JSON 孔位資料。

### 症狀（人工回報）

「GUI 的 BACK 的高亮位置不正確，沒有進行 Y 轉換」——用 TRA041-H33.dxf
在 GUI 選取 BACK 孔位時，高亮框沒有落在圖面上真正畫出來的圓上。

### 根因

`normalized_highlight_records()` 組裝每一列高亮座標時，`point` 依序嘗試
四種來源：`anchors`（`_match_front_back_pattern` 的整組孔群幾何比對，已經
是最終顯示座標）→ `paired_back_anchors`（借用同排 FRONT 錨點推出的顯示
座標，同樣已是最終座標）→ `source_anchors`（依孔位 provenance 的
entity handle 直接回查原始 DXF 找到的實體位置——這也已經是該實體「真正
畫在哪」的座標，不需要再轉換）→ `top_bottom_anchors` / `marker_anchors`。

問題出在後面這段「BACK 若落在主視圖同直徑圓上，要不要鏡射」的防呆：

```python
if (
    mirror_axis is None
    and index in source_anchors        # 只檢查 source_anchors 裡「有沒有」這個 index
    and str(hole.get("face", "")).upper() == "BACK"
    ...
):
    ...
    if key in primary_circle_keys:
        mirror_axis = primary_back_mirror_axis
```

`index in source_anchors` 只代表「`_source_reference_points()` 對這個
index 也算得出一個猜測」，不代表**這一列實際採用的 `point` 就是那個猜測**。
以 TRA041-H33 為例：

- BACK Ø5.6（x=72, y=-189.5／-139.5 等 6 顆孔）先被 `_match_front_back_pattern`
  用「翻轉 Y + 平移」的整組幾何比對完整解出，`point` 已經等於
  normalized.dxf 上真正畫出的圓（例如 (72, -25.0017)），`mirror_axis` 正確
  地留白（`None`，代表不必再轉換，`anchors` 已經做過鏡射比對）。
- 但同一個 index，`_source_reference_points()` **也**獨立算出一個候選
  （因為兩顆孔的 provenance 指向同一個 SECTION VIEW 樣板圓 handle，
  在 x 相同時只用 `abs(y)` 這個弱 tie-break 挑到同一顆圓，本身就不精確）。
- 於是防呆判斷「`index in source_anchors`」為真，且 `point`（其實來自
  `anchors`，不是來自 `source_anchors`）剛好落在主視圖高度範圍
  （`y_total=214.5` 的區間幾乎涵蓋整個正視圖），被誤判成「尚未鏡射的
  主視圖代理點」，再套用 `2 * (-y_total/2) - point_y` 鏡射一次。
- 兩次鏡射的淨效果約等於「鏡射抵消」，高亮座標退回接近孔位原始 `y`
  （例如從正確的 -25.0 變成 -189.5 附近）——在圖面上找不到對應的圓，
  外觀上就是使用者說的「沒有進行 Y 轉換」（顯示值等於原始 y，而不是
  真正應該轉換後的畫布座標）。

`test_ntn007_f11_1_back_64_highlight_uses_y_face_conversion` 已經明文
斷言「`_match_front_back_pattern` 解出的座標不得再被二次鏡射
（`mirror_axis is None`）」；這次的 bug 正是防呆邏輯繞過了這個契約。

### 修正

只用「這一列實際採用的 `point` 是否真的來自 `source_anchors`」作為觸發
條件，改用明確旗標 `point_from_source_anchor` 追蹤來源，取代原本
「`index in source_anchors`（不論 point 從哪裡來）」的寬鬆判斷：

```python
point_from_source_anchor = False
...
if point is None:
    point = source_anchors.get(index)
    if point is not None:
        point_from_source_anchor = True
...
if (
    point_from_source_anchor
    and mirror_axis is None
    and str(hole.get("face", "")).upper() == "BACK"
    ...
):
    ...
```

`anchors` / `paired_back_anchors` 解出的座標定義上已經是最終顯示座標，
不會再被這段防呆碰到；只有真的沒有其他來源、退到 `source_anchors`
的座標，才會再判斷它是不是需要鏡射的主視圖代理點。

### 驗證

- `tests/unit/test_gui.py`（含 `test_ntn007_f11_1_back_64_highlight_uses_y_face_conversion`、
  `test_n13_s06_full_view_top_holes_highlight_uses_source_geometry` 等
  高亮相關案例）全數通過，確認 `source_anchors` 真正被使用時的鏡射防呆
  仍然有效，未被移除。
- `scripts/verify.py unit`：229 個單元／服務測試全數通過。
- `tests/unit/test_contracts.py`：硬編碼稽核／架構邊界／版本一致性全數通過。
- 回歸測試分三批執行，共 28 個案例全數通過（含本次根因案例
  `TRA041-H33`，以及 `NTN007-F11-1`、`NKN01-VP14`、`N13-S06`、
  `YCN007-CC201`、`NTN007-622A` 等既有 BACK／高亮相關案例）。
- 手動以 `tests/fixtures/regression/TRA041-H33/source.dxf` 跑一次完整
  `normalized_highlight_records()`，確認全部 13 顆 BACK 孔的高亮 `display`
  座標都落在 `source_normalized.dxf` 內實際存在的圓心上（例如
  Ø5.6 x=72 的兩顆孔分別落在 (72, -25.00) 與 (72, -75.00)，而不是修正前
  的 (72, -189.50) 與 (72, -139.50)）。

---

## 6.66.6 - 2026-09-14

### 版本定位

> **新增 `tools/dxf_digest.py`（DXF 幾何摘要）：把一張工程圖壓縮成
> 「可以一眼讀完的幾何事實」，取代每次除錯都臨時寫腳本撈幾何。**

`dxf_hole_extractor/` 內的分析邏輯**零改動**，本版本只新增開發工具與文件。

### 為什麼需要這個工具

6.66.5 的除錯過程中，為了找出根因總共臨時寫了三個腳本：撈圓並依孔徑分組、
傾印某個區域的實體 bbox、傾印 pipeline context 的 cluster 切分。這三件事
每換一張圖就要重寫一次，而其中「依孔徑 × 線型分組」那一步幾乎直接給出了
答案骨架——這種價值不該留在暫存檔裡。

### 三條設計原則（改工具前必讀）

1. **不走 production 的過濾路徑。**
   從原始 modelspace 出發，只用 `get_all_wcs_entities()` 展開 INSERT、
   用 `extract_region_profile()` 轉換頂層 REGION，不呼叫
   `load_analysis_entities()` 決定「看得到什麼」。理由就是 6.66.5 的根因：
   該圖 12 個頂層 REGION，管線只看得到 1 個。摘要工具若共用同一套過濾，
   就會跟管線一起瞎。管線視角改用「管線可見度」一節**對照**呈現，
   REGION 輪廓也逐一標注 `✓ 收下 / ✗ 被濾掉`。

2. **只報量測，不報結論。**
   輸出寫 `linetype=HIDDEN` 而非 `face=BACK`；寫「標記中心距輪廓四邊各多少」
   而非「這是 BOTTOM 孔」。工具一旦開始下結論，讀到的就是工具的意見而不是圖，
   判錯時沒有人看得出來。

3. **不靜默轉換座標。**
   預設印相對 CNC 原點的 local 座標（世界座標無法閱讀），但原點會明確印出
   並標注「管線推導值，可能是錯的」，關係固定為 `world = local + origin`，
   任何一行都能逆推；`--frame world` 可直接印世界座標；尺寸分析失敗時
   退回 `(0, 0)` 並明講。

### 段落

`origin`／`visibility`／`layers`／`circles`／`concentric`／`regions`／
`outlines`／`markers`／`marker_position`／`dimensions`／`texts`，
可用 `--only` 挑選；`--bbox` 限定區域、`--raw` 逐筆列出。

其中 `marker_position` 最有價值：它印出每個標記中心到所在輪廓四邊的距離
（`dx_min`／`dx_max`／`dy_max`／`dy_min`），這正是面向與孔位 Y 的原始量測
依據——但推導那一步仍留給程式與人。

`texts` 一節明確標注「僅供導航，不得作為推導依據」，反例就在本專案：
TRA041-H33 主視圖標 `Ø22工作孔X3`，該處實際幾何是 3 顆 Ø30。

### 維護約束

工具只用 ezdxf ＋ 專案既有原子操作（`bbox_of_entity`、
`extract_region_profile`、`_resolve_linetype`、`_marker_bbox`），
不重新實作任何 Y/Z/原點推導；原點與 X/Y/Z 直接呼叫 `analyze_dxf_size()`
轉述。避免它長成第二套管線而與正式邏輯漂移。

門檻類參數（`--min-vertices`／`--max-marker-size`／`--min-marker-size`）
是顯示用的候選條件，會印在段落標題上且可調，不進入任何推導。

### 驗證

- 於 TRA041-H33、TRA036-S045、C3N064-Y002、E73-43、N201-BH001、
  TRA022-B001 與一個最小 DXF（尺寸分析必然失敗）上實測，皆正常輸出；
  最大案例 4.6MB 於 2 秒內完成。
- `pytest tests/unit tests/regression tests/service` 全數通過。
- 抽驗 regression 案例通過；分析路徑未改動。

## 6.66.5 - 2026-09-14

### 版本定位

> **把「剖面詳圖的材料輪廓」補回證據鏈：頂層 REGION 不再只認側視位置，
> 詳圖偵測的位置條件也從容器群集下放到單張詳圖本身；並修正象限盒子
> 把「Z 座標」寫進孔位 Y 的軸向錯誤。**

以 TRA041-H33 為開發案例驗證，從 11 顆孔（面向、Y、Z 幾乎全錯）恢復到
29 顆孔、27 顆與人工答案完全一致（另 2 顆見下方「待人工確認」）。

### 1. 頂層 REGION：詳圖材料輪廓不再被整批丟棄

**症狀**：TRA041-H33 的 10 張 1:1 剖面詳圖，材料斷面全是 modelspace 頂層
REGION。`load_analysis_entities()` 只把「與主視圖 Y 重疊、X 分離」的
detached 側視 REGION 轉成 `REGION_PROFILE`（且只留 1 個），其餘一律不轉；
而未轉換的 REGION 取不到 bbox，等於整個管線都看不見這 10 張詳圖的材料幾何。

**後果的證據鏈**：詳圖沒有輪廓錨點 → `split_region_profile_views()` 切不開
→ 面向標記沒有盒子可比對 → `collect_detail_marker_side_lengths()` 回傳空集合
→ 主視圖上成對的同心隱藏線圓（Ø22／Ø30）失去跨視圖佐證 → 被
`circle_extractor` 的 construction 規則整批濾掉。

**修正**（`dimensions/size_analyzer.py`）：
`_top_level_region_side_view_candidates()` 改名為
`_top_level_region_profile_candidates()`，同一個「輪廓高度＝主視圖材料高度」
的幾何入場條件下，分別回傳兩種位置的候選：

```text
與主視圖 Y 重疊、X 分離        → detached 側視輪廓（沿用舊規則，只取最靠近的 1 個）
整個位於主視圖材料下緣以下      → 剖面詳圖輪廓（成排本來就不只一張，全部保留）
```

側視輪廓維持原本的低優先級門檻（只有找不到側視或側視其實是縱向時才補），
詳圖輪廓則是另一組獨立證據，不受該門檻限制。

### 2. 詳圖偵測：位置條件下放到單張詳圖

**症狀**：這張圖的剖切符號畫在主視圖**上方**，與下方兩排詳圖被
gap-clustering 連成同一個橫跨整張圖紙的大群集（3276×2273）。
`find_scaled_detail_clusters()` 在**群集層級**就用
`bbox.y_max >= front_bbox.y_min` 整群否決，底下 10 張詳圖連被拆開的
機會都沒有。

**修正**（`views/multi_view_pipeline.py`）：先拆子群集，再用**單張詳圖
自己的材料輪廓 bbox** 判斷「是否位於主視圖下方」。容器群集的範圍不再
影響判定；原本整群都在下方的圖面結果完全不變。

「排除已識別側視圖」的比對刻意留在群集層級——側視圖的群集常被自己的
尺寸線撐大，改用輪廓 bbox 比對會讓 YCN007-CC201 的側視圖反而被排除掉
（實測會讓該案例 12 顆 BACK 孔翻面成 FRONT）。

### 3. 象限盒子：位置與深度是兩個互相垂直的量

**症狀**：`_find_single_quadrant_feature_distance()` 量的是**面向軸**
（進刀方向）上「特徵進刀端 → 盒子另一側」的距離，語意是Z 座標；
呼叫端卻直接拿它當孔位 `y`。TRA041-H33 的 Ø4.3 BOTTOM 孔因此得到
`y=-164`（那是深度），正確值是 `y=-16`。

**修正**（`holes/marker_candidate_generation.py`）：改名為
`_find_single_quadrant_feature_measurement()`，回傳
`QuadrantFeatureMeasurement(position, depth)` 兩個量：

```text
position（尺寸軸）  該面向的基準邊 → 特徵中心      → 孔位 y
depth   （面向軸）  特徵進刀端 → 材料另一側        → Z 座標 z
```

基準邊沿用專案既有的面向座標定義（`section_face_orientation` 的
`+X=FRONT`／`+Y=TOP`，與 `wide_marker_top_bottom` 的
「TOP 由 x_min 量、BOTTOM 由 x_max 量」一致）。

### 4. CI 的兩道防線原本沒有真的跑到

`scripts/ci_validate.py` 用 `-k case_hardcodes` 與 `-k architecture_boundaries`
選取檢查，但 `tests/unit/test_contracts.py` 裡沒有任何 test 名稱含這兩個
關鍵字，兩個步驟每次都「全部 deselected」而形同沒跑——包含專案最高原則
「不允許硬編碼」的那道稽核。

- 硬編碼稽核原本只有模組層級的 `main()`，補上 `test_no_case_hardcodes_in_analysis_code()`。
- CI 改為整份 `test_contracts.py` 一起跑，不再用 `-k` 把「有沒有被執行到」
  交給字串巧合。
- `tests/run_regression.py all` 這個入口早已依專案規定移除，CI 卻還在呼叫。
  改為 `--list` 列出案例，由呼叫端分批執行（同時新增 `--list` 選項與
  「未指定案例」的友善提示）。

### 5. 版本契約測試不再寫死版本字串

`tests/unit/test_contracts.py` 原本硬寫 `assert __version__ == '6.66.3'`，
在 6.66.4 發版時沒同步而留下一個與程式行為無關的紅燈。改為由
`CHANGELOG.md` 最新條目推導期望版本，契約仍是「pyproject／套件／CHANGELOG
三處同版本」，但不再需要每次發版改測試。

### 待人工確認（未改程式）

`TRA041-H33_holes.json` 內兩筆 `BACK Ø22` 的 `y` 標為 **-187.5**，但圖面
幾何指向 **-190.5**：

```text
主視圖 Ø22（HIDDEN 線型）圓心 y = -24.004938，與同圓心的 Ø7 完全同軸
Y 總寬 = 214.493
鏡射：-(214.493 - 24.004938) = -190.488  →  -190.5
```

同一條鏡射規則對其餘 BACK 孔全部完全吻合（Ø5.6 → -189.5／-139.5、
Ø30 → -170.5、另一顆 Ø22 → -150.3），且 -187.5 無法由任何一致的
換算得出（若改用 -187.5 反推，Y 需為 211.5，那又會讓 -150.3 對不上）。
因此本版本採計幾何推導值 -190.5，並將 TRA041-H33 登錄為 regression
案例；若人工複核確認 -187.5 才是現場要的值，請更新
`tests/fixtures/regression/TRA041-H33/expected.json` 與本節。

### 驗證

- 28 個既有 regression 案例分批全數通過（含一次實測到的 YCN007-CC201
  回歸，已在第 2 點說明並修正）。
- 新增 TRA041-H33 regression 案例。
- `pytest tests/unit tests/regression tests/service` 全數通過。
- production path 未加入任何案例特判。

## 6.66.4 - 2026-09-14

### 版本定位

本版本延續 6.66.1 的幾何修正，整合 TN02-B002R 的斷面拓撲重建、主視圖選擇
解歧義與執行日誌強化；TRA041-H33 作為新的開發測試案例驗證，不加入
regression oracle。

### 斷面輪廓推導

新增由彼此相鄰／重疊的 LINE/LWPOLYLINE 幾何重建材料斷面候選，避免只依賴
單一封閉多邊形。此路徑僅使用 DXF 自身拓撲、相對尺寸與投影關係，不使用
案例名稱、固定座標、固定孔徑或固定孔數。

### 主視圖選擇

當多個 cluster 都包含全域 X 尺寸線端點時，先判斷候選 X-span 是否在可信
幾何容差內；可信時以跨度吻合度優先，FRONT-like 僅在幾何近似時作解歧義。
若全部候選的 X-span 都不可信，才回復既有 FRONT-like fallback，避免大型
標註／詳圖 cluster 搶走真正材料主視圖。

### 日誌

分析結束時除了產物路徑，也輸出最終推導孔位的 face、diameter、x、y、z、
note 與候選數量；主視圖候選比較亦以結構化 diagnostics 記錄選擇依據。

### 驗證

- TN02-B002R：斷面重建後可恢復材料 Z 尺寸推導，並通過既有回歸案例。
- TRA041-H33：以開發中新案例驗證主視圖由可信 X-span 選擇，不列入 regression。
- 相關 unit／geometry／contract 測試均納入驗證。
- production path 未加入任何案例特判。

## 6.66.0 - 2026-09-14

### 版本定位

延續盒子優先，把兩件原本「靠假設」的事改成「由圖面證據推導」：

1. 斷面盒的**物理軸**（哪一個方向是工件 Y、哪一個是 Z）。
2. 同心異徑孔的**面向**與**孔數**（線型可見性）。

### E73-43：旋轉 90° 的斷面盒與隱藏線面向

案例症狀：輸出 12 顆 FRONT 孔、`z=2526`、`Z=180`；正確答案是 6 顆孔
（3 顆 BACK、3 顆 FRONT）、`z=100`、`Z=100`。三個缺陷各自獨立。

#### 1. 斷面盒軸向判反 → `Z` 取到材料寬

圖面線索：唯一的材料斷面 `REGION_PROFILE` 是 180×100，而主視圖材料高度是 180。
舊程式固定以「盒高＝Y、盒寬＝Z」解讀，於是 `Y=180`（改用正視圖值）、`Z=180`。

推導修正（`views/side_view_analyzer.py` 的 `_resolved_axes`）：
斷面盒必與主視圖共用同一個材料 Y，因此**先看哪一個方向等於主視圖 Y**，
該方向才是 Y，另一個方向是 Z。原本已有的 `longitudinal`（盒寬＝工件 X）
判定保留，新增 `transverse_rotated`（盒寬＝工件 Y）：

```text
盒 180×100，主視圖 Y = 180
盒寬 180 == Y  →  Y = 盒寬 = 180
                  Z = 盒高 = 100
```

`_find_detached_region_profile_candidates` 的候選排序同步改用
「兩個方向中較吻合者」，否則旋轉斷面會被自己的高度差扣分。

`dimensions/detail_scale.py` 的倍率判定也補上同一件事：Y 換算法有兩個合法
讀法（盒高／盒寬），只有在**與尺寸線法一致**時才採信旋轉讀法。E73-43 因此
從「兩法不一致、靠孔徑核對 50% 命中率硬選」變成兩法一致。

#### 2. 縱向視圖被當成剖面詳圖 → FRONT 深度取到 2526

`find_front_z_hint_from_detail_views` 原本只要求「群集在正視圖下方」，
於是把下方那張 2606.5 長的第二張縱向視圖當成斷面詳圖，把 `DK-158` 的
長度尺寸 2526 當成Z 座標。新增兩條純幾何前置條件：

- 群集換算成 1:1 之後的寬度不得達到正視圖工件長度（那是縱向視圖）。
- 詳圖內的材料輪廓若「水平寬度＝工件 Y」，代表斷面旋轉 90° 繪製，
  水平方向是 Y 軸不是Z 軸，該詳圖的水平 DIMENSION 不得當成深度。

E73-43 修正後取不到 FRONT Z 證據，正確回退到材料總 Z＝100。

#### 3. 同心異徑孔被拓撲樣板拆成兩顆 FRONT 孔

圖面線索：6 個同心 Ø7.6+Ø12.8 孔位分成兩排——x≈7513 那排整群畫在
`HIDDEN` 線型圖層，x≈7740 那排整群實線（圖面標註為 `M6.3錐孔-6`）。

`classify_concentric_grid_front_holes` 的前提是「大徑＝正面開口、小徑＝
對側牆開口」，整群隱藏線與該前提直接矛盾：連最大的開口都看不見。

新增 `classify_visibility_split_compound_holes`（`holes/hole_classifier.py`），
排在同心網格樣板之前：

- 同心群**整群線型一致** ⇒ 這些開口都在同一面 ⇒ 收斂成一顆孔，
  孔徑取貫通端（最小徑）。
- 整群隱藏線 ⇒ `BACK`，CNC Y 依材料總寬鏡射；整群實線 ⇒ `FRONT`，Y 直接採用。
- **鑑別力前置條件**：同一組孔徑必須同時出現隱藏與實線兩種畫法，才代表
  線型在這張圖裡承載面向語意。沿用 `circle_extractor._classify_concentric_groups`
  既有的「訊號必須有鑑別力」原則，因此全實線的既有案例
  （PYN64-B11、TN56W-010）完全不受影響，仍走原本的網格樣板。

證據等級定為 `GEOMETRIC`，低於 `FRONT_MARKER` / `SECTION_TEMPLATE`：
剖面若有直接證據仍優先於線型推論。

### 其他

- 修正 `gui/main_window.py` 兩處 f-string 內重用外層引號的寫法。
  該語法要 Python 3.12 以上，但 `pyproject.toml` 宣告支援 3.10，
  在 3.10/3.11 會直接 `SyntaxError`（3 個 unit test 因此失敗）。
- `test_nkn01_side_orientation_is_geometry_driven` 在 fixture 未隨釋出包附帶時
  改為 skip，不再以 `FileNotFoundError` 假裝成幾何契約失敗。

### 驗證

- 新增回歸案例 `tests/fixtures/regression/E73-43`：6/6 exact match。
- 全部 26 個回歸案例逐一分批執行：24 PASS。
  `TN56W-010(20260903)`、`YCN007-CC201` 仍失敗，但輸出與 6.65.0 基準**逐字相同**，
  屬既有未解案例，非本次變更造成。
- `pytest tests/unit tests/service tests/regression`：227 passed、1 skipped
  （6.65.0 基準為 3 failed）。
- 新增契約測試：斷面盒軸向解析、隱藏線面向與同心群收斂。
- production path 未加入任何案例名稱、固定座標或固定孔徑條件。

## 6.65.0 - 2026-09-12

### 版本定位

本版本延續 6.64.0 的盒子優先與 Human-Logic Driven Geometry Inference，新增 N105-R02 所揭露的泛化修正。

### N105-R02：盒子與斷面證據鏈泛化

- 以獨立 `REGION_PROFILE` 斷面盒辨識材料 Z 尺寸，避免將註解雲框或主視圖內部框線誤認為側視材料盒。
- FRONT/BACK 深度改由實際斷面盒的幾何尺寸與方向推導，不依賴特定案例的深度常數。
- TOP/BOTTOM 孔位套用盒子中心／象限一致性約束，避免同一斷面特徵被無條件複製到相反面向。
- TOP 面 Y 座標由 DIMENSION 與盒子幾何關係推導，避免固定 `-16` 類案例答案。
- 新增 N105-R02 的幾何契約測試與回歸驗證。

### 驗證

- N105-R02：7/7 exact match。
- 新增幾何契約：2 passed。
- 不加入任何案例名稱、固定座標或固定孔徑條件至 production path。

## 6.64.0 - 2026-09-12

### 版本定位

將專案正式定義為 **Human-Logic Driven Geometry Inference**：

- README 補齊人類完整十步推導邏輯，作為正式設計規格。
- 明確定義「材料盒」為副視圖、斷面與孔位推導的核心證據。
- 明確禁止以 DIMENSION 作為「候選材料盒」的證據。
- DIMENSION 僅在符合規格的階段提供縮放／倍率或尺寸關聯資訊，不直接成為孔位座標、深度或材料盒裁決。
- `z` 明確定義為 XYZ 孔位座標，不是Z 座標，也不是材料厚度。

### 盒子幾何優化

#### PYN01-B05：上下排列的重複剖面盒

真正的 `2-2 ~ 6-6` 剖面位於主視圖下方，不能因為傳統側視圖搜尋只注意左右相鄰位置就漏掉。

已建立純幾何的「重複材料盒」路徑：

```text
重複材料輪廓
    ↓
盒子 bbox
    ↓
盒子高度 / 主視圖 Y
    ↓
幾何倍率
    ↓
盒子寬度 / 倍率
    ↓
物理 Z
```

本案實際盒子：

```text
219 × 450
主視圖 Y = 150
scale = 3
Z = 73
```

PYN01-B05 經逐案回歸為 PASS，`Z=73` 保持正確。

#### TN56W-010：開放式材料盒

部分圖面不是封閉多邊形，而是由開放式外框與材料邊界形成可辨識材料盒。

本版本維持「從材料幾何找盒子」的路徑，避免因沒有封閉 LWPOLYLINE 就退回無關小輪廓。

TN56W-010 經逐案回歸為 PASS。

### PYN02-L38A：BACK Y 座標規則確認

本案的 3 顆 Ø4.3 BACK 孔：

```text
主視圖孔心 Y = -55
主視圖 Y 距離 = 132

(132 + (-55)) × -1 = -77
```

`Y=-77` 為正式正確值，不應被尺寸線或其它猜測覆寫。

因此本版本將這項結果明確記為座標轉換規格，並移除先前錯誤追逐 `-89.5` 的方向。

### 面向與盒子耦合修正

已持續驗證並保留以下已確認案例：

```text
PYN01-B05      PASS
PYN02-L38A     PASS
PYN13-Z34B     PASS
TN02-2041A     PASS
TN56W-010      PASS
YCN007-CC201   PASS
```

其中 `YCN007-CC201` 維持原先 **34/34** 穩定基準。

### 回歸執行策略變更

為避免大型 DXF 案例一次執行造成長時間等待，開發回歸改為：

```text
單案例 → 驗證 → 看結果 → 修正 → 再測下一案例
```

`tests/run_regression.py` 僅保留單案例入口與盒子象限契約測試；**禁止恢復一次跑全部案例的 `all` 入口。**

### 測試原則

- 優先跑本次修改直接相關 unit test。
- DXF regression 一次只跑少量案例。
- 不因執行時間限制而把未完成的 full suite 宣稱為通過。
- 視覺異常先截圖確認，再建立數字診斷。

---

## 6.63.2 - 2026-09-12（歷史基準）

- 修正 GUI「平移後圖面」高亮完全失效問題。
- 修正完整攤平視圖 FRONT/BACK 與 TOP/BOTTOM 判反。
- 修正 YCN007-CC201 的重複邊緣 marker 材料盒選擇與 Z 推導；6 顆 Ø4.3 孔的 Z 由錯誤 fallback `63.0` 更正為圖面證據支持的 `239.4`。
- YCN007-CC201 達成 34/34 孔一致。
- 既有測試基準為 unit 197 passed；原始交接基準為 24/25 regression，唯一失敗 PYN01-B05。

> 注意：6.63.2 對 PYN01-B05 的「下方重複剖面」仍屬調查階段；6.64.0 才把純盒子幾何路徑正式納入。

---

## 6.63.1 - 2026-09-11

- 修正端部剖面 FRONT/BACK marker 的加工位置推導。
- 深度改由剖面材料輪廓的 Feature Center → Near-End → Far-Edge 幾何距離推導。

---

## 6.63.0 - 2026-09-11

- 修正完整 TOP/BOTTOM 視圖材料外框推導。
- 支援多條獨立 LINE 首尾相接形成封閉輪廓。
- 完整視圖材料跨度優先由實際幾何輪廓推導。
- 新增端部剖面 marker 與孔列一對一幾何關聯。

---

## 6.62.x

- GUI 高亮、主題 palette、完整 TOP/BOTTOM 視圖與 N13-S06 等相關修復。
- 持續強化 normalized 畫布座標與來源 provenance。

---

## 6.61.x

- 修正 BACK 高亮鏡射。
- 修正側視 HATCH marker 的 FRONT/BACK 面向與實際材料牆深度。
- 移除不屬核心孔位推導範圍的環境依賴 GUI／Windows runtime 測試。

---

## 6.60.0

- 整理驗證流程。
- 引入獨立 regression 執行策略與每案例處理。
- 保留 regression oracle 作為結果驗證，不進入 inference。

---

## 6.58.0 以前

歷史工作主要集中於：

- `SectionFrame2D` 與剖面座標系統。
- MULTILEADER → marker → 詳圖容器的幾何 provenance。
- 剖面倍率與 section frame 推導。
- NKN01、NTN007、TN02、PYN、TRA 等圖面的幾何回歸。

詳細歷史可以從既有 git history 與專案 `docs/` 文件追查。

---

# 開發者注意事項

## 不要重複以下錯誤方向

1. **用 DIMENSION 選盒子。**
2. **用尺寸文字直接當孔位值。**
3. **用Z 座標直覺否決 z。**
4. **因單一案例失敗就重寫整條主流程。**
5. **忽略視覺圖面而只相信數字診斷。**
6. **把排版上下左右位置直接當面向語意。**

## 修改順序

```text
看圖
 ↓
確認材料盒
 ↓
確認盒子是否為正確物理視圖
 ↓
確認比例
 ↓
確認物理軸
 ↓
確認盒內 marker / feature
 ↓
確認面向
 ↓
確認 X/Y/Z 轉換
 ↓
單案例 regression
 ↓
下一案例
```

若以上某一層證據不存在，應修復該層，而不是用下游固定值補洞。


