// Ajusta el proyecto Android que genera Capacitor (npx cap add android):
// - permite tráfico http solo hacia el servidor local de Termux (127.0.0.1)
// - declara que la app puede abrir Termux (visibilidad de paquetes, Android 11+)
// - el teclado redimensiona la pantalla (la barra de teclas LaTeX queda visible)
// - número de versión desde la compilación de GitHub Actions
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const app = path.join(root, 'android', 'app');
const manifestPath = path.join(app, 'src', 'main', 'AndroidManifest.xml');
if (!existsSync(manifestPath)) {
  console.error('No existe android/. Ejecuta primero: npx cap add android');
  process.exit(1);
}

const xmlDir = path.join(app, 'src', 'main', 'res', 'xml');
mkdirSync(xmlDir, { recursive: true });
writeFileSync(path.join(xmlDir, 'network_security_config.xml'), `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="false">127.0.0.1</domain>
        <domain includeSubdomains="false">localhost</domain>
    </domain-config>
</network-security-config>
`);

let m = readFileSync(manifestPath, 'utf8');
if (!m.includes('networkSecurityConfig')) {
  m = m.replace('<application', '<application\n        android:networkSecurityConfig="@xml/network_security_config"');
}
if (!m.includes('com.termux')) {
  m = m.replace('</manifest>', '    <queries>\n        <package android:name="com.termux" />\n    </queries>\n</manifest>');
}
if (!m.includes('hasFragileUserData')) {
  m = m.replace('<application', '<application\n        android:hasFragileUserData="true"');
}
if (!m.includes('windowSoftInputMode')) {
  m = m.replace(/<activity(\s)/, '<activity\n            android:windowSoftInputMode="adjustResize"$1');
}
// «Abrir con → TeXsting» para archivos LaTeX (.tex, .ltx, .bib, .sty, .cls).
// Cada app que comparte un archivo puede declarar un tipo distinto, así que se aceptan
// los tipos LaTeX, texto plano y «desconocido»; la app revisa la extensión al abrirlo.
if (!m.includes('text/x-tex')) {
  const mimes = ['text/x-tex', 'application/x-tex', 'text/x-latex', 'application/x-latex', 'text/x-bibtex',
    'application/x-bibtex', 'text/plain', 'application/octet-stream'];
  const filter = `
            <intent-filter android:label="TeXsting">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <data android:scheme="content" />
                <data android:scheme="file" />
${mimes.map((t) => `                <data android:mimeType="${t}" />`).join('\n')}
            </intent-filter>`;
  m = m.replace('</intent-filter>', '</intent-filter>' + filter);
}
writeFileSync(manifestPath, m);

