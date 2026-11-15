#!/bin/bash
INJ='\AddToHook{begindocument/before}{\IfPackageLoadedTF{tikz}{\usetikzlibrary{external}\tikzexternalize[mode=list and make,prefix=texsting-fig/]}{}}'
for f in m_*.tex; do n=${f%.tex}; D=$(mktemp -d); cp $f $D; (cd $D; mkdir -p texsting-fig
  pdflatex -interaction=nonstopmode -file-line-error -jobname=$n "$INJ\\input{$n}" > /dev/null 2>&1
  echo "== $n: errores $(grep -c ':[0-9]*: ' $n.log)"; grep -m2 -A3 ':[0-9]*: ' $n.log | cut -c1-120); done
D=$(mktemp -d); cp m_base.tex $D; (cd $D; mkdir -p texsting-fig; pdflatex -interaction=nonstopmode -file-line-error -jobname=m_base "$INJ\\input{m_base}" >/dev/null 2>&1; grep -n -A12 'caption outside' m_base.log | head -30)
# Nombres con espacios: jobname seguro
D=$(mktemp -d); cp fisica.tex "$D/fisica (1).tex"; cd $D
pdftex -ini -interaction=nonstopmode -jobname=texsting-pre -progname=pdflatex '&pdflatex' mylatexformat.ltx '"fisica (1).tex"' >/dev/null 2>&1; echo "pre con comillas: $(ls texsting-pre.fmt 2>/dev/null) $(grep -m1 '^!' texsting-pre.log)"
pdflatex -fmt=texsting-pre -interaction=nonstopmode -file-line-error -synctex=1 -recorder -jobname=fisica_1 "fisica (1).tex" >/dev/null 2>&1; echo "compila pre jobname seguro: pdf=$(ls fisica_1.pdf 2>/dev/null) errores=$(grep -c ':[0-9]*: ' fisica_1.log) $(grep -m1 -o 'Output written.*' fisica_1.log)"
pdflatex -interaction=nonstopmode -file-line-error -synctex=1 -recorder -jobname=fisica_2 "fisica (1).tex" >/dev/null 2>&1; echo "normal jobname seguro: $(grep -m1 -o 'Output written.*' fisica_2.log) · synctex: $(zcat fisica_2.synctex.gz | grep -m1 '^Input')"
