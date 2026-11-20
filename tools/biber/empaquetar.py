#!/usr/bin/env python3
"""Biber para el motor integrado: arma lo que va en el APK a partir de lo que compiló dentro.sh en Termux.

Uso: empaquetar.py <salida de dentro.sh> <destino>
  <destino>/jniLibs/arm64-v8a/  perl (libtx_perl.so), libperl.so, bibliotecas y módulos compilados (libtx_pl_*.so)
  <destino>/assets/motor/perl.zip  módulos de Perl (sin documentación), el programa biber y xs.txt
  <destino>/assets/motor/perl-version.txt
Android solo deja ejecutar código desde nativeLibraryDir: los módulos compilados (.so) van ahí con nombre lib*.so y la
app crea en su carpeta enlaces con el nombre que Perl espera (xs.txt: ruta → biblioteca).
"""
import hashlib, os, re, shutil, subprocess, sys, tarfile, zipfile

ORIG, DEST = sys.argv[1], sys.argv[2]
JNI = os.path.join(DEST, "jniLibs", "arm64-v8a")
ASSETS = os.path.join(DEST, "assets", "motor")
os.makedirs(JNI, exist_ok=True); os.makedirs(ASSETS, exist_ok=True)
TMP = os.path.join(DEST, "_perl")
shutil.rmtree(TMP, ignore_errors=True)
with tarfile.open(os.path.join(ORIG, "perl-termux.tar.xz")) as t:
    t.extractall(TMP)

ok = re.compile(r"^lib[A-Za-z0-9_+\-]+\.so$")
def nombre_lib(n):
    return n if ok.match(n) else "libtx_" + re.sub(r"\W", "", n.split(".so")[0][3:]) + ".so"

# Bibliotecas que piden perl y los módulos: con nombre válido para jniLibs.
renombre = {n: nombre_lib(n) for n in os.listdir(os.path.join(ORIG, "libs"))}
def ajustar(f, soname=None):
    os.chmod(f, 0o755)  # los archivos vienen de solo lectura desde Termux
    out = subprocess.run(["readelf", "-d", f], capture_output=True, text=True).stdout
    for n in re.findall(r"\(NEEDED\).*\[(.+?)\]", out):
        if n in renombre and renombre[n] != n:
            subprocess.run(["patchelf", "--replace-needed", n, renombre[n], f], check=True)
    subprocess.run(["patchelf", "--remove-rpath", f], check=True)
    if soname: subprocess.run(["patchelf", "--set-soname", soname, f], check=True)

for n, nuevo in renombre.items():
    d = os.path.join(JNI, nuevo)
    shutil.copy(os.path.join(ORIG, "libs", n), d)
    ajustar(d, nuevo)
perl = os.path.join(JNI, "libtx_perl.so")
shutil.copy(os.path.join(TMP, "bin", "perl"), perl)
ajustar(perl)

# Módulos compilados → jniLibs; el resto de Perl → perl.zip (sin manuales ni archivos de instalación).
lib = os.path.join(TMP, "lib", "perl5")
xs, n_xs = [], 0
z = zipfile.ZipFile(os.path.join(ASSETS, "perl.zip"), "w", zipfile.ZIP_DEFLATED, compresslevel=9)
FUERA = re.compile(r"(\.pod$|\.packlist$|perllocal\.pod$|/\.meta/|/CORE/|/pod/|\.h$|\.a$|/man/"
                   # Codificaciones chinas, japonesas y coreanas (≈8 MB): Biber trabaja en UTF-8 y Latin-1.
                   r"|/Encode/(CN|JP|KR|TW|JIS2K|HanExtra|EUCJPASCII)(/|\.pm$|\.so$)"
                   # Lo que solo sirve para instalar o probar módulos.
                   r"|/(CPAN|TAP|Test2?|Module/Build|App/Cpan|Devel/PPPort|perl5db)\b)")
total = 0
for d, _, fs in os.walk(lib):
    for f in fs:
        ruta = os.path.join(d, f)
        rel = os.path.relpath(ruta, os.path.join(TMP, "lib"))  # perl5/…
        if f.endswith(".so"):
            if "/CORE/" in ruta or FUERA.search("/" + rel): continue  # libperl.so ya va como biblioteca
            nuevo = "libtx_pl_" + re.sub(r"\W", "_", rel.split("/auto/", 1)[-1][:-3]) + ".so"
            shutil.copy(ruta, os.path.join(JNI, nuevo)); ajustar(os.path.join(JNI, nuevo))
            xs.append(f"{rel}\t{nuevo}"); n_xs += 1
            continue
        if FUERA.search("/" + rel): continue
        z.write(ruta, rel); total += os.path.getsize(ruta)
z.write(os.path.join(ORIG, "biber"), "biber")
z.writestr("xs.txt", "\n".join(xs) + "\n")
z.close()
h = hashlib.sha256(open(os.path.join(ASSETS, "perl.zip"), "rb").read()).hexdigest()[:12]
open(os.path.join(ASSETS, "perl-version.txt"), "w").write(h)
shutil.rmtree(TMP)
print(f"perl.zip: {os.path.getsize(os.path.join(ASSETS, 'perl.zip')) / 1e6:.1f} MB ({total / 1e6:.0f} MB sin comprimir) · {n_xs} módulos compilados")
print("jniLibs:", sum(os.path.getsize(os.path.join(JNI, f)) for f in os.listdir(JNI)) / 1e6, "MB")
