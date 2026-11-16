package io.github.texsting;

import android.util.Base64;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.*;
import org.json.JSONObject;

@CapacitorPlugin(name = "Motor")
public class MotorPlugin extends Plugin {
    private final ExecutorService exec = Executors.newSingleThreadExecutor();
    // Trabajo en segundo plano (preámbulo, figuras): se corta en cuanto llega una compilación.
    private final ExecutorService bg = Executors.newSingleThreadExecutor(r -> new Thread(r, "texsting-bg"));
    private final Object work = new Object();
    private volatile int gen;
    // Procesos en segundo plano (varias figuras se dibujan a la vez): se cortan todos al compilar.
    private final Set<Process> bgProcs = java.util.concurrent.ConcurrentHashMap.newKeySet();

    private void cancelBackground() {
        gen++;
        for (Process p : bgProcs) p.destroyForcibly();
    }

    private void background(Runnable task) {
        final int g = gen;
        bg.execute(() -> {
            synchronized (work) {
                if (g != gen) return;
                try { task.run(); } catch (Exception ignored) { }
            }
        });
    }

    private File libDir() { return new File(getContext().getApplicationInfo().nativeLibraryDir); }
    private File pdftex() { return new File(libDir(), "libtx_pdftex.so"); }
    private File luatex() { return new File(libDir(), "libtx_luahbtex.so"); }
    private File luaFmtDir() { return new File(var(), "texmf-var/web2c/luahbtex"); }

    /** Orden para el motor elegido: pdfTeX (pdflatex) o LuaHBTeX (lualatex). fmt = null: el formato normal. */
    private List<String> tex(String eng, String fmt, String... rest) {
        List<String> c = new ArrayList<>();
        boolean lua = "lualatex".equals(eng);
        c.add((lua ? luatex() : pdftex()).getAbsolutePath());
        c.add(lua ? "-progname=lualatex" : "-progname=pdflatex");
        c.add("-fmt=" + (fmt != null ? fmt : lua ? "lualatex" : "pdflatex"));
        c.addAll(Arrays.asList(rest));
        return c;
    }
    /** Lo que se antepone al documento por la línea de comandos (p. ej. biblatex con BibTeX); vacío si nada. */
    private static String extraInject(File mainDir) {
        String t = readText(new File(mainDir, "texsting-inyectar.txt"));
        return t == null ? "" : t.trim();
    }
    private static String mainArg(File mainDir, String mainName) {
        String x = extraInject(mainDir);
        return x.isEmpty() ? mainName : x + "\\input{" + mainName + "}";
    }
    /** El motor con que se compiló por última vez este proyecto (lo usan también las figuras en segundo plano). */
    private static String engineOf(File mainDir) {
        return "lualatex".equals(String.valueOf(readText(new File(mainDir, "texsting-motor.txt"))).trim()) ? "lualatex" : "pdflatex";
    }

    /** LuaLaTeX: su formato se arma la primera vez que se usa (unos segundos), no al instalar. */
    private void prepareLua() throws Exception {
        String v = assetVersion();
        File f = new File(luaFmtDir(), "lualatex.fmt"), mk = new File(luaFmtDir(), "version.txt");
        if (f.exists() && v != null && v.equals(String.valueOf(readText(mk)).trim())) return;
        progress("Preparando LuaLaTeX por primera vez…");
        luaFmtDir().mkdirs();
        f.delete();
        Run fr = run(Arrays.asList(luatex().getAbsolutePath(), "-ini", "-jobname=lualatex", "-progname=lualatex", "lualatex.ini"),
                luaFmtDir(), 5 * 60 * 1000);
        if (!f.exists()) {
            String o = fr.out;
            throw new Exception("No se pudo preparar LuaLaTeX (código " + fr.code + "): " + (o.length() > 1500 ? o.substring(o.length() - 1500) : o));
        }
        try (OutputStream o = new FileOutputStream(mk)) { o.write(String.valueOf(v).getBytes(StandardCharsets.UTF_8)); }
    }
    private File base() { return new File(getContext().getFilesDir(), "motor"); }
    private File tl() { return new File(base(), "tl"); }
    private File var() { return new File(base(), "var"); }
    private File fmtDir() { return new File(var(), "texmf-var/web2c/pdftex"); }
    private File fmt() { return new File(fmtDir(), "pdflatex.fmt"); }
    private File marker() { return new File(base(), "version.txt"); }

    private String assetVersion() {
        try (InputStream in = getContext().getAssets().open("motor/version.txt")) {
            return new String(readAll(in), StandardCharsets.UTF_8).trim();
        } catch (IOException e) { return null; }
    }
    private static byte[] readAll(InputStream in) throws IOException {
        ByteArrayOutputStream o = new ByteArrayOutputStream();
        byte[] b = new byte[65536]; int n;
        while ((n = in.read(b)) > 0) o.write(b, 0, n);
        return o.toByteArray();
    }
    private static String readText(File f) {
        try (InputStream in = new FileInputStream(f)) { return new String(readAll(in), StandardCharsets.UTF_8); }
        catch (IOException e) { return null; }
    }
    private static byte[] readBytes(File f) {
        try (InputStream in = new FileInputStream(f)) { return readAll(in); } catch (IOException e) { return null; }
    }
    private static void delete(File f) {
        File[] l = f.listFiles();
        if (l != null) for (File c : l) delete(c);
        f.delete();
    }
    private boolean ready() {
        String v = assetVersion();
        return v != null && fmt().exists() && v.equals(String.valueOf(readText(marker())).trim());
    }

    private Map<String, String> env() {
        String t = tl().getAbsolutePath(), v = var().getAbsolutePath();
        Map<String, String> e = new HashMap<>();
        e.put("LD_LIBRARY_PATH", libDir().getAbsolutePath());
        e.put("PATH", "/system/bin");
        e.put("HOME", v); e.put("TMPDIR", getContext().getCacheDir().getAbsolutePath());
        e.put("TEXMFCNF", t + "/texmf-dist/web2c"); e.put("TEXMFROOT", t);
        e.put("TEXMFDIST", t + "/texmf-dist"); e.put("TEXMFSYSVAR", t + "/texmf-var");
        e.put("TEXMFSYSCONFIG", t + "/texmf-config"); e.put("TEXMFLOCAL", t + "/texmf-local");
        e.put("TEXMFVAR", v + "/texmf-var"); e.put("TEXMFCONFIG", v + "/texmf-config");
        // La caché de LuaLaTeX (lista de fuentes de luaotfload) va dentro de TEXMFVAR, como en TeX Live:
        // LuaTeX solo deja escribir ahí (en otra carpeta responde «no writeable cache path»).
        e.put("TEXMFHOME", v + "/texmf"); e.put("TEXMFCACHE", v + "/texmf-var");
        new File(v, "texmf-var").mkdirs();
        e.put("MKTEXTFM", "0"); e.put("MKTEXPK", "0"); e.put("MKTEXMF", "0"); e.put("MKTEXFMT", "0");
        return e;
    }

    private static class Run { int code = -1; String out = ""; boolean timedOut; }

    private Run run(List<String> cmd, File cwd, long timeoutMs) throws Exception {
        ProcessBuilder pb = new ProcessBuilder(cmd).directory(cwd).redirectErrorStream(true);
        pb.environment().clear();
        pb.environment().putAll(env());
        Process p = pb.start();
        boolean bgp = Thread.currentThread().getName().startsWith("texsting-bg");
        if (bgp) bgProcs.add(p);
        p.getOutputStream().close();
        final ByteArrayOutputStream buf = new ByteArrayOutputStream();
        Thread reader = new Thread(() -> {
            try (InputStream in = p.getInputStream()) {
                byte[] b = new byte[8192]; int n;
                while ((n = in.read(b)) > 0) synchronized (buf) { buf.write(b, 0, n); }
            } catch (IOException ignored) { }
        });
        reader.start();
        Run r = new Run();
        if (!p.waitFor(timeoutMs, TimeUnit.MILLISECONDS)) { p.destroyForcibly(); r.timedOut = true; }
        reader.join(2000);
        r.code = r.timedOut ? -1 : p.exitValue();
        synchronized (buf) { r.out = buf.toString("UTF-8"); }
        if (bgp) bgProcs.remove(p);
        return r;
    }

