#!/data/data/com.termux/files/usr/bin/bash
# TeXsting — instalador para Termux.
# Instala Debian (proot-distro) + TeX Live oficial + el servidor local de TeXsting.
# Uso: bash setup.sh [TOKEN] [recomendado|completo]   ó   texsting-setup completo
# Se puede volver a ejecutar sin problema: retoma lo que falte.
# Licencia: GPL-3.0-or-later

set -e
TOKEN="${1:-}"
SCHEME="${2:-}"
# Permite: texsting-setup completo  /  texsting-setup recomendado
case "$TOKEN" in completo|recomendado) SCHEME="$TOKEN"; TOKEN="" ;; esac
DISTRO="debian"
SRC_DIR="$HOME/.texsting"
PORT=8765

say()  { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m✔ %s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31m✘ %s\033[0m\n' "$*"; exit 1; }
in_debian() { proot-distro login "$DISTRO" -- "$@"; }

[ -n "$PREFIX" ] && [ -d "$PREFIX/bin" ] || fail "Este script debe ejecutarse dentro de Termux."
[ -f "$SRC_DIR/server.py" ] || fail "No encuentro $SRC_DIR/server.py. Copia el comando completo desde la app."

if [ -z "$TOKEN" ] && [ -f "$SRC_DIR/token" ]; then TOKEN="$(cat "$SRC_DIR/token")"; fi
if [ -z "$TOKEN" ]; then TOKEN="$(head -c 18 /dev/urandom | od -An -tx1 | tr -d ' \n')"; fi
printf '%s' "$TOKEN" > "$SRC_DIR/token"

# ¿Ya hay TeX Live instalado? Entonces solo actualizamos TeXsting y el token (segundos).
FAST=0
if [ -z "$SCHEME" ] && command -v proot-distro >/dev/null 2>&1 \
   && proot-distro login "$DISTRO" -- bash -c 'ls /opt/texlive/bin/*/tlmgr' >/dev/null 2>&1; then
  FAST=1
  say "TeX Live ya está instalado: solo actualizo TeXsting y reconecto la app"
fi

if [ "$FAST" = 0 ] && [ -z "$SCHEME" ]; then
  echo
  echo "¿Qué instalación de TeX Live quieres?"
  echo "  1) Recomendada (~2 GB): lo usual en ingeniería (matemática, TikZ, circuitikz,"
  echo "     español, bibliografía...). Si falta un paquete, TeXsting lo instala solo."
  echo "  2) Completa (~6 GB): todos los paquetes de CTAN, como un MiKTeX completo."
  read -r -p "Elige 1 o 2 [1]: " ans
  case "$ans" in 2) SCHEME="completo" ;; *) SCHEME="recomendado" ;; esac
fi

if [ "$FAST" = 0 ]; then
say "1/3 Actualizando Termux e instalando herramientas"
pkg update -y || true
yes | pkg upgrade -y -o Dpkg::Options::=--force-confnew || true
pkg install -y proot-distro curl procps termux-tools
ok "Herramientas listas"

say "2/3 Instalando Debian dentro de Termux (solo la primera vez)"
if in_debian true >/dev/null 2>&1; then
  ok "Debian ya estaba instalado"
else
  proot-distro install "$DISTRO"
  ok "Debian instalado"
fi

say "3/3 Instalando TeX Live ($SCHEME). Puede tardar bastante: déjalo correr."
in_debian bash -c 'mkdir -p /root/.texsting && cat > /root/.texsting/install-texlive.sh' <<'INNER'
#!/bin/bash
set -e
SCHEME="$1"
export DEBIAN_FRONTEND=noninteractive
REPO="https://mirror.ctan.org/systems/texlive/tlnet"
apt-get update
apt-get install -y --no-install-recommends perl wget xz-utils ca-certificates python3 fontconfig tar gnupg
case "$(uname -m)" in
  aarch64|arm64) ARCH=aarch64-linux ;;
  armv7l|armv8l|armhf|arm*) ARCH=armhf-linux ;;
  x86_64|amd64) ARCH=x86_64-linux ;;
  i686|i386) ARCH=i386-linux ;;
  *) echo "Arquitectura no soportada: $(uname -m)"; exit 1 ;;
esac
BIN="/opt/texlive/bin/$ARCH"
if [ -x "$BIN/tlmgr" ]; then
  echo "TeX Live ya estaba instalado."
  if [ "$SCHEME" = "completo" ]; then
    echo "Ampliando a la instalación completa (todos los paquetes)..."
    "$BIN/tlmgr" install scheme-full
  fi
