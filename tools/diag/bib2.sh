#!/bin/bash
# biblatex + BibTeX: ¿por qué siguen indefinidas las citas? Muestra todo lo que leen y escriben.
X='\PassOptionsToPackage{backend=bibtex}{biblatex}'
D=$(mktemp -d); cp b.tex refs.bib $D; cd $D
pdflatex -interaction=nonstopmode -jobname=b "$X\\input{b}" >/dev/null 2>&1
echo "== archivos tras la 1.ª pasada: $(ls)"; echo "== b.aux:"; cat b.aux; echo "== b-blx.bib:"; cat b-blx.bib 2>/dev/null | head -20
bibtex b; echo "== b.bbl completo:"; cat b.bbl
pdflatex -interaction=nonstopmode -jobname=b "$X\\input{b}" >/dev/null 2>&1
echo "== 2.ª pasada, avisos:"; grep -n -A3 "biblatex Warning\|undefined\|rerun\|Rerun" b.log | head -40
pdflatex -interaction=nonstopmode -jobname=b "$X\\input{b}" >/dev/null 2>&1
echo "== 3.ª pasada, avisos:"; grep -n -A3 "biblatex Warning\|undefined" b.log | head -20
echo "== versión: $(grep -m1 'Package: biblatex' b.log) $(kpsewhich biblatex.bst) $(grep -m1 -i 'version' $(kpsewhich biblatex.bst))"
