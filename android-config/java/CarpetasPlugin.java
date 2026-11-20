package io.github.texsting;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.Intent;
import android.content.UriPermission;
import android.database.Cursor;
import android.net.Uri;
import android.os.Environment;
import android.provider.DocumentsContract;
import android.provider.DocumentsContract.Document;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * Carpetas reales del teléfono (#4 y #7): la carpeta propia Documentos/Projects_LaTeX y las carpetas de proyectos
 * existentes. Android solo deja entrar a una carpeta que el usuario eligió (Storage Access Framework): el permiso
 * se guarda y sirve para siempre, también después de reiniciar el teléfono.
 *
 * Cada carpeta se nombra con «tree» (la carpeta que eligió el usuario, con su permiso) y «doc» (el id de una
 * carpeta o archivo dentro de ella). Las rutas son relativas a una carpeta («figuras/circuito.png»).
 */
@CapacitorPlugin(name = "Carpetas")
public class CarpetasPlugin extends Plugin {
    private static final String[] COLS = { Document.COLUMN_DOCUMENT_ID, Document.COLUMN_DISPLAY_NAME,
        Document.COLUMN_MIME_TYPE, Document.COLUMN_SIZE, Document.COLUMN_LAST_MODIFIED };

    private ContentResolver cr() { return getContext().getContentResolver(); }
    private static Uri doc(Uri tree, String id) { return DocumentsContract.buildDocumentUriUsingTree(tree, id); }

    /** Abre el selector de carpetas de Android (en Documentos, si se pide). */
    @PluginMethod
    public void elegir(PluginCall call) {
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
            | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION | Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
        String inicial = call.getString("inicial", "");
        if (inicial != null && !inicial.isEmpty()) {
            try {
                i.putExtra(DocumentsContract.EXTRA_INITIAL_URI,
                    DocumentsContract.buildDocumentUri("com.android.externalstorage.documents", "primary:" + inicial));
            } catch (Exception ignored) { }
        }
        startActivityForResult(call, i, "alElegir");
    }

    /**
     * Crea Documentos/Projects_LaTeX directamente (sin pasar por el selector), para que el selector se abra ya ahí
     * y al usuario solo le quede tocar «Usar esta carpeta» y «Permitir». Android no deja saltarse ese permiso.
     */
    @PluginMethod
    public void crearEnDocumentos(PluginCall call) {
        boolean ok = false;
        try {
            File d = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOCUMENTS), call.getString("nombre", "Projects_LaTeX"));
            ok = d.isDirectory() || d.mkdirs();
        } catch (Exception ignored) { }
        JSObject r = new JSObject();
        r.put("ok", ok);
        call.resolve(r);
    }

    @ActivityCallback
    private void alElegir(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            call.reject("cancelado", "CANCELADO");
            return;
        }
        Uri tree = result.getData().getData();
        try {
            cr().takePersistableUriPermission(tree, Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        } catch (Exception ignored) { }
        String id = DocumentsContract.getTreeDocumentId(tree);
        JSObject r = new JSObject();
        r.put("tree", tree.toString());
        r.put("doc", id);
        r.put("nombre", nombreDe(tree, id));
        r.put("ruta", rutaLegible(id));
        call.resolve(r);
    }

    /** «primary:Documents/Projects_LaTeX» → «Documents/Projects_LaTeX» (para mostrar dónde está). */
    private static String rutaLegible(String id) {
        int c = id.indexOf(':');
        return c >= 0 ? id.substring(c + 1) : id;
    }

    private String nombreDe(Uri tree, String id) {
        try (Cursor c = cr().query(doc(tree, id), new String[] { Document.COLUMN_DISPLAY_NAME }, null, null, null)) {
            if (c != null && c.moveToFirst()) return c.getString(0);
        } catch (Exception ignored) { }
        String r = rutaLegible(id);
        return r.substring(r.lastIndexOf('/') + 1);
    }

    /** ¿Sigue el permiso sobre esta carpeta? (se pierde si el usuario lo quita o borra la carpeta). */
    @PluginMethod
    public void acceso(PluginCall call) {
        String t = call.getString("tree");
        boolean ok = false;
        for (UriPermission p : cr().getPersistedUriPermissions())
            if (p.getUri().toString().equals(t) && p.isWritePermission()) ok = true;
        boolean existe = false;
        if (ok) {
            try (Cursor c = cr().query(doc(Uri.parse(t), call.getString("doc")), new String[] { Document.COLUMN_DOCUMENT_ID }, null, null, null)) {
                existe = c != null && c.moveToFirst();
            } catch (Exception ignored) { }
        }
        JSObject r = new JSObject();
        r.put("permiso", ok);
        r.put("existe", existe);
        call.resolve(r);
    }

    private String hijo(Uri tree, String padre, String nombre, boolean[] esCarpeta) {
        try (Cursor c = cr().query(DocumentsContract.buildChildDocumentsUriUsingTree(tree, padre), COLS, null, null, null)) {
            while (c != null && c.moveToNext()) {
                if (nombre.equals(c.getString(1))) {
                    if (esCarpeta != null) esCarpeta[0] = Document.MIME_TYPE_DIR.equals(c.getString(2));
                    return c.getString(0);
                }
            }
        }
        return null;
    }

    private String crearCarpetaEn(Uri tree, String padre, String nombre) throws Exception {
        boolean[] dir = { false };
        String id = hijo(tree, padre, nombre, dir);
        if (id != null && dir[0]) return id;
        Uri u = DocumentsContract.createDocument(cr(), doc(tree, padre), Document.MIME_TYPE_DIR, nombre);
        if (u == null) throw new Exception("No se pudo crear la carpeta «" + nombre + "»");
        return DocumentsContract.getDocumentId(u);
    }

    /** Busca (o crea) una carpeta con ese nombre dentro de otra. */
    @PluginMethod
    public void carpeta(PluginCall call) {
        try {
            Uri tree = Uri.parse(call.getString("tree"));
            String id = crearCarpetaEn(tree, call.getString("doc"), call.getString("nombre"));
            JSObject r = new JSObject();
            r.put("doc", id);
            call.resolve(r);
        } catch (Exception e) { call.reject(String.valueOf(e.getMessage())); }
    }

    /** Contenido de una carpeta: con «recursivo», también el de sus subcarpetas (rutas relativas). */
    @PluginMethod
    public void listar(PluginCall call) {
        try {
            Uri tree = Uri.parse(call.getString("tree"));
            JSArray out = new JSArray();
            listarEn(tree, call.getString("doc"), "", Boolean.TRUE.equals(call.getBoolean("recursivo", false)), out, 0);
            JSObject r = new JSObject();
            r.put("items", out);
            call.resolve(r);
        } catch (Exception e) { call.reject(String.valueOf(e.getMessage())); }
    }

    private void listarEn(Uri tree, String id, String base, boolean rec, JSArray out, int nivel) throws Exception {
        if (out.length() > 5000 || nivel > 12) return;
        try (Cursor c = cr().query(DocumentsContract.buildChildDocumentsUriUsingTree(tree, id), COLS, null, null, null)) {
            if (c == null) throw new Exception("No se pudo leer la carpeta");
            while (c.moveToNext()) {
                String nombre = c.getString(1);
                if (nombre == null || nombre.startsWith(".")) continue;
                boolean dir = Document.MIME_TYPE_DIR.equals(c.getString(2));
                JSObject o = new JSObject();
                o.put("path", base + nombre);
                o.put("doc", c.getString(0));
                o.put("dir", dir);
                o.put("size", c.isNull(3) ? 0 : c.getLong(3));
                o.put("mtime", c.isNull(4) ? 0 : c.getLong(4));
                out.put(o);
                if (dir && rec) listarEn(tree, c.getString(0), base + nombre + "/", true, out, nivel + 1);
            }
        }
    }

    @PluginMethod
    public void leer(PluginCall call) {
        try (InputStream in = cr().openInputStream(doc(Uri.parse(call.getString("tree")), call.getString("doc")))) {
            if (in == null) throw new Exception("No se pudo abrir el archivo");
            ByteArrayOutputStream b = new ByteArrayOutputStream();
            byte[] buf = new byte[65536];
            int n;
            while ((n = in.read(buf)) > 0) b.write(buf, 0, n);
            JSObject r = new JSObject();
            r.put("data", Base64.encodeToString(b.toByteArray(), Base64.NO_WRAP));
            call.resolve(r);
        } catch (Exception e) { call.reject(String.valueOf(e.getMessage())); }
    }

    /** Escribe un archivo (ruta relativa a la carpeta «doc»), creando las subcarpetas que falten. */
    @PluginMethod
    public void escribir(PluginCall call) {
        try {
            Uri tree = Uri.parse(call.getString("tree"));
            String padre = call.getString("doc");
            String[] partes = call.getString("path").split("/");
            for (int k = 0; k < partes.length - 1; k++) if (!partes[k].isEmpty()) padre = crearCarpetaEn(tree, padre, partes[k]);
            String nombre = partes[partes.length - 1];
            String id = hijo(tree, padre, nombre, null);
            Uri u;
            if (id != null) u = doc(tree, id);
            else {
                // octet-stream: Android no le agrega una extensión al nombre (con text/plain pondría «.txt»).
                u = DocumentsContract.createDocument(cr(), doc(tree, padre), "application/octet-stream", nombre);
                if (u == null) throw new Exception("No se pudo crear «" + nombre + "»");
            }
            byte[] data = Base64.decode(call.getString("data", ""), Base64.DEFAULT);
            OutputStream o;
            try { o = cr().openOutputStream(u, "wt"); } catch (Exception e) { o = cr().openOutputStream(u, "w"); }
            if (o == null) throw new Exception("No se pudo escribir «" + nombre + "»");
            try { o.write(data); } finally { o.close(); }
            JSObject r = new JSObject();
            r.put("doc", DocumentsContract.getDocumentId(u));
            long mt = 0;
            try (Cursor c = cr().query(u, new String[] { Document.COLUMN_LAST_MODIFIED }, null, null, null)) {
                if (c != null && c.moveToFirst() && !c.isNull(0)) mt = c.getLong(0);
            } catch (Exception ignored) { }
            r.put("mtime", mt);
            call.resolve(r);
        } catch (Exception e) { call.reject(String.valueOf(e.getMessage())); }
    }

    /** Borra un archivo o una carpeta (ruta relativa a «doc»; sin ruta, la carpeta «doc» misma). */
    @PluginMethod
    public void borrar(PluginCall call) {
        try {
            Uri tree = Uri.parse(call.getString("tree"));
            String id = resolver(tree, call.getString("doc"), call.getString("path", ""));
            if (id != null) DocumentsContract.deleteDocument(cr(), doc(tree, id));
            call.resolve();
        } catch (Exception e) { call.reject(String.valueOf(e.getMessage())); }
    }

    /** Cambia el nombre de un archivo o carpeta. Devuelve su nuevo id. */
    @PluginMethod
    public void renombrar(PluginCall call) {
        try {
            Uri tree = Uri.parse(call.getString("tree"));
            String id = resolver(tree, call.getString("doc"), call.getString("path", ""));
            if (id == null) throw new Exception("No existe");
            Uri u = DocumentsContract.renameDocument(cr(), doc(tree, id), call.getString("nombre"));
            JSObject r = new JSObject();
            r.put("doc", u != null ? DocumentsContract.getDocumentId(u) : id);
            call.resolve(r);
        } catch (Exception e) { call.reject(String.valueOf(e.getMessage())); }
    }

    private String resolver(Uri tree, String base, String path) {
        String id = base;
        if (path == null || path.isEmpty()) return id;
        for (String p : path.split("/")) {
            if (p.isEmpty()) continue;
            id = hijo(tree, id, p, null);
            if (id == null) return null;
        }
        return id;
    }
}
