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
import hashlib, os, re, shutil, subprocess, sys, tarfile, urllib.request, zipfile

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
    if rel.split("/")[0] in ("texmf-dist", "texmf-var"): keep.add(rel)
# strace solo ve lo que usaron estos documentos (p. ej. solo los tamaños de letra de 11 pt).
# Para no quedarse corto, cada carpeta usada entra completa: todas las fuentes de una familia
# y todos los archivos de un paquete. Las carpetas enormes (cm-super) quedan como estaban.
def dir_size(d):
    return sum(os.path.getsize(os.path.join(d, f)) for f in os.listdir(d) if os.path.isfile(os.path.join(d, f)))
expanded = set()
for rel in list(keep):
    d = os.path.dirname(rel)
    if d in expanded or not rel.startswith("texmf-dist/") or "/web2c" in d: continue
    full = os.path.join(TL, d)
    if dir_size(full) > 12e6:
        print("  carpeta grande, solo lo usado:", d, round(dir_size(full) / 1e6, 1), "MB"); continue
    expanded.add(d)
    for f in os.listdir(full):
        if os.path.isfile(os.path.join(full, f)) and not f.endswith((".log", ".fmt")):
            keep.add(os.path.join(d, f))
print(f"Carpetas completas: {len(expanded)}")
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
