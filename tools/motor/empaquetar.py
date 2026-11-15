"""Motor integrado (#1), prueba de concepto: arma lo que va dentro del APK para compilar
con pdfLaTeX SIN Termux.

  1. Binario: pdftex de Termux (aarch64, TeX Live 2026) y sus bibliotecas, renombrados
     como lib*.so para que Android los instale en nativeLibraryDir (el único lugar desde
     donde una app puede ejecutar programas).
  2. Datos: un TeX Live mínimo (LaTeX + paquetes de uso común) instalado en el runner;
     se guardan solo los archivos que de verdad se leen al crear el formato y al compilar
     documentos de prueba (se registran con strace).
  3. Se comprueba en el runner que esos datos alcanzan, usando el pdftex de x86_64 con
     el mismo ambiente que usará la app.

Uso: python3 tools/motor/empaquetar.py <salida>
  <salida>/jniLibs/arm64-v8a/*.so   y   <salida>/assets/motor/{tl.zip,version.txt}
"""
import collections, gzip, hashlib, lzma, os, re, shutil, subprocess, sys, tarfile, urllib.request, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else "motor-out/paquete")
WORK = os.path.abspath("motor-work")
TERMUX = "https://packages.termux.dev/apt/termux-main"
CTAN = "https://mirror.ctan.org/systems/texlive/tlnet"
TL = os.path.join(WORK, "tl")  # TeX Live del runner (x86_64)

# Paquetes de LaTeX incluidos en esta prueba (además de la base).
EXTRA = ["collection-latex", "babel-spanish", "hyphen-spanish", "geometry", "booktabs", "xcolor",
         "amsmath", "tools", "graphics", "hyperref", "fancyhdr", "enumitem", "caption", "float",
         "multirow", "siunitx", "lm", "cm-super", "titlesec", "parskip", "csquotes"]

def sh(cmd, **kw):
    print("+", cmd if isinstance(cmd, str) else " ".join(cmd), flush=True)
    return subprocess.run(cmd, shell=isinstance(cmd, str), check=True, **kw)

def get(url, dest):
    for i in range(4):
        try:
            with urllib.request.urlopen(url, timeout=300) as r, open(dest, "wb") as f:
                shutil.copyfileobj(r, f)
            return dest
        except Exception as e:
            print("reintento", url, e)
    raise SystemExit("No se pudo descargar " + url)

os.makedirs(WORK, exist_ok=True)
shutil.rmtree(OUT, ignore_errors=True)
JNI = os.path.join(OUT, "jniLibs", "arm64-v8a")
ASSETS = os.path.join(OUT, "assets", "motor")
os.makedirs(JNI); os.makedirs(ASSETS)

# ───────────────────────── 1. Binario de Termux ─────────────────────────
idx_path = get(f"{TERMUX}/dists/stable/main/binary-aarch64/Packages", os.path.join(WORK, "Packages"))
pkgs, cur = {}, {}
for line in open(idx_path, encoding="utf-8").read().splitlines() + [""]:
    if not line.strip():
        if "Package" in cur: pkgs[cur["Package"]] = cur
        cur = {}
    elif ":" in line and not line.startswith(" "):
        k, v = line.split(":", 1); cur[k] = v.strip()

root = os.path.join(WORK, "termux")
shutil.rmtree(root, ignore_errors=True); os.makedirs(root)
for name in ["texlive-bin", "libandroid-complex-math", "libc++", "libpng", "zlib", "libandroid-support"]:
    deb = get(f"{TERMUX}/{pkgs[name]['Filename']}", os.path.join(WORK, name + ".deb"))
    sh(["dpkg-deb", "-x", deb, root])
usr = os.path.join(root, "data/data/com.termux/files/usr")
libdir = os.path.join(usr, "lib")
pdftex = os.path.realpath(os.path.join(usr, "bin", "texlive", "pdftex"))
texlive_bin_version = pkgs["texlive-bin"]["Version"]

def needed(path):
    out = subprocess.run(["readelf", "-d", path], capture_output=True, text=True).stdout
    return re.findall(r"\(NEEDED\)\s+Shared library: \[(.+?)\]", out)

