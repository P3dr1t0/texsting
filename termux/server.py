#!/usr/bin/env python3
# TeXsting — servidor local de compilación LaTeX.
# Corre dentro de Termux (Debian en proot) y solo escucha en 127.0.0.1.
# La app TeXsting le envía los archivos del proyecto y recibe el PDF y el log.
#
# Licencia: GPL-3.0-or-later
"""TeXsting compile server."""

import base64
import json
import os
import re
import shutil
import signal
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

VERSION = "0.2.1"
HOME = os.path.expanduser("~")
CONF_DIR = os.environ.get("TEXSTING_DIR", os.path.join(HOME, ".texsting"))
HOST = os.environ.get("TEXSTING_HOST", "127.0.0.1")
PORT = int(os.environ.get("TEXSTING_PORT", "8765"))
WORK = os.environ.get("TEXSTING_WORK", os.path.join(CONF_DIR, "work"))
TIMEOUT = int(os.environ.get("TEXSTING_TIMEOUT", "600"))
MAX_BODY = 300 * 1024 * 1024
MAX_LOG = 3 * 1024 * 1024
MAX_INSTALL_ROUNDS = 4

ENGINES = {
    "pdflatex": ("-pdf", "pdflatex"),
    "xelatex": ("-xelatex", "xelatex"),
    "lualatex": ("-lualatex", "lualatex"),
}

MISSING_PATTERNS = [
    re.compile(r"LaTeX Error: File `([^']+)' not found"),
    re.compile(r"! I can't find file `([^']+)'"),
    re.compile(r"Font \\[^=\s]+=([A-Za-z0-9_\-]+)(?: at [^ ]+| scaled \d+)? not loadable: Metric \(TFM\) file not found"),
]

_compile_lock = threading.Lock()
_install_lock = threading.Lock()


def read_token():
    tok = os.environ.get("TEXSTING_TOKEN")
    if tok:
        return tok.strip()
    path = os.path.join(CONF_DIR, "token")
    try:
        with open(path, "r", encoding="utf-8") as fh:
            return fh.read().strip()
    except OSError:
        return ""


TOKEN = read_token()


def which(name):
    return shutil.which(name)


def tex_version():
    exe = which("pdftex") or which("xetex") or which("luatex")
    if not exe:
        return None
    try:
        out = subprocess.run([exe, "--version"], capture_output=True, text=True, timeout=20).stdout
        return out.splitlines()[0].strip() if out else None
    except Exception:
        return None


def tlmgr_usable():
    """tlmgr solo sirve si es el TeX Live oficial (no el empaquetado por Debian)."""
    global _TLMGR_CACHE
    if _TLMGR_CACHE is not None:
        return _TLMGR_CACHE
    ok = False
    if which("tlmgr") and which("kpsewhich"):
        try:
            root = subprocess.run(["kpsewhich", "-var-value=TEXMFROOT"], capture_output=True,
                                  text=True, timeout=30).stdout.strip()
            tlpdb = os.path.join(root, "tlpkg", "texlive.tlpdb")
            ok = bool(root) and os.path.isfile(tlpdb) and os.access(tlpdb, os.W_OK)
        except Exception:
            ok = False
    _TLMGR_CACHE = ok
    return ok


_TLMGR_CACHE = None


SAFE_ID = re.compile(r"^[A-Za-z0-9_\-]{1,64}$")


def safe_rel_path(p):
    p = (p or "").replace("\\", "/").strip()
    if not p or p.startswith("/") or "\x00" in p:
        return None
    parts = [x for x in p.split("/") if x not in ("", ".")]
    if not parts or any(x == ".." for x in parts):
        return None
    return "/".join(parts)


def write_if_changed(path, data):
    try:
        with open(path, "rb") as fh:
            if fh.read() == data:
                return False
    except OSError:
        pass
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as fh:
        fh.write(data)
    return True


def sync_project(project_dir, files):
    """Escribe los archivos del proyecto y borra los que ya no existen."""
    manifest_path = os.path.join(project_dir, ".texsting-manifest.json")
    try:
        with open(manifest_path, "r", encoding="utf-8") as fh:
            old = set(json.load(fh))
    except Exception:
        old = set()
    new = set()
    for f in files:
        rel = safe_rel_path(f.get("path"))
        if not rel:
            raise ValueError("Ruta de archivo no válida: %r" % f.get("path"))
        if "base64" in f and f["base64"] is not None:
            data = base64.b64decode(f["base64"])
        else:
            data = (f.get("text") or "").encode("utf-8")
        write_if_changed(os.path.join(project_dir, rel), data)
        new.add(rel)
    for rel in old - new:
        try:
            os.remove(os.path.join(project_dir, rel))
        except OSError:
            pass
    with open(manifest_path, "w", encoding="utf-8") as fh:
        json.dump(sorted(new), fh)


