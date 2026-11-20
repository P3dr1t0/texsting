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
# Biber no está en CPAN: se baja su código de GitHub (misma versión que TeX Live) y se instalan sus dependencias.
cd ~ && curl -fsSL "https://github.com/plk/biber/archive/refs/tags/v$VER.tar.gz" -o biber.tgz && tar xzf biber.tgz && cd "biber-$VER" || exit 1
cpanm --notest Module::Build Config::AutoConf ExtUtils::LibBuilder || { tail -60 ~/.cpanm/build.log; exit 1; }
cpanm --notest --installdeps . || true
# LWP::Protocol::https solo sirve para .bib en internet (https://…): si no compila, Biber funciona igual.
cpanm --notest Net::SSLeay IO::Socket::SSL LWP::Protocol::https || { grep -B5 -A30 -i "error" ~/.cpanm/build.log | tail -60; }
perl Build.PL && ./Build && ./Build install || exit 1
echo BIBER-INICIO
B=$PREFIX/bin/biber
perl $B --version
cd /prueba && time perl $B b; grep -c 'entry{' b.bbl || true; head -30 b.bbl; cat b.blg | tail -20
echo BIBER-FIN
set +x
P=$PREFIX
mkdir -p /salida
cp $PREFIX/bin/biber /salida/biber
tar -C $P -cJf /salida/perl-termux.tar.xz bin/perl lib/perl5 lib/libperl.so 2>/dev/null || tar -C $P -cJf /salida/perl-termux.tar.xz bin/perl lib/perl5
# Bibliotecas que piden los módulos compilados (XML::LibXML, Net::SSLeay…).
find $P/lib/perl5 -name '*.so' | while read f; do readelf -d "$f" | grep NEEDED; done | sort | uniq -c | sort -rn > /salida/needed.txt
readelf -d $P/bin/perl | grep -E 'NEEDED|RUNPATH' >> /salida/needed.txt
du -sh $P/lib/perl5 > /salida/tamanos.txt; du -sh $P/lib/perl5/* >> /salida/tamanos.txt
find $P/lib/perl5 -name '*.so' | wc -l >> /salida/tamanos.txt
echo LISTO
