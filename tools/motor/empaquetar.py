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
import collections, gzip, hashlib, lzma, os, time, re, shutil, subprocess, sys, tarfile, urllib.request, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else "motor-out/paquete")
WORK = os.path.abspath("motor-work")
TERMUX = "https://packages.termux.dev/apt/termux-main"
CTAN = "https://mirror.ctan.org/systems/texlive/tlnet"
TL = os.path.join(WORK, "tl")  # TeX Live del runner (x86_64)

# Paquetes de LaTeX incluidos en esta prueba (además de la base).
EXTRA = ["collection-latex", "babel-spanish", "hyphen-spanish", "geometry", "booktabs", "xcolor",
         "amsmath", "tools", "graphics", "hyperref", "fancyhdr", "enumitem", "caption", "float",
         "multirow", "siunitx", "lm", "cm-super", "titlesec", "parskip", "csquotes", "mylatexformat"]

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
    out = subprocess.run(["readelf", "-d", path], capture_output=True, text=True, errors="replace").stdout
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
    seg = subprocess.run(["readelf", "-lW", p], capture_output=True, text=True, errors="replace").stdout
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
year = subprocess.run([os.path.join(BIN, "tex"), "--version"], capture_output=True, text=True, errors="replace").stdout.splitlines()[0]
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
# mylatexformat: para guardar el preámbulo de cada proyecto ya cargado (compilar más rápido)
for f in os.listdir(os.path.join(TL, "texmf-dist/tex/latex/mylatexformat")):
    keep.add("texmf-dist/tex/latex/mylatexformat/" + f)
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
                    "-translate-file=cp227.tcx", "*pdflatex.ini"], cwd=fdir, env=env, capture_output=True, text=True, errors="replace")
print(r.stdout[-1500:])
if not os.path.exists(os.path.join(fdir, "pdflatex.fmt")): raise SystemExit("No se pudo crear el formato con los datos reducidos")
proj = os.path.join(check, "docs"); shutil.copytree(tests, proj)
for d in docs:
    for f in os.listdir(proj):
        if f.endswith((".aux", ".pdf", ".log", ".synctex.gz", ".out", ".toc")): os.remove(os.path.join(proj, f))
    for _ in range(2):
        r = subprocess.run([os.path.join(fake, "libtx_pdftex.so"), "-progname=pdflatex", "-fmt=pdflatex",
                            "-interaction=nonstopmode", "-file-line-error", "-synctex=1", d],
                           cwd=proj, env=env, capture_output=True, text=True, errors="replace")
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
def bajar(pkg, home):
    """Como install() en MotorPlugin.java: el .tar.xz de tlnet va a TEXMFHOME. Devuelve sus .map."""
    dest = os.path.join(WORK, "archivos", pkg + ".tar.xz"); os.makedirs(os.path.dirname(dest), exist_ok=True)
    if not os.path.exists(dest): get(f"{CTAN}/archive/{pkg}.tar.xz", dest)
    maps = []
    with tarfile.open(dest) as t:
        for m in t.getmembers():
            # Los paquetes «reubicables» de tlnet guardan las rutas sin texmf-dist/ (tex/latex/…).
            rel = m.name[2:] if m.name.startswith("./") else m.name
            rel = rel[len("texmf-dist/"):] if rel.startswith("texmf-dist/") else rel
            if m.isfile() and not rel.startswith(("tlpkg/", "bin/")):
                dst = os.path.join(home, rel); os.makedirs(os.path.dirname(dst), exist_ok=True)
                with t.extractfile(m) as src, open(dst, "wb") as out: shutil.copyfileobj(src, out)
                if rel.endswith(".map") and "fonts/map/" in rel: maps.append(dst)
    vmap = os.path.join(var, "texmf-var", "fonts", "map", "pdftex", "updmap", "pdftex.map")
    if maps:
        if not os.path.exists(vmap):
            os.makedirs(os.path.dirname(vmap), exist_ok=True)
            shutil.copy(os.path.join(sub, "texmf-var", "fonts", "map", "pdftex", "updmap", "pdftex.map"), vmap)
        known = {l.split()[0] for l in open(vmap, errors="replace") if l.strip() and not l.lstrip().startswith("%")}
        with open(vmap, "a") as o:
            for f in maps:
                for l in open(f, errors="replace"):
                    x = l.strip()
                    if x and not x.startswith("%") and x.split()[0] not in known:
                        known.add(x.split()[0]); o.write(x + "\n")
