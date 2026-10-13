# TN01A-A3028RA oracle 說明

標準答案（`TN01A-A3028RA_holes.json`）由使用者提供，60 顆孔
（face/diameter/x/y/z 五元組）已與管線輸出完全一致，沒有需要另外確認的
差異。本文件記錄修這個案例時發現的三個真實幾何推導缺陷，供之後回頭看
`front_back_stage.py`／`face_lookup.py`／`views/multi_view_pipeline.py`
時參考。

## 1. 主視圖選了錯的視圖（material box Y/Z 對調）

`discover_view_sections()` 原本用固定 `DIMENSION_TOLERANCE`（0.2mm）判斷
「兩個候選主視圖的 X 跨度誤差夠不夠接近，可以讓 front-like 訊號介入」。
這張圖真正畫了孔的視圖，X 跨度誤差是 52.3mm（材料總長 4265mm 的
1.2%）——遠大於 0.2mm，導致一個完全沒有孔、跨度誤差剛好 0.0mm 的
「尺寸／參考視圖」永遠贏過真正有孔的視圖。

修正：改用與 X 尺寸線長度成比例的容差（`PRIMARY_VIEW_OVERSHOOT_TIE_RATIO`，
沿用既有的 `FULL_VIEW_PROFILE_SPAN_TOLERANCE_RATIO=0.05`），取代固定毫米數。

## 2. 剖面 marker 交叉配對污染（x=1563/1588 誤增 FRONT）

x=1563/1588 的主視圖圓是 `DASHEDX2`（隱藏線型），已由**專屬剖切面**
（`x_position=250449.2`）的 marker 正確解出 BACK-only（y=-139/-79）。
但另一張詳圖裡有一組**沒有專屬剖切面**（`x_position=None`）、孔徑／高度
剛好相同（Ø4.2、距上緣 27/87mm）的 FRONT marker——這組原本是給 x=93/118
等孔群用的，`find_orphan_marker_holes()` 只看「同孔徑＋同高度」就借用了
x=1563/1588 已解析孔的 X，生出兩顆該處根本不存在的 FRONT 孔。

修正：`FrontBackHole` 新增 `source_marker_x` 欄位；沒有專屬剖切面的孤兒
marker，只能借用「同樣沒有專屬剖切面」的已解析孔的 X。

## 3. 同心建構圓誤判為獨立孔（x=112.5/187.5 誤增 Ø10 FRONT）

x=112.5/187.5 的 Ø5.2 孔已由專屬剖面 marker 證實為 FRONT（z=47.5，一個
獨立於主體 Z=70 的腳座／支架構件）。同心疊了一顆 Ø10 圓，`color`／線型
與 Ø5.2 完全相同（不是 `_is_construction_circle()` 能分辨的建構線訊號），
只有 2 個同心中心，未達 `classify_concentric_grid_front_holes()` 要求的
2×2＝4 個完整網格中心，因此那個函式正確地跳過了它。但「重複獨立孔群」
fallback（`classify_repeated_front_hole_components`）只看 Ø10 自己的幾何
（兩個 Ø10 圓剛好同 Y），被「Y 均一性」規則誤判成兩顆獨立 FRONT 孔。

修正：進入「重複獨立孔群」fallback 前，先排除「圓心與已解析孔位完全
重合但直徑不同、且沒有獨立證據支持第二個直徑」的圓。

## 4. 純拓樸孔群沒有鏡射 BACK（x=13/53/4213/4253 漏了 12 顆 BACK）

這 12 顆孔完全沒有專屬剖面 marker、也沒有可用的 DIMENSION 能獨立證實
背面存在（只有一條「距上緣 46mm」＋一條「35mm 間距」的正面尺寸鏈）。
但同一張圖有兩條獨立的幾何線索把它們連到已證實貫通的孔群：

- x=13/53 與已由獨立剖面 marker 證實貫通的 x=93/118（同孔徑 Ø4.2），
  X 間距 40/25mm，在既有 `PAIR_ISOLATION_WINDOW`（80mm，
  `classify_repeated_front_hole_components` 本來就用來判斷孔群連通性的
  幾何窗口）之內。
- x=4213/4253 的距上緣高度列（46/81/116mm，含順序與間距）跟 x=13/53
  逐一精確相同——同一種 Y 向排列在圖面另一端整組重現，是同一種孔位
  樣板的另一個副本。

新增 `_extend_confirmed_mirror_to_repeated_front()`：純拓樸推導出的 FRONT
孔，只有在能透過「X 幾何連通」或「高度列完全重現」連到同一張圖裡已由
marker 證實「同一顆圓同時是 FRONT＋BACK」的孔群時，才補上鏡射 BACK 孔
（`y = -Y總寬 + 距上緣高度`）。

**刻意不採用「同孔徑／同 Z 就套用」這種更寬鬆的規則。** 開發過程中第一版
就是這樣寫的，套用後 `PYN13-Z34B(20260831)` 立刻出現回歸：該圖有一組
同孔徑（Ø4.3）同 Z（115.0）、但既不相鄰、高度列也完全不同的孔群
（x=370.3/400.3），正確答案是它不貫通；寬鬆規則會誤增 4 顆多餘 BACK 孔。
改用「幾何連通＋高度列完全重現」這兩條更嚴格、只在同一張圖內部才成立
的證據後，兩個案例都能正確區分。
