#!/data/data/com.termux/files/usr/bin/bash
# Corre biber como lo hará la app: Perl desde «lib» (nativeLibraryDir), módulos desde perl.zip con enlaces a lib.
# Se borra el Perl de Termux para asegurar que no se use nada de ahí.
rm -rf $PREFIX/lib/perl5 $PREFIX/bin/perl 2>/dev/null
W=$HOME/app-perl; rm -rf $W && mkdir -p $W && cd $W && unzip -q /app/perl.zip
while IFS=$'\t' read -r rel so; do [ -n "$rel" ] && mkdir -p "$(dirname "$rel")" && ln -sf "/app/lib/$so" "$rel"; done < xs.txt
V=$(ls perl5 | grep -E '^5\.' | head -1)
export PERL5LIB=$W/perl5/$V:$W/perl5/$V/aarch64-android:$W/perl5/site_perl/$V:$W/perl5/site_perl/$V/aarch64-android
export LD_LIBRARY_PATH=/app/lib
cd /prueba && time /app/lib/libtx_perl.so $W/biber b; grep -c 'entry{' b.bbl
