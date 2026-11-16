#!/bin/bash
# biblatex con BibTeX en vez de biber, como lo hace el motor integrado.
X='\PassOptionsToPackage{backend=bibtex}{biblatex}'
for v in normal explicito; do D=$(mktemp -d); cp b.tex refs.bib $D; cd $D
  [ $v = explicito ] && sed -i 's/style=ieee/style=ieee,backend=biber/' b.tex
  pdflatex -interaction=nonstopmode -jobname=b "$X\\input{b}" >/dev/null 2>&1; echo "== $v: $(grep 'bibdata\|bibstyle' b.aux | tr '\n' ' ') bcf=$(ls b.bcf 2>/dev/null)"
  bibtex b | tail -2; pdflatex -interaction=nonstopmode -jobname=b "$X\\input{b}" >/dev/null 2>&1; pdflatex -interaction=nonstopmode -jobname=b "$X\\input{b}" >/dev/null 2>&1
  echo "indefinidas: $(grep -c 'undefined' b.log) · errores: $(grep -c '^!' b.log)"; pdftotext b.pdf - | grep -v '^$' | head -5; cd - >/dev/null; done