def run_cmd(cmd, cwd, timeout):
    """Ejecuta un comando en su propio grupo de procesos, con límite de tiempo."""
    env = dict(os.environ)
    # Evita que TeX corte las líneas del log a 79 caracteres.
    env.update({"max_print_line": "10000", "error_line": "254", "half_error_line": "238"})
    proc = subprocess.Popen(
        cmd, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        stdin=subprocess.DEVNULL, start_new_session=True, env=env,
    )
    try:
        out, _ = proc.communicate(timeout=timeout)
        return proc.returncode, out.decode("utf-8", "replace"), False
    except subprocess.TimeoutExpired:
        try:
            os.killpg(proc.pid, signal.SIGKILL)
        except Exception:
            proc.kill()
        out, _ = proc.communicate()
        return -9, out.decode("utf-8", "replace"), True


def run_latex(project_dir, main, engine, timeout):
    flag, exe = ENGINES[engine]
    if which("latexmk"):
        # -g: compilar siempre que el usuario lo pide (si no, latexmk se niega a
        # repetir un documento que tuvo errores y no cambió).
        cmd = ["latexmk", flag, "-g", "-interaction=nonstopmode", "-file-line-error",
               "-synctex=1", "-f", main]
        return run_cmd(cmd, project_dir, timeout)
    # Sin latexmk: dos pasadas del motor.
    out_all = ""
    code = 0
    deadline = time.time() + timeout
    for _ in range(2):
        left = max(5, int(deadline - time.time()))
        code, out, to = run_cmd([exe, "-interaction=nonstopmode", "-file-line-error",
                                 "-synctex=1", main], project_dir, left)
        out_all += out
        if to:
            return code, out_all, True
    return code, out_all, False


# Solo se buscan en CTAN archivos que suelen venir de paquetes (no imágenes ni \\input del usuario).
INSTALLABLE_EXT = ("sty", "cls", "bst", "def", "fd", "cfg", "clo", "ldf", "tfm", "bbx", "cbx", "lbx", "dbx", "code.tex", "otf", "ttf", "pfb", "map", "enc")


def find_missing(log_text):
    found = []
    for pat in MISSING_PATTERNS:
        for m in pat.finditer(log_text):
            name = m.group(1).strip()
            if pat is MISSING_PATTERNS[2]:
                name += ".tfm"
            if not name.lower().endswith(INSTALLABLE_EXT):
                continue
            if name not in found:
                found.append(name)
    return found


def tlmgr_find_package(filename):
    r = subprocess.run(["tlmgr", "search", "--global", "--file", "/" + filename],
                       capture_output=True, text=True, timeout=180)
    pkg = None
    best = None
    for line in r.stdout.splitlines():
        if line and not line.startswith((" ", "\t")) and line.endswith(":"):
            pkg = line[:-1].strip()
        elif pkg and line.strip().endswith("/" + filename):
            # Preferimos rutas tex/ sobre doc/ o source/.
            if best is None or "/tex/" in line:
                best = pkg
    return best


def tlmgr_install(pkg):
    r = subprocess.run(["tlmgr", "install", pkg], capture_output=True, text=True, timeout=900)
    return r.returncode == 0, (r.stdout + r.stderr)[-4000:]


def read_file(path, limit=None):
    try:
        with open(path, "rb") as fh:
            data = fh.read()
    except OSError:
        return None
    if limit and len(data) > limit:
        data = data[-limit:]
    return data


