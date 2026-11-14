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

# 1) ícono adaptable: primer plano dentro de la zona segura (círculo central de 66/108) + fondo
fg = logo_rgba(1024, fill=0.58)
fg.save(f'{OUT}/icon-foreground.png')
navy_bg(1024, 1024).save(f'{OUT}/icon-background.png')
# 2) ícono clásico (sin recorte adaptable) y el de Play Store
full = render(rings, size=1024, ss=4, fill=0.86, bg=NAVY, **CFG)
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
