"""Exploración del motor integrado (#1): baja de Termux los binarios de TeX Live para
aarch64 y calcula qué bibliotecas necesitan, cuánto pesan y si se pueden empaquetar
dentro del APK como lib*.so (jniLibs)."""
import os, re, subprocess, sys, json, urllib.request, shutil, collections

REPO = "https://packages.termux.dev/apt/termux-main"
ARCH = "aarch64"
OUT = os.path.abspath("motor-out")
os.makedirs(OUT, exist_ok=True)

def get(url, dest=None):
    for _ in range(3):
        try:
            data = urllib.request.urlopen(url, timeout=120).read()
            if dest:
                open(dest, "wb").write(data)
            return data
        except Exception as e:
            err = e
    raise err

idx = get(f"{REPO}/dists/stable/main/binary-{ARCH}/Packages").decode()
pkgs = {}
for block in idx.split("\n\n"):
    d = {}
    for line in block.splitlines():
        if ":" in line and not line.startswith(" "):
            k, v = line.split(":", 1); d[k] = v.strip()
    if "Package" in d:
        pkgs[d["Package"]] = d

print("Paquetes TeX en el índice:", ", ".join(sorted(p for p in pkgs if "tex" in p.lower()))[:2000])
root_pkg = "texlive-bin"
if root_pkg not in pkgs:
    print("NO existe", root_pkg); sys.exit(1)

def deps(name):
    d = pkgs.get(name, {}).get("Depends", "")
    return [re.split(r"[ (|]", x.strip())[0] for x in d.split(",") if x.strip()]

seen, order = set(), []
def walk(n):
    if n in seen or n not in pkgs: return
    seen.add(n); order.append(n)
    for x in deps(n): walk(x)
walk(root_pkg)
print("\nDependencias de", root_pkg, f"({len(order)}):", ", ".join(order))
print("Tamaño instalado declarado (KB):", {n: pkgs[n].get("Installed-Size") for n in order})

root = os.path.join(OUT, "root"); os.makedirs(root, exist_ok=True)
for n in order:
    deb = os.path.join(OUT, n + ".deb")
    get(f"{REPO}/{pkgs[n]['Filename']}", deb)
    subprocess.run(["dpkg-deb", "-x", deb, root], check=True)

usr = os.path.join(root, "data/data/com.termux/files/usr")
bindir, libdir = os.path.join(usr, "bin"), os.path.join(usr, "lib")
bins = sorted(os.listdir(bindir))
print(f"\nProgramas en texlive-bin ({len(bins)}):", " ".join(bins)[:3000])

def needed(path):
    r = subprocess.run(["readelf", "-d", path], capture_output=True, text=True).stdout
    return re.findall(r"\(NEEDED\)\s+Shared library: \[(.+?)\]", r), re.findall(r"\((?:RUNPATH|RPATH)\).*\[(.+?)\]", r)

SYSTEM = {"libc.so", "libm.so", "libdl.so", "liblog.so", "libandroid.so", "libz.so"}  # las da Android
want = ["pdftex", "xetex", "luahbtex", "luatex", "bibtex", "bibtex8", "makeindex", "kpsewhich", "xdvipdfmx", "dvipdfmx", "mpost"]
report = {}
for b in want:
    p = os.path.join(bindir, b)
    if not os.path.exists(p):
        report[b] = "NO ESTÁ"; continue
    real = os.path.realpath(p)
    closure, todo = set(), [real]
    missing = set()
    while todo:
        f = todo.pop()
        ns, rp = needed(f)
        for n in ns:
            if n in SYSTEM: continue
            cand = os.path.join(libdir, n)
            if os.path.exists(cand):
                c = os.path.realpath(cand)
                if c not in closure:
                    closure.add(c); todo.append(c)
            else:
                missing.add(n)
    size = os.path.getsize(real) + sum(os.path.getsize(c) for c in closure)
    report[b] = {"binario": os.path.basename(real), "MB_total": round(size / 1e6, 1),
                 "bibliotecas": sorted(os.path.basename(c) for c in closure), "faltan": sorted(missing),
                 "runpath": needed(real)[1]}
print("\nCierre de bibliotecas por programa:")
print(json.dumps(report, indent=1, ensure_ascii=False))

allfiles = set()
for b, r in report.items():
    if isinstance(r, dict):
        allfiles.add(os.path.realpath(os.path.join(bindir, b)))
        allfiles |= {os.path.join(libdir, x) for x in r["bibliotecas"]}
tot = sum(os.path.getsize(os.path.realpath(f)) for f in allfiles if os.path.exists(os.path.realpath(f)))
print(f"\nTOTAL binarios + bibliotecas (sin comprimir): {tot/1e6:.1f} MB")
# Rutas de Termux «quemadas» dentro de kpathsea
for b in ["kpsewhich"]:
    s = subprocess.run(["strings", os.path.realpath(os.path.join(bindir, b))], capture_output=True, text=True).stdout
    print("\nRutas fijas en", b, ":", sorted(set(re.findall(r"/data/data/com\.termux[^\s\"']*", s)))[:20])
kp = [os.path.join(dp, f) for dp, _, fs in os.walk(libdir) for f in fs if f.startswith("libkpathsea")]
for k in kp[:1]:
    s = subprocess.run(["strings", k], capture_output=True, text=True).stdout
    print("Rutas fijas en", os.path.basename(k), ":", sorted(set(re.findall(r"/data/data/com\.termux[^\s\"':]*", s)))[:20])
# Empaquetar el cierre para el siguiente paso
pack = os.path.join(OUT, "cierre"); os.makedirs(pack, exist_ok=True)
for f in allfiles:
    rf = os.path.realpath(f)
    if os.path.exists(rf): shutil.copy2(rf, os.path.join(pack, os.path.basename(f)))
subprocess.run(["tar", "-cJf", os.path.join(OUT, "cierre-aarch64.tar.xz"), "-C", pack, "."], check=True)
print("Comprimido (xz):", round(os.path.getsize(os.path.join(OUT, "cierre-aarch64.tar.xz")) / 1e6, 1), "MB")