SYSTEM = {"libc.so", "libm.so", "libdl.so", "liblog.so"}  # las pone Android
closure, todo = {}, [pdftex]
while todo:
    for n in needed(todo.pop()):
        if n in SYSTEM or n in closure: continue
        p = os.path.join(libdir, n)
        if not os.path.exists(p): raise SystemExit("Falta la biblioteca " + n)
        closure[n] = os.path.realpath(p); todo.append(closure[n])
print("pdftex necesita:", ", ".join(closure))

# Android solo instala archivos llamados lib*.so: los que no cumplen se renombran.
ok_name = re.compile(r"^lib[A-Za-z0-9_+\-]+\.so$")
rename = {n: (n if ok_name.match(n) else "libtx_" + re.sub(r"\W", "", n.split(".so")[0][3:]) + ".so") for n in closure}
shutil.copy(pdftex, os.path.join(JNI, "libtx_pdftex.so"))
for n, real in closure.items():
    shutil.copy(real, os.path.join(JNI, rename[n]))
for f in os.listdir(JNI):
    p = os.path.join(JNI, f)
    os.chmod(p, 0o755)
    for n in needed(p):
        if n in rename and rename[n] != n:
            sh(["patchelf", "--replace-needed", n, rename[n], p])
    if f in [rename[n] for n in closure if rename[n] != n]:
        sh(["patchelf", "--set-soname", f, p])
    # Alineación de segmentos (Android 15+ con páginas de 16 KB necesita 0x4000)
    seg = subprocess.run(["readelf", "-lW", p], capture_output=True, text=True).stdout
    aligns = sorted(set(re.findall(r"LOAD\s+.*\s(0x[0-9a-f]+)$", seg, re.M)))
    print(f"  {f:32s} {os.path.getsize(p)/1e6:6.2f} MB  alineación {aligns}  NEEDED {needed(p)}")

# ───────────────────────── 2. TeX Live mínimo ─────────────────────────
if not os.path.exists(os.path.join(TL, "bin", "x86_64-linux", "pdftex")):
    tgz = get(f"{CTAN}/install-tl-unx.tar.gz", os.path.join(WORK, "install-tl.tgz"))
    inst = os.path.join(WORK, "install-tl"); shutil.rmtree(inst, ignore_errors=True); os.makedirs(inst)
    with tarfile.open(tgz) as t: t.extractall(inst)
    inst = os.path.join(inst, os.listdir(inst)[0])
    prof = os.path.join(WORK, "tl.profile")
    open(prof, "w").write(f"""selected_scheme scheme-minimal
TEXDIR {TL}
TEXMFLOCAL {TL}/texmf-local
TEXMFSYSVAR {TL}/texmf-var
TEXMFSYSCONFIG {TL}/texmf-config
TEXMFVAR {TL}/texmf-var
TEXMFCONFIG {TL}/texmf-config
TEXMFHOME {TL}/texmf-home
binary_x86_64-linux 1
instopt_adjustpath 0
instopt_adjustrepo 0
tlpdbopt_install_docfiles 0
tlpdbopt_install_srcfiles 0
tlpdbopt_autobackup 0
""")
    sh([os.path.join(inst, "install-tl"), "-profile", prof, "-repository", CTAN, "-no-interaction"])
    sh([os.path.join(TL, "bin", "x86_64-linux", "tlmgr"), "install"] + EXTRA)
BIN = os.path.join(TL, "bin", "x86_64-linux")
envtl = dict(os.environ, PATH=BIN + ":" + os.environ["PATH"])
sh(["fmtutil-sys", "--byfmt", "pdflatex"], env=envtl)
year = subprocess.run([os.path.join(BIN, "tex"), "--version"], capture_output=True, text=True).stdout.splitlines()[0]
print("TeX Live del runner:", year, "| texlive-bin de Termux:", texlive_bin_version)

