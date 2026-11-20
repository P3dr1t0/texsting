#!/data/data/com.termux/files/usr/bin/bash
# Como probar_app.sh, pero con el mismo entorno mínimo que la app (env() en MotorPlugin.java):
# sin LANG ni LC_*, PATH=/system/bin, HOME y TMPDIR propios.
rm -rf $PREFIX/lib/perl5 $PREFIX/bin/perl 2>/dev/null
W=$HOME/app-perl; rm -rf $W && mkdir -p $W && cd $W && unzip -q /app/perl.zip
while IFS=$'\t' read -r rel so; do [ -n "$rel" ] && mkdir -p "$(dirname "$rel")" && ln -sf "/app/lib/$so" "$rel"; done < xs.txt
V=$(ls perl5 | grep -E '^5\.' | head -1)
P5=$W/perl5/$V:$W/perl5/$V/aarch64-android:$W/perl5/site_perl/$V:$W/perl5/site_perl/$V/aarch64-android
mkdir -p $HOME/v $HOME/cache
cd /prueba && env -i LD_LIBRARY_PATH=/app/lib PATH=/system/bin HOME=$HOME/v TMPDIR=$HOME/cache PERL5LIB=$P5 /app/lib/libtx_perl.so $W/biber main; echo "código de salida: $?"
grep -c 'entry{' main.bbl
