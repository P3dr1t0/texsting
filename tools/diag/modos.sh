#!/bin/bash
# Reproduce los modos del motor integrado: normal, preámbulo (mylatexformat) y figuras (tikz external).
# Uso: modos.sh "nombre del principal sin .tex"
J="$1"; D=$(mktemp -d); cp fisica.tex "$D/$J.tex"; cd "$D"
INJ='\AddToHook{begindocument/before}{\IfPackageLoadedTF{tikz}{\usetikzlibrary{external}\tikzexternalize[mode=list and make,prefix=texsting-fig/]}{}}'
t() { local s=$(date +%s.%N); "$@" > /dev/null 2>&1; echo "$(echo "$(date +%s.%N) - $s" | bc | cut -c1-5)s"; }
P="pdflatex -interaction=nonstopmode -file-line-error -synctex=1 -recorder"
echo "### [$J]"
echo "normal 1: $(t $P "$J.tex") · 2: $(t $P "$J.tex") · errores: $(grep -c '^!\|:[0-9]*: ' "$J.log")"
echo "pre fmt: $(t pdftex -ini -interaction=nonstopmode -jobname=texsting-pre -progname=pdflatex '&pdflatex' mylatexformat.ltx "$J.tex") · existe: $(ls texsting-pre.fmt 2>/dev/null)"
grep -m3 '^!' texsting-pre.log
echo "pre compila: $(t $P -fmt=texsting-pre "$J.tex") · errores: $(grep -c '^!\|:[0-9]*: ' "$J.log")"; grep -m3 '^!\|:[0-9]*: ' "$J.log"
rm -f "$J.aux"; mkdir -p texsting-fig
echo "figs main: $(t pdflatex -interaction=nonstopmode -file-line-error -recorder -jobname="$J" "$INJ\\input{$J}") · figlist: $(wc -l < "$J.figlist" 2>/dev/null)"
grep -m3 '^!\|:[0-9]*: ' "$J.log"
s=$(date +%s); n=0; while read -r f; do n=$((n+1)); pdflatex -interaction=batchmode -halt-on-error -jobname="$f" "$INJ\\def\\tikzexternalrealjob{$J}\\input{$J}" > /dev/null 2>&1 || echo "  fallo $f"; done < "$J.figlist"; echo "figs dibujadas: $n en $(( $(date +%s)-s ))s"
echo "figs main 2: $(t pdflatex -interaction=nonstopmode -file-line-error -recorder -jobname="$J" "$INJ\\input{$J}") · errores: $(grep -c '^!\|:[0-9]*: ' "$J.log")"; grep -m3 '^!\|:[0-9]*: ' "$J.log"
grep -m5 "Package tikz Warning\|Package pgfplots" "$J.log"