# Lo que ya trae el APK (como bundledNames() en MotorPlugin.java)
bundled = set()
for tree in ("texmf-dist", "texmf-var"):
    for l in open(os.path.join(sub, tree, "ls-R"), errors="replace").read().split("\n"):
        if l and not l.startswith("%") and not l.endswith(":"): bundled.add(l)
PATS = [r"LaTeX Error: File `([^']+)' not found", r"! I can't find file `([^']+)'",
        r"Font \\?[^=\s]+=([A-Za-z0-9_\-]+)(?: at [^ ]+| scaled \d+)? not loadable: Metric \(TFM\) file not found",
        r"I did not find the tikz library '([^']+)'", r"\(file ([^)\s]+\.pf[ab])\): cannot open Type 1 font file",
        r"\(file ([^)\s]+\.enc)\): cannot open encoding file"]
def faltantes(txt):
    # TeX corta las líneas a 79 caracteres (igual que unwrap() en MotorPlugin.java)
    txt = "".join(l + ("" if len(l) == 79 else "\n") for l in txt.split("\n"))
    out = []
    for k, pat in enumerate(PATS):
        for m in re.finditer(pat, txt):
            n = m.group(1)
            if k == 2:
                if n == "nullfont": continue
                n += ".tfm"
            if k == 3: n = "tikzlibrary" + n + ".code.tex"
            if k == 1 and "." not in n: n += ".tex"
            out.append(n)
    for m in re.finditer(r"Font shape `([A-Za-z0-9]+)/([^/']+)/[^']*' undefined", txt):
        fd = (m.group(1) + m.group(2)).lower() + ".fd"
        if fd not in bundled: out.append(fd)
    return list(dict.fromkeys(out))

def resolver(nombre, texto, home, verbose=False):
    """Compila y baja lo que falte, ronda por ronda (como compilar() en MotorPlugin.java)."""
    d = os.path.join(WORK, "dep", nombre); shutil.rmtree(d, ignore_errors=True); os.makedirs(d)
    open(os.path.join(d, "doc.tex"), "w").write(texto)
    e = dict(env, TEXMFHOME=home)
    instalados, r, logtxt = [], None, ""
    for ronda in range(12):
        r = subprocess.run([os.path.join(fake, "libtx_pdftex.so"), "-progname=pdflatex", "-fmt=pdflatex", "-interaction=nonstopmode",
                            "-file-line-error", "doc.tex"], cwd=d, env=e, capture_output=True, text=True, errors="replace", timeout=300)
        logtxt = open(os.path.join(d, "doc.log"), errors="replace").read() if os.path.exists(os.path.join(d, "doc.log")) else ""
        miss = faltantes(logtxt + "\n" + r.stdout)
        nuevos = list(dict.fromkeys(index.get(m) for m in miss if index.get(m) and index.get(m) not in instalados))
        if verbose: print(f"  ronda {ronda}: faltan {miss} → {nuevos}")
        if not nuevos: break
        for p_ in nuevos: bajar(p_, home); instalados.append(p_)
    return instalados, r, logtxt, d

# Dependencias de los paquetes y clases más usados: lo que cada uno termina pidiendo (pgf para circuitikz,
# la letra Times para IEEEtran…). La app las baja todas antes de compilar, en vez de una ronda por cada una.
CLASES = ["IEEEtran", "beamer", "memoir", "scrartcl", "scrreprt", "scrbook", "elsarticle", "llncs", "moderncv", "exam",
          "extarticle", "standalone", "tufte-handout", "revtex4-2", "acmart", "amsart", "letter", "jsarticle"]
