"""¿Cómo busca libpaper (de Termux) los tamaños de papel? y qué funciones usa xdvipdfmx."""
import os, re, subprocess, urllib.request, shutil
T = "https://packages.termux.dev/apt/termux-main"
W = os.path.abspath("lp"); os.makedirs(W, exist_ok=True)
def get(u, d):
    with urllib.request.urlopen(u, timeout=300) as r, open(d, "wb") as f: shutil.copyfileobj(r, f)
    return d
idx = open(get(f"{T}/dists/stable/main/binary-aarch64/Packages", f"{W}/P"), encoding="utf-8").read()
pk, cur = {}, {}
for l in idx.splitlines() + [""]:
    if not l.strip():
        if "Package" in cur: pk[cur["Package"]] = cur
        cur = {}
    elif ":" in l and not l.startswith(" "):
        k, v = l.split(":", 1); cur[k] = v.strip()
for p in ["libpaper", "texlive-bin"]:
    print(p, pk[p]["Version"], pk[p].get("Depends"))
    subprocess.run(["dpkg-deb", "-x", get(f"{T}/{pk[p]['Filename']}", f"{W}/{p}.deb"), f"{W}/r"], check=True)
u = f"{W}/r/data/data/com.termux/files/usr"
for root, _, fs in os.walk(u):
    for f in fs:
        if "paper" in f: print("archivo:", os.path.join(root, f).replace(u, "$PREFIX"))
lib = [os.path.join(u, "lib", f) for f in os.listdir(os.path.join(u, "lib")) if f.startswith("libpaper")][0]
s = subprocess.run(["strings", "-n", "4", lib], capture_output=True, text=True).stdout
print("\n".join(sorted({x for x in s.splitlines() if re.search(r"paper|XDG|HOME|/etc|termux|PAPER|config|proc", x, re.I)})))
xd = os.path.realpath(os.path.join(u, "bin", "texlive", "xdvipdfmx"))
print(subprocess.run(f"readelf --dyn-syms -W {xd} | grep -i paper", shell=True, capture_output=True, text=True).stdout)
print(subprocess.run(f"strings -n 3 {xd} | grep -i -E '^(a4|letter|paper|systempapername|defaultpapername)' | head -20", shell=True, capture_output=True, text=True).stdout)