# Documentos de prueba: lo que se lea al compilarlos queda dentro del APK.
tests = os.path.join(WORK, "docs"); shutil.rmtree(tests, ignore_errors=True); os.makedirs(tests)
shutil.copytree(os.path.join(HERE, "docs"), tests, dirs_exist_ok=True)
docs = sorted(f for f in os.listdir(tests) if f.endswith(".tex"))

def traced(cmd, cwd, env):
    log = os.path.join(WORK, "strace.txt")
    subprocess.run(["strace", "-f", "-qq", "-e", "trace=openat,open,stat,newfstatat,access", "-o", log] + cmd,
                   cwd=cwd, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    files = set()
    for line in open(log, errors="replace"):
        m = re.search(r'"(' + re.escape(TL) + r'/[^"]+)"', line)
        if m and "ENOENT" not in line: files.add(os.path.normpath(m.group(1)))
    return files

used = set()
fmtdir = os.path.join(WORK, "fmt"); shutil.rmtree(fmtdir, ignore_errors=True); os.makedirs(fmtdir)
used |= traced([os.path.join(BIN, "pdftex"), "-ini", "-jobname=pdflatex", "-progname=pdflatex",
                "-translate-file=cp227.tcx", "*pdflatex.ini"], fmtdir, envtl)
for d in docs:
    for _ in range(2):
        used |= traced([os.path.join(BIN, "pdflatex"), "-interaction=nonstopmode", "-synctex=1", d], tests, envtl)
keep = set()
for f in used:
    rel = os.path.relpath(f, TL)
    if not os.path.isfile(f) or rel.startswith(("bin/", "tlpkg/", "texmf-var/web2c/")) or rel.endswith((".fmt", ".log")):
        continue
    if rel.startswith("texmf-var/fonts/map/dvips/"): continue  # solo para dvips
    if rel.split("/")[0] in ("texmf-dist", "texmf-var"): keep.add(rel)
# strace solo ve lo que usaron estos documentos (p. ej. solo los tamaños de letra de 11 pt).
# Para no quedarse corto, cada carpeta usada entra completa: todas las fuentes de una familia
# y todos los archivos de un paquete. Las carpetas enormes (cm-super) quedan como estaban.
def dir_size(d):
    return sum(os.path.getsize(os.path.join(d, f)) for f in os.listdir(d) if os.path.isfile(os.path.join(d, f)))
expanded = set()
for rel in list(keep):
    d = os.path.dirname(rel)
    if d in expanded or not d.startswith(("texmf-dist/fonts/", "texmf-dist/tex/latex/")): continue
    full = os.path.join(TL, d)
    if dir_size(full) > 12e6:
        continue  # p. ej. cm-super (60 MB): solo lo usado
    expanded.add(d)
    for f in os.listdir(full):
        if os.path.isfile(os.path.join(full, f)) and not f.endswith((".log", ".fmt")):
            keep.add(os.path.join(d, f))
print(f"Carpetas completas: {len(expanded)}")
by = collections.Counter()
for rel in keep:
    if os.path.isfile(os.path.join(TL, rel)): by[os.path.dirname(rel)] += os.path.getsize(os.path.join(TL, rel))
for d, n in by.most_common(20): print(f"  {n/1e6:6.2f} MB  {d}")
keep |= {"texmf-dist/web2c/texmf.cnf", "texmf-dist/web2c/fmtutil.cnf"}
for name in ["cp227.tcx", "pdftexconfig.tex", "language.dat", "language.def", "pdftex.map"]:
    p = subprocess.run([os.path.join(BIN, "kpsewhich"), name], capture_output=True, text=True, env=envtl).stdout.strip()
    if p: keep.add(os.path.relpath(p, TL))

sub = os.path.join(WORK, "sub"); shutil.rmtree(sub, ignore_errors=True)
for rel in sorted(keep):
    dst = os.path.join(sub, rel); os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copy2(os.path.join(TL, rel), dst)
sh([os.path.join(BIN, "mktexlsr"), os.path.join(sub, "texmf-dist"), os.path.join(sub, "texmf-var")], env=envtl)
size = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(sub) for f in fs)
print(f"Datos de TeX: {len(keep)} archivos, {size/1e6:.1f} MB")

