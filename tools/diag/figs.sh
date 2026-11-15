#!/bin/bash
# Variantes del modo figuras para aislar «\caption outside float».
INJ='\AddToHook{begindocument/before}{\IfPackageLoadedTF{tikz}{\usetikzlibrary{external}\tikzexternalize[mode=list and make,prefix=texsting-fig/]}{}}'
prueba() { local n="$1" inj="$2"; D=$(mktemp -d); cp "$n.tex" "$D/"; cd "$D"; mkdir -p texsting-fig
  pdflatex -interaction=nonstopmode -file-line-error -jobname="$n" "$inj\\input{$n}" > /dev/null 2>&1
  echo "== $n: errores $(grep -c ':[0-9]*: ' "$n.log") · figlist $(wc -l < "$n.figlist" 2>/dev/null)"; cd - > /dev/null; }
python3 - <<'PY'
d=open('fisica.tex').read()
P='\\usepackage{float}'
open('f_preambulo.tex','w').write(d.replace(P, P+'\n\\usetikzlibrary{external}\\tikzexternalize[mode=list and make,prefix=texsting-fig/]',1))
open('f_sinH.tex','w').write(d.replace('\\begin{figure}[H]','\\begin{figure}[htbp]'))
open('f_sinhyperref.tex','w').write(d.replace('\\usepackage[hidelinks]{hyperref}',''))
open('f_sintcb.tex','w').write(d.replace('\\usepackage[most]{tcolorbox}','\\usepackage[most]{tcolorbox}\\renewenvironment{obs}{}{}'))
open('f_sinpgfplots.tex','w').write(d.replace('\\usepackage{pgfplots}','\\usepackage{pgfplots}\\tikzset{external/export next=false}'))
PY
prueba fisica "$INJ"
D=$(mktemp -d); cp fisica.tex $D; (cd $D; mkdir -p texsting-fig; pdflatex -interaction=nonstopmode -file-line-error -jobname=fisica "$INJ\\input{fisica}" >/dev/null 2>&1; grep -n -m1 -B30 'caption outside' fisica.log | cut -c1-150)
prueba f_preambulo ""
for v in f_sinH f_sinhyperref f_sintcb; do prueba $v "$INJ"; done
