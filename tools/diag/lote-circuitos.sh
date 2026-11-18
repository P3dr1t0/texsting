#!/bin/bash
# Documentos con circuitikz y babel en español (< y > activos) + Física, con los tres motores.
export MOTORES="pdflatex xelatex"
export DOCS='$OUT/docs/pruebas-texsting-serie2/prueba08-circuitos-ac.tex $OUT/docs/fisica-nueva.tex $OUT/docs/pruebas-texsting-serie2/prueba11-digital-senales.tex'
bash lote.sh