# ───────────────────────── 3. Prueba con el mismo ambiente que la app ─────────────────────────
def app_env(tlroot, var):
    # Igual que MotorPlugin.java
    return {"PATH": "/usr/bin:/bin", "HOME": var, "TMPDIR": var, "TEXMFCNF": tlroot + "/texmf-dist/web2c",
            "TEXMFROOT": tlroot, "TEXMFDIST": tlroot + "/texmf-dist", "TEXMFSYSVAR": tlroot + "/texmf-var",
            "TEXMFSYSCONFIG": tlroot + "/texmf-config", "TEXMFLOCAL": tlroot + "/texmf-local",
            "TEXMFVAR": var + "/texmf-var", "TEXMFCONFIG": var + "/texmf-config", "TEXMFHOME": var + "/texmf",
            "TEXMFCACHE": var + "/cache", "MKTEXTFM": "0", "MKTEXPK": "0", "MKTEXMF": "0", "MKTEXFMT": "0"}

check = os.path.join(WORK, "check"); shutil.rmtree(check, ignore_errors=True)
shutil.copytree(sub, os.path.join(check, "tl"))
fake = os.path.join(check, "lib"); os.makedirs(fake)
shutil.copy(os.path.join(BIN, "pdftex"), os.path.join(fake, "libtx_pdftex.so"))  # lejos de TeX Live
var = os.path.join(check, "var"); fdir = os.path.join(var, "texmf-var", "web2c", "pdftex"); os.makedirs(fdir)
env = app_env(os.path.join(check, "tl"), var)
r = subprocess.run([os.path.join(fake, "libtx_pdftex.so"), "-ini", "-jobname=pdflatex", "-progname=pdflatex",
                    "-translate-file=cp227.tcx", "*pdflatex.ini"], cwd=fdir, env=env, capture_output=True, text=True)
print(r.stdout[-1500:])
if not os.path.exists(os.path.join(fdir, "pdflatex.fmt")): raise SystemExit("No se pudo crear el formato con los datos reducidos")
proj = os.path.join(check, "docs"); shutil.copytree(tests, proj)
for d in docs:
    for f in os.listdir(proj):
        if f.endswith((".aux", ".pdf", ".log", ".synctex.gz", ".out", ".toc")): os.remove(os.path.join(proj, f))
    for _ in range(2):
        r = subprocess.run([os.path.join(fake, "libtx_pdftex.so"), "-progname=pdflatex", "-fmt=pdflatex",
                            "-interaction=nonstopmode", "-file-line-error", "-synctex=1", d],
                           cwd=proj, env=env, capture_output=True, text=True)
    pdf = os.path.join(proj, d[:-4] + ".pdf")
    # Igual que la app: cualquier «! …» o «archivo:línea:» del registro cuenta como error.
    logtxt = open(os.path.join(proj, d[:-4] + ".log"), errors="replace").read()
    errs = re.findall(r"^(?:! .*|.*:\d+: .*)$", logtxt, re.M)
    print(f"Prueba {d}: {'PDF OK' if os.path.exists(pdf) else 'SIN PDF'}  errores={errs[:5]}")
    if not os.path.exists(pdf) or errs:
        print(r.stdout[-3000:]); raise SystemExit("La prueba con los datos reducidos falló: " + d)

# ───────────────────────── 3b. Índice archivo → paquete (para bajar paquetes al vuelo) ─────────────────────────
INDEX_EXT = (".sty", ".cls", ".def", ".fd", ".cfg", ".clo", ".ldf", ".tfm", ".bbx", ".cbx", ".lbx", ".dbx",
             ".tex", ".pfb", ".map", ".enc", ".vf")