else
  P=/root/.texsting/texlive.profile
  {
    if [ "$SCHEME" = "completo" ]; then
      echo "selected_scheme scheme-full"
    else
      echo "selected_scheme scheme-custom"
      for c in basic latex latexrecommended latexextra fontsrecommended fontutils \
               mathscience pictures plaingeneric bibtexextra binextra xetex luatex \
               metapost langspanish langenglish; do
        echo "collection-$c 1"
      done
    fi
    echo "TEXDIR /opt/texlive"
    echo "TEXMFLOCAL /opt/texlive/texmf-local"
    echo "TEXMFSYSCONFIG /opt/texlive/texmf-config"
    echo "TEXMFSYSVAR /opt/texlive/texmf-var"
    echo "TEXMFHOME ~/texmf"
    echo "TEXMFCONFIG ~/.texlive/texmf-config"
    echo "TEXMFVAR ~/.texlive/texmf-var"
    echo "binary_$ARCH 1"
    echo "instopt_adjustpath 0"
    echo "instopt_adjustrepo 1"
    echo "instopt_letter 0"
    echo "instopt_portable 0"
    echo "instopt_write18_restricted 1"
    echo "tlpdbopt_autobackup 0"
    echo "tlpdbopt_install_docfiles 0"
    echo "tlpdbopt_install_srcfiles 0"
  } > "$P"
  cd /tmp
  rm -rf install-tl-*
  wget -q --show-progress -O install-tl-unx.tar.gz "$REPO/install-tl-unx.tar.gz"
  tar xzf install-tl-unx.tar.gz
  cd install-tl-2*
  perl ./install-tl --profile="$P" --repository="$REPO"
  cd /tmp && rm -rf install-tl-*
fi
"$BIN/tlmgr" path add
tlmgr option repository "$REPO" || true
command -v latexmk >/dev/null || tlmgr install latexmk
echo "TEXLIVE_OK"
INNER
in_debian bash /root/.texsting/install-texlive.sh "$SCHEME" || fail "Falló la instalación de TeX Live. Revisa tu internet y vuelve a ejecutar: texsting-setup"
ok "TeX Live instalado"
fi

# Servidor y token siempre actualizados.
in_debian bash -c 'mkdir -p /root/.texsting && cat > /root/.texsting/server.py' < "$SRC_DIR/server.py"
printf '%s' "$TOKEN" | in_debian bash -c 'cat > /root/.texsting/token && chmod 600 /root/.texsting/token'

say "Creando los comandos texsting, texsting-stop y texsting-setup"
cat > "$PREFIX/bin/texsting" <<EOF
#!$PREFIX/bin/bash
# Inicia el servidor de compilación de TeXsting (déjalo abierto en segundo plano).
if curl -s -m 1 http://127.0.0.1:$PORT/health >/dev/null 2>&1; then
  echo "TeXsting ya está activo. Puedes volver a la app."
  exit 0
fi
termux-wake-lock >/dev/null 2>&1 || true
echo "Iniciando TeXsting... (para detenerlo: texsting-stop)"
exec proot-distro login $DISTRO -- python3 /root/.texsting/server.py
EOF
cat > "$PREFIX/bin/texsting-stop" <<EOF
#!$PREFIX/bin/bash
pkill -f "/root/.texsting/server.py" && echo "TeXsting detenido." || echo "TeXsting no estaba activo."
termux-wake-unlock >/dev/null 2>&1 || true
EOF
cat > "$PREFIX/bin/texsting-setup" <<EOF
#!$PREFIX/bin/bash
exec bash "$SRC_DIR/setup.sh" "\$@"
EOF
chmod +x "$PREFIX/bin/texsting" "$PREFIX/bin/texsting-stop" "$PREFIX/bin/texsting-setup"
[ -f "$SRC_DIR/setup.sh" ] || cp "$0" "$SRC_DIR/setup.sh" 2>/dev/null || true

# Arranque automático cada vez que se abre Termux.
touch "$HOME/.bashrc"
sed -i '/# >>> texsting >>>/,/# <<< texsting <<</d' "$HOME/.bashrc"
cat >> "$HOME/.bashrc" <<'EOF'
# >>> texsting >>>
if ! curl -s -m 1 http://127.0.0.1:8765/health >/dev/null 2>&1; then
  nohup texsting > "$HOME/.texsting/server.log" 2>&1 &
  echo "TeXsting: servidor de compilación iniciado en segundo plano."
fi
# <<< texsting <<<
EOF
ok "Comandos creados (y arranque automático al abrir Termux)"

say "Probando una compilación"
texsting-stop >/dev/null 2>&1 || true
nohup texsting > "$SRC_DIR/server.log" 2>&1 &
for _ in $(seq 1 30); do
  curl -s -m 1 "http://127.0.0.1:$PORT/health" >/dev/null 2>&1 && break
  sleep 1
done
RES="$(curl -s -m 300 -H "Content-Type: application/json" -H "X-TeXsting-Token: $TOKEN" \
  -d '{"project":"prueba","main":"main.tex","engine":"pdflatex","files":[{"path":"main.tex","text":"\\documentclass{article}\\begin{document}Hola desde TeXsting: $e^{i\\pi}+1=0$\\end{document}"}]}' \
  "http://127.0.0.1:$PORT/compile" || true)"
case "$RES" in
  *'"ok": true'*) ok "¡Compilación de prueba exitosa!" ;;
  *) echo "$RES" | head -c 1500; fail "La compilación de prueba no funcionó. Mira $SRC_DIR/server.log" ;;
esac

cat <<EOF

────────────────────────────────────────────
  TeXsting está listo.
  • Servidor activo en segundo plano (puerto $PORT).
  • Token: $TOKEN
  • Cada vez que abras Termux, el servidor arranca solo.
  • Ya puedes volver a la app y tocar "Probar conexión".

  Consejos para que Android no lo cierre:
  • Quita a Termux de la optimización de batería.
  • En Android 14 o superior: Opciones de desarrollador →
    "Desactivar restricciones de procesos secundarios".
────────────────────────────────────────────
EOF
