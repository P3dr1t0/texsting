#!/usr/bin/env python3
"""
Achica libtx_icudata.so (los datos de ICU que usa XeTeX): de ~33 MB a ~13 MB.

ICU tiene dos partes: «common» (libicuuc: cortes de línea, conversores, normalización) e «i18n»
(libicui18n: orden alfabético, fechas, monedas, unidades…). La app solo trae libicuuc, así que los
datos que únicamente lee i18n nunca se usan: se sacan del paquete de datos sin ningún riesgo.

Se queda todo lo que puede leer libicuuc: brkitr (cortes de línea), conversores (.cnv), datos de
locales de la raíz, normalización (.nrm), propiedades (.icu), stringprep (.spp).

Uso: recortar_icu.py <ruta/libtx_icudata.so>      (lo reemplaza en su lugar)
Necesita clang y ld.lld (los del NDK de Android si están, si no los del sistema).
"""
import glob, os, re, shutil, struct, subprocess, sys, tempfile

# Carpetas del paquete que solo usa ICU i18n (no viene en la app).
QUITAR_CARPETAS = {"coll", "zone", "unit", "curr", "rbnf", "translit", "region", "lang"}
# Archivos sueltos de la raíz que solo usa i18n (husos horarios, plurales, números, unidades, «spoof»).
QUITAR_RAIZ = re.compile(r"^(zoneinfo64|timezoneTypes|windowsZones|metaZones|tzdbNames|dayPeriods|genderList|"
                         r"numberingSystems|pluralRanges|plurals|grammaticalFeatures|units|currencyNumericCodes|"
                         r"icustd|icuver)\.res$|\.cfu$")


def simbolo(lib):
    """(nombre, desplazamiento en el archivo, tamaño) del símbolo icudtNN_dat, leyendo el ELF a mano."""
    b = open(lib, "rb").read()
    assert b[:4] == b"\x7fELF" and b[4] == 2, "no es un ELF de 64 bits"
    e_shoff, = struct.unpack_from("<Q", b, 0x28)
    e_shentsize, e_shnum = struct.unpack_from("<HH", b, 0x3A)
    secs = [struct.unpack_from("<IIQQQQIIQQ", b, e_shoff + i * e_shentsize) for i in range(e_shnum)]
    for s in secs:
        if s[1] != 11:  # SHT_DYNSYM
            continue
        strtab = secs[s[6]]
        for k in range(s[5] // 24):
            st_name, st_info, st_other, st_shndx, st_value, st_size = struct.unpack_from("<IBBHQQ", b, s[4] + k * 24)
            nombre = b[strtab[4] + st_name: b.index(b"\0", strtab[4] + st_name)].decode()
            if re.fullmatch(r"icudt\d+_dat", nombre):
                sec = secs[st_shndx]
                return nombre, sec[4] + (st_value - sec[3]), st_size, b
    raise SystemExit("no encontré icudtNN_dat en " + lib)


def leer_paquete(d):
    hs, = struct.unpack_from("<H", d, 0)
    assert d[2:4] == b"\xda\x27", "no es un paquete de datos de ICU"
    n, = struct.unpack_from("<I", d, hs)
    ents = [struct.unpack_from("<II", d, hs + 4 + 8 * i) for i in range(n)]
    items = []
    for i, (no, do) in enumerate(ents):
        nombre = d[hs + no: d.index(b"\0", hs + no)].decode()
        fin = ents[i + 1][1] if i + 1 < n else len(d) - hs
        items.append((nombre, d[hs + do: hs + fin]))
    return d[:hs], items


def escribir_paquete(cabecera, items):
    """Mismo formato que pkgdata: tabla (nombre, posición) ordenada por nombre y datos alineados a 16."""
    n = len(items)
    nombres = b"".join(nm.encode() + b"\0" for nm, _ in items)
    pos_nombres = 4 + 8 * n
    pos_datos = pos_nombres + len(nombres)
    pos_datos += (-pos_datos) % 16
    tabla, datos, pn, pd = [], b"", pos_nombres, pos_datos
    for nm, dato in items:
        tabla.append(struct.pack("<II", pn, pd))
        pn += len(nm.encode()) + 1
        relleno = (-len(dato)) % 16
        datos += dato + b"\0" * relleno
        pd += len(dato) + relleno
    toc = struct.pack("<I", n) + b"".join(tabla) + nombres
    toc += b"\0" * (pos_datos - len(toc))
    return cabecera + toc + datos


def herramientas():
    for base in [os.environ.get("ANDROID_NDK_LATEST_HOME"), os.environ.get("ANDROID_NDK_HOME"), os.environ.get("ANDROID_NDK_ROOT")]:
        if base:
            c = glob.glob(os.path.join(base, "toolchains/llvm/prebuilt/*/bin/clang"))
            if c:
                return c[0], ["--target=aarch64-linux-android24"]
    return shutil.which("clang"), ["--target=aarch64-linux-android24", "-fuse-ld=lld"]


def main():
    lib = sys.argv[1]
    sym, off, size, b = simbolo(lib)
    cabecera, items = leer_paquete(b[off:off + size])
    pref = items[0][0].split("/")[0] + "/"
    quedan = []
    for nm, dato in items:
        rel = nm[len(pref):]
        carpeta = rel.split("/")[0] if "/" in rel else ""
        if carpeta in QUITAR_CARPETAS or (not carpeta and QUITAR_RAIZ.search(rel)):
            continue
        quedan.append((nm, dato))
    nuevo = escribir_paquete(cabecera, quedan)
    # Comprobación: el paquete nuevo se vuelve a leer y cada dato es idéntico al original.
    _, rel = leer_paquete(nuevo)
    orig = dict(items)
    assert [n for n, _ in rel] == [n for n, _ in quedan]
    assert all(orig[n] == dt[:len(orig[n])] and not dt[len(orig[n]):].strip(b"\0") for n, dt in rel)
    tmp = tempfile.mkdtemp()
    open(os.path.join(tmp, "datos.dat"), "wb").write(nuevo)
    open(os.path.join(tmp, "icu.S"), "w").write(
        f'  .section .rodata\n  .balign 16\n  .globl {sym}\n  .type {sym},%object\n{sym}:\n'
        f'  .incbin "datos.dat"\n  .size {sym}, .-{sym}\n')
    clang, flags = herramientas()
    salida = os.path.join(tmp, "libtx_icudata.so")
    subprocess.run([clang] + flags + ["-shared", "-nostdlib", "-Wl,-soname,libtx_icudata.so",
                    "-Wl,-z,max-page-size=16384", "-Wl,--hash-style=both", "-o", salida, "icu.S"], cwd=tmp, check=True)
    s2, off2, size2, b2 = simbolo(salida)
    assert s2 == sym and b2[off2:off2 + len(nuevo)] == nuevo and off2 % 16 == 0
    antes = os.path.getsize(lib)
    shutil.copy(salida, lib)
    print(f"ICU {sym}: {len(items)} → {len(quedan)} datos; {antes / 1e6:.1f} MB → {os.path.getsize(lib) / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