tlpdb = lzma.decompress(open(get(f"{CTAN}/tlpkg/texlive.tlpdb.xz", os.path.join(WORK, "tlpdb.xz")), "rb").read()).decode("utf-8", "replace")
index, sizes = {}, {}
for block in tlpdb.split("\n\n"):
    name, in_run, files, csize = None, False, [], 0
    for line in block.split("\n"):
        if line.startswith("name "): name = line[5:].strip()
        elif line.startswith("containersize "): csize = int(line.split()[1])
        elif line.startswith("runfiles "): in_run = True
        elif line.startswith(" ") and in_run: files.append(line.strip().split(" ")[0])
        else: in_run = False
    if not name or "." in name or name.startswith(("00texlive", "collection-", "scheme-", "texlive-")): continue
    sizes[name] = csize
    for f in files:
        if f.startswith(("texmf-dist/", "RELOC/")) and f.lower().endswith(INDEX_EXT):  # tlnet usa RELOC/
            index.setdefault(os.path.basename(f), name)
# .idx y no .txt.gz: Android quita el .gz de los assets al empaquetar.
with gzip.open(os.path.join(ASSETS, "indice.idx"), "wt", encoding="utf-8", compresslevel=9) as z:
    for k in sorted(index): z.write(f"{k}\t{index[k]}\n")
    for k in sorted(sizes): z.write(f"@{k}\t{sizes[k]}\n")
print(f"Índice: {len(index)} archivos de {len(sizes)} paquetes, {os.path.getsize(os.path.join(ASSETS, 'indice.idx'))/1e6:.2f} MB")

# Prueba de «paquete al vuelo»: circuitikz no viene en el APK; se baja de CTAN como lo hará la app
# (archive/<paquete>.tar.xz → TEXMFHOME, sin ls-R) y se compila con el mismo ambiente.
home_dir = os.path.join(var, "texmf")
def bajar(pkg):
    arch = get(f"{CTAN}/archive/{pkg}.tar.xz", os.path.join(WORK, pkg + ".tar.xz"))
    with tarfile.open(arch) as t:
        for m in t.getmembers():
            # Los paquetes «reubicables» de tlnet guardan las rutas sin texmf-dist/ (tex/latex/…).
            rel = m.name[2:] if m.name.startswith("./") else m.name
            rel = rel[len("texmf-dist/"):] if rel.startswith("texmf-dist/") else rel
            if m.isfile() and not rel.startswith(("tlpkg/", "bin/")):
                dst = os.path.join(home_dir, rel); os.makedirs(os.path.dirname(dst), exist_ok=True)
                with t.extractfile(m) as src, open(dst, "wb") as out: shutil.copyfileobj(src, out)
open(os.path.join(proj, "circuito.tex"), "w").write(r"""\documentclass[conference]{IEEEtran}
\usepackage{cite}
\usepackage{amsmath,amssymb}
\usepackage{algorithmic}
\usepackage[american]{circuitikz}
\usetikzlibrary{calc,arrows.meta,positioning}
\usepackage{pgfplots}\pgfplotsset{compat=1.18}
\begin{document}
\title{Prueba IEEE}\author{TeXsting}\maketitle
\begin{abstract}Resumen con \textbf{negrita}, \textit{cursiva} y \textsc{versalitas}, 25\textdegree.\end{abstract}
\section{Circuito}
\begin{circuitikz} \draw (0,0) to[R=$R_1$] (2,0) to[C=$C$] (2,-2) -- (0,-2) to[V=$V$] (0,0); \end{circuitikz}
\begin{tikzpicture}\begin{axis}[width=5cm]\addplot {x^2};\end{axis}\end{tikzpicture}
\end{document}
""")
# Lo que ya trae el APK (como bundledNames() en MotorPlugin.java)
bundled = set()
for tree in ("texmf-dist", "texmf-var"):
    for l in open(os.path.join(sub, tree, "ls-R"), errors="replace").read().split("\n"):
        if l and not l.startswith("%") and not l.endswith(":"): bundled.add(l)
PATS = [r"LaTeX Error: File `([^']+)' not found", r"! I can't find file `([^']+)'",
        r"Font \\[^=\s]+=([A-Za-z0-9_\-]+)(?: at [^ ]+| scaled \d+)? not loadable: Metric \(TFM\) file not found",
        r"I did not find the tikz library '([^']+)'", r"\(file ([^)\s]+\.pf[ab])\): cannot open Type 1 font file",
        r"\(file ([^)\s]+\.enc)\): cannot open encoding file"]
