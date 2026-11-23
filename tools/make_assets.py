# -*- coding: utf-8 -*-
"""把生成的原图压缩成 webp，并输出可直接内嵌的 assets.js"""
import base64, io, os
from PIL import Image, ImageOps

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(BASE, "assets_raw")
OUT = os.path.join(BASE, "src", "assets.js")
ASSETS_DIR = os.path.join(BASE, "src", "assets")
os.makedirs(ASSETS_DIR, exist_ok=True)

# 商品图统一 720x720，壁纸 1600x900
SPEC = {
    "phonograph": 720,
    "musicbox": 720,
    "lamp": 720,
    "grinder": 720,
    "samplebox": 720,
    "records": 720,
    "woodbox": 720,
    "gears": 720,
    "wallpaper": 1600,
}
KEY = {
    "phonograph": "phonograph",
    "musicbox": "musicbox",
    "lamp": "lamp",
    "grinder": "grinder",
    "samplebox": "samplebox",
    "records": "records",
    "woodbox": "woodbox",
    "gears": "gears",
    "wallpaper": "wallpaper",
}

out = {}
for name, maxw in SPEC.items():
    src = os.path.join(RAW, name + ".jpg")
    im = Image.open(src)
    im = ImageOps.exif_transpose(im).convert("RGB")
    if name == "wallpaper":
        im = ImageOps.fit(im, (maxw, int(maxw * 9 / 16)), method=Image.LANCZOS, centering=(0.5, 0.45))
        q = 82
    else:
        im = ImageOps.fit(im, (maxw, maxw), method=Image.LANCZOS, centering=(0.5, 0.5))
        q = 80
    path = os.path.join(ASSETS_DIR, name + ".webp")
    im.save(path, "WEBP", quality=q, method=5)
    data = base64.b64encode(open(path, "rb").read()).decode()
    out[KEY[name]] = "data:image/webp;base64," + data
    print(name, im.size, os.path.getsize(path))

with open(OUT, "w", encoding="utf-8") as f:
    f.write("/* 自动生成：tools/make_assets.py。图片已压缩为 webp 并内嵌为 data URI。 */\n")
    f.write("window.ASSETS = {\n")
    for k, v in out.items():
        f.write('  %s: "%s",\n' % (k, v))
    f.write("};\n")
print("assets.js", os.path.getsize(OUT))
