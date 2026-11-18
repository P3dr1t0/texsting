#!/bin/bash
# Solo los documentos con circuitikz: el lote da errores en TeX Live 2026, ¿cuáles?
export MOTORES="pdflatex"
export DOCS='$OUT/docs/pruebas-texsting-serie2/prueba08-circuitos-ac.tex'
bash lote.sh
f=$(kpsewhich circuitikz.sty); echo "circuitikz: $(grep -m1 'pgfcircversion\|ProvidesPackage' $f)"
