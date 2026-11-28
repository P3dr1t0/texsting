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
 * Mientras TeXsting compila, Android la trata como «trabajando en primer plano» (con una notificación «Compilando…»).
 *
 * Sin esto, al salir de la app Android la pasaba a los núcleos lentos del procesador (y la podía congelar).
 * Cada pasada del motor es un programa nuevo, y las que empezaban mientras estabas fuera nacían en los núcleos
 * lentos y se quedaban ahí aunque volvieras: el resto de la compilación iba muy lento.
 *
 * Tipo «shortService» (Android 14+): para terminar rápido un trabajo importante; no pide permisos.
 * Si una compilación pasa de ~3 minutos, Android corta el aviso y la compilación sigue como antes.
 */
public class CompilacionService extends Service {
    private static final String CANAL = "compilacion";
    private static final int ID = 7301;
    private static final String CANAL_LISTO = "compilacion-lista";
    private static final int ID_LISTO = 7303;
    /** Si sigue habiendo una compilación (puede terminar antes de que el servicio llegue a arrancar). */
    private static volatile boolean activo = false;
    private static volatile CompilacionService instancia;
    /** Qué pasó con el último aviso (para «Probar» en Ajustes y el resumen del log). */
    static volatile String estado = "sin usar";
    private PowerManager.WakeLock wl;

    // Avance que estima la app: segundos esperados (0 = sin dato), cuándo empezó y el paso actual.
    // El porcentaje se calcula aquí cada segundo (con la app en segundo plano, sus relojes van más lentos).
    private static volatile double esperado = 0;
    private static volatile long inicio = System.currentTimeMillis();
    private static volatile String paso = "Compilando";
    private static volatile String archivo = "";
    private NotificationCompat.Builder b;
    private final Handler h = new Handler(Looper.getMainLooper());
    private final Runnable tic = new Runnable() {
        @Override public void run() {
            if (instancia != CompilacionService.this || !activo) return;
            actualizar();
            h.postDelayed(this, 1000);
        }
    };

    /** Lo manda la app cuando cambia el paso o el tiempo esperado (la misma cuenta que la barra de la app). */
    static void progreso(double est, long desde, String p) {
        esperado = est; inicio = desde;
        if (p != null && !p.isEmpty()) paso = p;
        CompilacionService s = instancia;
        if (s != null) s.h.post(s::actualizar);
    }

    private static int porcentaje() {
        if (esperado <= 0) return -1;
        double t = (System.currentTimeMillis() - inicio) / 1000.0, est = esperado;
        double f = t <= est ? 0.9 * t / est : 0.9 + 0.07 * (1 - Math.exp(-(t - est) / Math.max(5, est / 3)));
        return (int) Math.round(f * 100);
    }

    private void actualizar() {
        if (b == null) return;
        int pct = porcentaje();
        b.setContentTitle(pct < 0 ? "Compilando…" : "Compilando… " + pct + " %")
         .setContentText(paso + (archivo.isEmpty() ? "" : " · " + archivo))
         .setProgress(100, Math.max(pct, 0), pct < 0);
        try { NotificationManagerCompat.from(this).notify(ID, b.build()); } catch (SecurityException ignored) { }
    }

