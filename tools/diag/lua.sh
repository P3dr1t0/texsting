#!/bin/bash
# Compila las pruebas de LuaLaTeX (tools/diag/lua) y resume errores, páginas y advertencias.
tlmgr install luacode luacolor lua-ul luamplib lipsum pgfplots microtype tex-gyre > /dev/null 2>&1 || true
cd lua
for f in lua-*.tex; do
  b=${f%.tex}
  lualatex -interaction=nonstopmode $f > /dev/null 2>&1; lualatex -interaction=nonstopmode $f > /dev/null 2>&1
  echo "== $b: pdf=$([ -f $b.pdf ] && echo sí || echo NO) páginas=$(pdfinfo $b.pdf 2>/dev/null | grep Pages | awk '{print $2}') errores=$(grep -c '^!' $b.log) advertencias=$(grep -c 'Warning' $b.log)"
  grep -A3 '^!' $b.log | head -20
  grep -i "warning" $b.log | grep -v "Font shape\|Overfull\|Underfull" | head -5
  pdftotext $b.pdf - 2>/dev/null | head -60
done
