# PYN02-Z13

- 原始圖面：`D:\workspace\修正\PYN02-Z13.dwg`，SHA-256：`b5805c828f3541339e1bbceea8b9c4f6d87a01a999de11ee37bb029a29c06e82`。
- `source.dxf` 使用 `web/tools/convert-regression-drawing.mjs` 從 DWG 轉出，依專案慣例不納入 Git；其他電腦須複製 DXF 或重新轉檔。
- `expected.json` 將使用者提供的 38 顆孔原樣轉成回歸格式，沒有修改人工座標。
- 圖面主視圖為局部加工投影；相鄰端面及多張已驗證倍率的剖面共同證實完整材料高度。正確高度亦使跨視圖標記配對可辨識 14 顆底面孔。
- Z 差異在回歸中只報告、不判失敗；此次 38 孔的 Z 均與人工答案一致。另有一個低信心候選由人工確認。
