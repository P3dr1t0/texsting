#!/bin/bash
# biblatex con BibTeX en vez de biber, como lo hace el motor integrado.
X='\PassOptionsToPackage{backend=bibtex}{biblatex}'
for v in normal; do D=$(mktemp -d); cp b.tex refs.bib $D; cd $D
  [ $v = explicito ] && sed -i 's/style=ieee/style=ieee,backend=biber/' b.tex
  pdflatex -interaction=nonstopmode -jobname=b "$X\\input{b}" >/dev/null 2>&1; echo "== $v: $(grep 'bibdata\|bibstyle' b.aux | tr '\n' ' ') bcf=$(ls b.bcf 2>/dev/null)"
  bibtex b > bt.txt 2>&1; tail -15 b.blg; pdflatex -interaction=nonstopmode -jobname=b "$X\\input{b}" >/dev/null 2>&1; pdflatex -interaction=nonstopmode -jobname=b "$X\\input{b}" >/dev/null 2>&1
  echo "errores: $(grep -c "^!" b.log)"; head -12 b.bbl; grep -i -A3 "Package biblatex Warning\|bbl" b.log | head -40; grep -i 'undefined\|warning' b.log | head -5; strings b.pdf | grep -c Knuth; cd - >/dev/null; done
