"""Renderizador 3D sencillo para el ícono de TeXsting.

Toma el contorno real de cada letra (TextPath de matplotlib), lo extruye, lo proyecta con una
cámara en perspectiva y lo pinta con el algoritmo del pintor (primero los lados del fondo,
luego los de adelante y al final las caras frontales, que siempre están más cerca de la cámara).
"""
import math
import numpy as np
from matplotlib.textpath import TextPath
from matplotlib.font_manager import FontProperties
from PIL import Image, ImageDraw, ImageFilter, ImageChops

LM = '/usr/share/texmf/fonts/opentype/public/lm/lmroman10-bold.otf'
INTER = '/usr/share/fonts/opentype/inter/InterDisplay-Black.otf'


def glyph_rings(text_parts, font):
    """text_parts: lista de (texto, dx_em, dy_em) relativos al avance anterior. Devuelve anillos (N×2) en em."""
    fp = FontProperties(fname=font)
    rings, x = [], 0.0
    for txt, kern, dy in text_parts:
        x += kern
        tp = TextPath((x, dy), txt, size=1.0, prop=fp)
        cur = []
        for curve, code in tp.iter_bezier():
            if code == 1:  # MOVETO: empieza un anillo nuevo
                if len(cur) >= 3: rings.append(np.asarray(cur, float))
                cur = [curve.control_points[0]]
                continue
            if code == 79:  # CLOSEPOLY
                if len(cur) >= 3: rings.append(np.asarray(cur, float))
                cur = []
                continue
            n = 1 if curve.degree == 1 else 14
            for t in np.linspace(0, 1, n + 1)[1:]:
                cur.append(curve.point_at_t(t))
        if len(cur) >= 3: rings.append(np.asarray(cur, float))
        # avance: ancho del texto
        adv = TextPath((0, 0), txt, size=1.0, prop=fp).get_extents().x1
        x += adv
    return rings


def tex_logo(font, lowered=True, suffix="'s", kern=(-0.10, -0.07)):
    if lowered:  # como el logo de TeX: E bajada 0,5 ex (un poco más separadas por la extrusión)
        parts = [('T', 0, 0), ('E', kern[0], -0.215), ('X', kern[1], 0)]
    else:
        parts = [('TeX', 0, 0)]
    if suffix:
        parts.append((suffix, 0.02, 0))
    return glyph_rings(parts, font)


class Camera:
    def __init__(self, target, yaw, pitch, dist, roll=0.0):
        self.T = np.array(target, float)
        cy, sy = math.cos(math.radians(yaw)), math.sin(math.radians(yaw))
        cp, sp = math.cos(math.radians(pitch)), math.sin(math.radians(pitch))
        self.P = self.T + dist * np.array([sy * cp, sp, cy * cp])
        f = self.T - self.P
        self.f = f / np.linalg.norm(f)
        r = np.cross(self.f, [0, 1, 0])
        self.r = r / np.linalg.norm(r)
        self.u = np.cross(self.r, self.f)
        if roll:
            c, s = math.cos(math.radians(roll)), math.sin(math.radians(roll))
            self.r, self.u = c * self.r + s * self.u, -s * self.r + c * self.u

    def project(self, pts):
        d = pts - self.P
        xc, yc, zc = d @ self.r, d @ self.u, d @ self.f
        return np.stack([xc / zc, -yc / zc], axis=1), zc


