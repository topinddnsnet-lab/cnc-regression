/**
 * @file 單元測試共用：載入模擬器 dxf3d 模組（路徑依 config.mjs／CNC_SIM_PATH）。
 */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SIM_PATH } from '../../config.mjs';

const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
/** 模擬器根目錄 */
export const SIM = path.resolve(HERE, process.env.CNC_SIM_PATH || SIM_PATH);

/**
 * 載入模擬器 dxf3d 底下的模組。
 * @param {string} name 檔名（例如 'acisSat.js'）
 * @returns {Promise<object>}
 */
export function dxf3d(name) {
  return import(pathToFileURL(path.join(SIM, 'src/ai/services/dxf3d', name)).href);
}
