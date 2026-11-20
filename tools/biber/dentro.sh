#!/data/data/com.termux/files/usr/bin/bash
# Se corre DENTRO de termux-docker (aarch64): compila Biber con el Perl de Termux y deja todo en /salida.
set -x
VER="$1"
export PERL_MM_USE_DEFAULT=1 PERL_CANARY_STABILITY_NOPROMPT=1 MAKEFLAGS=-j4
for i in 1 2 3; do pkg update -y && break; sleep 10; done
yes | pkg install -y perl clang make pkg-config libxml2 libxslt openssl libiconv zlib binutils curl patchelf || exit 1
perl -v | head -2
curl -fsSL https://cpanmin.us | perl - App::cpanminus || exit 1
# Biber con la misma versión que el biblatex de TeX Live (si no, rechaza el .bcf).
cpanm --notest --quiet "PLS/Biber-$VER.tar.gz" || cpanm --notest "Biber@$VER" || cpanm --notest Biber || { tail -100 ~/.cpanm/build.log; exit 1; }
which biber && biber --version
cd /prueba && biber b && grep -c 'entry{' b.bbl || true; head -40 b.bbl
P=$PREFIX
mkdir -p /salida
cp $(which biber) /salida/biber
tar -C $P -cJf /salida/perl-termux.tar.xz bin/perl lib/perl5 lib/libperl.so 2>/dev/null || tar -C $P -cJf /salida/perl-termux.tar.xz bin/perl lib/perl5
# Bibliotecas que piden los módulos compilados (XML::LibXML, Net::SSLeay…).
find $P/lib/perl5 -name '*.so' | while read f; do readelf -d "$f" | grep NEEDED; done | sort | uniq -c | sort -rn > /salida/needed.txt
readelf -d $P/bin/perl | grep -E 'NEEDED|RUNPATH' >> /salida/needed.txt
du -sh $P/lib/perl5 > /salida/tamanos.txt; du -sh $P/lib/perl5/* >> /salida/tamanos.txt
find $P/lib/perl5 -name '*.so' | wc -l >> /salida/tamanos.txt
echo LISTO
