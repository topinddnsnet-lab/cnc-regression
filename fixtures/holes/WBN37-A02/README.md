# WBN37-A02 人工校正回歸

- 圖面來源：使用者提供的 `D:\workspace\校正\WBN37-A02.dwg`。
- 答案來源：使用者提供的 `WB-WBN37-A02.json`，面向名稱正規化為 FRONT/BACK、Ø 註記正規化為 diameter，座標轉為數字。
- 2026-10-27 使用者明確更正：背面 Ø5.5 的 Z 原填 31.5 為筆誤，正確為 **33.04**；原校正檔已同步更新。正面 Ø12 的 Z 保持 **31.5**。
- 共 24 孔：正面 Ø12 12 孔、背面 Ø5.5 12 孔；沒有 TOP/BOTTOM 孔。
- 圖面有兩組互為正交的完整投影與 REGION 端面。端面中的分離孔標記必須參與抓孔，不可被其他詳圖擋住。
- 主視圖的窄間距豎線在另一投影有 U 形開口與向外連接的材料邊，屬輪廓缺口，不能當成 Ø1.5 孔。
- `tests/unit/calibrated-end-projections.test.mjs` 除標準回歸外，額外嚴格檢查 24 孔數量、無多孔及每孔 Z 誤差不超過 0.2 mm。
- `source.dxf` 由專案內建 DWG 轉檔器轉出，依回歸專案慣例不加入 Git；重建可執行 web/tools/convert-regression-drawing.mjs，傳入上述原始 DWG 及此資料夾的 source.dxf 路徑。
