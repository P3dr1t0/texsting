#!/bin/bash
# Compila libandroid-complex-math.so (ver complex_math.c) en $1, alineada a 16 KB.
set -e
OUT=$1; T=$(mktemp -d); D=$(cd "$(dirname "$0")" && pwd)
CC=""; for b in "$ANDROID_NDK_LATEST_HOME" "$ANDROID_NDK_HOME" "$ANDROID_NDK_ROOT"; do
  [ -n "$b" ] && c=$(ls $b/toolchains/llvm/prebuilt/*/bin/clang 2>/dev/null | head -1) && [ -n "$c" ] && { CC=$c; break; }; done
FL="--target=aarch64-linux-android24 -O2 -fno-builtin -fPIC -shared -Wl,-soname,libandroid-complex-math.so -Wl,-z,max-page-size=16384"
if [ -n "$CC" ]; then
  $CC $FL -o "$OUT" "$D/complex_math.c" -lm
else
  # Sin NDK: libm de mentira solo para enlazar (en el equipo se usa la de Android).
  printf 'double exp(double x){return x;}double log(double x){return x;}double atan2(double a,double b){return a;}double hypot(double a,double b){return a;}double sin(double x){return x;}double cos(double x){return x;}\n' > $T/m.c
  clang --target=aarch64-linux-android24 -fuse-ld=lld -shared -nostdlib -fPIC -Wl,-soname,libm.so -o $T/libm.so $T/m.c
  clang $FL -fuse-ld=lld -nostdlib -o "$OUT" "$D/complex_math.c" $T/libm.so
fi
echo "libandroid-complex-math.so: $(stat -c %s "$OUT") bytes, alineación $(readelf -lW "$OUT" | awk '$1=="LOAD"{print $NF}' | sort -u | tr '\n' ' ')"