    /**
     * Al terminar, si la app no está a la vista: aviso con sonido («PDF listo» o «terminó con errores»).
     * Canal aparte («Compilación terminada»), así se puede silenciar sin tocar el de «Compilando…».
     */
    static void avisarListo(Context c, boolean ok, int errores) {
        try {
            NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
            if (Build.VERSION.SDK_INT >= 26 && nm != null && nm.getNotificationChannel(CANAL_LISTO) == null) {
                NotificationChannel ch = new NotificationChannel(CANAL_LISTO, "Compilación terminada", NotificationManager.IMPORTANCE_DEFAULT);
                ch.setDescription("Avisa cuando termina de compilar mientras usas otra app.");
                nm.createNotificationChannel(ch);
            }
            Intent abrir = c.getPackageManager().getLaunchIntentForPackage(c.getPackageName());
            PendingIntent pi = abrir == null ? null : PendingIntent.getActivity(c, 1, abrir,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0));
            String titulo = !ok ? "No se generó el PDF" : errores > 0 ? "PDF listo, con " + errores + (errores == 1 ? " error" : " errores") : "PDF listo";
            String texto = (archivo.isEmpty() ? "Tu documento" : archivo) + (ok ? " · toca para verlo" : " · toca para ver los mensajes");
            Notification n = new NotificationCompat.Builder(c, CANAL_LISTO)
                .setSmallIcon(R.drawable.ic_stat_texsting)
                .setContentTitle(titulo)
                .setContentText(texto)
                .setAutoCancel(true)
                .setCategory(NotificationCompat.CATEGORY_STATUS)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setContentIntent(pi)
                .build();
            NotificationManagerCompat.from(c).notify(ID_LISTO, n);
        } catch (Exception ignored) { /* sin permiso de notificaciones: no pasa nada */ }
    }

    /** Al volver a la app: el aviso de «listo» ya no hace falta. */
    static void quitarListo(Context c) {
        try { NotificationManagerCompat.from(c).cancel(ID_LISTO); } catch (Exception ignored) { }
    }

    /** Al empezar una compilación (llamar con la app a la vista). */
    static void empezar(Context c, String texto) {
        activo = true;
        esperado = 0; inicio = System.currentTimeMillis(); paso = "Compilando"; archivo = texto;
        estado = "pedido a Android (aún no arranca)";
        try {
            Intent i = new Intent(c, CompilacionService.class).putExtra("texto", texto);
            if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i); else c.startService(i);
        } catch (Exception e) {
            // P. ej., si Android no deja empezarlo en ese momento: se compila igual, como antes.
            estado = "Android no dejó empezarlo: " + e.getClass().getSimpleName() + " " + e.getMessage();
        }
    }

    /** Al terminar la compilación (bien o con errores). */
    static void terminar() {
        activo = false;
        CompilacionService s = instancia;
        if (s != null) s.parar();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        instancia = this;
        String texto = intent != null && intent.getStringExtra("texto") != null ? intent.getStringExtra("texto") : "Compilando tu documento…";
        Notification n = notificacion(archivo);
        // Siempre primero startForeground (Android lo exige), aunque la compilación ya haya terminado.
        try {
            if (Build.VERSION.SDK_INT >= 34) startForeground(ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SHORT_SERVICE);
            else if (Build.VERSION.SDK_INT >= 29) startForeground(ID, n, 0);
            else startForeground(ID, n);
            estado = "mostrado";
        } catch (Exception e) {
            estado = "error al mostrarlo: " + e.getClass().getSimpleName() + " " + e.getMessage();
            stopSelf();
            return START_NOT_STICKY;
        }
        if (!activo) { estado = "la compilación terminó antes de que arrancara"; parar(); return START_NOT_STICKY; }
        h.removeCallbacks(tic);
        h.post(tic);
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

    private Notification notificacion(String texto) {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26 && nm != null && nm.getNotificationChannel(CANAL) == null) {
            NotificationChannel ch = new NotificationChannel(CANAL, "Compilación", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("Aparece mientras TeXsting compila, para que siga a toda velocidad aunque cambies de app.");
            ch.setShowBadge(false);
            nm.createNotificationChannel(ch);
        }
        Intent abrir = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent pi = abrir == null ? null : PendingIntent.getActivity(this, 0, abrir,
            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0));
        b = new NotificationCompat.Builder(this, CANAL)
            .setSmallIcon(R.drawable.ic_stat_texsting)
            .setContentTitle("Compilando…")
            .setContentText(paso + (texto == null || texto.isEmpty() ? "" : " · " + texto))
            .setProgress(0, 0, true)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_PROGRESS)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .setContentIntent(pi);
        return b.build();
    }

    private void parar() {
        h.removeCallbacks(tic);
        try { if (wl != null && wl.isHeld()) wl.release(); } catch (Exception ignored) { }
        wl = null;
        try {
            if (Build.VERSION.SDK_INT >= 24) stopForeground(STOP_FOREGROUND_REMOVE); else stopForeground(true);
        } catch (Exception ignored) { }
        stopSelf();
    }

    /** Android 14: se acabó el tiempo de «shortService» (~3 min). La compilación sigue; solo se quita el aviso. */
    @Override
    public void onTimeout(int startId) { parar(); }

    /** Android 15+. */
    @Override
    public void onTimeout(int startId, int fgsType) { parar(); }

    @Override
    public void onDestroy() {
        try { if (wl != null && wl.isHeld()) wl.release(); } catch (Exception ignored) { }
        if (instancia == this) instancia = null;
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
