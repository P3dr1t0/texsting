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
import android.os.IBinder;
import android.os.PowerManager;

import androidx.core.app.NotificationCompat;

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
    /** Si sigue habiendo una compilación (puede terminar antes de que el servicio llegue a arrancar). */
    private static volatile boolean activo = false;
    private static volatile CompilacionService instancia;
    /** Qué pasó con el último aviso (para «Probar» en Ajustes y el resumen del log). */
    static volatile String estado = "sin usar";
    private PowerManager.WakeLock wl;

    /** Al empezar una compilación (llamar con la app a la vista). */
    static void empezar(Context c, String texto) {
        activo = true;
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
        Notification n = notificacion(texto);
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
        return new NotificationCompat.Builder(this, CANAL)
            .setSmallIcon(R.drawable.ic_stat_texsting)
            .setContentTitle("Compilando…")
            .setContentText(texto)
            .setProgress(0, 0, true)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_PROGRESS)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .setContentIntent(pi)
            .build();
    }

    private void parar() {
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
