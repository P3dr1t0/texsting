#!/bin/bash
# Solo los documentos con circuitikz (sin figuras externas en TeX Live 2026: ¿por qué?)
export MOTORES="pdflatex xelatex"
export DOCS='$OUT/docs/pruebas-texsting-serie2/prueba08-circuitos-ac.tex $OUT/docs/pruebas-texsting-serie2/prueba12-documento-largo.tex'
bash lote.sh