    /** Descomprime los datos de TeX y crea el formato pdflatex (solo la primera vez o tras actualizar). */
    private synchronized JSObject prepare() throws Exception {
        JSObject r = new JSObject();
        if (!pdftex().exists()) throw new Exception("Este APK no trae el motor integrado.");
        String v = assetVersion();
        if (v == null) throw new Exception("Faltan los datos de TeX en el APK.");
        long t0 = System.currentTimeMillis();
        if (!v.equals(String.valueOf(readText(marker())).trim()) || !fmt().exists()) {
            // Al actualizar la app se cambia TeX y el formato, pero NO los paquetes ya descargados (var/texmf):
            // antes se borraban y había que volver a bajarlos todos.
            delete(tl()); delete(new File(var(), "texmf-var"));
            bundled = null;
            tl().mkdirs();
            try (ZipInputStream z = new ZipInputStream(new BufferedInputStream(getContext().getAssets().open("motor/tl.zip")))) {
                ZipEntry e; byte[] b = new byte[65536];
                String rootPath = tl().getCanonicalPath();
                while ((e = z.getNextEntry()) != null) {
                    File f = new File(tl(), e.getName());
                    if (!f.getCanonicalPath().startsWith(rootPath)) continue;
                    if (e.isDirectory()) { f.mkdirs(); continue; }
                    f.getParentFile().mkdirs();
                    try (OutputStream o = new FileOutputStream(f)) { int n; while ((n = z.read(b)) > 0) o.write(b, 0, n); }
                }
            }
            long t1 = System.currentTimeMillis();
            r.put("unzipMs", t1 - t0);
            fmtDir().mkdirs();
            Run fr = run(Arrays.asList(pdftex().getAbsolutePath(), "-ini", "-jobname=pdflatex", "-progname=pdflatex",
                    "-translate-file=cp227.tcx", "*pdflatex.ini"), fmtDir(), 180000);
            r.put("fmtMs", System.currentTimeMillis() - t1);
            if (!fmt().exists()) {
                String o = fr.out;
                throw new Exception("No se pudo crear el formato (código " + fr.code + "): " + (o.length() > 1500 ? o.substring(o.length() - 1500) : o));
            }
            rebuildMap();
            try (OutputStream o = new FileOutputStream(marker())) { o.write(v.getBytes(StandardCharsets.UTF_8)); }
            r.put("primeraVez", true);
        } else {
            r.put("primeraVez", false);
        }
        r.put("version", v);
        return r;
    }


    /** Como updmap: las fuentes nuevas se agregan a una copia propia de pdftex.map (tiene prioridad). */
    private void appendMaps(List<File> maps) throws IOException {
                // Como updmap: las fuentes nuevas se agregan a una copia propia de pdftex.map (tiene prioridad).
                File vmap = new File(var(), "texmf-var/fonts/map/pdftex/updmap/pdftex.map");
                if (!vmap.exists()) {
                    vmap.getParentFile().mkdirs();
                    byte[] base = readBytes(new File(tl(), "texmf-var/fonts/map/pdftex/updmap/pdftex.map"));
                    try (OutputStream o = new FileOutputStream(vmap)) { if (base != null) o.write(base); }
                }
                // Solo las fuentes que el mapa todavía no tiene (si no, pdfTeX avisa «already exists» por cada una).
                Set<String> known = new HashSet<>();
                String cur = readText(vmap);
                if (cur != null) for (String l : cur.split("\n")) { String t = l.trim(); if (!t.isEmpty() && t.charAt(0) != '%') known.add(t.split("\\s+")[0]); }
                StringBuilder add = new StringBuilder();
                for (File m : maps) {
                    String t = readText(m);
                    if (t == null) continue;
                    for (String l : t.split("\n")) {
                        String x = l.trim();
                        if (x.isEmpty() || x.charAt(0) == '%') continue;
                        String name = x.split("\\s+")[0];
                        if (known.add(name)) add.append(x).append('\n');
                    }
                }
                try (OutputStream o = new FileOutputStream(vmap, true)) { o.write(("\n" + add).getBytes(StandardCharsets.UTF_8)); }
                }

    /** Tras actualizar: vuelve a sumar al mapa de fuentes las de los paquetes ya descargados. */
    private void rebuildMap() {
        List<File> maps = new ArrayList<>();
        Deque<File> todo = new ArrayDeque<>();
        todo.add(new File(home(), "fonts/map"));
        while (!todo.isEmpty()) {
            File d = todo.pop();
            File[] l = d.listFiles();
            if (l == null) continue;
            for (File f : l) { if (f.isDirectory()) todo.add(f); else if (f.getName().endsWith(".map")) maps.add(f); }
        }
        if (!maps.isEmpty()) try { appendMaps(maps); } catch (IOException ignored) { }
    }

    @PluginMethod
    public void estado(PluginCall call) {
        JSObject r = new JSObject();
        r.put("binario", pdftex().exists());
        JSArray mot = new JSArray();
        mot.put("pdflatex");
        if (luatex().exists()) mot.put("lualatex");
        r.put("motores", mot);
        r.put("datos", assetVersion() != null);
        r.put("listo", ready());
        r.put("version", assetVersion());
        call.resolve(r);
    }

    @PluginMethod
    public void preparar(PluginCall call) {
        exec.execute(() -> {
            try { call.resolve(prepare()); } catch (Exception e) { call.reject(String.valueOf(e.getMessage())); }
        });
    }

