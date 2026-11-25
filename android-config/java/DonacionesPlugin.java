package io.github.p3dr1t0.texsting;

import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.ConsumeParams;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Donaciones con Google Play (productos de una sola vez que se «consumen», para poder donar otra vez).
 * No desbloquean nada: TeXsting es completo y gratis para todos.
 * Productos en Play Console: donacion_1, donacion_3 y donacion_5 (1, 3 y 5 USD; Play pone el precio local).
 */
@CapacitorPlugin(name = "Donaciones")
public class DonacionesPlugin extends Plugin implements PurchasesUpdatedListener {
    private static final String[] PRODUCTOS = { "donacion_1", "donacion_3", "donacion_5" };
    private BillingClient cliente;
    private final Map<String, ProductDetails> detalles = new HashMap<>();
    private PluginCall compraEnCurso;

    @Override
    public void load() {
        cliente = BillingClient.newBuilder(getContext())
            .setListener(this)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .enableAutoServiceReconnection()
            .build();
    }

    private interface Listo { void run(); }

    private void conectar(PluginCall call, Listo listo) {
        if (cliente.isReady()) { listo.run(); return; }
        cliente.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(BillingResult r) {
                if (r.getResponseCode() == BillingClient.BillingResponseCode.OK) listo.run();
                else call.reject("Google Play no está disponible en este equipo (" + r.getResponseCode() + ")", "NO_DISPONIBLE");
            }
            @Override
            public void onBillingServiceDisconnected() { /* se reconecta solo (enableAutoServiceReconnection) */ }
        });
    }

    /** Precios de las donaciones en la moneda del usuario. También termina donaciones que quedaron pendientes. */
    @PluginMethod
    public void productos(PluginCall call) {
        conectar(call, () -> {
            terminarPendientes();
            List<QueryProductDetailsParams.Product> lista = new ArrayList<>();
            for (String id : PRODUCTOS) {
                lista.add(QueryProductDetailsParams.Product.newBuilder()
                    .setProductId(id).setProductType(BillingClient.ProductType.INAPP).build());
            }
            QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder().setProductList(lista).build();
            cliente.queryProductDetailsAsync(params, (r, resultado) -> {
                if (r.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    call.reject("No se pudieron cargar las donaciones (" + r.getResponseCode() + ")", "SIN_PRODUCTOS");
                    return;
                }
                JSArray arr = new JSArray();
                for (ProductDetails pd : resultado.getProductDetailsList()) {
                    ProductDetails.OneTimePurchaseOfferDetails oferta = pd.getOneTimePurchaseOfferDetails();
                    if (oferta == null) continue;
                    detalles.put(pd.getProductId(), pd);
                    JSObject o = new JSObject();
                    o.put("id", pd.getProductId());
                    o.put("precio", oferta.getFormattedPrice());
                    arr.put(o);
                }
                JSObject res = new JSObject();
                res.put("productos", arr);
                call.resolve(res);
            });
        });
    }

    /** Abre la ventana de pago de Google Play. Responde { estado: "gracias" | "pendiente" | "cancelado" }. */
    @PluginMethod
    public void donar(PluginCall call) {
        String id = call.getString("id", "");
        ProductDetails pd = detalles.get(id);
        if (pd == null) { call.reject("Esa donación no está disponible", "SIN_PRODUCTO"); return; }
        if (compraEnCurso != null) { call.reject("Ya hay un pago abierto", "EN_CURSO"); return; }
        conectar(call, () -> {
            BillingFlowParams params = BillingFlowParams.newBuilder()
                .setProductDetailsParamsList(Collections.singletonList(
                    BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(pd).build()))
                .build();
            call.setKeepAlive(true);
            compraEnCurso = call;
            getActivity().runOnUiThread(() -> {
                BillingResult r = cliente.launchBillingFlow(getActivity(), params);
                if (r.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    terminarLlamada(null, "No se pudo abrir el pago (" + r.getResponseCode() + ")");
                }
            });
        });
    }

    @Override
    public void onPurchasesUpdated(BillingResult r, List<Purchase> compras) {
        int code = r.getResponseCode();
        if (code == BillingClient.BillingResponseCode.OK && compras != null) {
            boolean pendiente = false;
            for (Purchase p : compras) {
                if (p.getPurchaseState() == Purchase.PurchaseState.PURCHASED) consumir(p);
                else if (p.getPurchaseState() == Purchase.PurchaseState.PENDING) pendiente = true;
            }
            terminarLlamada(pendiente ? "pendiente" : "gracias", null);
        } else if (code == BillingClient.BillingResponseCode.USER_CANCELED) {
            terminarLlamada("cancelado", null);
        } else if (code == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) {
            // Una donación anterior quedó sin consumir: se consume y se puede volver a donar.
            terminarPendientes();
            terminarLlamada(null, "Termina de procesarse una donación anterior; inténtalo de nuevo en un momento.");
        } else {
            terminarLlamada(null, "El pago no se completó (" + code + ")");
        }
    }

    private void terminarLlamada(String estado, String error) {
        PluginCall call = compraEnCurso;
        compraEnCurso = null;
        if (call == null) return;
        if (error != null) call.reject(error);
        else { JSObject o = new JSObject(); o.put("estado", estado); call.resolve(o); }
        call.setKeepAlive(false);
    }

    /** Consumir = confirmar el pago a Google (si no, lo devuelve a los 3 días) y permitir donar otra vez. */
    private void consumir(Purchase p) {
        ConsumeParams cp = ConsumeParams.newBuilder().setPurchaseToken(p.getPurchaseToken()).build();
        cliente.consumeAsync(cp, (r, token) -> { /* si falla, se reintenta en terminarPendientes() */ });
    }

    /** Donaciones pagadas después (por ejemplo en efectivo) o que no llegaron a consumirse. */
    private void terminarPendientes() {
        QueryPurchasesParams q = QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build();
        cliente.queryPurchasesAsync(q, (r, compras) -> {
            if (r.getResponseCode() != BillingClient.BillingResponseCode.OK || compras == null) return;
            for (Purchase p : compras) if (p.getPurchaseState() == Purchase.PurchaseState.PURCHASED) consumir(p);
        });
    }
}