PAQUETES = ["tikz", "pgfplots", "circuitikz", "tcolorbox", "listings", "algorithm2e", "algpseudocode", "algorithmic", "algorithm",
            "siunitx", "mathtools", "physics", "cancel", "enumitem", "cleveref", "natbib", "cite", "biblatex", "fancyhdr",
            "titlesec", "tocloft", "longtable", "tabularx", "multirow", "makecell", "subcaption", "wrapfig", "geometry",
            "microtype", "lmodern", "times", "helvet", "mathptmx", "newtxtext", "newtxmath", "mathpazo", "fontawesome5",
            "tikz-cd", "chemfig", "mhchem", "pgfgantt", "karnaugh-map", "tikz-timing", "bytefield", "steinmetz", "lipsum",
            "blindtext", "todonotes", "thmtools", "mdframed", "framed", "fancyvrb", "pdfpages", "multicol", "setspace",
            "ragged2e", "datetime2", "glossaries", "acro", "nomencl", "appendix", "forest", "tabularray", "nicematrix",
            "xltabular", "colortbl", "sectsty", "fontenc", "pgfornament", "smartdiagram", "schemabloc", "tikz-3dplot",
            "pst-node", "bm", "esint", "upgreek", "gensymb", "textcomp", "eurosym", "float", "hyperref", "babel", "csquotes"]
deps = {}
t0 = time.time()
for c in CLASES + PAQUETES:
    es_clase = c in CLASES
    pkg = index.get(c + (".cls" if es_clase else ".sty"))
    if not pkg: continue
    doc = (f"\\documentclass{{{c}}}\n" if es_clase else f"\\documentclass{{article}}\n\\usepackage{{{c}}}\n") + \
        "\\begin{document}\nHola \\textbf{negrita} \\textit{cursiva} \\textsc{Versalitas} $x^2$.\n\\end{document}\n"
    try:
        inst, r, lg, _ = resolver(c, doc, os.path.join(WORK, "dep-home", c))
    except Exception as ex:
        print("  dep", c, "falló:", ex); continue
    extra = [x for x in inst if x != pkg]
    if extra: deps[pkg] = sorted(set(deps.get(pkg, [])) | set(extra))
print(f"Dependencias: {len(deps)} paquetes en {time.time() - t0:.0f} s →", {k: v for k, v in list(deps.items())[:12]})
with gzip.open(os.path.join(ASSETS, "indice.idx"), "wt", encoding="utf-8", compresslevel=9) as z:
    for k in sorted(index): z.write(f"{k}\t{index[k]}\n")
    for k in sorted(sizes): z.write(f"@{k}\t{sizes[k]}\n")
    for k in sorted(deps): z.write(f"+{k}\t{','.join(deps[k])}\n")

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
# La prueba con IEEE: primero se bajan juntos los paquetes declarados y sus dependencias (como prefetch()).
decl = ["IEEEtran.cls", "cite.sty", "amsmath.sty", "amssymb.sty", "algorithmic.sty", "circuitikz.sty", "pgfplots.sty"]
pre_pkgs = []
for f in decl:
    if f in bundled: continue
    p_ = index.get(f)
    for q in ([p_] + deps.get(p_, [])) if p_ else []:
        if q not in pre_pkgs: pre_pkgs.append(q)
for q in pre_pkgs: bajar(q, home_dir)
print("  antes de compilar se bajan:", pre_pkgs)
instalados, r, logtxt, dprueba = resolver("ieee", open(os.path.join(proj, "circuito.tex")).read(), home_dir, verbose=True)
print("  rondas extra:", instalados)
errs = re.findall(r"^(?:!.*|.*:\d+: .*)$", logtxt, re.M)
shapes = re.findall(r"Font shape `[^']+' undefined", logtxt)
plano = "".join(l + ("" if len(l) == 79 else "\n") for l in r.stdout.split("\n"))
embebidas = sorted(set(os.path.basename(x) for x in re.findall(r"<([^<>\s]+\.pf[ab])>", plano)))
print("  final de la salida:", r.stdout[-700:].replace("\n", " | "))
print("  avisos pdfTeX:", re.findall(r"pdfTeX warning.*", plano)[:5])
print("  fuentes incrustadas:", embebidas)
pdfp = os.path.join(dprueba, "doc.pdf")
fonts = sorted(set(re.findall(rb"/BaseFont\s*/(?:[A-Z]{6}\+)?([A-Za-z0-9\-]+)", open(pdfp, "rb").read()))) if os.path.exists(pdfp) else []
ok = os.path.exists(pdfp) and not errs
print("Prueba de paquetes al vuelo:", "PDF OK" if ok else "FALLÓ", "| instalados:", instalados, "| errores:", errs[:5])
print("  avisos de fuente:", shapes[:6], "| fuentes en el PDF:", [f.decode() for f in fonts])
if not ok: raise SystemExit("La prueba de paquetes al vuelo falló")

