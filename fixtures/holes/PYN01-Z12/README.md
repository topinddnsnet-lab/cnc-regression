# PYN01-Z12：高度不一致的純幾何補孔

- 原始 DWG SHA-256：`d997db5e336f501b3030751ca69d2501459348e3f31625ab88ff68ac3cd02deb`。轉換的 `source.dxf` 留在本機、不加入 Git。
- 使用者要求另 5 個真圓亦應保留，因此 expected 改為全部 15 個 Ø4.3。標註的 10 孔數量與 INSERT 來源不得排除幾何吻合的真圓。
- 新增補孔只使用完整側視輪廓在等比例縮放／鏡射後的吻合、實際圓徑與孔列位置；尺寸文字、引線、標題不參與此規則推導。既有 X 原點與比例流程維持原範圍。
- 已目視 4-4 右壁孔形。斷面高度 150 與主視圖高度 113 不符，保留原工件尺寸，15 孔均須 status=review、needsReview=true、confidence<=0.5，附 section_primary_height_mismatch。需視覺判讀，不強行讓兩視圖高度相同。
- X、孔徑與上緣距離取實際幾何；不以標註校正幾何。web 的 `tests/test-geometric-section-recovery.mjs <DWG 或 DXF>` 同時驗證其餘 21 孔與工件尺寸保持一致，以及標註移除／竄改不影響新增規則。
- 未修改既有其他案例、baseline 或公差，未執行 --accept。
