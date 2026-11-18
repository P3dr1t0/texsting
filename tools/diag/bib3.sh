#!/bin/bash
# biblatex + BibTeX: variantes (opción inyectada o escrita, estilo ieee o numeric) y el log alrededor del .bbl.
for v in inyectada escrita numeric; do
  D=$(mktemp -d); cp b.tex refs.bib $D; cd $D; X='\PassOptionsToPackage{backend=bibtex}{biblatex}'
  [ $v != inyectada ] && { sed -i 's/\\usepackage\[style=ieee\]{biblatex}/\\usepackage[style=ieee,backend=bibtex]{biblatex}/' b.tex; X=''; }
  [ $v = numeric ] && sed -i 's/style=ieee/style=numeric/' b.tex
  for i in 1; do pdflatex -interaction=nonstopmode -jobname=b "$X\\input{b}" >/dev/null 2>&1; done; bibtex b >/dev/null 2>&1
  pdflatex -interaction=nonstopmode -jobname=b "$X\\input{b}" >/dev/null 2>&1; pdflatex -interaction=nonstopmode -jobname=b "$X\\input{b}" >/dev/null 2>&1
  echo "== $v: indefinidas=$(grep -c 'undefined' b.log) rerun=$(grep -c 'run BibTeX' b.log) knuth-en-pdf=$(pdftotext b.pdf - | grep -c Knuth)"
  [ $v = inyectada ] && { n=$(grep -n "b.bbl" b.log | head -1 | cut -d: -f1); sed -n "$((n-5)),$((n+25))p" b.log; echo "-- blg:"; cat b.blg | tail -15; }
  cd - >/dev/null
done