def faltantes(txt):
    out = []
    for k, pat in enumerate(PATS):
        for m in re.finditer(pat, txt):
            n = m.group(1)
            if k == 2: n += ".tfm"
            if k == 3: n = "tikzlibrary" + n + ".code.tex"
            if k == 1 and "." not in n: n += ".tex"
            out.append(n)
    for m in re.finditer(r"Font shape `([A-Za-z0-9]+)/([^/']+)/[^']*' undefined", txt):
        fd = (m.group(1) + m.group(2)).lower() + ".fd"
        if fd not in bundled: out.append(fd)
    return list(dict.fromkeys(out))
instalados = []
for ronda in range(10):
    r = subprocess.run([os.path.join(fake, "libtx_pdftex.so"), "-progname=pdflatex", "-fmt=pdflatex", "-interaction=nonstopmode",
                        "-file-line-error", "circuito.tex"], cwd=proj, env=env, capture_output=True, text=True)
    logtxt = open(os.path.join(proj, "circuito.log"), errors="replace").read()
    miss = faltantes(logtxt + "\n" + r.stdout)
    nuevos = list(dict.fromkeys(index.get(m) for m in miss if index.get(m) and index.get(m) not in instalados))
    print(f"  ronda {ronda}: faltan {miss} → {nuevos}")
    if not nuevos: break
    for p_ in nuevos:
        bajar(p_); instalados.append(p_)
        # .map de las fuentes nuevas → copia propia de pdftex.map (como install() en MotorPlugin.java)
        vmap = os.path.join(var, "texmf-var", "fonts", "map", "pdftex", "updmap", "pdftex.map")
        if not os.path.exists(vmap):
            os.makedirs(os.path.dirname(vmap), exist_ok=True)
            shutil.copy(os.path.join(sub, "texmf-var", "fonts", "map", "pdftex", "updmap", "pdftex.map"), vmap)
        for dp, _, fs in os.walk(os.path.join(home_dir, "fonts", "map")):
            for f in fs:
                if f.endswith(".map") and f"/{p_}" in dp + "/":
                    with open(vmap, "a") as o: o.write("\n" + open(os.path.join(dp, f), errors="replace").read())
errs = re.findall(r"^(?:! .*|.*:\d+: .*)$", logtxt, re.M)
shapes = re.findall(r"Font shape `[^']+' undefined", logtxt)
pdfp = os.path.join(proj, "circuito.pdf")
fonts = sorted(set(re.findall(rb"/BaseFont\s*/(?:[A-Z]{6}\+)?([A-Za-z0-9\-]+)", open(pdfp, "rb").read()))) if os.path.exists(pdfp) else []
ok = os.path.exists(pdfp) and not errs
print("Prueba de paquetes al vuelo:", "PDF OK" if ok else "FALLÓ", "| instalados:", instalados, "| errores:", errs[:5])
print("  avisos de fuente:", shapes[:6], "| fuentes en el PDF:", [f.decode() for f in fonts])
if not ok: raise SystemExit("La prueba de paquetes al vuelo falló")

# ───────────────────────── 4. Empaquetar ─────────────────────────
zpath = os.path.join(ASSETS, "tl.zip")
with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for dp, _, fs in os.walk(sub):
        for f in fs:
            full = os.path.join(dp, f); z.write(full, os.path.relpath(full, sub))
h = hashlib.sha256(open(zpath, "rb").read()).hexdigest()[:12]
open(os.path.join(ASSETS, "version.txt"), "w").write(f"{h}\n{year}\ntexlive-bin {texlive_bin_version}\n")
jsize = sum(os.path.getsize(os.path.join(JNI, f)) for f in os.listdir(JNI))
print(f"Listo: binarios {jsize/1e6:.1f} MB, datos {os.path.getsize(zpath)/1e6:.1f} MB comprimidos (versión {h})")
