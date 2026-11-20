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

    private File xetex() { return new File(libDir(), "libtx_xetex.so"); }
    private File xdvipdfmx() { return new File(libDir(), "libtx_xdvipdfmx.so"); }
    private File xeFmtDir() { return new File(var(), "texmf-var/web2c/xetex"); }

    /** Orden para el motor elegido: pdfTeX (pdflatex), LuaHBTeX (lualatex) o XeTeX (xelatex). fmt = null: el normal. */
    private List<String> tex(String eng, String fmt, String... rest) {
        List<String> c = new ArrayList<>();
        if ("lualatex".equals(eng)) {
            c.add(luatex().getAbsolutePath()); c.add("-progname=lualatex"); c.add("-fmt=" + (fmt != null ? fmt : "lualatex"));
        } else if ("xelatex".equals(eng)) {
            // XeTeX solo escribe el .xdv; el PDF lo arma xdvipdfmx después (ver xdvToPdf), una sola vez al final
            // y no en cada pasada, y con sus mensajes a la vista si algo falla.
            c.add(xetex().getAbsolutePath()); c.add("-progname=xelatex"); c.add("-fmt=" + (fmt != null ? fmt : "xelatex"));
            c.add("-no-pdf");
        } else {
            c.add(pdftex().getAbsolutePath()); c.add("-progname=pdflatex"); c.add("-fmt=" + (fmt != null ? fmt : "pdflatex"));
        }
        c.addAll(Arrays.asList(rest));
        return c;
    }

    /** XeLaTeX: arma rel.pdf a partir de rel.xdv con xdvipdfmx. Devuelve true si salió el PDF. */
    private boolean xdvToPdf(File dir, String rel, StringBuilder output) {
        File x = new File(dir, rel + ".xdv"), p = new File(dir, rel + ".pdf");
        if (!x.exists()) return p.exists();
        if (p.exists() && p.lastModified() >= x.lastModified()) return true;
        p.delete();
        try {
            // Sin -q: si falla, sus avisos dicen qué letra falta («Could not locate … for TFM "esint10"»).
            Run r = run(Arrays.asList(xdvipdfmx().getAbsolutePath(), "-E", "-o", rel + ".pdf", rel + ".xdv"), dir, 5 * 60 * 1000);
            if (!p.exists() || r.code != 0) {
                if (output != null) output.append("\n[xdvipdfmx] No se pudo armar el PDF (código ").append(r.code).append("):\n")
                        .append(r.out.length() > 3000 ? r.out.substring(r.out.length() - 3000) : r.out).append('\n');
                if (r.code != 0) p.delete();
            }
        } catch (Exception e) {
            if (output != null) output.append("\n[xdvipdfmx] ").append(e.getMessage()).append('\n');
        }
        return p.exists();
    }

    /** XeLaTeX: fontconfig busca las fuentes por nombre en TeX, en las descargadas y en las del sistema (Roboto, Noto…). */
    private void writeFontsConf() throws IOException {
        File fc = new File(var(), "fonts.conf");
        String t = "<?xml version=\"1.0\"?>\n<fontconfig>\n"
                + "  <dir>" + new File(tl(), "texmf-dist/fonts/opentype").getAbsolutePath() + "</dir>\n"
                + "  <dir>" + new File(tl(), "texmf-dist/fonts/truetype").getAbsolutePath() + "</dir>\n"
                + "  <dir>" + new File(home(), "fonts").getAbsolutePath() + "</dir>\n"
                + "  <dir>/system/fonts</dir>\n"
                + "  <cachedir>" + new File(var(), "fontconfig").getAbsolutePath() + "</cachedir>\n"
                + "</fontconfig>\n";
        if (!t.equals(readText(fc))) try (OutputStream o = new FileOutputStream(fc)) { o.write(t.getBytes(StandardCharsets.UTF_8)); }
    }

    /** Tamaños de papel para libpaper (formato de paperspecs: nombre,ancho,alto,unidad). */
    private void writePaperSpecs() throws IOException {
        File dir = new File(var(), "config");
        dir.mkdirs();
        StringBuilder t = new StringBuilder("A4,210,297,mm\nLetter,8.5,11,in\nLegal,8.5,14,in\nExecutive,7.25,10.5,in\n"
                + "Tabloid,11,17,in\nLedger,17,11,in\nStatement,5.5,8.5,in\nFolio,210,330,mm\nB4,250,353,mm\nB5,176,250,mm\n"
                + "C5,162,229,mm\nDL,110,220,mm\n");
        int[][] a = { {841, 1189}, {594, 841}, {420, 594}, {297, 420}, {210, 297}, {148, 210}, {105, 148}, {74, 105}, {52, 74}, {37, 52}, {26, 37} };
        for (int i = 0; i < a.length; i++) if (i != 4) t.append("A").append(i).append(',').append(a[i][0]).append(',').append(a[i][1]).append(",mm\n");
        File f = new File(dir, "paperspecs");
        if (!t.toString().equals(readText(f))) try (OutputStream o = new FileOutputStream(f)) { o.write(t.toString().getBytes(StandardCharsets.UTF_8)); }
    }

    /** XeLaTeX: su formato se arma la primera vez que se usa. */
    private void prepareXe() throws Exception {
        writeFontsConf();
        writePaperSpecs();
        String v = assetVersion();
        File f = new File(xeFmtDir(), "xelatex.fmt"), mk = new File(xeFmtDir(), "version.txt");
        if (f.exists() && v != null && v.equals(String.valueOf(readText(mk)).trim())) return;
        progress("Preparando XeLaTeX por primera vez…");
        xeFmtDir().mkdirs();
        f.delete();
        Run fr = run(Arrays.asList(xetex().getAbsolutePath(), "-ini", "-etex", "-jobname=xelatex", "-progname=xelatex", "xelatex.ini"),
                xeFmtDir(), 5 * 60 * 1000);
        if (!f.exists()) {
            String o = fr.out;
            throw new Exception("No se pudo preparar XeLaTeX (código " + fr.code + "): " + (o.length() > 1500 ? o.substring(o.length() - 1500) : o));
        }
        try (OutputStream o = new FileOutputStream(mk)) { o.write(String.valueOf(v).getBytes(StandardCharsets.UTF_8)); }
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
        String e = String.valueOf(readText(new File(mainDir, "texsting-motor.txt"))).trim();
        return e.equals("lualatex") || e.equals("xelatex") ? e : "pdflatex";
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

    // ───────────── biber (biblatex): Perl de Termux dentro del APK (tools/biber) ─────────────
    private File perlDir() { return new File(base(), "perl"); }
    private String perlVersion() {
        try (InputStream in = getContext().getAssets().open("motor/perl-version.txt")) {
            return new String(readAll(in), StandardCharsets.UTF_8).trim();
        } catch (IOException e) { return null; }
    }
    private boolean hayBiber() { return new File(libDir(), "libtx_perl.so").exists() && perlVersion() != null; }

    /** La primera vez que se necesita biber: descomprime los módulos de Perl y enlaza los compilados (están en jniLibs). */
    private synchronized void preparePerl() throws Exception {
        String v = perlVersion();
        File mk = new File(perlDir(), ".version");
        if (v == null || v.equals(String.valueOf(readText(mk)).trim())) return;
        progress("Preparando biber (solo la primera vez)…");
        delete(perlDir());
        perlDir().mkdirs();
        String rootPath = perlDir().getCanonicalPath();
        try (ZipInputStream z = new ZipInputStream(new BufferedInputStream(getContext().getAssets().open("motor/perl.zip")))) {
            ZipEntry e; byte[] b = new byte[65536];
            while ((e = z.getNextEntry()) != null) {
                File f = new File(perlDir(), e.getName());
                if (!f.getCanonicalPath().startsWith(rootPath)) continue;
                if (e.isDirectory()) { f.mkdirs(); continue; }
                f.getParentFile().mkdirs();
                try (OutputStream o = new FileOutputStream(f)) { int n; while ((n = z.read(b)) > 0) o.write(b, 0, n); }
            }
        }
        String xs = readText(new File(perlDir(), "xs.txt"));
        if (xs != null) for (String l : xs.split("\n")) {
            int t = l.indexOf('\t');
            if (t <= 0) continue;
            File link = new File(perlDir(), l.substring(0, t));
            link.getParentFile().mkdirs();
            link.delete();
            android.system.Os.symlink(new File(libDir(), l.substring(t + 1).trim()).getAbsolutePath(), link.getAbsolutePath());
        }
        try (OutputStream o = new FileOutputStream(mk)) { o.write(v.getBytes(StandardCharsets.UTF_8)); }
    }

    /** Dónde busca Perl sus módulos (los del APK, no los de Termux). */
    private String perl5lib() {
        File p5 = new File(perlDir(), "perl5");
        String[] vs = p5.list((d, n) -> n.startsWith("5."));
        if (vs == null || vs.length == 0) return null;
        String b = p5.getAbsolutePath(), ver = vs[0];
        return b + "/" + ver + ":" + b + "/" + ver + "/aarch64-android:" + b + "/site_perl/" + ver + ":" + b + "/site_perl/" + ver + "/aarch64-android";
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
        e.put("FONTCONFIG_FILE", v + "/fonts.conf");
        // xdvipdfmx (XeLaTeX) usa libpaper de Termux, que busca los tamaños de papel en la carpeta de Termux:
        // se le da una lista propia (config/paperspecs, ver writePaperSpecs) y A4 por defecto.
        e.put("XDG_CONFIG_HOME", v + "/config");
        e.put("PAPERSIZE", "a4");
        e.put("MKTEXTFM", "0"); e.put("MKTEXPK", "0"); e.put("MKTEXMF", "0"); e.put("MKTEXFMT", "0");
        if (perlDir().exists()) { String p5 = perl5lib(); if (p5 != null) e.put("PERL5LIB", p5); }
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
        if (xetex().exists() && xdvipdfmx().exists()) mot.put("xelatex");
        r.put("motores", mot);
        r.put("datos", assetVersion() != null);
        r.put("listo", ready());
        r.put("version", assetVersion());
        call.resolve(r);
    }

    @PluginMethod
    public void preparar(PluginCall call) {
        exec.execute(() -> {
            try {
                call.resolve(prepare());
                // Al abrir la app: también los formatos de XeLaTeX y LuaLaTeX, en segundo plano (si se compila
                // mientras tanto, esto se corta y se retoma la próxima vez).
                if (call.getBoolean("todos", false)) background(() -> {
                    try { quiet = true; if (xetex().exists()) prepareXe(); if (luatex().exists()) prepareLua(); }
                    catch (Exception ignored) { } finally { quiet = false; }
                });
            } catch (Exception e) { call.reject(String.valueOf(e.getMessage())); }
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
        // MetaPost dentro de LuaLaTeX (luamplib): «I can't open file `plain.mp'».
        Pattern.compile("I can't open file `([^']+\\.mp)'"),
        // biblatex con un estilo que viene en otro paquete (style=ieee → biblatex-ieee): «Style 'ieee' not found».
        Pattern.compile("Package biblatex Error: (?:Bibliography )?[Ss]tyle '([^']+)' not found"),
        Pattern.compile("Package biblatex Error: Citation style '([^']+)' not found"),
    };
    // «Font shape `OT1/ptm/m/n' undefined»: LaTeX no encontró la descripción de la fuente (ot1ptm.fd)
    // y usó otra sin error. Pasa con IEEEtran (Times): hay que bajar el .fd y sus fuentes.
    private static final Pattern SHAPE = Pattern.compile("Font shape `([A-Za-z0-9]+)/([^/']+)/[^']*' undefined");
    private static final String[] INSTALLABLE = { ".sty", ".cls", ".def", ".fd", ".cfg", ".clo", ".ldf", ".tfm", ".bbx", ".cbx",
        ".lbx", ".dbx", ".code.tex", ".tex", ".pfb", ".map", ".enc", ".vf", ".otf", ".ttf", ".lua", ".bst", ".mp" };
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

    /**
     * Paquete de TeX Live que trae un archivo. El índice del APK no incluye los .mp de MetaPost: los de
     * metafun empiezan con «mp-» o se llaman metafun; el resto (plain.mp, boxes.mp, graph.mp…) es de «metapost».
     */
    private String pkgOf(String file) {
        String pkg = index.get(file);
        if (pkg != null || !file.endsWith(".mp")) return pkg;
        return file.startsWith("mp-") || file.startsWith("metafun") ? "metafun" : "metapost";
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
                if (i == 8) name += ".bbx";
                if (i == 9) name += ".cbx";
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

    /** Paso actual de la compilación, para la barra de progreso del editor («Pasada 2», «Armando el PDF»). */
    private void paso(String text) {
        if (quiet) return;
        JSObject d = new JSObject();
        d.put("texto", text);
        notifyListeners("paso", d);
    }
    /** Si hay trabajo en segundo plano (figuras, preámbulo): el editor muestra un indicador mientras dure. */
    private void fondoEstado(boolean activo, String texto) {
        JSObject d = new JSObject();
        d.put("activo", activo);
        d.put("texto", texto);
        notifyListeners("fondoEstado", d);
    }
    /**
     * Tramo del trabajo de fondo para el porcentaje: va de «desde» a «hasta» (0–100) y se espera que tarde
     * «segundos». El editor avanza la barra solo dentro del tramo; al llegar el siguiente salta a su inicio.
     */
    private void fondoPaso(String texto, int desde, int hasta, double segundos) {
        JSObject d = new JSObject();
        d.put("activo", true);
        d.put("texto", texto);
        d.put("desde", desde);
        d.put("hasta", hasta);
        d.put("segundos", Math.max(2, segundos));
        notifyListeners("fondoEstado", d);
    }
    /** Lo que tardó la última pasada completa: con eso se estima cuánto toma el trabajo de fondo. */
    private volatile long pasadaMs = 30000;
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

    private final Object instalando = new Object();
    private void install(String pkg) throws Exception { install(pkg, true); }

    /** Baja e instala un paquete de CTAN. «avisar» = false: descarga de «Usar sin internet» (no es de una compilación). */
    private void install(String pkg, boolean avisar) throws Exception {
        synchronized (instalando) {
            // La compilación y la descarga de «Usar sin internet» pueden pedir el mismo paquete a la vez.
            if (installedPkgs().contains(pkg)) return;
            installNow(pkg, avisar);
        }
    }

    private void installNow(String pkg, boolean avisar) throws Exception {
        Long sz = sizes.get(pkg);
        if (avisar) progress("Descargando el paquete «" + pkg + "»" + (sz != null && sz > 0 ? String.format(Locale.ROOT, " (%.1f MB)", sz / 1e6).replace('.', ',') : "") + "… (solo la primera vez)");
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

    private static final Pattern BIBLATEX_OPC = Pattern.compile("\\\\usepackage\\s*\\[([^\\]]*)\\]\\s*\\{biblatex\\}");
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
            // Estilos de biblatex que vienen en otros paquetes (style=ieee → ieee.bbx y ieee.cbx, de biblatex-ieee).
            Matcher bm = BIBLATEX_OPC.matcher(code);
            while (bm.find()) for (String op : bm.group(1).split(",")) {
                String[] kv = op.split("=", 2);
                if (kv.length < 2) continue;
                String k = kv[0].trim(), v = kv[1].trim();
                if (v.isEmpty() || !v.matches("[A-Za-z0-9_\\-]+")) continue;
                if (k.equals("style") || k.equals("bibstyle")) { String fb = v + ".bbx"; if (!want.contains(fb) && !bundledNames().contains(fb)) want.add(fb); }
                if (k.equals("style") || k.equals("citestyle")) { String fc = v + ".cbx"; if (!want.contains(fc) && !bundledNames().contains(fc)) want.add(fc); }
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

    // ───────────── «Usar sin internet»: bajar de una vez los paquetes básicos o los avanzados ─────────────
    private final ExecutorService dl = Executors.newSingleThreadExecutor(r -> new Thread(r, "texsting-descargas"));
    private volatile boolean dlCancelar, dlActiva;

    /** Las listas que armó tools/apk/sin_internet.py: nivel → [[paquete, bytes de descarga, bytes instalado]]. */
    private JSONObject listasSinInternet() throws Exception {
        try (InputStream in = getContext().getAssets().open("motor/sin-internet.json")) {
            return new JSONObject(new String(readAll(in), StandardCharsets.UTF_8));
        }
    }

    private static long tamano(File f) {
        if (f.isFile()) return f.length();
        long t = 0;
        File[] l = f.listFiles();
        if (l != null) for (File x : l) t += tamano(x);
        return t;
    }

    @PluginMethod
    public void sinInternet(PluginCall call) {
        try {
            JSONObject listas = listasSinInternet();
            Set<String> have = installedPkgs();
            JSObject r = new JSObject();
            for (String nivel : new String[] { "basicos", "avanzados" }) {
                org.json.JSONArray a = listas.getJSONArray(nivel);
                long desc = 0, inst = 0; int listos = 0;
                for (int i = 0; i < a.length(); i++) {
                    org.json.JSONArray x = a.getJSONArray(i);
                    if (have.contains(x.getString(0))) { listos++; continue; }
                    desc += x.getLong(1); inst += x.getLong(2);
                }
                JSObject n = new JSObject();
                n.put("total", a.length()); n.put("listos", listos); n.put("descarga", desc); n.put("instalado", inst);
                r.put(nivel, n);
            }
            r.put("ocupado", tamano(home()));
            r.put("paquetes", have.size());
            r.put("descargando", dlActiva);
            call.resolve(r);
        } catch (Exception e) { call.reject("Esta versión no trae las listas de paquetes: " + e.getMessage()); }
    }

    private void avisoDescarga(String nivel, int hechos, int total, String paquete, long bytes, long bytesTotal, boolean fin, int fallos, boolean cancelado) {
        JSObject d = new JSObject();
        d.put("nivel", nivel); d.put("hechos", hechos); d.put("total", total); d.put("paquete", paquete);
        d.put("bytes", bytes); d.put("bytesTotal", bytesTotal); d.put("fin", fin); d.put("fallos", fallos); d.put("cancelado", cancelado);
        notifyListeners("descargaPaquetes", d);
    }

    /** Baja en segundo plano los paquetes de un nivel que falten (y avisa el avance con «descargaPaquetes»). */
    @PluginMethod
    public void descargarSinInternet(PluginCall call) {
        String nivel = "avanzados".equals(call.getString("nivel")) ? "avanzados" : "basicos";
        if (dlActiva) { call.reject("Ya hay una descarga en curso"); return; }
        dlActiva = true;
        dlCancelar = false;
        call.resolve();
        dl.execute(() -> {
            int hechos = 0, fallos = 0, total = 0;
            long bytes = 0, bytesTotal = 0;
            try {
                loadIndex();
                JSONObject listas = listasSinInternet();
                org.json.JSONArray a = listas.getJSONArray(nivel);
                Set<String> have = installedPkgs();
                List<String> pend = new ArrayList<>();
                Map<String, Long> peso = new HashMap<>();
                for (int i = 0; i < a.length(); i++) {
                    org.json.JSONArray x = a.getJSONArray(i);
                    if (have.contains(x.getString(0))) continue;
                    pend.add(x.getString(0)); peso.put(x.getString(0), x.getLong(1)); bytesTotal += x.getLong(1);
                }
                total = pend.size();
                avisoDescarga(nivel, 0, total, "", 0, bytesTotal, false, 0, false);
                for (String pkg : pend) {
                    if (dlCancelar) break;
                    try { install(pkg, false); } catch (Exception e) { fallos++; }
                    hechos++;
                    bytes += peso.getOrDefault(pkg, 0L);
                    avisoDescarga(nivel, hechos, total, pkg, bytes, bytesTotal, false, fallos, false);
                }
            } catch (Exception e) { fallos++; }
            finally {
                dlActiva = false;
                avisoDescarga(nivel, hechos, total, "", bytes, bytesTotal, true, fallos, dlCancelar);
            }
        });
    }

    @PluginMethod
    public void cancelarDescarga(PluginCall call) { dlCancelar = true; call.resolve(); }

    /** Borra los paquetes descargados (se vuelven a bajar solos cuando un documento los pida). */
    @PluginMethod
    public void borrarDescargados(PluginCall call) {
        if (dlActiva) { call.reject("Espera a que termine la descarga (o cancélala)"); return; }
        exec.execute(() -> {
            synchronized (work) {
                synchronized (instalando) {
                    long antes = tamano(home());
                    delete(home());
                    installedFile().delete();
                    // El mapa de fuentes con las descargadas y los cachés de fuentes de LuaLaTeX y XeLaTeX.
                    new File(var(), "texmf-var/fonts/map/pdftex/updmap/pdftex.map").delete();
                    delete(new File(var(), "texmf-var/luatex-cache"));
                    delete(new File(var(), "fontconfig"));
                    JSObject r = new JSObject();
                    r.put("liberado", antes);
                    call.resolve(r);
                }
            }
        });
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
        // biblatex queda distinto con biber que con BibTeX: si el APK empieza a traer biber, se arma de nuevo.
        if (pre.contains("biblatex")) k.append('\u0000').append(hayBiber() ? "biber" : "bibtex");
        return sha1(k.toString());
    }

    /** Arma el formato con el preámbulo (en segundo plano, después de una compilación normal). */
    /**
     * Va en la orden que arma el preámbulo guardado, antes de mylatexformat:
     * - \\prevdepth no se guarda en un formato, y la clase (article, book…) lo deja en 0: sin esto la primera página
     *   (p. ej. la portada) salía unos 13 pt más arriba que compilando normal. Se anota al guardar y se repone.
     * - Al empezar el documento se carga texsting-ganchos.tex: ahí la app pone las figuras guardadas (o nada),
     *   y así el preámbulo guardado y las figuras guardadas se pueden usar juntos.
     */
    private static final String PRE_GANCHOS = "\\makeatletter"
            // Una clase puede cargar otra (\\LoadClass): se cambia una sola vez.
            + "\\AddToHook{class/after}{\\ifdefined\\texsting@stop\\else\\let\\texsting@stop\\MYLATEX@StopAtdocument"
            + "\\def\\MYLATEX@StopAtdocument#1{\\xdef\\texsting@pd{\\the\\prevdepth}\\texsting@stop{#1}}\\fi}"
            + "\\AddToHook{begindocument/before}{\\ifdefined\\texsting@pd\\prevdepth=\\texsting@pd\\relax\\fi"
            + "\\InputIfFileExists{texsting-ganchos.tex}{}{}}\\makeatother\\input";
    /** La clave del preámbulo guardado cambia cuando cambia cómo se arma (así se rehace solo). */
    private static String preKeyOf(String docKey) { return docKey == null ? null : "pre2-" + docKey; }

    private void buildPre(File mainDir, String mainName, String key) {
        File info = new File(mainDir, PRE + ".txt"), fmtFile = new File(mainDir, PRE + ".fmt");
        fondoPaso("Guardando el preámbulo", 0, 100, pasadaMs * 0.4 / 1000.0);
        try {
            boolean bad = true;
            for (int attempt = 0; attempt < 3; attempt++) {
                fmtFile.delete();
                Run r = run(Arrays.asList(pdftex().getAbsolutePath(), "-ini", "-interaction=nonstopmode", "-jobname=" + PRE,
                        "-progname=pdflatex", "&pdflatex", PRE_GANCHOS, "mylatexformat.ltx", mainName.contains(" ") ? "\"" + mainName + "\"" : mainName), mainDir, 3 * 60 * 1000);
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
            if (!bad) bgLogro = true;
        } catch (Exception e) {
            fmtFile.delete();
        }
    }


    // ───────────── Figuras guardadas (TikZ/pgfplots «external»): solo se redibujan las que cambian ─────────────
    private static final String FIG = "texsting-fig";
    private static final Pattern ERR = Pattern.compile("^(!(?! Package tikz Warning)|.*:\\d+: )", Pattern.MULTILINE);

    /** Se agrega por la línea de comandos, sin tocar tu archivo. */
    /** Lo que el preámbulo guardado carga al empezar el documento: las figuras guardadas, o nada. */
    private static void ganchos(File mainDir, boolean figuras) {
        File f = new File(mainDir, "texsting-ganchos.tex");
        String want = figuras ? "% TeXsting: figuras guardadas (lo escribe la app)\n" + figInject() + "\n" : "% TeXsting: sin figuras guardadas\n";
        if (!want.equals(readText(f))) {
            try (OutputStream o = new FileOutputStream(f)) { o.write(want.getBytes(StandardCharsets.UTF_8)); } catch (Exception ignored) { }
        }
    }
    /** Lo de figInject() va en un archivo: así la primera línea del log no es un bloque de código de la app. */
    private static String figInput(File mainDir) {
        File f = new File(mainDir, "texsting-figuras.tex");
        String want = "% TeXsting: figuras TikZ guardadas aparte (lo escribe la app)\n" + figInject() + "\n";
        if (!want.equals(readText(f))) {
            try (OutputStream o = new FileOutputStream(f)) { o.write(want.getBytes(StandardCharsets.UTF_8)); } catch (Exception ignored) { }
        }
        return "\\input{texsting-figuras.tex}";
    }
    private static String figInject() {
        // tcolorbox dibuja sus cajas con TikZ: «shield externalize» evita que se intenten guardar como figuras
        // (si no, las cajas «breakable» rompen la compilación).
        return "\\makeatletter\\AddToHook{begindocument/before}{\\IfPackageLoadedTF{tikz}{\\usetikzlibrary{external}"
                + "\\tikzexternalize[mode=list and make,prefix=" + FIG + "/]"
                + "\\IfPackageLoadedTF{tcolorbox}{\\tcbset{shield externalize}}{}"
                // circuitikz es \begin{tikzpicture} con otro nombre: así sus circuitos también se guardan.
                + "\\IfPackageLoadedTF{circuitikz}{\\RenewDocumentEnvironment{circuitikz}{+b}{\\begin{tikzpicture}#1\\end{tikzpicture}}{}"
                // Al leer el circuito de una vez, los caracteres que babel activa (en español, < y >) quedaban activos
                // dentro de TikZ y opciones como i>^= daban error al guardar la figura. Se apagan antes, como hace
                // tikzpicture con la biblioteca babel, y se restauran al terminar.
                + "\\AddToHook{env/circuitikz/before}{\\expandafter\\ifx\\csname iftikz@handle@active@code\\endcsname\\iftrue\\csname tikz@switchoff@shorthands\\endcsname\\fi}"
                + "\\AddToHook{env/circuitikz/after}{\\csname tikz@orig@shorthands\\endcsname\\expandafter\\let\\csname tikz@orig@shorthands\\expandafter\\endcsname\\csname pgfutil@empty\\endcsname}"
                + "}{}"
                // Dibujos sobre la página (portadas, marcos: «remember picture», «overlay») no se guardan aparte:
                // guardados ocupan una página entera y empujan el contenido (portada en blanco, páginas de más).
                + "\\AddToHook{begindocument/end}{\\let\\texsting@pic\\tikzpicture"
                + "\\def\\tikzpicture{\\@ifnextchar[\\texsting@pico\\texsting@pic}"
                + "\\def\\texsting@pico[#1]{\\in@{remember picture}{#1}\\ifin@\\else\\in@{overlay}{#1}\\fi"
                + "\\ifin@\\tikzset{external/export next=false}\\fi\\texsting@pic[#1]}}"
                + "}{}}\\makeatother";
    }
    static String safeJob(String name) {
        String s = name.replaceAll("[^A-Za-z0-9._-]", "_");
        return s.isEmpty() || s.startsWith("-") ? "doc" + s : s;
    }
    private static String secs(long ms) {
        return String.format(Locale.ROOT, "%.1f s", ms / 1000.0);
    }
    private static long readMs(File f) {
        try { return Long.parseLong(String.valueOf(readText(f)).trim()); } catch (Exception e) { return -1; }
    }
    private static void writeMs(File f, long ms) {
        try (OutputStream o = new FileOutputStream(f)) { o.write(String.valueOf(ms).getBytes(StandardCharsets.UTF_8)); } catch (IOException ignored) { }
    }
    private static File figStatus(File mainDir) { return new File(mainDir, FIG + ".txt"); }
    /** Primera línea del estado: «ok <clave>» o «no <clave>». La segunda, si no se pudo, dice por qué. */
    private static String figState(File mainDir) {
        String t = readText(figStatus(mainDir));
        return t == null ? "" : t.split("\n", 2)[0].trim();
    }
    private static String figReason(File mainDir) {
        String t = readText(figStatus(mainDir));
        String[] p = t == null ? new String[0] : t.split("\n", 2);
        return p.length > 1 ? p[1].trim() : "";
    }
    private static void setFigState(File mainDir, boolean ok, String key, String reason) {
        try (OutputStream o = new FileOutputStream(figStatus(mainDir))) {
            o.write(((ok ? "ok " : "no ") + key + (ok || reason == null || reason.isEmpty() ? "" : "\n" + reason)).getBytes(StandardCharsets.UTF_8));
        } catch (Exception ignored) { }
    }
    /** El primer error del log, en una línea (para explicar por qué algo no se pudo). */
    private static String firstError(String log) {
        if (log == null) return "";
        Matcher m = ERR.matcher(log);
        if (!m.find()) return "";
        int a = m.start(), b = log.indexOf('\n', a);
        String line = log.substring(a, b < 0 ? log.length() : b).trim();
        Matcher l = Pattern.compile("\\nl\\.(\\d+) ").matcher(log.substring(a, Math.min(log.length(), a + 3000)));
        if (line.startsWith("!") && l.find()) line += " (línea " + l.group(1) + ")";
        return line.length() > 200 ? line.substring(0, 200) + "…" : line;
    }
    private volatile String figFail = "";
    /** Algo quedó guardado en segundo plano (preámbulo o figuras): se avisa una sola vez al terminar. */
    private volatile boolean bgLogro = false;

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
        return key != null && ("ok " + key).equals(figState(mainDir))
                && new File(mainDir, job + ".figlist").exists() && !figList(mainDir, job).isEmpty() && staleFigs(mainDir, job).isEmpty();
    }

    private boolean makeFig(File mainDir, String job, String mainName, String fig) throws Exception {
        new File(mainDir, FIG).mkdirs();
        new File(mainDir, fig + ".pdf").delete();
        Run r = run(tex(engineOf(mainDir), null, "-interaction=batchmode",
                "-halt-on-error", "-jobname=" + fig, figInput(mainDir) + extraInject(mainDir) + "\\def\\tikzexternalrealjob{" + job + "}\\input{" + mainName + "}"),
                mainDir, 3 * 60 * 1000);
        if (engineOf(mainDir).equals("xelatex") && !r.timedOut && r.code == 0) xdvToPdf(mainDir, fig, null);
        // Si se cortó (llegó una compilación) o falló, el PDF puede quedar a medias: se borra.
        String lg = readText(new File(mainDir, fig + ".log"));
        boolean ok = !r.timedOut && r.code == 0 && new File(mainDir, fig + ".pdf").exists() && lg != null && lg.contains("Output written");
        if (!ok) {
            new File(mainDir, fig + ".pdf").delete();
            if (!r.timedOut) figFail = "error al dibujar una figura: " + firstError(lg);
        }
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

    // ── Todas las figuras en una sola pasada ──
    // Antes cada figura era una compilación aparte del documento entero (30 figuras = 30 compilaciones).
    // Ahora una sola compilación entrega cada figura que falta como una página de texsting-fig-lote.pdf,
    // y después cada página se copia a su archivo (pdfTeX en modo -ini, sin formato: centésimas de segundo).
    private static final String LOTE = FIG + "-lote";

    /** Se agrega a la orden: las figuras de la lista se «capturan» todas, cada una en su página. */
    private static String loteInject() {
        // Todo entre makeatletter y makeatother: los nombres con @ se leen al escribir el gancho.
        return "\\makeatletter\\newwrite\\texsting@mapa\\newbox\\texsting@arranque"
                + "\\AddToHook{begindocument/end}{\\IfPackageLoadedTF{tikz}{"
                + "\\global\\setbox\\texsting@arranque\\copy\\pgfexternal@startupbox"
                + "\\immediate\\openout\\texsting@mapa=\\pgfactualjobname.mapa\\relax"
                // TikZ captura solo la figura que se llama como el trabajo; aquí, todas las de la lista.
                + "\\def\\tikzifexternaljobnamematches#1#2#3{\\ifcsname texsting@hacer@#1\\endcsname#2\\else#3\\fi}"
                + "\\let\\texsting@grab\\pgf@external@grab"
                + "\\def\\pgf@external@grab#1{\\global\\setbox\\pgfexternal@startupbox\\copy\\texsting@arranque"
                + "\\immediate\\write\\texsting@mapa{#1}\\texsting@grab{#1}}"
                // XeLaTeX: el tamaño de cada página va aparte (si no, se acumulan y valen para todas).
                + "\\ifdefined\\XeTeXversion\\def\\pgfsys@prepare@papersize#1#2{\\global\\pdfpagewidth=#1\\relax\\global\\pdfpageheight=#2\\relax}\\fi"
                + "}{}}\\makeatother";
    }

    /** Copia la página n de lote.pdf como fig.pdf (con sus letras y recursos). */
    private boolean pageToPdf(File mainDir, String lote, int n, String fig) {
        try {
            File out = new File(mainDir, fig + ".pdf");
            out.delete();
            // En modo -ini { } no agrupan: se les da su significado primero. fig es relativo (texsting-fig/doc-figure3).
            Run r = run(Arrays.asList(pdftex().getAbsolutePath(), "-ini", "-interaction=batchmode", "-jobname=" + fig,
                    "\\catcode`\\{=1 \\catcode`\\}=2 \\pdfoutput=1 \\pdfcompresslevel=9 \\pdfobjcompresslevel=2 "
                    + "\\pdfximage page " + n + " {" + lote + "}"
                    + "\\setbox0\\hbox{\\pdfrefximage\\pdflastximage}\\pdfhorigin=0pt \\pdfvorigin=0pt "
                    + "\\pdfpagewidth=\\wd0 \\pdfpageheight=\\ht0 \\shipout\\box0 \\end"), mainDir, 60 * 1000);
            new File(mainDir, fig + ".log").delete();
            return !r.timedOut && r.code == 0 && out.exists() && out.length() > 0;
        } catch (Exception e) { return false; }
    }

    /** Dibuja las figuras en una sola compilación. false: no se pudo (se usa el método de una en una). */
    /**
     * Las figuras se reparten entre varias compilaciones a la vez (una por cada par de núcleos, hasta 3).
     * Cada una recorre el documento entero, pero solo dibuja su parte: con muchas figuras, el tiempo
     * de guardarlas baja casi a la mitad o a un tercio.
     */
    private boolean makeFigsLote(File mainDir, String job, String mainName, List<String> figs, int g, int normalErrors) {
        if (figs.isEmpty()) return true;
        int n = Math.max(1, Math.min(3, Runtime.getRuntime().availableProcessors() / 2));
        if (figs.size() < 8) n = 1;  // con pocas figuras no compensa recorrer el documento varias veces
        if (n == 1) return makeFigsLoteUno(mainDir, job, mainName, figs, g, normalErrors, LOTE, 3);
        List<List<String>> grupos = new ArrayList<>();
        for (int k = 0; k < n; k++) grupos.add(new ArrayList<>());
        for (int i = 0; i < figs.size(); i++) grupos.get(i % n).add(figs.get(i));
        final String tname = Thread.currentThread().getName() + "-lote";
        ExecutorService pool = Executors.newFixedThreadPool(n, x -> new Thread(x, tname));
        List<java.util.concurrent.Future<Boolean>> pend = new ArrayList<>();
        for (int k = 0; k < n; k++) {
            final List<String> grupo = grupos.get(k);
            final String nombre = LOTE + (k + 1);
            pend.add(pool.submit(() -> makeFigsLoteUno(mainDir, job, mainName, grupo, g, normalErrors, nombre, 1)));
        }
        boolean ok = true;
        for (java.util.concurrent.Future<Boolean> x : pend) try { ok &= x.get(); } catch (Exception e) { ok = false; }
        pool.shutdown();
        return ok && g == gen;
    }

    private boolean makeFigsLoteUno(File mainDir, String job, String mainName, List<String> figs, int g, int normalErrors, String lote, int hilos) {
        if (figs.isEmpty()) return true;
        try {
            new File(mainDir, FIG).mkdirs();
            String eng = engineOf(mainDir);
            StringBuilder defs = new StringBuilder();
            for (String f : figs) defs.append("\\expandafter\\def\\csname texsting@hacer@").append(f).append("\\endcsname{}\n");
            try (OutputStream o = new FileOutputStream(new File(mainDir, lote + "-lista.tex"))) { o.write(defs.toString().getBytes(StandardCharsets.UTF_8)); }
            for (String ext : new String[] { ".pdf", ".xdv", ".mapa", ".log" }) new File(mainDir, lote + ext).delete();
            Run r = run(tex(eng, null, "-interaction=nonstopmode", "-jobname=" + lote,
                    figInput(mainDir) + extraInject(mainDir) + "\\input{" + lote + "-lista.tex}" + loteInject()
                    + "\\def\\tikzexternalrealjob{" + job + "}\\input{" + mainName + "}"), mainDir, 10 * 60 * 1000);
            if (g != gen || r.timedOut) return false;
            String lg = readText(new File(mainDir, lote + ".log"));
            if (lg == null || countMatches(ERR, lg) > normalErrors) { figFail = "error al dibujar las figuras: " + firstError(lg); return false; }
            if (eng.equals("xelatex") && !xdvToPdf(mainDir, lote, null)) { figFail = "no se pudo armar el PDF de las figuras"; return false; }
            if (g != gen) return false;
            String mapa = readText(new File(mainDir, lote + ".mapa"));
            Matcher pm = Pattern.compile("Output written on [^(]*\\((\\d+) pages?").matcher(lg);
            if (mapa == null || !pm.find()) return false;
            List<String> names = new ArrayList<>();
            for (String l : mapa.split("\n")) if (!l.trim().isEmpty()) names.add(l.trim());
            // Cada figura capturada es una página; si no cuadra (algún paquete que saca páginas propias), no se arriesga.
            if (names.size() != Integer.parseInt(pm.group(1))) { figFail = "las figuras no salieron una por página"; return false; }
            // Si una figura se dibujó dos veces (p. ej. dentro de align), vale la última.
            Map<String, Integer> page = new LinkedHashMap<>();
            for (int i = 0; i < names.size(); i++) page.put(names.get(i), i + 1);
            for (String f : figs) if (!page.containsKey(f)) return false;
            int n = hilos;
            final String tname = Thread.currentThread().getName() + "-fig";
            ExecutorService pool = Executors.newFixedThreadPool(n, x -> new Thread(x, tname));
            final java.util.concurrent.atomic.AtomicBoolean fail = new java.util.concurrent.atomic.AtomicBoolean();
            List<java.util.concurrent.Future<?>> pend = new ArrayList<>();
            for (String f : figs) {
                final int pg = page.get(f);
                pend.add(pool.submit(() -> { if (!fail.get() && g == gen && !pageToPdf(mainDir, lote + ".pdf", pg, f)) fail.set(true); }));
            }
            for (java.util.concurrent.Future<?> x : pend) try { x.get(); } catch (Exception ignored) { }
            pool.shutdown();
            boolean ok = !fail.get() && g == gen;
            if (!ok) for (String f : figs) new File(mainDir, f + ".pdf").delete();
            return ok;
        } catch (Exception e) {
            return false;
        } finally {
            for (String ext : new String[] { ".pdf", ".xdv", ".synctex.gz" }) new File(mainDir, lote + ext).delete();
        }
    }

    /** Lote primero; si no se pudo, las que falten de una en una (como antes). */
    private boolean drawFigs(File mainDir, String job, String mainName, List<String> figs, int g, int normalErrors) {
        if (figs.isEmpty()) return true;
        if (makeFigsLote(mainDir, job, mainName, figs, g, normalErrors)) return true;
        if (g != gen) return false;
        return makeFigs(mainDir, job, mainName, staleFigs(mainDir, job), g);
    }

    private Run mainWithFigs(File mainDir, String job, String mainName) throws Exception {
        return mainWithFigs(mainDir, job, mainName, false);
    }
    /** Con el preámbulo guardado (pdfLaTeX) las figuras entran por texsting-ganchos.tex (ver buildPre). */
    private Run mainWithFigs(File mainDir, String job, String mainName, boolean pre) throws Exception {
        new File(mainDir, FIG).mkdirs();
        if (pre) {
            ganchos(mainDir, true);
            return run(tex("pdflatex", PRE, "-interaction=nonstopmode", "-file-line-error", "-synctex=1", "-recorder",
                    "-jobname=" + job, mainName), mainDir, 10 * 60 * 1000);
        }
        return run(tex(engineOf(mainDir), null, "-interaction=nonstopmode",
                "-file-line-error", "-synctex=1", "-recorder", "-jobname=" + job, figInput(mainDir) + extraInject(mainDir) + "\\input{" + mainName + "}"),
                mainDir, 10 * 60 * 1000);
    }

    /** En segundo plano: lista las figuras, dibuja cada una y comprueba que el resultado no tenga más errores. */
    /** Páginas que dice el log («Output written on x.pdf (12 pages»); -1 si no lo dice. */
    private static int pagesOf(String log) {
        if (log == null) return -1;
        Matcher m = Pattern.compile("Output written on [^(]*\\((\\d+) pages?").matcher(log);
        int n = -1;
        while (m.find()) n = Integer.parseInt(m.group(1));
        return n;
    }

    /**
     * Las compilaciones de fondo (con las figuras aún sin dibujar) reescriben el .aux y el índice con otros
     * números de página. Si llegaba una compilación antes de que terminaran, veía el índice cambiado y hacía
     * una segunda pasada completa (en Circuitos, +40 s). Por eso se guardan antes y se reponen al terminar
     * o al cortarse: la compilación espera a que el fondo suelte el candado, así que no se pisan.
     */
    private static Map<File, byte[]> snapshotAux(File mainDir, String job) {
        Map<File, byte[]> m = new LinkedHashMap<>();
        for (String ext : new String[] { ".toc", ".lof", ".lot", ".out", ".nav", ".snm" }) m.put(new File(mainDir, job + ext), readBytes(new File(mainDir, job + ext)));
        java.util.ArrayDeque<File> pend = new java.util.ArrayDeque<>();
        pend.add(mainDir);
        while (!pend.isEmpty()) {
            File[] fs = pend.poll().listFiles();
            if (fs == null) continue;
            for (File f : fs) {
                if (f.isDirectory()) { if (!f.getName().equals(FIG)) pend.add(f); }
                else if (f.getName().endsWith(".aux") && !f.getName().startsWith(FIG)) m.put(f, readBytes(f));
            }
        }
        m.putIfAbsent(new File(mainDir, job + ".aux"), null);
        return m;
    }
    private static void restoreAux(Map<File, byte[]> snap) {
        for (Map.Entry<File, byte[]> e : snap.entrySet()) {
            try {
                if (e.getValue() == null) e.getKey().delete();
                else try (OutputStream o = new FileOutputStream(e.getKey())) { o.write(e.getValue()); }
            } catch (Exception ignored) { }
        }
    }

    private void buildFigs(File mainDir, String job, String mainName, int normalErrors, int normalPages, String key) throws Exception {
        Map<File, byte[]> snap = snapshotAux(mainDir, job);
        try { buildFigsDentro(mainDir, job, mainName, normalErrors, normalPages, key); }
        finally { restoreAux(snap); }
    }

    private void buildFigsDentro(File mainDir, String job, String mainName, int normalErrors, int normalPages, String key) throws Exception {
        final int g = gen;
        // Si se armaron con otro preámbulo u otros datos, se empieza de cero. Si solo se interrumpió
        // (llegó una compilación), se sigue donde quedó.
        String st = figState(mainDir);
        if (readText(figStatus(mainDir)) != null && !st.endsWith(" " + key)) { delete(new File(mainDir, FIG)); figStatus(mainDir).delete(); }
        figFail = "";
        double P = pasadaMs / 1000.0;
        fondoPaso("Guardando figuras", 0, 15, P * 0.35);
        Run r = mainWithFigs(mainDir, job, mainName);
        if (g != gen || r.timedOut) return;
        // Si con figuras guardadas el documento ya da más errores (p. ej. karnaugh-map o tikz-timing, que no se
        // pueden guardar aparte), se anota y no se vuelve a intentar con este preámbulo.
        String lg0 = readText(new File(mainDir, job + ".log"));
        if (lg0 == null || countMatches(ERR, lg0) > normalErrors) {
            setFigState(mainDir, false, key, "con las figuras aparte, el documento da un error: " + firstError(lg0));
            return;
        }
        if (figList(mainDir, job).isEmpty()) return;
        List<String> porDibujar = staleFigs(mainDir, job);
        int par = porDibujar.size() >= 8 ? Math.max(1, Math.min(3, Runtime.getRuntime().availableProcessors() / 2)) : 1;
        fondoPaso("Guardando figuras", 15, 88, P * 1.15 / par + porDibujar.size() * 0.05);
        if (!drawFigs(mainDir, job, mainName, porDibujar, g, normalErrors)) {
            if (g != gen) return;
            setFigState(mainDir, false, key, figFail.isEmpty() ? "no se pudieron dibujar las figuras" : figFail);
            return;
        }
        long t = System.currentTimeMillis();
        fondoPaso("Guardando figuras", 88, 100, P * 0.35);
        r = mainWithFigs(mainDir, job, mainName);
        if (g != gen || r.timedOut) return;
        writeMs(new File(mainDir, FIG + "-ms.txt"), System.currentTimeMillis() - t);
        String lg = readText(new File(mainDir, job + ".log"));
        int pg = pagesOf(lg);
        // Si con las figuras guardadas cambia el número de páginas, algo no salió igual (p. ej. un dibujo sobre
        // la página que no se reconoció): mejor compilar como siempre.
        boolean samePages = normalPages < 0 || pg == normalPages;
        boolean ok = lg != null && countMatches(ERR, lg) <= normalErrors && staleFigs(mainDir, job).isEmpty() && samePages;
        setFigState(mainDir, ok, key, lg != null && countMatches(ERR, lg) > normalErrors
                ? "con las figuras guardadas, el documento da un error: " + firstError(lg)
                : !samePages ? "con las figuras guardadas el documento cambia de " + normalPages + " a " + pg + " páginas"
                : "algunas figuras no quedaron guardadas");
        if (ok) bgLogro = true;
    }

    /** Aviso para la app cuando termina algo en segundo plano. */
    private void aviso(String text) {
        JSObject d = new JSObject();
        d.put("texto", text);
        notifyListeners("fondo", d);
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
            File mk = new File(libDir(), "libtx_makeindex.so");
            if (mk.exists()) {
                // Índices alfabéticos: el del documento y los de imakeidx (\makeindex[name=autores] → autores.idx).
                File[] idxs = mainDir.listFiles((d, n) -> n.endsWith(".idx") && !n.startsWith("texsting-"));
                if (idxs != null) for (File idx : idxs) {
                    String stem = idx.getName().substring(0, idx.getName().length() - 4);
                    ran |= makeindex(mk, mainDir, idx.getName(), stem + ".ind", null, null, stem + ".texsting-idx", "Armando el índice alfabético…", output);
                }
                // Nomenclatura (nomencl): main.nlo → main.nls con el estilo nomencl.ist.
                if (new File(mainDir, job + ".nlo").exists())
                    ran |= makeindex(mk, mainDir, job + ".nlo", job + ".nls", "nomencl.ist", null, job + ".texsting-nls", "Armando la nomenclatura…", output);
                // Glosarios y siglas (glossaries), como makeglossaries: cada \@newglossary del .aux es un makeindex.
                String auxG = String.valueOf(readText(new File(mainDir, job + ".aux")));
                Matcher ist = Pattern.compile("\\\\@istfilename\\{([^}]+)\\}").matcher(auxG);
                if (ist.find()) {
                    String estilo = ist.group(1).trim();
                    boolean letra = auxG.contains("\\@glsorder{letter}");
                    Matcher g = Pattern.compile("\\\\@newglossary\\{([^}]*)\\}\\{([^}]*)\\}\\{([^}]*)\\}\\{([^}]*)\\}").matcher(auxG);
                    while (g.find()) {
                        String in = job + "." + g.group(4), out = job + "." + g.group(3), log = job + "." + g.group(2);
                        if (!new File(mainDir, in).exists()) continue;
                        if (estilo.endsWith(".xdy")) {
                            output.append("\n[TeXsting] El glosario usa xindy, que el motor integrado no trae: usa \\usepackage[...]{glossaries} sin la opción xindy.\n");
                            continue;
                        }
                        ran |= makeindex(mk, mainDir, in, out, estilo, log, job + ".texsting-" + g.group(1), "Armando el glosario…", output, letra);
                    }
                }
            }
            // biblatex con biber (lo normal en biblatex): como latexmk, se corre si cambió el .bcf o algún .bib.
            File bcf = new File(mainDir, job + ".bcf");
            if (bcf.exists() && hayBiber()) {
                String b = String.valueOf(readText(bcf));
                StringBuilder k = new StringBuilder(b);
                Matcher m = Pattern.compile("<bcf:datasource[^>]*>([^<]+)</bcf:datasource>").matcher(b);
                while (m.find()) { String t = readText(new File(mainDir, m.group(1).trim())); if (t != null) k.append('\u0000').append(t); }
                String key = sha1(k.toString());
                File stamp = new File(mainDir, job + ".texsting-biber");
                if (!key.equals(String.valueOf(readText(stamp)).trim()) || !new File(mainDir, job + ".bbl").exists()) {
                    preparePerl();
                    progress("Armando la bibliografía (biber)…");
                    Run br = run(Arrays.asList(new File(libDir(), "libtx_perl.so").getAbsolutePath(), new File(perlDir(), "biber").getAbsolutePath(), job), mainDir, 3 * 60 * 1000);
                    output.append(br.out);
                    if (br.code == 0) try (OutputStream o = new FileOutputStream(stamp)) { o.write(key.getBytes(StandardCharsets.UTF_8)); }
                    ran = true;
                }
            } else if (bcf.exists() && output.indexOf("biber: command not found") < 0)
                output.append("\nbiber: command not found (este APK no trae biber; usa \\usepackage[backend=bibtex]{biblatex})\n");
        } catch (Exception e) {
            output.append("\n[TeXsting] BibTeX/makeindex: ").append(e.getMessage()).append('\n');
        }
        return ran;
    }

    private boolean makeindex(File mk, File dir, String in, String out, String estilo, String log, String stampName, String aviso, StringBuilder output) throws Exception {
        return makeindex(mk, dir, in, out, estilo, log, stampName, aviso, output, false);
    }

    /** makeindex como latexmk: solo si cambió la entrada (o falta la salida). */
    private boolean makeindex(File mk, File dir, String in, String out, String estilo, String log, String stampName, String aviso, StringBuilder output, boolean letra) throws Exception {
        String key = sha1(String.valueOf(readText(new File(dir, in))) + "\u0000" + estilo);
        File stamp = new File(dir, stampName);
        if (key.equals(String.valueOf(readText(stamp)).trim()) && new File(dir, out).exists()) return false;
        progress(aviso);
        List<String> cmd = new ArrayList<>(Arrays.asList(mk.getAbsolutePath()));
        if (letra) cmd.add("-l");
        if (estilo != null) { cmd.add("-s"); cmd.add(estilo); }
        if (log != null) { cmd.add("-t"); cmd.add(log); }
        cmd.add("-o"); cmd.add(out); cmd.add(in);
        output.append(run(cmd, dir, 60 * 1000).out);
        try (OutputStream o = new FileOutputStream(stamp)) { o.write(key.getBytes(StandardCharsets.UTF_8)); }
        return true;
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
                String want = call.getString("engine", "pdflatex");
                String eng = "lualatex".equals(want) && luatex().exists() ? "lualatex"
                        : "xelatex".equals(want) && xetex().exists() && xdvipdfmx().exists() ? "xelatex" : "pdflatex";
                long tf = System.currentTimeMillis();
                if (eng.equals("lualatex")) prepareLua();
                if (eng.equals("xelatex")) prepareXe();
                long formatoMs = System.currentTimeMillis() - tf;
                try (OutputStream o = new FileOutputStream(new File(mainDir, "texsting-motor.txt"))) { o.write(eng.getBytes(StandardCharsets.UTF_8)); }
                // biblatex usa biber por defecto, y biber no viene en el motor: se le pide BibTeX, que sí viene.
                boolean biblatex = false;
                Pattern bl = Pattern.compile("(?m)^[^%\\n]*\\\\(?:usepackage|RequirePackage)\\s*(?:\\[[^\\]]*\\])?\\s*\\{[^}]*\\bbiblatex\\b");
                for (int i = 0; files != null && i < files.length() && !biblatex; i++) {
                    JSONObject f = files.getJSONObject(i);
                    if (f.getString("path").endsWith(".tex") && f.has("text") && bl.matcher(f.optString("text", "")).find()) biblatex = true;
                }
                try (OutputStream o = new FileOutputStream(new File(mainDir, "texsting-inyectar.txt"))) {
                    // Con biber en el APK, biblatex queda como en Overleaf (biber); sin biber, se le pide BibTeX.
                    o.write((biblatex && !hayBiber() ? "\\PassOptionsToPackage{backend=bibtex}{biblatex}" : "").getBytes(StandardCharsets.UTF_8));
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
                    // «figuras-2»: con el método por lote se vuelve a intentar lo que antes no se pudo.
                    StringBuilder fk = new StringBuilder("figuras-3\u0000").append(figBase).append('\u0000').append(eng);
                    for (int i = 0; files != null && i < files.length(); i++) {
                        JSONObject f = files.getJSONObject(i);
                        String pth = f.getString("path");
                        if (pth.endsWith(".tex")) continue;
                        fk.append('\u0000').append(pth).append('\u0000').append(f.has("text") ? f.optString("text", "") : f.optString("base64", ""));
                    }
                    figKey = sha1(fk.toString());
                }
                String preKey = usePreSetting ? preKeyOf(docKey) : null;
                String preInfo = String.valueOf(readText(new File(mainDir, PRE + ".txt"))).trim();
                boolean usePre = preKey != null && new File(mainDir, PRE + ".fmt").exists()
                        && (preInfo.equals("ok " + preKey) || preInfo.equals("verificado " + preKey));
                boolean useFigs = autoinstall && figsReady(mainDir, job, figKey);
                // Con las dos cosas listas, se usa la que dio la compilación más rápida en este proyecto.
                // Preámbulo guardado y figuras guardadas se usan juntos (las figuras entran por texsting-ganchos.tex).
                if (usePre && !useFigs) ganchos(mainDir, false);
                long firstRunMs = -1;
                boolean usedPre = usePre, usedFigs = useFigs;
                // Para el «Log completo»: cuánto tomó cada paso, y así saber qué conviene acelerar.
                List<String> pasos = new ArrayList<>();
                while (true) {
                    // Como latexmk: se repite mientras cambien los archivos auxiliares (índice, referencias), hasta 4 veces.
                    int p = 0;
                    while (p < 4) {
                        String before = digest(dir, stem);
                        // Tras bajar paquetes la pasada se repite por eso, no por el índice: el texto lo dice.
                        paso((passes == 0 ? "Pasada 1" : "Pasada " + (passes + 1) + (rounds > 0 && p == 0 ? " (con los paquetes nuevos)" : " (índice y referencias)")) + (useFigs || usePre ? " ⚡" : ""));
                        long tRun = System.currentTimeMillis();
                        r = useFigs ? mainWithFigs(mainDir, job, mainName, usePre)
                                : run(tex(eng, usePre ? PRE : null,
                                "-interaction=nonstopmode", "-file-line-error", "-synctex=1", "-recorder", "-jobname=" + job, mainArg(mainDir, mainName)),
                                mainDir, 10 * 60 * 1000);
                        if (firstRunMs < 0) firstRunMs = System.currentTimeMillis() - tRun;
                        if (!useFigs && !usePre) pasadaMs = System.currentTimeMillis() - tRun;
                        p++; passes++;
                        pasos.add("pasada " + passes + (useFigs && usePre ? " (preámbulo y figuras guardados)" : useFigs ? " (figuras guardadas)" : usePre ? " (preámbulo guardado)" : "") + ": " + secs(System.currentTimeMillis() - tRun));
                        output.append(r.out);
                        if (r.timedOut) { timedOut = true; break; }
                        String lg = readText(new File(dir, stem + ".log"));
                        // Se corta para buscar paquetes solo si de verdad falta algo: fontspec/polyglossia escriben
                        // «not found» en mensajes informativos, y eso dejaba a XeLaTeX con una sola pasada.
                        if (lg != null && (lg.contains("Emergency stop") || lg.contains("not loadable") || lg.contains("cannot open")
                                || !findMissing(lg).isEmpty() || !fontRequests(lg).isEmpty())) break;
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
                        String pkg = pkgOf(m);
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
                        long tFig = System.currentTimeMillis();
                        boolean ok = drawFigs(mainDir, job, mainName, stale, gen, countMatches(ERR, lgf));
                        pasos.add("dibujar " + stale.size() + (stale.size() == 1 ? " figura: " : " figuras: ") + secs(System.currentTimeMillis() - tFig));
                        if (ok) { long tp = System.currentTimeMillis(); r = mainWithFigs(mainDir, job, mainName, usePre); passes++; pasos.add("pasada " + passes + ": " + secs(System.currentTimeMillis() - tp)); }
                        else {
                            // Esta figura no se puede guardar aparte: el proyecto vuelve a compilar como siempre.
                            setFigState(mainDir, false, figKey, figFail.isEmpty() ? "no se pudo dibujar una figura que cambió" : figFail);
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
                    usedFigs = false;  // este PDF salió de la compilación normal
                    log = normal == null ? "" : normal;
                }
                if (eng.equals("xelatex") && !timedOut) {
                    paso("Armando el PDF");
                    long tx = System.currentTimeMillis();
                    StringBuilder xo = new StringBuilder();
                    if (!xdvToPdf(dir, stem, xo) && autoinstall) {
                        // «Could not locate a virtual/physical font for TFM "esint10"»: es una letra Type 1 que no
                        // está en pdftex.map (como el «Font esint10 at 657 not found» de pdfLaTeX).
                        Matcher fm = Pattern.compile("font for TFM \"([A-Za-z0-9_\\-]+)\"").matcher(xo);
                        List<String> pfbs = new ArrayList<>();
                        while (fm.find()) if (!pfbs.contains(fm.group(1) + ".pfb")) pfbs.add(fm.group(1) + ".pfb");
                        boolean got = false;
                        if (!pfbs.isEmpty()) {
                            loadIndex();
                            Set<String> have = installedPkgs();
                            for (String w : pfbs) {
                                String pkg = index.get(w);
                                if (pkg == null || have.contains(pkg) || installedNow.contains(pkg)) continue;
                                for (String q : withDeps(pkg, have, installedNow)) {
                                    try { install(q); installedNow.add(q); got = true; }
                                    catch (Exception e) { xo.append("\n[TeXsting] No se pudo descargar ").append(q).append(": ").append(e.getMessage()).append('\n'); }
                                }
                            }
                        }
                        if (got) { progress("Armando el PDF con las letras nuevas…"); xo.setLength(0); xdvToPdf(dir, stem, xo); }
                    }
                    output.append(xo);
                    pasos.add("armar el PDF (xdvipdfmx): " + secs(System.currentTimeMillis() - tx));
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
                res.put("formatoMs", formatoMs);
                res.put("texMs", t2 - t1);
                res.put("preparacion", prep);
                if (firstRunMs > 0 && rounds == 0 && (usedPre || usedFigs)) writeMs(new File(mainDir, (usedFigs ? FIG : PRE) + "-ms.txt"), firstRunMs);
                res.put("preambuloGuardado", usedPre || usedFigs);
                res.put("figurasGuardadas", usedFigs);
                // Qué se hará después de responder (para el resumen).
                String keyNow = usePreSetting ? preKeyOf(preambleKey(files, main)) : null;
                String infoNow = String.valueOf(readText(new File(mainDir, PRE + ".txt"))).trim();
                boolean bgPre = keyNow != null && pdfBytes != null && !timedOut && !infoNow.endsWith(" " + keyNow);
                // Si el documento usa TikZ/pgfplots, se guardan sus figuras ya dibujadas para las próximas veces.
                String figSt = figState(mainDir);
                boolean usesTikz = log.contains("/tikz.sty") || log.contains("pgfplots.sty") || new File(mainDir, job + ".figlist").exists();
                boolean bgFigs = autoinstall && !usedFigs && usesTikz && figKey != null && pdfBytes != null && !timedOut
                        && !figSt.equals("no " + figKey) && !figsReady(mainDir, job, figKey);
                StringBuilder rs = new StringBuilder("[TeXsting] Tiempos (").append(eng.equals("xelatex") ? "XeLaTeX" : eng.equals("lualatex") ? "LuaLaTeX" : "pdfLaTeX")
                        .append(", ").append(secs(t2 - t0)).append(" en total):\n");
                if (t1 - t0 >= 500) rs.append("  preparar el motor: ").append(secs(t1 - t0)).append('\n');
                if (formatoMs >= 500) rs.append("  preparar ").append(eng.equals("xelatex") ? "XeLaTeX" : "LuaLaTeX").append(" (solo la primera vez): ").append(secs(formatoMs)).append('\n');
                if (!installedNow.isEmpty()) rs.append("  paquetes descargados: ").append(String.join(", ", installedNow)).append('\n');
                if (biblatex) rs.append("  biblatex: ").append(hayBiber() ? "con biber" : "con BibTeX (este APK no trae biber)").append('\n');
                for (String ps : pasos) rs.append("  ").append(ps).append('\n');
                if (usesTikz) {
                    int nf = figList(mainDir, job).size();
                    rs.append("  figuras TikZ: ").append(usedFigs ? "se usaron las guardadas" + (nf > 0 ? " (" + nf + ")" : "")
                            : figSt.equals("no " + figKey) ? "no se pueden guardar aparte, se dibujan en cada compilación"
                                + (figReason(mainDir).isEmpty() ? "" : "\n    motivo: " + figReason(mainDir))
                            : bgFigs ? "se están guardando en segundo plano para la próxima compilación"
                            : "se dibujan en cada compilación").append('\n');
                }
                if (eng.equals("pdflatex")) rs.append("  preámbulo guardado: ").append(usedPre ? "sí" : bgPre ? "se está armando para la próxima compilación" : "no").append('\n');
                if (eng.equals("xelatex")) {
                    File[] fc = new File(var(), "fontconfig").listFiles();
                    rs.append("  caché de fuentes del sistema: ").append(fc == null || fc.length == 0 ? "vacía" : fc.length + " archivos").append('\n');
                }
                res.put("resumen", rs.toString());
                call.resolve(res);
                // Después de responder: si el preámbulo cambió, se arma el nuevo para la próxima compilación.
                final File md = mainDir; final String mn = mainName; final String jb = job;
                if (bgPre) {
                    final String kn = keyNow;
                    background(() -> buildPre(md, mn, kn));
                }
                if (bgFigs) {
                    final int nErr = countMatches(ERR, log);
                    final int nPag = pagesOf(log);
                    final String dk = figKey;
                    background(() -> { try { buildFigs(md, jb, mn, nErr, nPag, dk); } catch (Exception ignored) { } });
                }
                if (bgPre || bgFigs) {
                    bgLogro = false;
                    fondoEstado(true, bgFigs ? "Guardando figuras para la próxima compilación…" : "Guardando el preámbulo para la próxima compilación…");
                    background(() -> {
                        fondoEstado(false, "");
                        if (bgLogro) aviso("Listo en segundo plano: la próxima compilación será más rápida ⚡");
                        bgLogro = false;
                    });
                }
            } catch (Exception e) {
                call.reject(String.valueOf(e.getMessage()));
            }
        }
    }
}
