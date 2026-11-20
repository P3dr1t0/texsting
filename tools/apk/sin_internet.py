#!/usr/bin/env python3
"""Listas de paquetes para «Usar sin internet» (Ajustes): básicos y avanzados.

Uso: sin_internet.py <assets/motor> — lee tl.zip (lo que ya trae el APK), baja el texlive.tlpdb de CTAN y escribe
assets/motor/sin-internet.json con [paquete, bytes de descarga, bytes instalado] de cada lista, sin los paquetes que
el APK ya trae. Así la app sabe qué bajar y cuánto pesa, y la lista se actualiza sola con TeX Live.
"""
import json, lzma, os, sys, time, urllib.request, zipfile

MOTOR = sys.argv[1]
CTAN = ["https://mirror.ctan.org/systems/texlive/tlnet", "https://mirrors.mit.edu/CTAN/systems/texlive/tlnet",
        "https://mirrors.rit.edu/CTAN/systems/texlive/tlnet"]

# Básicos: lo de un curso de ingeniería o ciencias (y lo que suele traer un proyecto de Overleaf).
BASICOS = """
amsmath amsfonts amscls tools graphics xcolor geometry hyperref url bookmark babel babel-spanish csquotes
pgf pgfplots circuitikz siunitx steinmetz pict2e tikz-timing karnaugh-map tikz-cd tikz-3dplot tikzfill pgfornament
booktabs multirow makecell colortbl tabularray nicematrix longtable xltabular tabularx array
tcolorbox pdfcol environ trimspaces mdframed framed zref needspace
fancyhdr titlesec titling tocloft sectsty appendix setspace ragged2e microtype enumitem float caption wrapfig
listings fancyvrb upquote algorithms algorithmicx algorithm2e
mathtools cancel esint esint-type1 physics mhchem chemfig bm gensymb eurosym units nicefrac xfrac
lm cm-super tex-gyre fontawesome5 lipsum blindtext
biblatex biblatex-ieee biblatex-apa IEEEtran cite natbib
beamer etoolbox kvoptions xstring pdfpages pdflscape adjustbox collectbox qrcode
todonotes glossaries acro nomencl datetime2 forest smartdiagram
fontspec unicode-math polyglossia luacode lua-ul luacolor luamplib metapost
""".split()

# Avanzados: casi todo LaTeX (lo que trae una instalación completa de MiKTeX/TeX Live), sin la documentación.
AVANZADOS_COLECCIONES = """
collection-latexrecommended collection-latexextra collection-pictures collection-mathscience
collection-fontsrecommended collection-bibtexextra collection-publishers collection-langspanish
collection-metapost collection-luatex collection-xetex collection-plaingeneric collection-latex
""".split()


def bajar_tlpdb():
    for intento in range(3):
        for m in CTAN:
            try:
                with urllib.request.urlopen(m + "/tlpkg/texlive.tlpdb.xz", timeout=120) as r:
                    return lzma.decompress(r.read()).decode("utf-8", "replace")
            except Exception as e:
                print("tlpdb:", m, e)
        time.sleep(10)
    raise SystemExit("no se pudo bajar texlive.tlpdb")


def leer(tlpdb):
    pk = {}
    for bloque in tlpdb.split("\n\n"):
        d = {"depend": [], "runfiles": [], "csize": 0, "rsize": 0}
        en_run = False
        nombre = None
        for l in bloque.split("\n"):
            if l.startswith("name "):
                nombre = l[5:].strip()
            elif l.startswith("depend "):
                d["depend"].append(l[7:].strip())
            elif l.startswith("containersize "):
                d["csize"] = int(l.split()[1])
            elif l.startswith("runfiles "):
                en_run = True
                for t in l.split()[1:]:
                    if t.startswith("size="):
                        d["rsize"] = int(t[5:]) * 4096  # tlpdb cuenta en bloques de 4 KB
            elif l.startswith(" ") and en_run:
                d["runfiles"].append(l.strip().split(" ")[0])
            else:
                en_run = False
        if nombre:
            pk[nombre] = d
    return pk


def main():
    with zipfile.ZipFile(os.path.join(MOTOR, "tl.zip")) as z:
        en_apk = {n for n in z.namelist() if not n.endswith("/")}
    pk = leer(bajar_tlpdb())

    def traido(nombre):
        """¿El APK ya trae (casi) todo el paquete?"""
        rf = [f.replace("RELOC/", "texmf-dist/") for f in pk[nombre]["runfiles"]]
        rf = [f for f in rf if f.startswith("texmf-dist/")]
        if not rf:
            return True
        return sum(1 for f in rf if f in en_apk) >= 0.9 * len(rf)

    def sirve(n):
        return n in pk and "." not in n and not n.startswith(("collection-", "scheme-", "00texlive", "texlive")) \
            and pk[n]["csize"] > 0 and not traido(n)

    def expandir(raices):
        visto, out, pila = set(), [], list(raices)
        while pila:
            n = pila.pop()
            if n in visto or n not in pk:
                continue
            visto.add(n)
            if sirve(n):
                out.append(n)
            pila.extend(pk[n]["depend"])
        return sorted(out)

    basicos = expandir(BASICOS)
    avanzados = sorted(set(expandir(AVANZADOS_COLECCIONES)) | set(basicos))
    fila = lambda n: [n, pk[n]["csize"], pk[n]["rsize"]]
    datos = {"basicos": [fila(n) for n in basicos], "avanzados": [fila(n) for n in avanzados]}
    with open(os.path.join(MOTOR, "sin-internet.json"), "w") as f:
        json.dump(datos, f, separators=(",", ":"))
    for k, v in datos.items():
        print(f"{k}: {len(v)} paquetes · descarga {sum(x[1] for x in v) / 1e6:.0f} MB · instalado {sum(x[2] for x in v) / 1e6:.0f} MB")
    faltan = [n for n in BASICOS if n not in pk]
    if faltan:
        print("::warning::Paquetes básicos que no existen en TeX Live:", " ".join(faltan))


main()
