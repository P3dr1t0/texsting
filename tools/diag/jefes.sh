#!/bin/bash
# Los «jefes»: compila cada proyecto como lo haría latexmk (con biber, glosarios, nomenclatura e
# índices) en TeX Live 2026 completo, para saber que los documentos están bien antes de probarlos en la app.
tlmgr install biblatex biber imakeidx nomencl glossaries glossaries-spanish cleveref todonotes threeparttable \
  siunitx pgfplots circuitikz tikz-timing tikz-cd forest tcolorbox diagbox tabularray pdflscape makecell \
  wrapfig lipsum qrcode appendixnumberbeamer beamer chemformula gnu-freefont babel-greek babel-russian \
  babel-german hyphen-greek hyphen-russian hyphen-german luacode fontspec unicode-math lm-math csquotes \
  mfirstuc xfor datatool tracklang glossaries-extra listings environ trimspaces pdfcol tikzfill \
  multirow ninecolors > /dev/null 2>&1 || true
cd jefes
for d in jefe*/; do
  d=${d%/}; cd $d
  eng=pdflatex; grep -q '!TEX program = lualatex' main.tex && eng=lualatex
  t0=$(date +%s)
  run() { $eng -interaction=nonstopmode -file-line-error main.tex > /dev/null 2>&1; }
  run
  [ -f main.bcf ] && biber main > biber.out 2>&1
  [ -f main.glo ] && makeglossaries main > glos.out 2>&1
  for i in *.idx; do [ -f "$i" ] && makeindex "$i" > /dev/null 2>&1; done
  [ -f main.nlo ] && makeindex main.nlo -s nomencl.ist -o main.nls > /dev/null 2>&1
  run; [ -f main.bcf ] && biber main >> biber.out 2>&1; run
  echo "=== $d ($eng): pdf=$([ -f main.pdf ] && echo sí || echo NO) páginas=$(pdfinfo main.pdf 2>/dev/null | awk '/Pages/{print $2}') errores=$(grep -cE '^!|^[^ ]+:[0-9]+: ' main.log) indefinidas=$(grep -c 'undefined' main.log) $(( $(date +%s) - t0 )) s"
  grep -A3 -E '^!|^[^ ]+:[0-9]+: ' main.log | head -24
  grep -i "warning.*undefined\|Citation.*undefined" main.log | head -5
  grep -i "error\|WARN" biber.out 2>/dev/null | head -5
  cd ..
done
