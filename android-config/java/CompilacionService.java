package io.github.p3dr1t0.texsting;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

/**
 * Mientras TeXsting trabaja, Android la trata como «trabajando en primer plano», con una notificación.
 *
 * Sin esto, al salir de la app Android la pasaba a los núcleos lentos del procesador (y la podía congelar).
 * Cada pasada del motor es un programa nuevo, y las que empezaban mientras estabas fuera nacían en los núcleos
 * lentos y se quedaban ahí aunque volvieras.
 *
 * Dos modos, con notificaciones distintas:
 *  - COMPILAR: «Compilando… 45 %» (se cierra al terminar la compilación);
 *  - FONDO: «Guardando figuras… 30 %» con botón Cancelar (lo que el motor arma para la próxima compilación).
 * Se pasa de uno a otro sin detener el servicio: Android no deja volver a empezarlo si estás en otra app.
 *
 * Tipo «shortService» (Android 14+): para terminar rápido un trabajo importante; no pide permisos.
 * Si todo junto pasa de ~3 minutos, Android corta el aviso y el trabajo sigue como antes.
 */
public class CompilacionService extends Service {
    private static final String CANAL = "compilacion";
    private static final String CANAL_LISTO = "compilacion-lista";
    private static final int ID = 7301, ID_FONDO = 7304, ID_LISTO = 7303;
    static final String CANCELAR_FONDO = "texsting.CANCELAR_FONDO";

    private static final int NADA = 0, COMPILAR = 1, FONDO = 2;
    private static volatile int modo = NADA;
    private static volatile CompilacionService instancia;
    /** Qué pasó con el último aviso (para «Probar» en Ajustes y el resumen del log). */
    static volatile String estado = "sin usar";
    /** Lo que hace «Cancelar» en «Guardando figuras…» (lo pone el motor). */
    static volatile Runnable alCancelarFondo;

    // Compilación: segundos esperados (0 = sin dato), cuándo empezó, paso y archivo.
    private static volatile double esperado = 0;
    private static volatile long inicio = System.currentTimeMillis();
    private static volatile String paso = "Compilando";
    private static volatile String archivo = "";
    // Trabajo de fondo: texto y tramo (de «desde» a «hasta» %, en «segundos»).
    private static volatile String fondoTexto = "";
    private static volatile int fDesde = -1, fHasta = -1;
    private static volatile double fSeg = 0;
    private static volatile long fInicio = 0;

    private PowerManager.WakeLock wl;
    private NotificationCompat.Builder b;
    private int idActual = 0, modoMostrado = NADA;
    private final Handler h = new Handler(Looper.getMainLooper());
    private final Runnable tic = new Runnable() {
        @Override public void run() {
            if (instancia != CompilacionService.this || modo == NADA) return;
            actualizar();
            h.postDelayed(this, 1000);
        }
    };

    // ───────── Lo que llama el motor ─────────

    /** Al empezar una compilación (con la app a la vista). */
    static void empezar(Context c, String nombre) {
        esperado = 0; inicio = System.currentTimeMillis(); paso = "Compilando"; archivo = nombre;
        cambiarA(c, COMPILAR);
    }

    /** Al terminar la compilación. Si después viene trabajo de fondo, el motor ya pasó a FONDO y esto no hace nada. */
    static void terminar() { if (modo == COMPILAR) parar(); }

    /** Empieza (o cambia el texto de) el trabajo de fondo. */
    static void fondo(Context c, String texto) {
        fondoTexto = texto; fDesde = -1; fHasta = -1;
        if (modo == FONDO) { refrescar(); return; }
        cambiarA(c, FONDO);
    }

    /** Tramo del trabajo de fondo, para el porcentaje (la misma cuenta que la barra de la app). */
    static void fondoTramo(String texto, int desde, int hasta, double segundos) {
        if (texto != null && !texto.isEmpty()) fondoTexto = texto;
        fDesde = desde; fHasta = hasta; fSeg = segundos; fInicio = System.currentTimeMillis();
        refrescar();
    }

    /** Terminó (o se cortó) el trabajo de fondo. */
    static void terminarFondo() { if (modo == FONDO) parar(); }

    /** La app manda el avance de la compilación que estima (segundos esperados, cuándo empezó y el paso). */
    static void progreso(double est, long desde, String p) {
        esperado = est; inicio = desde;
        if (p != null && !p.isEmpty()) paso = p;
        refrescar();
    }

