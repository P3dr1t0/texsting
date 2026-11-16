"""Exploración: qué hace falta para XeLaTeX y LuaLaTeX con los binarios de Termux (aarch64)."""
import os, re, subprocess, urllib.request, shutil, gzip, lzma
TERMUX = "https://packages.termux.dev/apt/termux-main"
W = os.path.abspath("explora"); os.makedirs(W, exist_ok=True)
def get(url, dest):
    with urllib.request.urlopen(url, timeout=300) as r, open(dest, "wb") as f: shutil.copyfileobj(r, f)
    return dest
idx = open(get(f"{TERMUX}/dists/stable/main/binary-aarch64/Packages", f"{W}/Packages"), encoding="utf-8").read()
pkgs, cur = {}, {}
for line in idx.splitlines() + [""]:
    if not line.strip():
        if "Package" in cur: pkgs[cur["Package"]] = cur
        cur = {}
    elif ":" in line and not line.startswith(" "):
        k, v = line.split(":", 1); cur[k] = v.strip()
def deps(p):
    return [d.strip().split(" ")[0] for d in pkgs[p].get("Depends", "").split(",") if d.strip()]
print("texlive-bin", pkgs["texlive-bin"]["Version"], "Depends:", pkgs["texlive-bin"].get("Depends"))
# todas las dependencias de texlive-bin (recursivo)
seen, todo = set(), ["texlive-bin"]
while todo:
    p = todo.pop()
    if p in seen or p not in pkgs: continue
    seen.add(p); todo += deps(p)
root = f"{W}/root"; os.makedirs(root, exist_ok=True)
for p in sorted(seen):
    deb = get(f"{TERMUX}/{pkgs[p]['Filename']}", f"{W}/{p}.deb")
    subprocess.run(["dpkg-deb", "-x", deb, root], check=True)
usr = f"{root}/data/data/com.termux/files/usr"; lib = f"{usr}/lib"; bin_ = f"{usr}/bin/texlive"
print("binarios en bin/texlive:", " ".join(sorted(os.listdir(bin_)))[:3000])
def needed(path):
    out = subprocess.run(["readelf", "-d", path], capture_output=True, text=True, errors="replace").stdout
    return re.findall(r"\(NEEDED\)\s+Shared library: \[(.+?)\]", out)
SYSTEM = {"libc.so", "libm.so", "libdl.so", "liblog.so"}
for b in ["pdftex", "xetex", "xdvipdfmx", "luahbtex", "luatex", "biber", "kpsewhich", "texlua"]:
    p = os.path.join(bin_, b)
    if not os.path.exists(p): print(f"\n== {b}: NO EXISTE"); continue
    real = os.path.realpath(p)
    clos, todo = {}, [real]
    while todo:
        for n in needed(todo.pop()):
            if n in SYSTEM or n in clos: continue
            q = os.path.join(lib, n)
            if not os.path.exists(q): clos[n] = None; continue
            clos[n] = os.path.realpath(q); todo.append(clos[n])
    tot = os.path.getsize(real) + sum(os.path.getsize(v) for v in clos.values() if v)
    xz = len(lzma.compress(open(real, "rb").read() + b"".join(open(v, "rb").read() for v in clos.values() if v), preset=6))
    print(f"\n== {b} -> {os.path.basename(real)} {os.path.getsize(real)/1e6:.2f} MB; total con libs {tot/1e6:.1f} MB (comprimido ~{xz/1e6:.1f} MB)")
    for n, v in sorted(clos.items()):
        print(f"   {n:28s} {'FALTA' if v is None else f'{os.path.getsize(v)/1e6:6.2f} MB'}")
# ¿qué trae icu como datos?
for f in sorted(os.listdir(lib)):
    if "icu" in f or "fontconfig" in f or "harfbuzz" in f or "graphite" in f or "freetype" in f or "teckit" in f.lower():
        print("lib:", f, f"{os.path.getsize(os.path.join(lib, f))/1e6:.2f} MB" if os.path.isfile(os.path.join(lib, f)) else "")
for d in ["etc/fonts", "share/fontconfig"]:
    p = os.path.join(usr, d)
    if os.path.exists(p): print("existe", d, os.listdir(p)[:20])
print("biber (perl) en otros paquetes:", [k for k in pkgs if "biber" in k])
