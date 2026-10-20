# cnc-regression：孔位回歸測試（JS 版）

獨立於模擬器的測試專案。整個資料夾刪除，模擬器照常運作。用 Node（v18 以上）直接執行模擬器的孔位演算法，與標準答案比對。

## 放置方式

```
workspace/
├─ cnc-simulator-v2/     模擬器
└─ cnc-regression/       本專案
```

模擬器位置在 `config.mjs` 的 `SIM_PATH`（預設 `../cnc-simulator-v2`，相對本資料夾）。
臨時改用其他位置：環境變數 `CNC_SIM_PATH`，或命令列 `--sim <路徑>`（優先順序：命令列 > 環境變數 > config.mjs）。

## 常用指令

```bash
node run.mjs                         # 全圖
node run.mjs --case PYN02-L38A       # 單案例
node run.mjs --affected-git          # 只跑模擬器未提交改動會影響到的案例
node tools/selftest.mjs              # 比對規則自我測試
node --test tests/unit/*.test.mjs    # 合成單元測試（6.74–6.80 移植）
npm test                             # 以上三者依序全跑
node tools/parity.mjs                # 與 Python 6.80 最後輸出逐孔比對（歷史參考）
```

Python 兩個專案已於 2026-10-13 退役，紀錄見 `docs/python-archive/退役紀錄.md`。
`fixtures/features/` 是特徵專案的 6 張路徑回歸圖，留給之後的路徑回歸使用。

報告：每次執行都會重新產生 `reports/report.md`（人看）、`reports/report.json`（AI 看）、`reports/cases/`（細節）。
`reports/` 不進 git（每次重產），打包時附上一份 2026-10-13 的執行結果供參考。

## 限人工的指令

| 指令 | 用途 |
| --- | --- |
| `node run.mjs --accept` | 全圖跑完後，把目前結果設為新的 baseline，並更新覆蓋率影響圖 |
| `node run.mjs --classify` | 產生分群草稿 `reports/groups.draft.json`，人工命名後合併到 `fixtures/groups.json` |
| `node tools/known-fail.mjs <案例> "<原因>"` | 把該案例目前缺的孔標為已知失敗；`--clear` 清除 |
| `node tools/migrate-notes.mjs` | 把 `note` 裡的例外字樣轉成 `_match`（一次性） |

## 新增測試圖

1. 建立 `fixtures/holes/<案例名>/`，放入 `source.dxf` 與 `expected.json`。
2. `expected.json` 每顆孔填 `face`、`diameter`、`x`、`y`、`z`、`note`（可選）。需要例外規則時，加上 `_match`（見下）。
3. `node run.mjs --case <案例名>` 確認。報告的 `group` 欄位會顯示它被歸到哪一群；`isNew: true` 代表新型態。
4. 確認後執行 `node run.mjs --accept`。

## 答案的隱藏欄位 `_match`

`note` 給人看，不參與判定。判定用的例外規則寫在 `_match`：

| 欄位 | 意義 |
| --- | --- |
| `faceAlternatives: ["FRONT"]` | 這些面向也算對 |
| `yzTol: 5` | Y 公差放寬（斜孔） |
| `zCheck: false` | Z 不列入報告 |
| `optional: true` | 沒抓到不算失敗 |
| `knownFail: {since, reason}` | 已知失敗，不讓結束碼變成非 0 |

## 公差

孔徑、X、Y ±0.2；Z 只報告；多出孔只顯示警告，不判失敗；必要孔缺少或面向／孔徑／X／Y 不符仍判失敗。

## 指紋與分群

- 覆蓋率影響圖（`baseline/coverage.json`）：每個案例跑過哪些模擬器函式，供 `--affected` 使用。
- 圖面特徵與決策鍵：從演算法既有輸出歸納，不需修改模擬器。
- 分群：Jaccard 相似度、平均連結，門檻 0.4。出現在 90% 以上案例的特徵會自動忽略。

## git

DXF 圖檔（約 50MB）與 `reports/` 不進 git，見 `.gitignore`。要在別台電腦重建，需另外複製 `fixtures/holes/*/source.dxf`。
