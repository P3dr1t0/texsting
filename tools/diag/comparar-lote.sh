#!/bin/bash
# comparar-lote.sh motor archivo.tex (OUT: carpeta de trabajo) : compila normal (2 pasadas) vs figuras por lote y compara páginas
ENG=$1; F=$2; M=$(basename $F .tex); D=$OUT/$ENG-$M; rm -rf $D; mkdir -p $D; cp $(dirname $F)/* $D/ 2>/dev/null; cd $D
FIGI=$(cat $OUT/fig.txt); LOTEI=$(cat $OUT/lote.txt); X=""; [ $ENG = xelatex ] && X="-no-pdf"
pdfx(){ [ $ENG = xelatex ] && xdvipdfmx -q -E -o $1.pdf $1.xdv 2>/dev/null; }
mkdir ref; cp $M.tex ref/; (cd ref; for i in 1 2; do $ENG $X -interaction=nonstopmode $M.tex >/dev/null 2>&1; done; ENG=$ENG; [ $ENG = xelatex ] && xdvipdfmx -q -E -o $M.pdf $M.xdv 2>/dev/null)
mkdir -p texsting-fig; $ENG $X -interaction=nonstopmode -jobname=$M "$FIGI\\input{$M.tex}" >/dev/null 2>&1
n=$(cat $M.figlist 2>/dev/null | wc -l)
if [ $n = 0 ]; then echo "$ENG $M: sin figuras externas"; grep -m4 -A6 "^!" $M.log; grep -m2 -A6 "^!" ref/$M.log; ls; exit; fi
sed 's/.*/\\expandafter\\def\\csname texsting@hacer@&\\endcsname{}/' $M.figlist > texsting-fig-lote-lista.tex
$ENG $X -interaction=nonstopmode -jobname=texsting-fig-lote "$FIGI\\input{texsting-fig-lote-lista.tex}$LOTEI\\def\\tikzexternalrealjob{$M}\\input{$M.tex}" >/dev/null 2>&1; pdfx texsting-fig-lote
pages=$(grep -o "Output written on [^(]*(\([0-9]*\) page" texsting-fig-lote.log | grep -o "([0-9]*" | tr -d '(')
mapa=$(wc -l < texsting-fig-lote.mapa 2>/dev/null)
i=0; while read f; do i=$((i+1)); pdftex -ini -interaction=batchmode -jobname=$f "\\catcode\`\\{=1 \\catcode\`\\}=2 \\pdfoutput=1 \\pdfximage page $i {texsting-fig-lote.pdf}\\setbox0\\hbox{\\pdfrefximage\\pdflastximage}\\pdfhorigin=0pt \\pdfvorigin=0pt \\pdfpagewidth=\\wd0 \\pdfpageheight=\\ht0 \\shipout\\box0 \\end" >/dev/null 2>&1; done < texsting-fig-lote.mapa
for i in 1 2; do $ENG $X -interaction=nonstopmode -jobname=$M "$FIGI\\input{$M.tex}" >/dev/null 2>&1; done; pdfx $M
errL=$(grep -c "^!" texsting-fig-lote.log); errM=$(grep -c "^!" $M.log); errR=$(grep -c "^!" ref/$M.log)
mkdir -p cr cl; pdftoppm -r 30 -png ref/$M.pdf cr/p 2>/dev/null; pdftoppm -r 30 -png $M.pdf cl/p 2>/dev/null
d=0; big=""; for a in cr/*.png; do b=cl/$(basename $a); [ -f $b ] || { d=$((d+1)); continue; }; v=$(compare -metric AE -fuzz 15% $a $b /dev/null 2>&1); [ "${v%.*}" -gt 200 ] 2>/dev/null && { d=$((d+1)); big="$big $(basename $a):$v"; }; done
echo "$ENG $M: figs=$n lote=$pages mapa=$mapa err(lote/doc/ref)=$errL/$errM/$errR págs=$(ls cr | wc -l)/$(ls cl | wc -l) distintas=$d$big"
[ "$errL" -gt "$errM" ] && { echo "--- errores del lote:"; grep -m3 -B2 -A12 "^!" texsting-fig-lote.log; }
if [ "$errL" -gt "$errM" ]; then
  echo "--- líneas con error en el lote: $(grep -A12 '^!' texsting-fig-lote.log | grep -o '^l\.[0-9]*' | sort | uniq -c | tr '\n' ' ')"
  echo "--- figuras de una en una (como antes):"
  while read f; do $ENG $X -interaction=nonstopmode -jobname=$f "$FIGI\\def\\tikzexternalrealjob{$M}\\input{$M.tex}" >/dev/null 2>&1; echo "   $f: errores $(grep -c '^!' $f.log) $(grep -A12 '^!' $f.log | grep -o '^l\.[0-9]*' | sort -u | tr '\n' ' ')"; done < $M.figlist
fi