# Preámbulo guardado (como buildPre() en MotorPlugin.java): se arma y se compila con él.
eh = dict(env, TEXMFHOME=home_dir)
def correr(args):
    t = time.time()
    rr = subprocess.run([os.path.join(fake, "libtx_pdftex.so")] + args, cwd=dprueba, env=eh, capture_output=True, text=True, errors="replace")
    return time.time() - t, rr
normal, _ = correr(["-progname=pdflatex", "-fmt=pdflatex", "-interaction=nonstopmode", "-file-line-error", "-synctex=1", "doc.tex"])
for intento in range(3):
    armar, _ = correr(["-ini", "-interaction=nonstopmode", "-jobname=texsting-pre", "-progname=pdflatex", "&pdflatex", "mylatexformat.ltx", "doc.tex"])
    prelog = open(os.path.join(dprueba, "texsting-pre.log"), errors="replace").read()
    pre_errs = re.findall(r"^!.*$", prelog, re.M)
    if not pre_errs: break
    # Como buildPre(): las letras que la clase deja listas (Courier, Helvetica en IEEEtran) se bajan y se reintenta.
    extra = []
    for m in faltantes(prelog):
        p_ = index.get(m)
        for q in ([p_] + deps.get(p_, [])) if p_ else []:
            if q not in extra and not os.path.isdir(os.path.join(WORK, "ya", q)): extra.append(q)
    print("  al armar el preámbulo faltan:", faltantes(prelog), "→", extra)
    if not extra: break
    for q in extra: bajar(q, home_dir); os.makedirs(os.path.join(WORK, "ya", q), exist_ok=True)
con, _ = correr(["-progname=pdflatex", "-fmt=texsting-pre", "-interaction=nonstopmode", "-file-line-error", "-synctex=1", "doc.tex"])
lg2 = open(os.path.join(dprueba, "doc.log"), errors="replace").read()
errs2 = re.findall(r"^(?:!.*|.*:\d+: .*)$", lg2, re.M)
print(f"Preámbulo guardado: normal {normal:.2f} s | armarlo {armar:.2f} s | con él {con:.2f} s | errores al armar {pre_errs[:3]} | errores con él {errs2[:3]}")
if pre_errs or errs2 or not os.path.exists(os.path.join(dprueba, "texsting-pre.fmt")): raise SystemExit("El preámbulo guardado falló")

# Figuras guardadas (como buildFigs()/mainWithFigs() en MotorPlugin.java)
INJ = r"\AddToHook{begindocument/before}{\IfPackageLoadedTF{tikz}{\usetikzlibrary{external}\tikzexternalize[mode=list and make,prefix=texsting-fig/]}{}}"
os.makedirs(os.path.join(dprueba, "texsting-fig"), exist_ok=True)
principal = ["-progname=pdflatex", "-fmt=pdflatex", "-interaction=nonstopmode", "-file-line-error", "-synctex=1", "-jobname=doc", INJ + r"\input{doc.tex}"]
lista, _ = correr(principal)
figs = [l.strip() for l in open(os.path.join(dprueba, "doc.figlist")).read().split("\n") if l.strip()] if os.path.exists(os.path.join(dprueba, "doc.figlist")) else []
t_figs = 0
for f in figs:
    dt, _ = correr(["-progname=pdflatex", "-fmt=pdflatex", "-interaction=batchmode", "-halt-on-error", "-jobname=" + f,
                    INJ + r"\def\tikzexternalrealjob{doc}\input{doc.tex}"])
    t_figs += dt
hechas = [f for f in figs if os.path.exists(os.path.join(dprueba, f + ".pdf"))]
con_figs, _ = correr(principal)
lg3 = open(os.path.join(dprueba, "doc.log"), errors="replace").read()
errs3 = re.findall(r"^(?:!(?! Package tikz Warning).*|.*:\d+: .*)$", lg3, re.M)
print(f"Figuras guardadas: {len(hechas)}/{len(figs)} figuras ({t_figs:.2f} s) | normal {normal:.2f} s | con figuras {con_figs:.2f} s | errores {errs3[:3]}")
if len(hechas) != len(figs) or errs3: raise SystemExit("Las figuras guardadas fallaron")

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
