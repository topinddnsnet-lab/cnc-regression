# PYN01-Z12：高度不同但有正視圓與 4-4 佐證的引孔

- 原始 `PYN01-Z12.dwg` SHA-256：`d997db5e336f501b3030751ca69d2501459348e3f31625ab88ff68ac3cd02deb`。CAD-Viewer 轉換所得 `source.dxf` 依既有規則留在本機、不加入 Git。
- 使用者確認目標為 10 個 Ø4.3，引線指向右側 INSERT 圓族；同高度另有 5 個同徑圓，不依數量任意截取，也不將兩族合併。
- 目視 4-4：Ø4.3 引孔位於右壁、距上緣 55，依現有軸定義為 FRONT，Z=73。原料斷面高 150，主視加工投影高 113；不把兩者強制改成同一高度。
- 使用者要求：高度不同但正視有實際圓時，保留為低信心候選，不完全捨棄。這 10 孔應保持 `status=review`、`needsReview=true`、confidence 不高於 0.5，並包含 `section_primary_height_mismatch` 警告。對應單元測試防止最終證據評分升回 accepted。
- expected 僅驗證使用者確認的這 10 孔。X 取實際圓心；部分 240 標註對應實際約 240.25，屬需視覺判讀的標註／幾何差異，不在演算法校正比例或放寬公差。
- web 的 `test-counted-section-recovery.mjs <原始 DWG>` 額外檢查原有 21 孔、材料尺寸及選取的圓族。未更改既有答案、baseline、已知失敗或公差，也未執行 `--accept`。
