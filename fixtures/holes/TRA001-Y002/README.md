# TRA001-Y002

- 圖面來源：`D:\workspace\修正\09_TRA001-Y002.dwg`；原始 DWG SHA-256：`4f7565285e70a19a0410a291a9118a4b35fef2887e2658b09ae262538d345ba9`。
- `source.dxf` 由 `web/tools/convert-regression-drawing.mjs` 轉出，依回歸專案慣例不加入 Git；在其他電腦執行此案例時需另行複製或重新轉檔。
- `expected.json` 是使用者提供並確認修正的 47 孔：背面 Ø4.3 的 Y 為 -185.5、Ø5 的 Y 為 -57.5；孔徑與座標由人工答案轉為數值。
- 圖面上的背面 Ø19 為放大示意，使用者確認可保留供人工移除；不列入必要孔，回歸會顯示多孔警告。
- 孔位回歸的 Z 差異只報告，不影響通過；擠出方向和 Z 另由 simulator 的 `tests/test-offline-corrected-drawing.mjs` 檢查。
