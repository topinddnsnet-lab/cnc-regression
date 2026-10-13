"""以 Python 6.80 產生 49 案逐孔參考輸出（含信心度、規則名），供 JS 移植對照。"""
import json, sys, time, traceback
from pathlib import Path
root = Path(sys.argv[1]); fix = Path(sys.argv[2]); out = Path(sys.argv[3])
sys.path.insert(0, str(root))
from dxf_hole_extractor import _hole_z
from dxf_hole_extractor.application.extractor import DxfAnalysisEngine
from dxf_hole_extractor.holes.result_domain import to_hole_result
names = sys.argv[4:] or sorted(p.name for p in fix.iterdir() if (p / 'source.dxf').exists())
for name in names:
    t = time.time()
    try:
        size, holes, _ = DxfAnalysisEngine().analyze_with_stage_snapshots(fix / name / 'source.dxf')
        rows = []
        for h in holes:
            if not (hasattr(h, 'face') and hasattr(h, 'diameter')): continue
            try:
                r = to_hole_result(h); conf, st = r.confidence, r.status.value if hasattr(r.status, 'value') else str(r.status)
            except Exception:
                conf, st = None, None
            rows.append(dict(face=h.face, diameter=h.diameter, x=h.x, y=h.y, z=_hole_z(h, size.z_value),
                             confidence=conf, status=st, note=getattr(h, 'note', None), evidence=getattr(h, 'evidence', None)))
        res = dict(ok=True, size=dict(x=size.x_value, y=size.y_value, z=size.z_value), holes=rows, sec=round(time.time() - t, 1))
    except Exception as e:
        res = dict(ok=False, error=traceback.format_exc()[-1500:])
    (out / f'{name}.json').write_text(json.dumps(res, ensure_ascii=False, indent=1, default=str), encoding='utf-8')
    print(name, res.get('ok'), len(res.get('holes', [])), res.get('sec'), flush=True)