    private static String digest(File dir, String stem) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-1");
            for (String ext : new String[] { ".aux", ".toc", ".lof", ".lot", ".out", ".nav", ".snm" }) {
                byte[] b = readBytes(new File(dir, stem + ext));
                if (b != null) md.update(b);
                md.update((byte) 0);
            }
            StringBuilder s = new StringBuilder();
            for (byte x : md.digest()) s.append(String.format("%02x", x));
            return s.toString();
        } catch (Exception e) { return ""; }
    }


    // ───────────── Paquetes al vuelo (como MiKTeX): se bajan de CTAN la primera vez que hacen falta ─────────────
    private static final String[] CTAN = {
        "https://mirror.ctan.org/systems/texlive/tlnet/archive/",       // elige un espejo cercano
        "https://mirrors.mit.edu/CTAN/systems/texlive/tlnet/archive/",  // respaldo
    };
    private static final Pattern[] MISSING = {
        Pattern.compile("LaTeX Error: File `([^']+)' not found"),
        Pattern.compile("! I can't find file `([^']+)'"),
        Pattern.compile("Font \\\\?[^=\\s]+=([A-Za-z0-9_\\-]+)(?: at [^ ]+| scaled \\d+)? not loadable: Metric \\(TFM\\) file not found"),
        Pattern.compile("I did not find the tikz library '([^']+)'"),
        Pattern.compile("\\(file ([^)\\s]+\\.pf[ab])\\): cannot open Type 1 font file"),
        Pattern.compile("\\(file ([^)\\s]+\\.enc)\\): cannot open encoding file"),
        // La fuente tiene métrica (.tfm) pero no está en pdftex.map: pdfTeX busca un mapa de bits y falla
        // («Font esint10 at 657 not found»). Hay que bajar su versión Type 1 (.pfb), que trae el .map.
        Pattern.compile("\\(file ([A-Za-z0-9_\\-]+)\\): Font \\1 at \\d+ not found"),
    };
    // «Font shape `OT1/ptm/m/n' undefined»: LaTeX no encontró la descripción de la fuente (ot1ptm.fd)
    // y usó otra sin error. Pasa con IEEEtran (Times): hay que bajar el .fd y sus fuentes.
    private static final Pattern SHAPE = Pattern.compile("Font shape `([A-Za-z0-9]+)/([^/']+)/[^']*' undefined");
    private static final String[] INSTALLABLE = { ".sty", ".cls", ".def", ".fd", ".cfg", ".clo", ".ldf", ".tfm", ".bbx", ".cbx",
        ".lbx", ".dbx", ".code.tex", ".tex", ".pfb", ".map", ".enc", ".vf", ".otf", ".ttf", ".lua", ".bst" };
    private Map<String, String> index;
    private Set<String> bundled;

    /** Nombres de los archivos que ya trae el APK (de los ls-R): para no volver a bajar sus paquetes. */
    private synchronized Set<String> bundledNames() {
        if (bundled != null) return bundled;
        Set<String> s = new HashSet<>();
        for (String tree : new String[] { "texmf-dist", "texmf-var" }) {
            String t = readText(new File(tl(), tree + "/ls-R"));
            if (t == null) continue;
            for (String l : t.split("\n")) if (!l.isEmpty() && l.charAt(0) != '%' && !l.endsWith(":")) s.add(l);
        }
        return bundled = s;
    }

    /** Descripciones de fuentes (.fd) que LaTeX buscó y no encontró. */
    static List<String> findShapes(String log) {
        log = unwrap(log);
        List<String> found = new ArrayList<>();
        Matcher m = SHAPE.matcher(log);
        while (m.find()) {
            String fd = (m.group(1) + m.group(2)).toLowerCase(Locale.ROOT) + ".fd";
            if (!found.contains(fd)) found.add(fd);
        }
        return found;
    }
    private Map<String, Long> sizes;
    private Map<String, String[]> deps;

    private File home() { return new File(var(), "texmf"); }
    private File installedFile() { return new File(var(), "paquetes-instalados.txt"); }

    private Set<String> installedPkgs() {
        Set<String> s = new LinkedHashSet<>();
        String t = readText(installedFile());
        if (t != null) for (String l : t.split("\n")) if (!l.trim().isEmpty()) s.add(l.trim());
        return s;
    }

    private synchronized void loadIndex() throws IOException {
        if (index != null) return;
        Map<String, String> idx = new HashMap<>();
        Map<String, Long> sz = new HashMap<>();
        Map<String, String[]> dp = new HashMap<>();
        try (BufferedReader br = new BufferedReader(new InputStreamReader(new GZIPInputStream(getContext().getAssets().open("motor/indice.idx")), StandardCharsets.UTF_8))) {
            String l;
            while ((l = br.readLine()) != null) {
                int t = l.indexOf('\t');
                if (t <= 0) continue;
                if (l.charAt(0) == '+') { dp.put(l.substring(1, t), l.substring(t + 1).split(",")); continue; }
                if (l.charAt(0) == '@') { try { sz.put(l.substring(1, t), Long.parseLong(l.substring(t + 1))); } catch (NumberFormatException ignored) { } }
                else idx.put(l.substring(0, t), l.substring(t + 1));
            }
        }
        index = idx; sizes = sz; deps = dp;
    }

    /** TeX corta las líneas del registro a 79 caracteres: se vuelven a unir para buscar los mensajes. */
    static String unwrap(String log) {
        StringBuilder b = new StringBuilder(log.length());
        for (String l : log.split("\n", -1)) { b.append(l); if (l.length() != 79) b.append('\n'); }
        return b.toString();
    }

    static List<String> findMissing(String log) {
        log = unwrap(log);
        List<String> found = new ArrayList<>();
        for (int i = 0; i < MISSING.length; i++) {
            Matcher m = MISSING[i].matcher(log);
            while (m.find()) {
                String name = m.group(1).trim().replace("\"", "");
                if (name.contains("/")) continue;
                if (i == 2) { if (name.equals("nullfont")) continue; name += ".tfm"; }
                if (i == 3) name = "tikzlibrary" + name + ".code.tex";
                if (i == 1 && !name.contains(".")) name += ".tex";
                if (i == 6) name += ".pfb";
                boolean ok = false;
                for (String ext : INSTALLABLE) if (name.toLowerCase(Locale.ROOT).endsWith(ext)) ok = true;
                if (ok && !found.contains(name)) found.add(name);
            }
        }
        return found;
    }

    /** LuaLaTeX/fontspec: «The font "TeX Gyre Termes" cannot be found». */
    static List<String> fontRequests(String log) {
        List<String> out = new ArrayList<>();
        Matcher m = Pattern.compile("The font \"([^\"]+)\" cannot be found").matcher(unwrap(log));
        while (m.find()) if (!out.contains(m.group(1))) out.add(m.group(1));
        return out;
    }

    /** El archivo de una fuente pedida por nombre: «TeX Gyre Termes» → texgyretermes-regular.otf (del índice). */
    private String fontFile(String name) {
        String key = name.toLowerCase(Locale.ROOT).replaceAll("\\.(otf|ttf)$", "").replaceAll("[^a-z0-9]", "");
        if (key.length() < 3 || index == null) return null;
        String best = null;
        for (String f : index.keySet()) {
            String lf = f.toLowerCase(Locale.ROOT);
            if (!lf.endsWith(".otf") && !lf.endsWith(".ttf")) continue;
            String k = lf.substring(0, lf.length() - 4).replaceAll("[^a-z0-9]", "");
            if (k.equals(key) || k.equals(key + "regular")) return f;
            if (k.startsWith(key) && (best == null || f.length() < best.length())) best = f;
        }
        return best;
    }

    private volatile boolean quiet;

    private void progress(String text) {
        if (quiet) return;
        JSObject d = new JSObject();
        d.put("texto", text);
        notifyListeners("progreso", d);
    }

    private static void download(String url, File dest) throws Exception {
        for (int hop = 0; hop < 8; hop++) {
            HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
            c.setInstanceFollowRedirects(false);
            c.setConnectTimeout(20000);
            c.setReadTimeout(60000);
            c.setRequestProperty("User-Agent", "TeXsting");
            int code = c.getResponseCode();
            if (code >= 300 && code < 400) {
                String loc = c.getHeaderField("Location");
                c.disconnect();
                if (loc == null) throw new IOException("Redirección sin destino");
                url = new URL(new URL(url), loc).toString();
                continue;
            }
            if (code != 200) { c.disconnect(); throw new IOException("CTAN respondió " + code); }
            try (InputStream in = c.getInputStream(); OutputStream o = new FileOutputStream(dest)) {
                byte[] b = new byte[65536]; int n;
                while ((n = in.read(b)) > 0) o.write(b, 0, n);
            } finally { c.disconnect(); }
            return;
        }
        throw new IOException("Demasiadas redirecciones");
    }

    private static boolean readFully(InputStream in, byte[] b, int len) throws IOException {
        int off = 0;
        while (off < len) { int n = in.read(b, off, len - off); if (n < 0) return off == 0 ? false : fail(); off += n; }
        return true;
    }
    private static boolean fail() throws IOException { throw new EOFException("Archivo incompleto"); }
    private static void skip(InputStream in, long n) throws IOException {
        byte[] b = new byte[8192];
        while (n > 0) { int r = in.read(b, 0, (int) Math.min(b.length, n)); if (r < 0) throw new EOFException(); n -= r; }
    }
    private static String cstr(byte[] b, int off, int len) {
        int end = off;
        while (end < off + len && end < b.length && b[end] != 0) end++;
        return new String(b, off, end - off, StandardCharsets.UTF_8);
    }
    private static long octal(byte[] b, int off, int len) {
        long v = 0;
        for (int i = off; i < off + len; i++) { int ch = b[i]; if (ch == 0 || ch == ' ') { if (v > 0) break; else continue; } v = v * 8 + (ch - '0'); }
        return v;
    }

    /** Descomprime un .tar.xz de TeX Live en TEXMFHOME (sin tlpkg/). Devuelve los .map de fuentes. */
    static List<File> untar(InputStream in, File root) throws IOException {
        List<File> maps = new ArrayList<>();
        byte[] h = new byte[512];
        String next = null;
        String rootPath = root.getCanonicalPath();
        while (readFully(in, h, 512)) {
            boolean zero = true;
            for (byte x : h) if (x != 0) { zero = false; break; }
            if (zero) break;
            String name = cstr(h, 0, 100), prefix = cstr(h, 345, 155);
            long size = octal(h, 124, 12);
            char type = (char) h[156];
            long pad = (512 - size % 512) % 512;
            if (type == 'L' || type == 'x') {
                byte[] b = new byte[(int) size];
                readFully(in, b, (int) size);
                skip(in, pad);
                if (type == 'L') next = cstr(b, 0, b.length);
                else for (String line : new String(b, StandardCharsets.UTF_8).split("\n")) {
                    int sp = line.indexOf(' ');
                    if (sp > 0 && line.startsWith("path=", sp + 1)) next = line.substring(sp + 6);
                }
                continue;
            }
            if (next != null) { name = next; next = null; } else if (!prefix.isEmpty()) name = prefix + "/" + name;
            if (name.startsWith("./")) name = name.substring(2);
            // Los paquetes «reubicables» de tlnet guardan las rutas sin texmf-dist/ (tex/latex/…).
            if (name.startsWith("texmf-dist/")) name = name.substring("texmf-dist/".length());
            if ((type == '0' || type == 0) && !name.startsWith("tlpkg/") && !name.startsWith("bin/") && !name.isEmpty()) {
                File out = new File(root, name);
                if (out.getCanonicalPath().startsWith(rootPath + File.separator)) {
                    out.getParentFile().mkdirs();
                    try (OutputStream o = new FileOutputStream(out)) {
                        byte[] b = new byte[65536]; long left = size;
                        while (left > 0) { int r = in.read(b, 0, (int) Math.min(b.length, left)); if (r < 0) throw new EOFException(); o.write(b, 0, r); left -= r; }
                    }
                    if (name.endsWith(".map") && ("/" + name).contains("/fonts/map/")) maps.add(out);
                    skip(in, pad);
                    continue;
                }
            }
            skip(in, size + pad);
        }
        return maps;
    }

    /** El paquete y lo que termina pidiendo (tabla calculada al armar el APK), sin los ya instalados. */
    private List<String> withDeps(String pkg, Set<String> have, List<String> already) {
        List<String> out = new ArrayList<>();
        if (pkg == null) return out;
        if (!have.contains(pkg) && !already.contains(pkg)) out.add(pkg);
        String[] d = deps.get(pkg);
        if (d != null) for (String x : d) if (!x.isEmpty() && !have.contains(x) && !already.contains(x) && !out.contains(x)) out.add(x);
        return out;
    }

    private void install(String pkg) throws Exception {
        Long sz = sizes.get(pkg);
        progress("Descargando el paquete «" + pkg + "»" + (sz != null && sz > 0 ? String.format(Locale.ROOT, " (%.1f MB)", sz / 1e6).replace('.', ',') : "") + "… (solo la primera vez)");
        File tmp = new File(getContext().getCacheDir(), pkg + ".tar.xz");
        try {
            Exception last = null;
            for (String m : CTAN) {
                try { download(m + pkg + ".tar.xz", tmp); last = null; break; } catch (Exception e) { last = e; }
            }
            if (last != null) throw last;
            List<File> maps;
            try (InputStream in = new org.tukaani.xz.XZInputStream(new BufferedInputStream(new FileInputStream(tmp), 65536))) {
                maps = untar(in, home());
            }
            if (!maps.isEmpty()) appendMaps(maps);
            try (OutputStream o = new FileOutputStream(installedFile(), true)) { o.write((pkg + "\n").getBytes(StandardCharsets.UTF_8)); }
        } finally {
            tmp.delete();
        }
    }

    private static final Pattern USES = Pattern.compile("\\\\(documentclass|usepackage|RequirePackage)\\s*(?:\\[[^\\]]*\\])?\\s*\\{([^}]*)\\}");

    /** Antes de compilar: los \\documentclass y \\usepackage del proyecto que no estén se bajan juntos
     *  (así no hace falta una compilación completa por cada paquete que falta). */
    private List<String> prefetch(File dir, JSArray files, List<String> installedNow) throws Exception {
        List<String> want = new ArrayList<>();
        Set<String> projectFiles = new HashSet<>();
        for (int i = 0; files != null && i < files.length(); i++) projectFiles.add(new File(files.getJSONObject(i).getString("path")).getName());
        for (int i = 0; files != null && i < files.length(); i++) {
            JSONObject f = files.getJSONObject(i);
            if (!f.has("text")) continue;
            String path = f.getString("path");
            if (!path.endsWith(".tex") && !path.endsWith(".sty") && !path.endsWith(".cls")) continue;
            StringBuilder code = new StringBuilder();
            for (String l : f.optString("text", "").split("\n")) {
                int c = -1;
                for (int k = 0; k < l.length(); k++) { if (l.charAt(k) == '\\') { k++; continue; } if (l.charAt(k) == '%') { c = k; break; } }
                code.append(c >= 0 ? l.substring(0, c) : l).append('\n');
            }
            Matcher m = USES.matcher(code);
            while (m.find()) {
                String ext = m.group(1).equals("documentclass") ? ".cls" : ".sty";
                for (String n : m.group(2).split(",")) {
                    n = n.trim();
                    if (n.isEmpty() || n.contains("/") || n.contains("\\")) continue;
                    String file = n + ext;
                    if (!want.contains(file) && !projectFiles.contains(file) && !bundledNames().contains(file)) want.add(file);
                }
            }
        }
        if (want.isEmpty()) return want;
        loadIndex();
        Set<String> have = installedPkgs();
        List<String> pkgs = new ArrayList<>();
        for (String w : want) for (String p : withDeps(index.get(w), have, pkgs)) pkgs.add(p);
        for (String p : pkgs) {
            try { install(p); installedNow.add(p); } catch (Exception e) { /* se reintenta al compilar */ }
        }
        return pkgs;
    }


    // ───────────── Fuentes Type 1 que faltan ─────────────
    // pdfTeX se detiene en la PRIMERA .pfb que no encuentra: para no hacer una compilación por cada letra,
    // se miran todas las fuentes que usó el documento (.fls) y se buscan sus .pfb en el mapa de fuentes.
    private List<String> fontsNeeded(File dir, String stem) {
        List<String> out = new ArrayList<>();
        String fls = readText(new File(dir, stem + ".fls"));
        if (fls == null) return out;
        Set<String> tfms = new HashSet<>();
        for (String l : fls.split("\n")) if (l.startsWith("INPUT ") && l.endsWith(".tfm")) { String n = new File(l.substring(6).trim()).getName(); tfms.add(n.substring(0, n.length() - 4)); }
        if (tfms.isEmpty()) return out;
        File vmap = new File(var(), "texmf-var/fonts/map/pdftex/updmap/pdftex.map");
        String map = readText(vmap.exists() ? vmap : new File(tl(), "texmf-var/fonts/map/pdftex/updmap/pdftex.map"));
        if (map == null) return out;
        Set<String> have = new HashSet<>(bundledNames());
        Deque<File> todo = new ArrayDeque<>();
        todo.add(new File(home(), "fonts"));
        while (!todo.isEmpty()) { File[] l = todo.pop().listFiles(); if (l != null) for (File f : l) { if (f.isDirectory()) todo.add(f); else have.add(f.getName()); } }
        for (String line : map.split("\n")) {
            String t = line.trim();
            if (t.isEmpty() || t.charAt(0) == '%') continue;
            int sp = t.indexOf(' ');
            if (sp < 0 || !tfms.contains(t.substring(0, sp))) continue;
            for (String tok : t.split("\\s+")) {
                String f = tok.replaceAll("^<+\\[?", "");
                if ((f.endsWith(".pfb") || f.endsWith(".pfa")) && !have.contains(f) && !out.contains(f)) out.add(f);
            }
        }
        return out;
    }

    // Paquetes enormes de los que basta bajar un archivo suelto desde CTAN (cm-super pesa ~60 MB;
    // cada una de sus letras, ~100 KB).
    private static final Map<String, String> SINGLE = new HashMap<>();
    static { SINGLE.put("cm-super", "fonts/ps-type1/cm-super/pfb/"); }

    private boolean downloadSingle(String pkg, String file) {
        String dirOnCtan = SINGLE.get(pkg);
        if (dirOnCtan == null) return false;
        File out = new File(home(), "fonts/type1/public/" + pkg + "/" + file);
        out.getParentFile().mkdirs();
        progress("Descargando la letra «" + file.replaceAll("\\.pf[ab]$", "") + "»…");
        for (String base : new String[] { "https://mirror.ctan.org/", "https://mirrors.mit.edu/CTAN/" }) {
            try { download(base + dirOnCtan + file, out); if (out.length() > 0) return true; } catch (Exception ignored) { }
        }
        out.delete();
        return false;
    }

    @PluginMethod
    public void paquetes(PluginCall call) {
        JSObject r = new JSObject();
        JSArray a = new JSArray();
        for (String p : installedPkgs()) a.put(p);
        r.put("instalados", a);
        call.resolve(r);
    }


    // ───────────── Preámbulo precompilado (mylatexformat): los \\usepackage se cargan una sola vez ─────────────
    private static final String PRE = "texsting-pre";

    private static int countMatches(Pattern p, String s) {
        Matcher m = p.matcher(s); int n = 0;
        while (m.find()) n++;
        return n;
    }

    private static String sha1(String s) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-1");
            StringBuilder b = new StringBuilder();
            for (byte x : md.digest(s.getBytes(StandardCharsets.UTF_8))) b.append(String.format("%02x", x));
            return b.toString();
        } catch (Exception e) { return null; }
    }

    /** Clave del preámbulo: si cambia (o cambian los paquetes instalados), hay que volver a armarlo. */
    private String preambleKey(JSArray files, String main) throws Exception { return preambleKey(files, main, true); }

    /** withVersion = false: para las figuras, que son PDF y siguen sirviendo tras actualizar la app. */
    private String preambleKey(JSArray files, String main, boolean withVersion) throws Exception {
        String mainText = null;
        for (int i = 0; files != null && i < files.length(); i++) {
            JSONObject f = files.getJSONObject(i);
            if (f.getString("path").equals(main) && f.has("text")) mainText = f.optString("text", "");
        }
        if (mainText == null) return null;
        int b = mainText.indexOf("\\begin{document}");
        if (b < 0) return null;
        String pre = mainText.substring(0, b);
        // Cosas que no se pueden «congelar» en un formato: mejor compilar normal.
        if (pre.contains("endofdump") || pre.contains("filecontents") || pre.contains("\\write18") || pre.contains("minted")) return null;
        StringBuilder k = new StringBuilder(pre);
        for (int i = 0; files != null && i < files.length(); i++) {
            JSONObject f = files.getJSONObject(i);
            String path = f.getString("path");
            if (path.equals(main) || !f.has("text")) continue;
            String name = new File(path).getName(), stem = name.replaceAll("\\.[^.]+$", "");
            if (stem.length() > 1 && pre.contains(stem)) k.append("\u0000").append(path).append('\u0000').append(f.optString("text", ""));
        }
        if (withVersion) k.append('\u0000').append(assetVersion());
        return sha1(k.toString());
    }

    /** Arma el formato con el preámbulo (en segundo plano, después de una compilación normal). */
    private void buildPre(File mainDir, String mainName, String key) {
        File info = new File(mainDir, PRE + ".txt"), fmtFile = new File(mainDir, PRE + ".fmt");
        try {
            boolean bad = true;
            for (int attempt = 0; attempt < 3; attempt++) {
                fmtFile.delete();
                Run r = run(Arrays.asList(pdftex().getAbsolutePath(), "-ini", "-interaction=nonstopmode", "-jobname=" + PRE,
                        "-progname=pdflatex", "&pdflatex", "mylatexformat.ltx", mainName.contains(" ") ? "\"" + mainName + "\"" : mainName), mainDir, 3 * 60 * 1000);
                String lg = readText(new File(mainDir, PRE + ".log"));
                bad = r.timedOut || !fmtFile.exists() || lg == null || Pattern.compile("^!", Pattern.MULTILINE).matcher(lg).find();
                if (!bad || r.timedOut || lg == null) break;
                // Al guardar el formato, LaTeX deja listas las letras de la clase (p. ej. IEEEtran: Courier y
                // Helvetica) aunque el documento no las use: si faltan, se bajan en silencio y se reintenta.
                loadIndex();
                Set<String> have = installedPkgs();
                List<String> got = new ArrayList<>();
                List<String> want = findMissing(lg);
                want.addAll(findShapes(lg));
                for (String m : want) for (String q : withDeps(index.get(m), have, got)) {
                    try { quiet = true; install(q); got.add(q); } catch (Exception ignored) { } finally { quiet = false; }
                }
                if (got.isEmpty()) break;
            }
            if (bad) fmtFile.delete();
            try (OutputStream o = new FileOutputStream(info)) { o.write(((bad ? "no " : "ok ") + key).getBytes(StandardCharsets.UTF_8)); }
        } catch (Exception e) {
            fmtFile.delete();
        }
    }


    // ───────────── Figuras guardadas (TikZ/pgfplots «external»): solo se redibujan las que cambian ─────────────
    private static final String FIG = "texsting-fig";
    private static final Pattern ERR = Pattern.compile("^(!(?! Package tikz Warning)|.*:\\d+: )", Pattern.MULTILINE);

    /** Se agrega por la línea de comandos, sin tocar tu archivo. */
    private static String figInject() {
        // tcolorbox dibuja sus cajas con TikZ: «shield externalize» evita que se intenten guardar como figuras
        // (si no, las cajas «breakable» rompen la compilación).
        return "\\AddToHook{begindocument/before}{\\IfPackageLoadedTF{tikz}{\\usetikzlibrary{external}"
                + "\\tikzexternalize[mode=list and make,prefix=" + FIG + "/]"
                + "\\IfPackageLoadedTF{tcolorbox}{\\tcbset{shield externalize}}{}"
                // circuitikz es \begin{tikzpicture} con otro nombre: así sus circuitos también se guardan.
                + "\\IfPackageLoadedTF{circuitikz}{\\RenewDocumentEnvironment{circuitikz}{+b}{\\begin{tikzpicture}#1\\end{tikzpicture}}{}}{}}{}}";
    }
    static String safeJob(String name) {
        String s = name.replaceAll("[^A-Za-z0-9._-]", "_");
        return s.isEmpty() || s.startsWith("-") ? "doc" + s : s;
    }
    private static long readMs(File f) {
        try { return Long.parseLong(String.valueOf(readText(f)).trim()); } catch (Exception e) { return -1; }
    }
    private static void writeMs(File f, long ms) {
        try (OutputStream o = new FileOutputStream(f)) { o.write(String.valueOf(ms).getBytes(StandardCharsets.UTF_8)); } catch (IOException ignored) { }
    }
    private static File figStatus(File mainDir) { return new File(mainDir, FIG + ".txt"); }

    private static List<String> figList(File mainDir, String job) {
        List<String> out = new ArrayList<>();
        String t = readText(new File(mainDir, job + ".figlist"));
        if (t != null) for (String l : t.split("\n")) if (!l.trim().isEmpty()) out.add(l.trim());
        return out;
    }

    /** Figuras sin PDF o cuyo código cambió (TikZ reescribe el .md5 cuando cambia la figura). */
    private static List<String> staleFigs(File mainDir, String job) {
        List<String> out = new ArrayList<>();
        for (String f : figList(mainDir, job)) {
            File pdf = new File(mainDir, f + ".pdf"), md5 = new File(mainDir, f + ".md5");
            if (!pdf.exists() || (md5.exists() && md5.lastModified() > pdf.lastModified())) out.add(f);
        }
        return out;
    }

    /** Listas si se armaron con este mismo preámbulo (si cambia, p. ej. \\pgfplotsset, hay que redibujarlas todas). */
    private boolean figsReady(File mainDir, String job, String key) {
        return key != null && ("ok " + key).equals(String.valueOf(readText(figStatus(mainDir))).trim())
                && new File(mainDir, job + ".figlist").exists() && !figList(mainDir, job).isEmpty() && staleFigs(mainDir, job).isEmpty();
    }

    private boolean makeFig(File mainDir, String job, String mainName, String fig) throws Exception {
        new File(mainDir, FIG).mkdirs();
        new File(mainDir, fig + ".pdf").delete();
        Run r = run(tex(engineOf(mainDir), null, "-interaction=batchmode",
                "-halt-on-error", "-jobname=" + fig, figInject() + extraInject(mainDir) + "\\def\\tikzexternalrealjob{" + job + "}\\input{" + mainName + "}"),
                mainDir, 3 * 60 * 1000);
        // Si se cortó (llegó una compilación) o falló, el PDF puede quedar a medias: se borra.
        String lg = readText(new File(mainDir, fig + ".log"));
        boolean ok = !r.timedOut && r.code == 0 && new File(mainDir, fig + ".pdf").exists() && lg != null && lg.contains("Output written");
        if (!ok) new File(mainDir, fig + ".pdf").delete();
        return ok;
    }

    /** Dibuja varias figuras a la vez (como «make -j» de TikZ): una por cada par de núcleos, hasta 3. */
    private boolean makeFigs(File mainDir, String job, String mainName, List<String> figs, int g) {
        if (figs.isEmpty()) return true;
        int n = Math.max(1, Math.min(3, Runtime.getRuntime().availableProcessors() / 2));
        n = Math.min(n, figs.size());
        final String name = Thread.currentThread().getName() + "-fig";
        ExecutorService pool = Executors.newFixedThreadPool(n, r -> new Thread(r, name));
        final java.util.concurrent.atomic.AtomicBoolean fail = new java.util.concurrent.atomic.AtomicBoolean();
        List<java.util.concurrent.Future<?>> pend = new ArrayList<>();
        for (String f : figs) pend.add(pool.submit(() -> {
            if (fail.get() || g != gen) return;
            try { if (!makeFig(mainDir, job, mainName, f)) fail.set(true); } catch (Exception e) { fail.set(true); }
        }));
        for (java.util.concurrent.Future<?> x : pend) try { x.get(); } catch (Exception ignored) { }
        pool.shutdown();
        return !fail.get() && g == gen;
    }

    private Run mainWithFigs(File mainDir, String job, String mainName) throws Exception {
        new File(mainDir, FIG).mkdirs();
        return run(tex(engineOf(mainDir), null, "-interaction=nonstopmode",
                "-file-line-error", "-synctex=1", "-recorder", "-jobname=" + job, figInject() + extraInject(mainDir) + "\\input{" + mainName + "}"),
                mainDir, 10 * 60 * 1000);
    }

    /** En segundo plano: lista las figuras, dibuja cada una y comprueba que el resultado no tenga más errores. */
    private void buildFigs(File mainDir, String job, String mainName, int normalErrors, String key) throws Exception {
        final int g = gen;
        // Si se armaron con otro preámbulo u otros datos, se empieza de cero. Si solo se interrumpió
        // (llegó una compilación), se sigue donde quedó.
        String st = String.valueOf(readText(figStatus(mainDir))).trim();
        if (readText(figStatus(mainDir)) != null && !st.endsWith(" " + key)) { delete(new File(mainDir, FIG)); figStatus(mainDir).delete(); }
        Run r = mainWithFigs(mainDir, job, mainName);
        if (g != gen || r.timedOut) return;
        if (figList(mainDir, job).isEmpty()) return;
        if (!makeFigs(mainDir, job, mainName, staleFigs(mainDir, job), g)) {
            if (g != gen) return;
            try (OutputStream o = new FileOutputStream(figStatus(mainDir))) { o.write(("no " + key).getBytes(StandardCharsets.UTF_8)); }
            return;
        }
        long t = System.currentTimeMillis();
        r = mainWithFigs(mainDir, job, mainName);
        if (g != gen || r.timedOut) return;
        writeMs(new File(mainDir, FIG + "-ms.txt"), System.currentTimeMillis() - t);
        String lg = readText(new File(mainDir, job + ".log"));
        boolean ok = lg != null && countMatches(ERR, lg) <= normalErrors && staleFigs(mainDir, job).isEmpty();
        try (OutputStream o = new FileOutputStream(figStatus(mainDir))) { o.write(((ok ? "ok " : "no ") + key).getBytes(StandardCharsets.UTF_8)); }
    }

    // ───────────── BibTeX y makeindex (vienen en el APK junto a pdfTeX) ─────────────
    private boolean auxTools(File mainDir, String job, StringBuilder output, boolean autoinstall) {
        boolean ran = false;
        try {
            File bib = new File(libDir(), "libtx_bibtex.so");
            String aux = readText(new File(mainDir, job + ".aux"));
            if (bib.exists() && aux != null && aux.contains("\\bibdata{")) {
                StringBuilder k = new StringBuilder();
                for (String l : aux.split("\n"))
                    if (l.startsWith("\\citation{") || l.startsWith("\\bibdata{") || l.startsWith("\\bibstyle{")) k.append(l).append('\n');
                Matcher m = Pattern.compile("\\\\bibdata\\{([^}]*)\\}").matcher(aux);
                while (m.find()) for (String b : m.group(1).split(",")) {
                    String n = b.trim();
                    String t = readText(new File(mainDir, n.endsWith(".bib") ? n : n + ".bib"));
                    if (t != null) k.append('\u0000').append(t);
                }
                String key = sha1(k.toString());
                File stamp = new File(mainDir, job + ".texsting-bib");
                if (!key.equals(String.valueOf(readText(stamp)).trim()) || !new File(mainDir, job + ".bbl").exists()) {
                    progress("Armando la bibliografía (BibTeX)…");
                    List<String> cmd = Arrays.asList(bib.getAbsolutePath(), job);
                    Run b = run(cmd, mainDir, 2 * 60 * 1000);
                    // Estilo que no viene en el APK (p. ej. IEEEtran.bst): se baja y se repite.
                    Matcher sm = Pattern.compile("I couldn't open style file (\\S+)").matcher(b.out);
                    if (sm.find() && autoinstall) {
                        String st = sm.group(1).endsWith(".bst") ? sm.group(1) : sm.group(1) + ".bst";
                        loadIndex();
                        String pkg = index.get(st);
                        Set<String> have = installedPkgs();
                        if (pkg != null && !have.contains(pkg)) {
                            for (String q : withDeps(pkg, have, new ArrayList<>())) install(q);
                            b = run(cmd, mainDir, 2 * 60 * 1000);
                        }
                    }
                    output.append(b.out);
                    try (OutputStream o = new FileOutputStream(stamp)) { o.write(key.getBytes(StandardCharsets.UTF_8)); }
                    ran = true;
                }
            }
            File mk = new File(libDir(), "libtx_makeindex.so"), idx = new File(mainDir, job + ".idx");
            if (mk.exists() && idx.exists()) {
                String key = sha1(String.valueOf(readText(idx)));
                File stamp = new File(mainDir, job + ".texsting-idx");
                if (!key.equals(String.valueOf(readText(stamp)).trim()) || !new File(mainDir, job + ".ind").exists()) {
                    progress("Armando el índice alfabético…");
                    output.append(run(Arrays.asList(mk.getAbsolutePath(), job + ".idx"), mainDir, 60 * 1000).out);
                    try (OutputStream o = new FileOutputStream(stamp)) { o.write(key.getBytes(StandardCharsets.UTF_8)); }
                    ran = true;
                }
            }
            // biblatex con biber (lo normal en biblatex): biber todavía no viene en el motor integrado.
            if (new File(mainDir, job + ".bcf").exists() && output.indexOf("biber: command not found") < 0)
                output.append("\nbiber: command not found (el motor integrado todavía no trae biber; usa \\usepackage[backend=bibtex]{biblatex})\n");
        } catch (Exception e) {
            output.append("\n[TeXsting] BibTeX/makeindex: ").append(e.getMessage()).append('\n');
        }
        return ran;
    }

    @PluginMethod
    public void compilar(PluginCall call) {
        cancelBackground();
        exec.execute(() -> { synchronized (work) { compilarAhora(call); } });
    }

    private void compilarAhora(PluginCall call) {
        {
            try {
                long t0 = System.currentTimeMillis();
                JSObject prep = prepare();
                long t1 = System.currentTimeMillis();
                String project = call.getString("project", "default").replaceAll("[^A-Za-z0-9_-]", "_");
                String main = call.getString("main", "main.tex");
                File dir = new File(base(), "proyectos/" + project);
                dir.mkdirs();
                String rootPath = dir.getCanonicalPath();
                JSArray files = call.getArray("files");
                Set<String> keep = new LinkedHashSet<>();
                for (int i = 0; files != null && i < files.length(); i++) {
                    JSONObject f = files.getJSONObject(i);
                    File out = new File(dir, f.getString("path"));
                    if (!out.getCanonicalPath().startsWith(rootPath + File.separator)) continue;
                    out.getParentFile().mkdirs();
                    byte[] data = f.has("base64") ? Base64.decode(f.getString("base64"), Base64.DEFAULT)
                            : f.optString("text", "").getBytes(StandardCharsets.UTF_8);
                    byte[] prev = out.exists() && out.length() == data.length ? readBytes(out) : null;
                    if (prev == null || !Arrays.equals(prev, data)) try (OutputStream o = new FileOutputStream(out)) { o.write(data); }
                    keep.add(out.getCanonicalPath());
                }
                // Archivos que se borraron del proyecto en la app: también se borran aquí.
                File manifest = new File(dir, ".texsting-archivos.txt");
                String oldList = readText(manifest);
                if (oldList != null) for (String l : oldList.split("\n")) if (!l.isEmpty() && !keep.contains(l) && l.startsWith(rootPath + File.separator)) new File(l).delete();
                try (OutputStream o = new FileOutputStream(manifest)) { o.write(String.join("\n", keep).getBytes(StandardCharsets.UTF_8)); }
                // Nombres con espacios o paréntesis (p. ej. «fisica (1).tex») rompen el preámbulo guardado y las
                // figuras: los archivos de salida usan un nombre seguro y se compila el archivo original.
                String job = safeJob(new File(main).getName().replaceAll("\\.tex$", ""));
                String parentDir = new File(main).getParent();
                String stem = parentDir == null ? job : parentDir + "/" + job;
                File pdf = new File(dir, stem + ".pdf");
                pdf.delete();
                File mainDir = new File(dir, main).getParentFile();
                String mainName = new File(main).getName();
                // Motor: pdfLaTeX (normal) o LuaLaTeX (fontspec, fuentes OpenType…), si este APK lo trae.
                String eng = "lualatex".equals(call.getString("engine", "pdflatex")) && luatex().exists() ? "lualatex" : "pdflatex";
                if (eng.equals("lualatex")) prepareLua();
                try (OutputStream o = new FileOutputStream(new File(mainDir, "texsting-motor.txt"))) { o.write(eng.getBytes(StandardCharsets.UTF_8)); }
                // biblatex usa biber por defecto, y biber no viene en el motor: se le pide BibTeX, que sí viene.
                boolean biblatex = false;
                Pattern bl = Pattern.compile("(?m)^[^%\\n]*\\\\(?:usepackage|RequirePackage)\\s*(?:\\[[^\\]]*\\])?\\s*\\{[^}]*\\bbiblatex\\b");
                for (int i = 0; files != null && i < files.length() && !biblatex; i++) {
                    JSONObject f = files.getJSONObject(i);
                    if (f.getString("path").endsWith(".tex") && f.has("text") && bl.matcher(f.optString("text", "")).find()) biblatex = true;
                }
                try (OutputStream o = new FileOutputStream(new File(mainDir, "texsting-inyectar.txt"))) {
                    o.write((biblatex ? "\\PassOptionsToPackage{backend=bibtex}{biblatex}" : "").getBytes(StandardCharsets.UTF_8));
                }
                StringBuilder output = new StringBuilder();
                Run r = null;
                int passes = 0, rounds = 0;
                boolean timedOut = false;
                boolean autoinstall = call.getBoolean("autoinstall", true);
                List<String> installedNow = new ArrayList<>(), failed = new ArrayList<>(), skipped = new ArrayList<>();
                if (autoinstall) prefetch(dir, files, installedNow);
                // Preámbulo ya armado para este proyecto: se salta la carga de los paquetes.
                // El preámbulo guardado (mylatexformat) es solo para pdfLaTeX.
                boolean usePreSetting = call.getBoolean("preambulo", true) && eng.equals("pdflatex") && !biblatex;
                String docKey = preambleKey(files, main);
                // Las figuras dependen también de los datos que leen (tablas .csv, imágenes…): si cambia
                // cualquier archivo que no sea .tex, se vuelven a dibujar todas.
                String figKey = null;
                String figBase = preambleKey(files, main, false);
                if (figBase != null) {
                    StringBuilder fk = new StringBuilder(figBase).append('\u0000').append(eng);
                    for (int i = 0; files != null && i < files.length(); i++) {
                        JSONObject f = files.getJSONObject(i);
                        String pth = f.getString("path");
                        if (pth.endsWith(".tex")) continue;
                        fk.append('\u0000').append(pth).append('\u0000').append(f.has("text") ? f.optString("text", "") : f.optString("base64", ""));
                    }
                    figKey = sha1(fk.toString());
                }
                String preKey = usePreSetting ? docKey : null;
                String preInfo = String.valueOf(readText(new File(mainDir, PRE + ".txt"))).trim();
                boolean usePre = preKey != null && new File(mainDir, PRE + ".fmt").exists()
                        && (preInfo.equals("ok " + preKey) || preInfo.equals("verificado " + preKey));
                boolean useFigs = autoinstall && figsReady(mainDir, job, figKey);
                // Con las dos cosas listas, se usa la que dio la compilación más rápida en este proyecto.
                long preMs = readMs(new File(mainDir, PRE + "-ms.txt")), figMs = readMs(new File(mainDir, FIG + "-ms.txt"));
                if (useFigs && usePre && (preMs < 0 || (figMs >= 0 && preMs <= figMs))) useFigs = false;
                if (useFigs) usePre = false;
                long firstRunMs = -1;
                boolean usedPre = usePre, usedFigs = useFigs;
                while (true) {
                    // Como latexmk: se repite mientras cambien los archivos auxiliares (índice, referencias), hasta 4 veces.
                    int p = 0;
                    while (p < 4) {
                        String before = digest(dir, stem);
                        long tRun = System.currentTimeMillis();
                        r = useFigs ? mainWithFigs(mainDir, job, mainName)
                                : run(tex(eng, usePre ? PRE : null,
                                "-interaction=nonstopmode", "-file-line-error", "-synctex=1", "-recorder", "-jobname=" + job, mainArg(mainDir, mainName)),
                                mainDir, 10 * 60 * 1000);
                        if (firstRunMs < 0) firstRunMs = System.currentTimeMillis() - tRun;
                        p++; passes++;
                        output.append(r.out);
                        if (r.timedOut) { timedOut = true; break; }
                        String lg = readText(new File(dir, stem + ".log"));
                        if (lg != null && (lg.contains("Emergency stop") || lg.contains("not found") || lg.contains("not loadable") || lg.contains("cannot open"))) break;
                        // Bibliografía (BibTeX) e índice alfabético (makeindex), como latexmk: si cambiaron, se arman y se repite.
                        if (p < 4 && auxTools(mainDir, job, output, autoinstall)) continue;
                        boolean rerunMsg = lg != null && (lg.contains("Rerun to get") || lg.contains("Label(s) may have changed"));
                        if (!rerunMsg && before.equals(digest(dir, stem))) break;
                    }
                    if (timedOut || !autoinstall || rounds >= 8) break;
                    String lg = readText(new File(dir, stem + ".log"));
                    List<String> miss = new ArrayList<>();
                    String all = (lg == null ? "" : lg) + "\n" + r.out;
                    for (String m : findMissing(all))
                        if (!failed.contains(m) && !new File(mainDir, m).exists() && !new File(dir, m).exists()) miss.add(m);
                    // Las .fd solo si no vienen en el APK (si vienen, es una variante que de verdad no existe).
                    List<String> soft = new ArrayList<>();
                    for (String fd : findShapes(all)) if (!bundledNames().contains(fd) && !failed.contains(fd) && !skipped.contains(fd)) soft.add(fd);
                    List<String> fontReq = fontRequests(all);
                    if (miss.isEmpty() && soft.isEmpty() && fontReq.isEmpty()) break;
                    loadIndex();
                    for (String fr : fontReq) {
                        String ff = fontFile(fr);
                        if (ff != null && !failed.contains(ff) && !miss.contains(ff)) miss.add(ff); else if (ff == null) failed.add(fr);
                    }
                    Set<String> have = installedPkgs();
                    boolean progressed = false;
                    for (String m : soft) {
                        String pkg = index.get(m);
                        if (pkg == null || have.contains(pkg) || installedNow.contains(pkg)) { skipped.add(m); continue; }
                        miss.add(m);
                    }
                    if (all.contains("Type 1 font file")) for (String f : fontsNeeded(dir, stem)) if (!miss.contains(f) && !failed.contains(f)) miss.add(f);
                    for (String m : miss) {
                        String pkg = index.get(m);
                        if (pkg != null && SINGLE.containsKey(pkg)) {
                            if (downloadSingle(pkg, m)) progressed = true; else failed.add(m);
                            continue;
                        }
                        if (pkg == null || have.contains(pkg) || installedNow.contains(pkg)) { if (!skipped.contains(m)) failed.add(m); continue; }
                        for (String q : withDeps(pkg, have, installedNow)) {
                            try { install(q); installedNow.add(q); progressed = true; }
                            catch (Exception e) { if (q.equals(pkg)) failed.add(m); output.append("\n[TeXsting] No se pudo descargar ").append(q).append(": ").append(e.getMessage()).append('\n'); }
                        }
                    }
                    if (!progressed) break;
                    rounds++;
                    usePre = false;  // con paquetes nuevos, el preámbulo guardado ya no vale
                    useFigs = false; usedFigs = false;
                    new File(dir, stem + ".aux").delete();
                    pdf.delete();
                    progress("Compilando de nuevo con " + String.join(", ", installedNow) + "…");
                }
                if (useFigs && !timedOut) {
                    // Una figura guardada dañada (p. ej. de una versión anterior que se cortaba a medias):
                    // se borra para dibujarla de nuevo.
                    String lgf = String.valueOf(readText(new File(dir, stem + ".log")));
                    Matcher bad = Pattern.compile("\\(file \\./(" + FIG + "/[^)]+)\\.pdf\\): [^\\n]*(failed|cannot|not)").matcher(unwrap(lgf));
                    while (bad.find()) new File(mainDir, bad.group(1) + ".pdf").delete();
                    List<String> stale = staleFigs(mainDir, job);
                    if (!stale.isEmpty()) {
                        progress(stale.size() == 1 ? "Dibujando la figura que cambió…" : "Dibujando las " + stale.size() + " figuras que cambiaron…");
                        boolean ok = makeFigs(mainDir, job, mainName, stale, gen);
                        if (ok) { r = mainWithFigs(mainDir, job, mainName); passes++; }
                        else {
                            // Esta figura no se puede guardar aparte: el proyecto vuelve a compilar como siempre.
                            try (OutputStream o = new FileOutputStream(figStatus(mainDir))) { o.write(("no " + figKey).getBytes(StandardCharsets.UTF_8)); }
                            usedFigs = false;
                            r = run(tex(eng, null,
                                    "-interaction=nonstopmode", "-file-line-error", "-synctex=1", "-recorder", "-jobname=" + job, mainArg(mainDir, mainName)), mainDir, 10 * 60 * 1000);
                            passes++;
                        }
                        output.append(r.out);
                    }
                }
                String log = readText(new File(dir, stem + ".log"));
                if (log == null) log = "";
                Pattern errPat = ERR;
                // La primera vez que el preámbulo guardado da errores, se comprueba compilando normal:
                // si así hay menos errores, el preámbulo de este proyecto no se puede guardar.
                if (usePre && preInfo.startsWith("ok ") && !timedOut && errPat.matcher(log).find()) {
                    int withPre = countMatches(errPat, log);
                    r = run(tex(eng, null,
                            "-interaction=nonstopmode", "-file-line-error", "-synctex=1", "-recorder", "-jobname=" + job, mainArg(mainDir, mainName)), mainDir, 10 * 60 * 1000);
                    passes++;
                    String normal = readText(new File(dir, stem + ".log"));
                    int without = normal == null ? Integer.MAX_VALUE : countMatches(errPat, normal);
                    boolean preOk = without >= withPre;
                    try (OutputStream o = new FileOutputStream(new File(mainDir, PRE + ".txt"))) { o.write(((preOk ? "verificado " : "no ") + preKey).getBytes(StandardCharsets.UTF_8)); }
                    if (!preOk) { new File(mainDir, PRE + ".fmt").delete(); usedPre = false; }
                    log = normal == null ? "" : normal;
                }
                byte[] pdfBytes = readBytes(pdf);
                boolean hasErrors = errPat.matcher(log).find();
                String status = timedOut ? "timeout" : pdfBytes == null ? "failed" : (hasErrors || r.code != 0) ? "errors" : "success";
                byte[] sync = readBytes(new File(dir, stem + ".synctex.gz"));
                JSObject res = new JSObject();
                res.put("ok", pdfBytes != null);
                res.put("status", status);
                res.put("pdf", pdfBytes != null ? Base64.encodeToString(pdfBytes, Base64.NO_WRAP) : null);
                res.put("synctex", sync != null ? Base64.encodeToString(sync, Base64.NO_WRAP) : null);
                res.put("log", log.length() > 400000 ? log.substring(log.length() - 400000) : log);
                String o = output.toString();
                res.put("output", o.length() > 40000 ? o.substring(o.length() - 40000) : o);
                JSArray inst = new JSArray(), mis = new JSArray();
                for (String x : installedNow) inst.put(x);
                for (String x : failed) mis.put(x);
                res.put("installed", inst);
                res.put("missing", mis);
                long t2 = System.currentTimeMillis();
                res.put("elapsed", (t2 - t0) / 1000.0);
                res.put("engine", eng);
                res.put("integrado", true);
                res.put("pasadas", passes);
                res.put("prepararMs", t1 - t0);
                res.put("texMs", t2 - t1);
                res.put("preparacion", prep);
                if (firstRunMs > 0 && rounds == 0 && (usedPre || usedFigs)) writeMs(new File(mainDir, (usedFigs ? FIG : PRE) + "-ms.txt"), firstRunMs);
                res.put("preambuloGuardado", usedPre || usedFigs);
                res.put("figurasGuardadas", usedFigs);
                call.resolve(res);
                // Después de responder: si el preámbulo cambió, se arma el nuevo para la próxima compilación.
                String keyNow = usePreSetting ? preambleKey(files, main) : null;
                String infoNow = String.valueOf(readText(new File(mainDir, PRE + ".txt"))).trim();
                final File md = mainDir; final String mn = mainName; final String jb = job;
                if (keyNow != null && pdfBytes != null && !timedOut && !infoNow.endsWith(" " + keyNow)) {
                    final String kn = keyNow;
                    background(() -> buildPre(md, mn, kn));
                }
                // Si el documento usa TikZ/pgfplots, se guardan sus figuras ya dibujadas para las próximas veces.
                String figSt = String.valueOf(readText(figStatus(mainDir))).trim();
                boolean usesTikz = log.contains("/tikz.sty") || log.contains("pgfplots.sty") || new File(mainDir, job + ".figlist").exists();
                if (autoinstall && !usedFigs && usesTikz && figKey != null && pdfBytes != null && !timedOut
                        && !figSt.equals("no " + figKey) && !figsReady(mainDir, job, figKey)) {
                    final int nErr = countMatches(ERR, log);
                    final String dk = figKey;
                    background(() -> { try { buildFigs(md, jb, mn, nErr, dk); } catch (Exception ignored) { } });
                }
            } catch (Exception e) {
                call.reject(String.valueOf(e.getMessage()));
            }
        }
    }
}