    private static void cambiarA(Context c, int nuevo) {
        modo = nuevo;
        CompilacionService s = instancia;
        if (s != null) { s.h.post(s::actualizar); return; }
        estado = "pedido a Android (aún no arranca)";
        try {
            Intent i = new Intent(c, CompilacionService.class);
            if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i); else c.startService(i);
        } catch (Exception e) {
            // P. ej., si Android no deja empezarlo en ese momento: se trabaja igual, como antes.
            estado = "Android no dejó empezarlo: " + e.getClass().getSimpleName() + " " + e.getMessage();
        }
    }

    private static void refrescar() { CompilacionService s = instancia; if (s != null) s.h.post(s::actualizar); }

    private static void parar() {
        modo = NADA;
        CompilacionService s = instancia;
        if (s != null) s.h.post(s::detener);
    }

    // ───────── El servicio ─────────

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && CANCELAR_FONDO.equals(intent.getAction())) {
            Runnable r = alCancelarFondo;
            if (r != null) new Thread(r, "texsting-cancelar").start();
            return START_NOT_STICKY;
        }
        instancia = this;
        // Siempre primero startForeground (Android lo exige), aunque el trabajo ya haya terminado.
        if (!mostrar()) { stopSelf(); return START_NOT_STICKY; }
        if (modo == NADA) { estado = "terminó antes de que arrancara"; detener(); return START_NOT_STICKY; }
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (wl == null && pm != null) {
                wl = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "texsting:compilar");
                wl.setReferenceCounted(false);
                wl.acquire(10 * 60 * 1000L);  // que no se duerma con la pantalla apagada (máximo 10 min)
            }
        } catch (Exception ignored) { }
        return START_NOT_STICKY;
    }

    /** Pone (o cambia) la notificación del modo actual como la del servicio en primer plano. */
    private boolean mostrar() {
        int m = modo == NADA ? COMPILAR : modo;
        int id = m == FONDO ? ID_FONDO : ID;
        b = constructor(m);
        llenar(m);
        try {
            Notification n = b.build();
            if (Build.VERSION.SDK_INT >= 34) startForeground(id, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SHORT_SERVICE);
            else if (Build.VERSION.SDK_INT >= 29) startForeground(id, n, 0);
            else startForeground(id, n);
            estado = "mostrado";
        } catch (Exception e) {
            estado = "error al mostrarlo: " + e.getClass().getSimpleName() + " " + e.getMessage();
            return false;
        }
        // Se cambió de «Compilando…» a «Guardando figuras…» (o al revés): la notificación anterior se quita.
        if (idActual != 0 && idActual != id) {
            try { NotificationManagerCompat.from(this).cancel(idActual); } catch (Exception ignored) { }
        }
        idActual = id; modoMostrado = m;
        h.removeCallbacks(tic);
        h.postDelayed(tic, 1000);
        return true;
    }

    private void canales() {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26 && nm != null && nm.getNotificationChannel(CANAL) == null) {
            NotificationChannel ch = new NotificationChannel(CANAL, "Compilación", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("Aparece mientras TeXsting compila o guarda figuras, para que siga a toda velocidad aunque cambies de app.");
            ch.setShowBadge(false);
            nm.createNotificationChannel(ch);
        }
    }

    private static PendingIntent abrirApp(Context c, int req) {
        Intent abrir = c.getPackageManager().getLaunchIntentForPackage(c.getPackageName());
        return abrir == null ? null : PendingIntent.getActivity(c, req, abrir,
            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0));
    }

    private NotificationCompat.Builder constructor(int m) {
        canales();
        NotificationCompat.Builder nb = new NotificationCompat.Builder(this, CANAL)
            .setSmallIcon(R.drawable.ic_stat_texsting)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_PROGRESS)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .setContentIntent(abrirApp(this, 0));
        if (m == FONDO) {
            Intent cancelar = new Intent(this, CompilacionService.class).setAction(CANCELAR_FONDO);
            PendingIntent pc = PendingIntent.getService(this, 2, cancelar,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0));
            nb.addAction(0, "Cancelar", pc);
        }
        return nb;
    }

    private static int porcentajeCompilar() {
        if (esperado <= 0) return -1;
        double t = (System.currentTimeMillis() - inicio) / 1000.0, est = esperado;
        double f = t <= est ? 0.9 * t / est : 0.9 + 0.07 * (1 - Math.exp(-(t - est) / Math.max(5, est / 3)));
        return (int) Math.round(f * 100);
    }

    private static int porcentajeFondo() {
        if (fDesde < 0 || fHasta < 0) return -1;
        double t = (System.currentTimeMillis() - fInicio) / 1000.0, seg = Math.max(2, fSeg);
        double g = t <= seg ? 0.9 * t / seg : 0.9 + 0.08 * (1 - Math.exp(-(t - seg) / seg));
        return (int) Math.round(fDesde + (fHasta - fDesde) * g);
    }

    private void llenar(int m) {
        if (m == FONDO) {
            int pct = porcentajeFondo();
            String t = (fondoTexto.isEmpty() ? "Guardando figuras" : fondoTexto.replace(" para la próxima compilación", "").replaceAll("…$", "")) + "…";
            b.setContentTitle(pct < 0 ? t : t + " " + pct + " %")
             .setContentText("Para que la próxima compilación sea más rápida")
             .setProgress(100, Math.max(pct, 0), pct < 0);
        } else {
            int pct = porcentajeCompilar();
            b.setContentTitle(pct < 0 ? "Compilando…" : "Compilando… " + pct + " %")
             .setContentText(paso + (archivo.isEmpty() ? "" : " · " + archivo))
             .setProgress(100, Math.max(pct, 0), pct < 0);
        }
    }

    private void actualizar() {
        if (instancia != this || modo == NADA) return;
        if (modo != modoMostrado) { mostrar(); return; }
        if (b == null) return;
        llenar(modo);
        try { NotificationManagerCompat.from(this).notify(idActual, b.build()); } catch (SecurityException ignored) { }
    }

    private void detener() {
        if (modo != NADA) { mostrar(); return; }  // llegó otro trabajo mientras tanto
        h.removeCallbacks(tic);
        try { if (wl != null && wl.isHeld()) wl.release(); } catch (Exception ignored) { }
        wl = null;
        try {
            if (Build.VERSION.SDK_INT >= 24) stopForeground(STOP_FOREGROUND_REMOVE); else stopForeground(true);
        } catch (Exception ignored) { }
        idActual = 0; modoMostrado = NADA;
        if (instancia == this) instancia = null;  // lo que llegue después arranca un servicio nuevo
        stopSelf();
    }

    /** Android 14: se acabó el tiempo de «shortService» (~3 min). El trabajo sigue; solo se quita el aviso. */
    @Override
    public void onTimeout(int startId) { modo = NADA; detener(); }

    /** Android 15+. */
    @Override
    public void onTimeout(int startId, int fgsType) { modo = NADA; detener(); }

    @Override
    public void onDestroy() {
        h.removeCallbacks(tic);
        try { if (wl != null && wl.isHeld()) wl.release(); } catch (Exception ignored) { }
        if (instancia == this) instancia = null;
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    // ───────── Aviso de «listo» (con sonido, solo si estás en otra app) ─────────

    static void avisarListo(Context c, boolean ok, int errores) {
        try {
            NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
            if (Build.VERSION.SDK_INT >= 26 && nm != null && nm.getNotificationChannel(CANAL_LISTO) == null) {
                NotificationChannel ch = new NotificationChannel(CANAL_LISTO, "Compilación terminada", NotificationManager.IMPORTANCE_DEFAULT);
                ch.setDescription("Avisa cuando termina de compilar mientras usas otra app.");
                nm.createNotificationChannel(ch);
            }
            String titulo = !ok ? "No se generó el PDF" : errores > 0 ? "PDF listo, con " + errores + (errores == 1 ? " error" : " errores") : "PDF listo";
            String texto = (archivo.isEmpty() ? "Tu documento" : archivo) + (ok ? " · toca para verlo" : " · toca para ver los mensajes");
            Notification n = new NotificationCompat.Builder(c, CANAL_LISTO)
                .setSmallIcon(R.drawable.ic_stat_texsting)
                .setContentTitle(titulo)
                .setContentText(texto)
                .setAutoCancel(true)
                .setCategory(NotificationCompat.CATEGORY_STATUS)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setContentIntent(abrirApp(c, 1))
                .build();
            NotificationManagerCompat.from(c).notify(ID_LISTO, n);
        } catch (Exception ignored) { /* sin permiso de notificaciones: no pasa nada */ }
    }

    /** Al volver a la app: el aviso de «listo» ya no hace falta. */
    static void quitarListo(Context c) {
        try { NotificationManagerCompat.from(c).cancel(ID_LISTO); } catch (Exception ignored) { }
    }
}
