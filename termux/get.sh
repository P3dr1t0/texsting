#!/data/data/com.termux/files/usr/bin/bash
# TeXsting — descarga el instalador y el servidor desde GitHub y los ejecuta.
# Uso (lo copia la app): bash ~/texsting-get.sh TOKEN
set -e
BASE="https://raw.githubusercontent.com/P3dr1t0/texsting/main/termux"
mkdir -p "$HOME/.texsting"
echo "Descargando TeXsting..."
curl -fsSL "$BASE/server.py" -o "$HOME/.texsting/server.py"
curl -fsSL "$BASE/setup.sh" -o "$HOME/.texsting/setup.sh"
exec bash "$HOME/.texsting/setup.sh" "$@"