// Complemento nativo «OpenedFile»: nombre real y tamaño de un archivo recibido con «Abrir con»
// (muchas apps mandan una dirección content:// que no incluye el nombre).
const javaDir = path.join(app, 'src', 'main', 'java', 'io', 'github', 'texsting');
mkdirSync(javaDir, { recursive: true });
writeFileSync(path.join(javaDir, 'OpenedFilePlugin.java'), `package io.github.texsting;

import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "OpenedFile")
public class OpenedFilePlugin extends Plugin {
    @PluginMethod
    public void info(PluginCall call) {
        String url = call.getString("url");
        if (url == null) { call.reject("sin url"); return; }
        JSObject ret = new JSObject();
        try {
            Uri uri = Uri.parse(url);
            if ("file".equals(uri.getScheme())) {
                ret.put("name", uri.getLastPathSegment());
            } else {
                try (Cursor c = getContext().getContentResolver().query(uri, null, null, null, null)) {
                    if (c != null && c.moveToFirst()) {
                        int i = c.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                        if (i >= 0 && !c.isNull(i)) ret.put("name", c.getString(i));
                        int j = c.getColumnIndex(OpenableColumns.SIZE);
                        if (j >= 0 && !c.isNull(j)) ret.put("size", c.getLong(j));
                    }
                }
                ret.put("mime", getContext().getContentResolver().getType(uri));
            }
            call.resolve(ret);
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()));
        }
    }
}
`);
// Complemento nativo «Motor»: compila con pdfLaTeX dentro de la app, sin Termux (#1, experimental).
// Los programas vienen en jniLibs (tools/motor/empaquetar.py) y los datos de TeX en assets/motor/tl.zip.
writeFileSync(path.join(javaDir, 'MotorPlugin.java'), `package io.github.texsting;

import android.util.Base64;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.*;
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
                for (int i = 0; files != null && i < files.length(); i++) {
                    JSONObject f = files.getJSONObject(i);
                    File out = new File(dir, f.getString("path"));
                    if (!out.getCanonicalPath().startsWith(rootPath + File.separator)) continue;
                    out.getParentFile().mkdirs();
                    byte[] data = f.has("base64") ? Base64.decode(f.getString("base64"), Base64.DEFAULT)
                            : f.optString("text", "").getBytes(StandardCharsets.UTF_8);
                    try (OutputStream o = new FileOutputStream(out)) { o.write(data); }
                }
                String stem = main.replaceAll("\\\\.tex$", "");
                File pdf = new File(dir, stem + ".pdf");
                pdf.delete();
                File mainDir = new File(dir, main).getParentFile();
                String mainName = new File(main).getName();
                StringBuilder output = new StringBuilder();
                Run r = null;
                int passes = 0;
                boolean timedOut = false;
                // Como latexmk: se repite mientras cambien los archivos auxiliares (índice, referencias), hasta 4 veces.
                while (passes < 4) {
                    String before = digest(dir, stem);
                    r = run(Arrays.asList(pdftex().getAbsolutePath(), "-progname=pdflatex", "-fmt=pdflatex",
                            "-interaction=nonstopmode", "-file-line-error", "-synctex=1", "-recorder", mainName),
                            mainDir, 10 * 60 * 1000);
                    passes++;
                    output.append(r.out);
                    if (r.timedOut) { timedOut = true; break; }
                    String log = readText(new File(dir, stem + ".log"));
                    if (log != null && log.contains("Emergency stop")) break;
                    boolean rerunMsg = log != null && (log.contains("Rerun to get") || log.contains("Label(s) may have changed"));
                    if (!rerunMsg && before.equals(digest(dir, stem))) break;
                }
                String log = readText(new File(dir, stem + ".log"));
                if (log == null) log = "";
                byte[] pdfBytes = readBytes(pdf);
                boolean hasErrors = java.util.regex.Pattern.compile("^(! |.*:\\\\d+: )", java.util.regex.Pattern.MULTILINE).matcher(log).find();
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
                res.put("installed", new JSArray());
                res.put("missing", new JSArray());
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
`);
writeFileSync(path.join(javaDir, 'MainActivity.java'), `package io.github.texsting;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(OpenedFilePlugin.class);
        registerPlugin(MotorPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
`);

const gradlePath = path.join(app, 'build.gradle');
let g = readFileSync(gradlePath, 'utf8');
// Firma fija: sin esto cada compilación usa una llave nueva y Android no deja actualizar encima.
if (!g.includes('signingConfigs.texsting')) {
  g = g.replace(/android\s*\{/, `android {
    signingConfigs {
        texsting {
            storeFile file("\${rootDir}/../android-config/debug.keystore")
            storePassword "android"
            keyAlias "androiddebugkey"
            keyPassword "android"
        }
    }`);
  if (/buildTypes\s*\{/.test(g)) {
    g = g.replace(/buildTypes\s*\{/, `buildTypes {
        debug {
            signingConfig signingConfigs.texsting
        }`);
  } else {
    g = g.replace(/android \{/, 'android {\n    buildTypes { debug { signingConfig signingConfigs.texsting } }');
  }
}
// Los programas del motor integrado deben quedar como archivos reales en nativeLibraryDir
// (desde Android 10 una app solo puede ejecutar programas que estén ahí).
if (!g.includes('useLegacyPackaging')) {
  g = g.replace(/android\s*\{/, `android {
    packagingOptions {
        jniLibs { useLegacyPackaging true }
        doNotStrip '**/libtx_*.so'
        doNotStrip '**/libc++_shared.so'
        doNotStrip '**/libkpathsea.so'
        doNotStrip '**/libpng16.so'
        doNotStrip '**/libandroid-*.so'
    }
    aaptOptions { noCompress 'zip' }`);
}
const build = parseInt(process.env.BUILD_NUMBER || '1', 10);
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
g = g.replace(/versionCode \d+/, `versionCode ${build}`).replace(/versionName "[^"]*"/, `versionName "${pkg.version}.${build}"`);
writeFileSync(gradlePath, g);

console.log(`Android ajustado (versión ${pkg.version}.${build}).`);