def render(rings, *, size=1024, ss=4, depth=0.32, yaw=-34, pitch=-12, dist_k=1.55, roll=0.0,
           bg=((18, 24, 38), (34, 46, 72)), side=(128, 128, 136), side_dark=(70, 72, 80),
           front=(255, 255, 255), outline=(0, 0, 0), outline_w=0.0055, fill=0.80,
           floor_shadow=True, light=(0.45, 0.75, 0.55), bg_style='vertical', glow=None):
    S = size * ss
    allp = np.vstack(rings)
    cx, cy = (allp[:, 0].min() + allp[:, 0].max()) / 2, (allp[:, 1].min() + allp[:, 1].max()) / 2
    W = allp[:, 0].max() - allp[:, 0].min()
    rings = [r - [cx, cy] for r in rings]
    ymin = min(r[:, 1].min() for r in rings)
    cam = Camera((0, 0, -depth / 2), yaw, pitch, dist_k * W, roll)
    L = np.array(light, float); L /= np.linalg.norm(L)

    def to3(r, z):
        return np.column_stack([r[:, 0], r[:, 1], np.full(len(r), z)])

    # --- caras laterales
    quads = []
    for r in rings:
        n = len(r)
        for i in range(n):
            a, b = r[i], r[(i + 1) % n]
            if np.allclose(a, b):
                continue
            q = np.array([[a[0], a[1], 0], [b[0], b[1], 0], [b[0], b[1], -depth], [a[0], a[1], -depth]])
            e = b - a
            nrm = np.array([e[1], -e[0], 0.0]); nrm /= np.linalg.norm(nrm) + 1e-12
            cen = q.mean(0)
            if np.dot(nrm, cam.P - cen) < 0:
                nrm = -nrm
            quads.append((q, nrm))
    # proyección y ajuste a la imagen
    proj_front = [cam.project(to3(r, 0))[0] for r in rings]
    proj_back = [cam.project(to3(r, -depth))[0] for r in rings]
    pts = np.vstack(proj_front + proj_back)
    lo, hi = pts.min(0), pts.max(0)
    k = fill * S / max(hi - lo)
    off = np.array([S, S]) / 2 - (lo + hi) / 2 * k

    def scr(p2):
        return [tuple(v) for v in (p2 * k + off)]

    # --- fondo
    img = Image.new('RGB', (S, S))
    if bg_style == 'radial':
        yy, xx = np.mgrid[0:S, 0:S].astype(np.float32)
        d = np.sqrt((xx - S * 0.5) ** 2 + (yy - S * 0.42) ** 2) / (S * 0.75)
        t = np.clip(d, 0, 1)[..., None]
        arr = (np.array(bg[1]) * (1 - t) + np.array(bg[0]) * t).astype(np.uint8)
        img = Image.fromarray(arr, 'RGB')
    else:
        top, bot = np.array(bg[0]), np.array(bg[1])
        g = np.linspace(0, 1, S)[:, None, None]
        arr = (top * (1 - g) + bot * g).astype(np.uint8)
        img = Image.fromarray(np.broadcast_to(arr, (S, S, 3)).copy(), 'RGB')
    if glow:  # halo suave detrás de las letras
        gl = Image.new('L', (S, S), 0)
        gd = ImageDraw.Draw(gl)
        for pf in proj_front:
            gd.polygon(scr(pf), fill=255)
        gl = gl.filter(ImageFilter.GaussianBlur(S * 0.05))
        img = Image.composite(Image.new('RGB', (S, S), glow), img, gl.point(lambda v: int(v * 0.55)))

    # --- sombra en el piso (proyección de las letras sobre el plano y = ymin, desde la luz)
    if floor_shadow:
        Ld = -L  # dirección en la que viaja la luz
        Ld = np.array([Ld[0], -abs(Ld[1]), Ld[2]])
        sh = Image.new('L', (S, S), 0)
        sd = ImageDraw.Draw(sh)
        for r in rings:
            for z in (0.0, -depth):
                p3 = to3(r, z)
                t = (ymin - p3[:, 1]) / Ld[1]
                fl = p3 + t[:, None] * Ld
                sd.polygon(scr(cam.project(fl)[0]), fill=255)
        sh = sh.filter(ImageFilter.GaussianBlur(S * 0.012))
        img = Image.composite(Image.new('RGB', (S, S), (0, 0, 0)), img, sh.point(lambda v: int(v * 0.42)))

    draw = ImageDraw.Draw(img)
    # --- lados: del más lejano al más cercano
    ow = max(1, int(outline_w * S))
    edge_col = tuple(int(c * 0.45) for c in side_dark)
    items = []
    for q, nrm in quads:
        p2, zc = cam.project(q)
        lam = 0.30 + 0.70 * max(0.0, float(np.dot(nrm, L)))
        col = tuple(int(side_dark[i] + (side[i] - side_dark[i]) * lam) for i in range(3))
        items.append((zc.max(), p2, col))
    items.sort(key=lambda t: -t[0])
    for _, p2, col in items:
        sp = scr(p2)
        draw.polygon(sp, fill=col, outline=col)
        draw.line([sp[2], sp[3]], fill=edge_col, width=max(1, ow // 2))  # borde trasero de esta cara

    # --- caras frontales (con agujeros por XOR) + borde negro
    mask = Image.new('1', (S, S), 0)
    for pf in proj_front:
        m = Image.new('1', (S, S), 0)
        ImageDraw.Draw(m).polygon(scr(pf), fill=1)
        mask = ImageChops.logical_xor(mask, m)
    img.paste(Image.new('RGB', (S, S), front), mask=mask)
    draw = ImageDraw.Draw(img)
    for pf in proj_front:
        pts2 = scr(pf)
        draw.line(pts2 + [pts2[0]], fill=outline, width=ow, joint='curve')
    return img.resize((size, size), Image.LANCZOS)


def as_launcher(img, shape='squircle'):
    """Simula cómo lo recorta el lanzador de Android."""
    s = img.size[0]
    m = Image.new('L', (s * 4, s * 4), 0)
    d = ImageDraw.Draw(m)
    if shape == 'circle':
        d.ellipse([0, 0, s * 4 - 1, s * 4 - 1], fill=255)
    else:
        d.rounded_rectangle([0, 0, s * 4 - 1, s * 4 - 1], radius=int(s * 4 * 0.24), fill=255)
    m = m.resize((s, s), Image.LANCZOS)
    out = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    out.paste(img.convert('RGBA'), mask=m)
    return out
