// Ajusta el proyecto Android que genera Capacitor (npx cap add android):
// - permite tráfico http solo hacia el servidor local de Termux (127.0.0.1)
// - declara que la app puede abrir Termux (visibilidad de paquetes, Android 11+)
// - el teclado redimensiona la pantalla (la barra de teclas LaTeX queda visible)
// - número de versión desde la compilación de GitHub Actions
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';
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
// El paquete Java es el identificador de la app (capacitor.config.json → appId): io.github.p3dr1t0.texsting.
const APP_ID = JSON.parse(readFileSync(path.join(root, 'capacitor.config.json'), 'utf8')).appId;
const javaDir = path.join(app, 'src', 'main', 'java', ...APP_ID.split('.'));
const conPaquete = (archivo) => readFileSync(archivo, 'utf8').replace(/^package [\w.]+;/m, `package ${APP_ID};`);
mkdirSync(javaDir, { recursive: true });
writeFileSync(path.join(javaDir, 'OpenedFilePlugin.java'), `package ${APP_ID};

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
                        // Dónde está (para reconocer un archivo de Documentos/Projects_LaTeX): MediaStore da
                        // relative_path («Documents/Projects_LaTeX/Tarea/») y algunas apps de archivos dan _data.
                        for (String col : new String[] { "relative_path", "_data" }) {
                            int k = c.getColumnIndex(col);
                            if (k >= 0 && !c.isNull(k)) { try { String v = c.getString(k); if (v != null && !v.isEmpty()) { ret.put("ruta", v); break; } } catch (Exception ignored) { } }
                        }
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
writeFileSync(path.join(javaDir, 'MotorPlugin.java'), conPaquete(path.join(root, 'android-config', 'java', 'MotorPlugin.java')));
// Complemento nativo «Carpetas»: carpeta propia Documentos/Projects_LaTeX y carpetas de proyectos existentes (#4, #7).
writeFileSync(path.join(javaDir, 'CarpetasPlugin.java'), conPaquete(path.join(root, 'android-config', 'java', 'CarpetasPlugin.java')));
// Complemento nativo «Donaciones»: 1, 3 y 5 USD con Google Play (no desbloquean nada).
writeFileSync(path.join(javaDir, 'DonacionesPlugin.java'), conPaquete(path.join(root, 'android-config', 'java', 'DonacionesPlugin.java')));
writeFileSync(path.join(javaDir, 'MainActivity.java'), `package ${APP_ID};

import android.content.res.Configuration;
import android.os.Bundle;
import android.view.ViewGroup;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(OpenedFilePlugin.class);
        registerPlugin(MotorPlugin.class);
        registerPlugin(CarpetasPlugin.class);
        registerPlugin(DonacionesPlugin.class);
        super.onCreate(savedInstanceState);
        // Desde Android 15 (targetSdk 35+) la app va de borde a borde y «adjustResize» ya no achica la pantalla
        // cuando sale el teclado: el teclado tapaba la barra de teclas LaTeX. Aquí la vista web deja como margen
        // las barras del sistema y, abajo, lo que sea mayor: la barra de gestos o el teclado.
        WebView wv = getBridge() != null ? getBridge().getWebView() : null;
        if (wv == null) return;
        ViewCompat.setOnApplyWindowInsetsListener(wv, (v, ins) -> {
            Insets bars = ins.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            Insets ime = ins.getInsets(WindowInsetsCompat.Type.ime());
            int abajo = Math.max(bars.bottom, ime.bottom);
            ViewGroup.MarginLayoutParams mlp = (ViewGroup.MarginLayoutParams) v.getLayoutParams();
            if (mlp.leftMargin != bars.left || mlp.topMargin != bars.top || mlp.rightMargin != bars.right || mlp.bottomMargin != abajo) {
                mlp.leftMargin = bars.left;
                mlp.topMargin = bars.top;
                mlp.rightMargin = bars.right;
                mlp.bottomMargin = abajo;
                v.setLayoutParams(mlp);
            }
            return WindowInsetsCompat.CONSUMED;
        });
        ViewCompat.requestApplyInsets(wv);
        barraDeEstado(getResources().getConfiguration());
    }

    @Override
    public void onConfigurationChanged(Configuration c) {
        super.onConfigurationChanged(c);
        barraDeEstado(c);
    }

    /** Celular en horizontal: sin barra de estado (se ve deslizando desde arriba), para ganar alto con el teclado.
     *  En la tablet (o en vertical) se deja como siempre. */
    private void barraDeEstado(Configuration c) {
        WindowInsetsControllerCompat w = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (c.orientation == Configuration.ORIENTATION_LANDSCAPE && c.smallestScreenWidthDp < 600) {
            w.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            w.hide(WindowInsetsCompat.Type.statusBars());
        } else {
            w.show(WindowInsetsCompat.Type.statusBars());
        }
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
    aaptOptions { noCompress 'zip' }
    lint { checkReleaseBuilds false; abortOnError false }`);
}
// Para descomprimir los paquetes de CTAN (.tar.xz) que el motor integrado baja al vuelo.
if (!g.includes('org.tukaani:xz')) {
  g = g.replace(/dependencies\s*\{/, "dependencies {\n    implementation 'org.tukaani:xz:1.9'");
}
// Google Play Billing (donaciones).
if (!g.includes('com.android.billingclient:billing')) {
  g = g.replace(/dependencies\s*\{/, "dependencies {\n    implementation 'com.android.billingclient:billing:8.3.0'");
}
// Versión final (la que va a Google Play): firmada con la llave de subida, que llega descifrada en
// TEXSTING_KEYSTORE (ver .github/workflows/apk.yml). Sin ella, solo se arma la versión de prueba (debug).
if (process.env.TEXSTING_KEYSTORE && !g.includes('signingConfigs.subida')) {
  g = g.replace(/signingConfigs\s*\{/, `signingConfigs {
        subida {
            storeFile file(System.getenv("TEXSTING_KEYSTORE"))
            storePassword System.getenv("TEXSTING_KEYSTORE_PASS")
            keyAlias "texsting"
            keyPassword System.getenv("TEXSTING_KEYSTORE_PASS")
        }`);
  g = g.replace(/release\s*\{/, `release {
            signingConfig signingConfigs.subida`);
}

// Google Play exige apuntar a Android 16 (API 36) desde el 31 de agosto de 2026.
const varsPath = path.join(root, 'android', 'variables.gradle');
if (existsSync(varsPath)) {
  let v = readFileSync(varsPath, 'utf8');
  v = v.replace(/compileSdkVersion\s*=\s*\d+/, 'compileSdkVersion = 36').replace(/targetSdkVersion\s*=\s*\d+/, 'targetSdkVersion = 36');
  writeFileSync(varsPath, v);
}
const propsPath = path.join(root, 'android', 'gradle.properties');
if (existsSync(propsPath)) {
  let pr = readFileSync(propsPath, 'utf8');
  if (!pr.includes('suppressUnsupportedCompileSdk')) pr += '\nandroid.suppressUnsupportedCompileSdk=36\n';
  writeFileSync(propsPath, pr);
}

const build = parseInt(process.env.BUILD_NUMBER || '1', 10);
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
g = g.replace(/versionCode \d+/, `versionCode ${build}`).replace(/versionName "[^"]*"/, `versionName "${pkg.version}.${build}"`);
writeFileSync(gradlePath, g);

console.log(`Android ajustado (versión ${pkg.version}.${build}).`);