def compile_project(req):
    project = req.get("project") or "default"
    if not SAFE_ID.match(project):
        raise ValueError("Identificador de proyecto no válido")
    main = safe_rel_path(req.get("main") or "main.tex")
    if not main or not main.lower().endswith(".tex"):
        raise ValueError("El archivo principal debe ser un .tex")
    engine = req.get("engine") or "pdflatex"
    if engine not in ENGINES:
        raise ValueError("Motor no soportado: %s" % engine)
    autoinstall = bool(req.get("autoinstall", True))
    timeout = int(req.get("timeout") or TIMEOUT)
    timeout = max(10, min(timeout, 3600))

    project_dir = os.path.join(WORK, project)
    os.makedirs(project_dir, exist_ok=True)
    sync_project(project_dir, req.get("files") or [])

    stem = os.path.splitext(main)[0]
    pdf_path = os.path.join(project_dir, stem + ".pdf")
    log_path = os.path.join(project_dir, stem + ".log")

    started = time.time()
    installed, failed = [], []
    can_install = autoinstall and tlmgr_usable()
    rounds = 0
    while True:
        # Borra el PDF anterior para no devolver uno viejo si la compilación falla.
        try:
            os.remove(pdf_path)
        except OSError:
            pass
        code, output, timed_out = run_latex(project_dir, main, engine,
                                            max(10, timeout - int(time.time() - started)))
        log_bytes = read_file(log_path) or b""
        log_text = log_bytes.decode("utf-8", "replace")
        missing = [m for m in find_missing(log_text + "\n" + output)
                   if m not in failed and not os.path.exists(os.path.join(project_dir, m))]
        if timed_out or not missing or not can_install or rounds >= MAX_INSTALL_ROUNDS:
            break
        rounds += 1
        progress = False
        with _install_lock:
            for fname in missing:
                pkg = tlmgr_find_package(fname)
                if not pkg:
                    failed.append(fname)
                    continue
                ok, _ = tlmgr_install(pkg)
                if ok:
                    installed.append(pkg)
                    progress = True
                else:
                    failed.append(fname)
        if not progress:
            break
        # Limpia auxiliares para forzar recompilación completa tras instalar.
        if which("latexmk"):
            run_cmd(["latexmk", "-c", main], project_dir, 60)

    pdf = read_file(pdf_path)
    has_errors = bool(re.search(r"^(! |.*:\d+: )", log_text, re.M))
    if timed_out:
        status = "timeout"
    elif pdf is None:
        status = "failed"
    elif has_errors or code != 0:
        status = "errors"
    else:
        status = "success"
    synctex = read_file(os.path.join(project_dir, stem + ".synctex.gz"))
    return {
        "ok": pdf is not None,
        "status": status,
        "pdf": base64.b64encode(pdf).decode("ascii") if pdf else None,
        "synctex": base64.b64encode(synctex).decode("ascii") if synctex else None,
        "log": log_text[-MAX_LOG:],
        "output": output[-40000:],
        "installed": installed,
        "missing": failed,
        "elapsed": round(time.time() - started, 2),
        "engine": engine,
    }


def server_info():
    return {
        "app": "texsting-server",
        "version": VERSION,
        "tex": tex_version(),
        "latexmk": bool(which("latexmk")),
        "tlmgr": tlmgr_usable(),
        "engines": [e for e, (_, exe) in ENGINES.items() if which(exe)],
    }


class Handler(BaseHTTPRequestHandler):
    server_version = "TeXsting/" + VERSION

    def log_message(self, fmt, *args):
        sys.stderr.write("[texsting] %s - %s\n" % (time.strftime("%H:%M:%S"), fmt % args))

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-TeXsting-Token")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Access-Control-Max-Age", "600")

    def _json(self, code, obj):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _authorized(self):
        if not TOKEN:
            return True
        return self.headers.get("X-TeXsting-Token", "") == TOKEN

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/health":
            return self._json(200, {"app": "texsting-server", "version": VERSION})
        if not self._authorized():
            return self._json(401, {"error": "Token incorrecto"})
        if path in ("/", "/ping", "/info"):
            return self._json(200, server_info())
        return self._json(404, {"error": "No encontrado"})

    def do_POST(self):
        path = self.path.split("?")[0]
        if not self._authorized():
            return self._json(401, {"error": "Token incorrecto"})
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            length = 0
        if length <= 0 or length > MAX_BODY:
            return self._json(413, {"error": "Cuerpo vacío o demasiado grande"})
        try:
            req = json.loads(self.rfile.read(length).decode("utf-8"))
        except Exception:
            return self._json(400, {"error": "JSON no válido"})
        if path == "/compile":
            if not _compile_lock.acquire(timeout=TIMEOUT):
                return self._json(503, {"error": "Hay otra compilación en curso"})
            try:
                return self._json(200, compile_project(req))
            except ValueError as exc:
                return self._json(400, {"error": str(exc)})
            except Exception as exc:  # pragma: no cover
                return self._json(500, {"error": "Error interno: %s" % exc})
            finally:
                _compile_lock.release()
        if path == "/install":
            if not tlmgr_usable():
                return self._json(400, {"error": "tlmgr no está disponible"})
            pkgs = [p for p in (req.get("packages") or []) if re.match(r"^[A-Za-z0-9_.\-]+$", p)]
            results = {}
            with _install_lock:
                for p in pkgs:
                    ok, out = tlmgr_install(p)
                    results[p] = {"ok": ok, "output": out}
            return self._json(200, {"results": results})
        return self._json(404, {"error": "No encontrado"})


def main():
    os.makedirs(WORK, exist_ok=True)
    httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    info = server_info()
    print("TeXsting servidor %s escuchando en http://%s:%d" % (VERSION, HOST, PORT))
    print("TeX: %s | latexmk: %s | tlmgr: %s" % (info["tex"], info["latexmk"], info["tlmgr"]))
    if not TOKEN:
        print("AVISO: sin token; cualquier app del teléfono podría usar el servidor.")
    sys.stdout.flush()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
