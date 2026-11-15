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

    private File libDir() { return new File(getContext().getApplicationInfo().nativeLibraryDir); }
    private File pdftex() { return new File(libDir(), "libtx_pdftex.so"); }
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
        e.put("TEXMFHOME", v + "/texmf"); e.put("TEXMFCACHE", v + "/cache");
        e.put("MKTEXTFM", "0"); e.put("MKTEXPK", "0"); e.put("MKTEXMF", "0"); e.put("MKTEXFMT", "0");
        return e;
    }

    private static class Run { int code = -1; String out = ""; boolean timedOut; }

    private Run run(List<String> cmd, File cwd, long timeoutMs) throws Exception {
        ProcessBuilder pb = new ProcessBuilder(cmd).directory(cwd).redirectErrorStream(true);
        pb.environment().clear();
        pb.environment().putAll(env());
        Process p = pb.start();
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
            delete(tl()); delete(var());
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
            try (OutputStream o = new FileOutputStream(marker())) { o.write(v.getBytes(StandardCharsets.UTF_8)); }
            r.put("primeraVez", true);
        } else {
            r.put("primeraVez", false);
        }
        r.put("version", v);
        return r;
    }

    @PluginMethod
    public void estado(PluginCall call) {
        JSObject r = new JSObject();
        r.put("binario", pdftex().exists());
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
    };
    // «Font shape `OT1/ptm/m/n' undefined»: LaTeX no encontró la descripción de la fuente (ot1ptm.fd)
    // y usó otra sin error. Pasa con IEEEtran (Times): hay que bajar el .fd y sus fuentes.
    private static final Pattern SHAPE = Pattern.compile("Font shape `([A-Za-z0-9]+)/([^/']+)/[^']*' undefined");
    private static final String[] INSTALLABLE = { ".sty", ".cls", ".def", ".fd", ".cfg", ".clo", ".ldf", ".tfm", ".bbx", ".cbx",
        ".lbx", ".dbx", ".code.tex", ".tex", ".pfb", ".map", ".enc", ".vf" };
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
        try (BufferedReader br = new BufferedReader(new InputStreamReader(new GZIPInputStream(getContext().getAssets().open("motor/indice.idx")), StandardCharsets.UTF_8))) {
            String l;
            while ((l = br.readLine()) != null) {
                int t = l.indexOf('\t');
                if (t <= 0) continue;
                if (l.charAt(0) == '@') { try { sz.put(l.substring(1, t), Long.parseLong(l.substring(t + 1))); } catch (NumberFormatException ignored) { } }
                else idx.put(l.substring(0, t), l.substring(t + 1));
            }
        }
        index = idx; sizes = sz;
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
                boolean ok = false;
                for (String ext : INSTALLABLE) if (name.toLowerCase(Locale.ROOT).endsWith(ext)) ok = true;
                if (ok && !found.contains(name)) found.add(name);
            }
        }
        return found;
    }

    private void progress(String text) {
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
            if (!maps.isEmpty()) {
                // Como updmap: las fuentes nuevas se agregan a una copia propia de pdftex.map (tiene prioridad).
                File vmap = new File(var(), "texmf-var/fonts/map/pdftex/updmap/pdftex.map");
                if (!vmap.exists()) {
                    vmap.getParentFile().mkdirs();
                    byte[] base = readBytes(new File(tl(), "texmf-var/fonts/map/pdftex/updmap/pdftex.map"));
                    try (OutputStream o = new FileOutputStream(vmap)) { if (base != null) o.write(base); }
                }
                try (OutputStream o = new FileOutputStream(vmap, true)) {
                    for (File m : maps) { byte[] b = readBytes(m); if (b != null) { o.write('\n'); o.write(b); } }
                }
            }
            try (OutputStream o = new FileOutputStream(installedFile(), true)) { o.write((pkg + "\n").getBytes(StandardCharsets.UTF_8)); }
        } finally {
            tmp.delete();
        }
    }

    @PluginMethod
    public void paquetes(PluginCall call) {
        JSObject r = new JSObject();
        JSArray a = new JSArray();
        for (String p : installedPkgs()) a.put(p);
        r.put("instalados", a);
        call.resolve(r);
    }

    @PluginMethod
    public void compilar(PluginCall call) {
        exec.execute(() -> {
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
                String stem = main.replaceAll("\\.tex$", "");
                File pdf = new File(dir, stem + ".pdf");
                pdf.delete();
                File mainDir = new File(dir, main).getParentFile();
                String mainName = new File(main).getName();
                StringBuilder output = new StringBuilder();
                Run r = null;
                int passes = 0, rounds = 0;
                boolean timedOut = false;
                boolean autoinstall = call.getBoolean("autoinstall", true);
                List<String> installedNow = new ArrayList<>(), failed = new ArrayList<>(), skipped = new ArrayList<>();
                while (true) {
                    // Como latexmk: se repite mientras cambien los archivos auxiliares (índice, referencias), hasta 4 veces.
                    int p = 0;
                    while (p < 4) {
                        String before = digest(dir, stem);
                        r = run(Arrays.asList(pdftex().getAbsolutePath(), "-progname=pdflatex", "-fmt=pdflatex",
                                "-interaction=nonstopmode", "-file-line-error", "-synctex=1", "-recorder", mainName),
                                mainDir, 10 * 60 * 1000);
                        p++; passes++;
                        output.append(r.out);
                        if (r.timedOut) { timedOut = true; break; }
                        String lg = readText(new File(dir, stem + ".log"));
                        if (lg != null && (lg.contains("Emergency stop") || lg.contains("not found") || lg.contains("not loadable") || lg.contains("cannot open"))) break;
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
                    if (miss.isEmpty() && soft.isEmpty()) break;
                    loadIndex();
                    Set<String> have = installedPkgs();
                    boolean progressed = false;
                    for (String m : soft) {
                        String pkg = index.get(m);
                        if (pkg == null || have.contains(pkg) || installedNow.contains(pkg)) { skipped.add(m); continue; }
                        miss.add(m);
                    }
                    for (String m : miss) {
                        String pkg = index.get(m);
                        if (pkg == null || have.contains(pkg) || installedNow.contains(pkg)) { if (!skipped.contains(m)) failed.add(m); continue; }
                        try { install(pkg); installedNow.add(pkg); progressed = true; }
                        catch (Exception e) { failed.add(m); output.append("\n[TeXsting] No se pudo descargar ").append(pkg).append(": ").append(e.getMessage()).append('\n'); }
                    }
                    if (!progressed) break;
                    rounds++;
                    new File(dir, stem + ".aux").delete();
                    pdf.delete();
                    progress("Compilando de nuevo con " + String.join(", ", installedNow) + "…");
                }
                String log = readText(new File(dir, stem + ".log"));
                if (log == null) log = "";
                byte[] pdfBytes = readBytes(pdf);
                boolean hasErrors = java.util.regex.Pattern.compile("^(! |.*:\\d+: )", java.util.regex.Pattern.MULTILINE).matcher(log).find();
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
                res.put("engine", "pdflatex");
                res.put("integrado", true);
                res.put("pasadas", passes);
                res.put("prepararMs", t1 - t0);
                res.put("texMs", t2 - t1);
                res.put("preparacion", prep);
                call.resolve(res);
            } catch (Exception e) {
                call.reject(String.valueOf(e.getMessage()));
            }
        });
    }
}
