/**
 * @file cnc-regression 全域設定（要改路徑改這裡）。
 *
 * 模擬器位置的決定順序（前者優先）：
 *   1. 命令列 `--sim <路徑>`
 *   2. 環境變數 `CNC_SIM_PATH`
 *   3. 本檔的 `SIM_PATH`
 * 相對路徑以 cnc-regression 資料夾為基準。
 */

/** 模擬器專案資料夾（含 src/ai/services/dxf3d/index.js 的那一層） */
export const SIM_PATH = '../cnc-simulator-v2';

/** 單案例逾時（秒） */
export const CASE_TIMEOUT_SEC = 180;

/** 平行執行數；0 表示自動（CPU 數 − 1，最多 8） */
export const JOBS = 0;
