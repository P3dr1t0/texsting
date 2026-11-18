#!/bin/bash
# Figuras TikZ en una sola compilación (makeFigsLote en MotorPlugin.java) con TeX Live del año.
# Usa las mismas órdenes que la app (se sacan del .java) y compara el PDF con la compilación normal.
set -u
export OUT=$(mktemp -d); HERE=$(pwd)
python3 - "$OUT" <<'PY'
import sys
s=open('../../android-config/java/MotorPlugin.java').read()
def grab(n):
    i=s.index('private static String '+n+'()'); j=s.index('\n    }\n',i)+7; return s[i:j]
open(sys.argv[1]+'/T.java','w').write('public class T {\n static final String FIG="texsting-fig"; static final String LOTE=FIG+"-lote";\n'+grab('figInject')+grab('loteInject')+'\n public static void main(String[] a){ System.out.print(a[0].equals("fig")?figInject():loteInject()); }\n}')
# Física con el encabezado nuevo (iftex + fontspec en XeLaTeX)
t=open('fisica.tex').read(); i=t.index('\\usepackage{amsmath')
open(sys.argv[1]+'/fisica-nueva.tex','w').write(r'''\documentclass[11pt,a4paper]{article}
\usepackage{iftex}
\ifPDFTeX
  \usepackage[T1]{fontenc}
  \usepackage[utf8]{inputenc}
  \IfFileExists{lmodern.sty}{\usepackage{lmodern}}{}
\else
  \usepackage{fontspec}
\fi
\usepackage[provide=*]{babel}
\babelprovide[import,main]{spanish}
\usepackage[a4paper,margin=2.1cm,top=2.2cm,bottom=2.2cm,headheight=14pt]{geometry}
\usepackage[american]{circuitikz}
'''+t[i:])
PY
(cd $OUT && javac T.java 2>/dev/null && java T fig 2>/dev/null > fig.txt && java T lote 2>/dev/null > lote.txt)
echo "lote: $(cat $OUT/lote.txt | head -c 120)…"
mkdir -p $OUT/docs && cp $OUT/fisica-nueva.tex $OUT/docs/ && cd $OUT/docs && for z in $HERE/../../pruebas/*.zip; do unzip -q -o $z; done; cd $HERE
for e in ${MOTORES:-pdflatex xelatex lualatex}; do
  TODOS="$OUT/docs/fisica-nueva.tex $OUT/docs/pruebas-texsting-serie2/prueba08-circuitos-ac.tex $OUT/docs/pruebas-texsting-serie2/prueba12-documento-largo.tex $OUT/docs/pruebas-texsting-serie4/prueba25-graficas-pesadas.tex $OUT/docs/pruebas-texsting-serie2/prueba11-digital-senales.tex"
  for f in $(eval echo ${DOCS:-$TODOS}); do
    [ $e = lualatex ] && [ $(basename $f) != fisica-nueva.tex ] && continue
    s=$(date +%s); bash comparar-lote.sh $e $f; echo "   ($(( $(date +%s) - s )) s)"
  done
done
