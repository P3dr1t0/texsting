import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from render3d import render, tex_logo, LM
import os
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'assets')
NAVY = ((14, 20, 34), (36, 50, 82))
CFG = dict(yaw=-14, pitch=-11, dist_k=0.58, depth=0.42, light=(-0.45, 0.8, 0.55), side=(186, 188, 194), side_dark=(70, 72, 80))
rings = tex_logo(LM)

def logo_rgba(size, fill, ss=4):
    """Logo con fondo transparente (se renderiza sobre negro y sobre blanco y se despeja la transparencia)."""
    b = np.asarray(render(rings, size=size, ss=ss, fill=fill, bg=((0, 0, 0), (0, 0, 0)), **CFG), np.float32)
    w = np.asarray(render(rings, size=size, ss=ss, fill=fill, bg=((255, 255, 255), (255, 255, 255)), **CFG), np.float32)
    alpha = np.clip(255 - (w - b).mean(axis=2), 0, 255)
    a = alpha[..., None] / 255.0
    rgb = np.where(a > 0.003, b / np.maximum(a, 0.003), 0)
    return Image.fromarray(np.dstack([np.clip(rgb, 0, 255), alpha]).astype(np.uint8), 'RGBA')

def navy_bg(w, h):
    top, bot = np.array(NAVY[0]), np.array(NAVY[1])
    g = np.linspace(0, 1, h)[:, None, None]
    arr = (top * (1 - g) + bot * g).astype(np.uint8)
    return Image.fromarray(np.broadcast_to(arr, (h, w, 3)).copy(), 'RGB').convert('RGBA')

def fits(img, R, margin):
    a = np.asarray(img)[..., 3]
    ys, xs = np.nonzero(a > 60)
    c = img.size[0] / 2
    return np.sqrt((xs - c) ** 2 + (ys - c) ** 2).max() <= R * (1 - margin)

def biggest_fill(size, R, margin, lo=0.5, hi=1.0):
    for _ in range(9):  # búsqueda binaria del tamaño
        mid = (lo + hi) / 2
        if fits(logo_rgba(size, fill=mid, ss=1), R, margin): lo = mid
        else: hi = mid
    return lo

# 1) ícono adaptable: el lanzador muestra el círculo/cuadro central de 72 de 108 dp.
#    El logo ocupa casi todo ese ancho, sin salirse del círculo (el recorte más estricto).
R_VIS = 1024 * 36 / 108
FG_FILL = biggest_fill(512, R_VIS * 512 / 1024, margin=0.04)
print('relleno del primer plano', round(FG_FILL, 3))
fg = logo_rgba(1024, fill=FG_FILL)
fg.save(f'{OUT}/icon-foreground.png')
navy_bg(1024, 1024).save(f'{OUT}/icon-background.png')
# 2) ícono clásico (sin recorte adaptable) y el de Play Store
full = render(rings, size=1024, ss=4, fill=0.95, bg=NAVY, **CFG)
full.convert('RGBA').save(f'{OUT}/icon-only.png')
full.resize((512, 512), Image.LANCZOS).convert('RGBA').save(f'{OUT}/play-store-icon-512.png')
# 3) pantalla de arranque: logo centrado sobre azul noche (claro y oscuro iguales: es la marca)
splash = navy_bg(2732, 2732)
lg = logo_rgba(1100, fill=0.92, ss=3)
splash.alpha_composite(lg, ((2732 - 1100) // 2, (2732 - 1100) // 2))
splash.save(f'{OUT}/splash.png'); splash.save(f'{OUT}/splash-dark.png')
# 4) imagen destacada de Play Store (1024×500)
fgimg = navy_bg(1024, 500)
lg = logo_rgba(520, fill=0.92, ss=4)
fgimg.alpha_composite(lg, (14, -22))
d = ImageDraw.Draw(fgimg)
f1 = ImageFont.truetype('/usr/share/fonts/opentype/inter/InterDisplay-Black.otf', 76)
f2 = ImageFont.truetype('/usr/share/fonts/opentype/inter/InterDisplay-Medium.otf', 34)
f3 = ImageFont.truetype('/usr/share/fonts/opentype/inter/InterDisplay-SemiBold.otf', 21)
x0 = 572
d.text((x0, 150), 'TeX', font=f1, fill=(255, 255, 255))
wtex = d.textlength('TeX', font=f1)
d.text((x0 + wtex, 150), 'sting', font=f1, fill=(232, 168, 56))
d.text((x0, 252), 'LaTeX en tu Android,', font=f2, fill=(220, 226, 240))
d.text((x0, 296), 'sin internet.', font=f2, fill=(220, 226, 240))
d.text((x0, 372), 'Gratis · PDF al instante · Paquetes al vuelo', font=f3, fill=(150, 162, 190))
fgimg.convert('RGB').save(f'{OUT}/play-store-feature-1024x500.png')
print('listo')

# 5) recursos de Android en la resolución correcta de cada densidad (el generador automático
#    dejaba el primer plano en 192 px; en pantallas xxxhdpi hacen falta 432 px).
RES = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'android-config', 'res')
DENS = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
bg_full = navy_bg(1024, 1024)
mono = fg.copy()
arr = np.asarray(mono).copy()
lum = arr[..., :3].mean(axis=2)
arr[..., 3] = np.where((lum > 200) & (arr[..., 3] > 128), 255, 0).astype(np.uint8)  # solo las caras blancas
arr[..., :3] = 255
mono = Image.fromarray(arr, 'RGBA')
legacy = full.convert('RGBA')
def rounded(img, radius_k):
    s_ = img.size[0]
    m = Image.new('L', (s_ * 4, s_ * 4), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, s_ * 4 - 1, s_ * 4 - 1], radius=int(s_ * 4 * radius_k), fill=255)
    out = Image.new('RGBA', img.size, (0, 0, 0, 0)); out.paste(img, (0, 0), m.resize(img.size, Image.LANCZOS)); return out
def circle(img):
    s_ = img.size[0]
    m = Image.new('L', (s_ * 4, s_ * 4), 0); ImageDraw.Draw(m).ellipse([0, 0, s_ * 4 - 1, s_ * 4 - 1], fill=255)
    out = Image.new('RGBA', img.size, (0, 0, 0, 0)); out.paste(img, (0, 0), m.resize(img.size, Image.LANCZOS)); return out
for dname, k in DENS.items():
    d_ = os.path.join(RES, f'mipmap-{dname}'); os.makedirs(d_, exist_ok=True)
    a = int(108 * k); l = int(48 * k)
    fg.resize((a, a), Image.LANCZOS).save(f'{d_}/ic_launcher_foreground.png')
    bg_full.resize((a, a), Image.LANCZOS).save(f'{d_}/ic_launcher_background.png')
    mono.resize((a, a), Image.LANCZOS).save(f'{d_}/ic_launcher_monochrome.png')
    rounded(legacy.resize((l, l), Image.LANCZOS), 0.18).save(f'{d_}/ic_launcher.png')
    circle(legacy.resize((l, l), Image.LANCZOS)).save(f'{d_}/ic_launcher_round.png')
d_ = os.path.join(RES, 'mipmap-anydpi-v26'); os.makedirs(d_, exist_ok=True)
xml = """<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
    <monochrome android:drawable="@mipmap/ic_launcher_monochrome" />
</adaptive-icon>
"""
for n in ('ic_launcher.xml', 'ic_launcher_round.xml'):
    open(os.path.join(d_, n), 'w').write(xml)
print('recursos de Android listos')
