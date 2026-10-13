# AI 操作指引：孔位回歸

給要修改模擬器孔位演算法（`cnc-simulator-v2/src/ai/services/dxf3d/`）的 AI。先讀完本檔再動手。

## 第一個動作

```bash
cd cnc-regression
node tools/selftest.mjs        # 比對規則自我測試，應全部通過
node --test tests/unit/*.test.mjs  # 合成單元測試，應全部通過
node run.mjs                   # 全圖，約 15～40 秒；確認起點乾淨（新壞 0）
```

起點不乾淨（新壞 > 0）時，先停下來回報給人，不要在髒的起點上修改。

## 指令

| 目的 | 指令 |
| --- | --- |
| 全圖 | `node run.mjs` |
| 單案例 | `node run.mjs --case <案例名>`（可重複 `--case`） |
| 只跑受影響案例 | `node run.mjs --affected-git`（依模擬器未提交的改動）或 `--affected src/…/檔案.js` |
| 指定模擬器位置 | 改 `config.mjs` 的 `SIM_PATH`；臨時可用環境變數 `CNC_SIM_PATH` 或 `--sim <路徑>` |

結束碼：`0` 沒有新壞；`1` 有新壞或分析錯誤；`2` 參數錯誤。

## 讀報告

讀 `reports/report.json`，不要讀整份 Markdown。

- `exitCode`、`newlyBroken`、`newlyFixed`、`decisionChanged`：先看這四個。
- `cases[].missing[]`：缺的孔。`nearest.delta` 是最接近的輸出與答案差多少，`nearest.decision` 是產生它的規則。
- `cases[].extraHard[]`：多出、且信心不低的孔，`decision` 是產生它的規則。
- `cases[].decisionChanges`：跟 baseline 比，哪些孔改由不同規則決定。這是找出「改了哪裡害到誰」的主要線索。
- 更細的資料（Z 差異、低信心多出）：`reports/cases/<案例名>.json`。

決策鍵格式為「規則名｜evidence｜面向證據來源」，規則名就是孔的 `note` 全形括號前那段。

## 修復迴圈（每一輪）

1. 在模擬器 `git commit`，作為還原點。
2. `node run.mjs --case <目標>`，讀差異與決策鍵。
3. 修改模擬器 `src`。
4. `node run.mjs --affected-git`，然後 `node run.mjs` 全圖。
5. 判定：
    - 目標通過，而且 `newlyBroken` 為空：在模擬器 `git commit`，並寫一段給人看的修改摘要（改了什麼、為什麼、影響了哪些案例的決策）。
    - `newlyBroken` 不為空：`git checkout -- .` 還原。把壞掉的案例與決策變化，當作下一輪的判斷依據。
6. 測試與修改的輪數不限（使用者 2026-10-13 指定），可以一直嘗試到目標通過且沒有新壞為止。
   只有遇到「需視覺判讀」的情況（見最後一節）才停下來，把證據交給人。

## 禁止事項

- 修改 `fixtures/**/expected.json`、`_match`、`fixtures/groups.json`、`baseline/`。
- 執行 `node run.mjs --accept` 或 `node tools/known-fail.mjs`。這兩個限人工使用。
- 在演算法中讀取答案，或依檔名、料號、圖層名稱、固定座標、固定孔徑寫分支。只能靠幾何推導。
- 放寬公差，或把失敗改標為已知失敗。這兩件事只能提議，由人決定。
- 一次修改多個不相關的問題。

## 背景規則（不得更改）

- Python 參考專案已退役。不要為了「跟 Python 一樣」而改程式；判定一律以回歸答案與幾何推導為準（`docs/python-archive/` 只是歷史紀錄）。

- 本檔的修復迴圈是「AI 測試與修改程式」，輪數不限。模擬器內的「AI 輔助建模」是另一回事，每次最多 40 輪（`AgentLoop.js` 的 `MAX_ROUNDS_CAP`），越短得出結論越好，不得調高。

- 孔徑、X、Y 公差 ±0.2；Z 只報告、不判失敗。
- 多出孔只有在 `status=accepted` 或 `confidence ≥ 0.5` 時才算失敗。
- 圖面一律第三角法。
- 截斷視圖、示意圓、被改成特定數值字串的尺寸線，程式無法自動校正。遇到這類情況，請在摘要中標註「需視覺判讀」，交給人處理，不要硬寫規則去湊答案。
