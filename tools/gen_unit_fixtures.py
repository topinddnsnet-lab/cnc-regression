# -*- coding: utf-8 -*-
"""產生單元測試用的合成 DXF（移植自 Python 專案的合成測試；需要 ezdxf）。

用法：python tools/gen_unit_fixtures.py
產物：tests/unit/fixtures/*.dxf（已提交進 git，平常不必重產）。
"""
from pathlib import Path

import ezdxf

OUT = Path(__file__).resolve().parents[1] / "tests" / "unit" / "fixtures"


def filleted_rect(msp, x0, y0, w, h, r):
    """以 4 條 LINE＋4 個圓角 ARC 畫封閉矩形，內含 3×26 小卡槽框。"""
    msp.add_line((x0 + r, y0), (x0 + w - r, y0))
    msp.add_line((x0 + w, y0 + r), (x0 + w, y0 + h - r))
    msp.add_line((x0 + w - r, y0 + h), (x0 + r, y0 + h))
    msp.add_line((x0, y0 + h - r), (x0, y0 + r))
    msp.add_arc((x0 + w - r, y0 + r), r, 270, 360)
    msp.add_arc((x0 + w - r, y0 + h - r), r, 0, 90)
    msp.add_arc((x0 + r, y0 + h - r), r, 90, 180)
    msp.add_arc((x0 + r, y0 + r), r, 180, 270)
    msp.add_lwpolyline([(x0 + 2, y0 + 10), (x0 + 5, y0 + 10), (x0 + 5, y0 + 23), (x0 + 5, y0 + 36),
                        (x0 + 2, y0 + 36), (x0 + 2, y0 + 23)], close=True)


def front_view(msp, length, height, strip=0.0):
    """主視圖；strip>0 時在下方多畫一條附件襯條。"""
    msp.add_line((0, 0), (length, 0))
    msp.add_line((length, 0), (length, height))
    msp.add_line((length, height), (0, height))
    msp.add_line((0, height), (0, 0))
    if strip:
        msp.add_line((20, -strip), (length - 20, -strip))
        msp.add_line((20, -strip), (20, 0))
        msp.add_line((length - 20, -strip), (length - 20, 0))
    msp.add_linear_dim(base=(0, height + 40), p1=(0, height), p2=(length, height)).render()


def save(doc, name):
    OUT.mkdir(parents=True, exist_ok=True)
    doc.saveas(OUT / name)
    print(name)


doc = ezdxf.new(); msp = doc.modelspace()
front_view(msp, 1000, 166); filleted_rect(msp, -200, 0, 70, 166, 3)
save(doc, "line_arc_side.dxf")

doc = ezdxf.new(); msp = doc.modelspace()
front_view(msp, 1000, 140, strip=8); filleted_rect(msp, -200, 0, 70, 140, 3)
save(doc, "aligned_side.dxf")

doc = ezdxf.new(); msp = doc.modelspace()
front_view(msp, 1000, 40)
x0 = -200.0
pts = [(x0, 0), (x0 + 30, 0), (x0 + 30, 2), (x0 + 2, 2), (x0 + 2, 40), (x0, 40)]
for a, b in zip(pts, pts[1:]):
    msp.add_line(a, b)
msp.add_arc((x0 + 2, 2), 0.0001, 0, 90)
msp.add_line((x0 + 1, 20), (x0 - 15, 30))
save(doc, "open_profile.dxf")
