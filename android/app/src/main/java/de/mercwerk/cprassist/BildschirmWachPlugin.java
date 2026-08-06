package de.mercwerk.cprassist;

import android.app.Activity;
import android.view.WindowManager;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Hält den Bildschirm an, solange eine Reanimation läuft.
 *
 * Warum eigener nativer Code statt der Screen-Wake-Lock-API des Browsers:
 * navigator.wakeLock ist in der Android-WebView nicht zuverlässig verfügbar
 * und scheitert dort im Zweifel still. FLAG_KEEP_SCREEN_ON dagegen ist die
 * Android-eigene Lösung – solange das Fenster im Vordergrund ist, dunkelt
 * das System den Bildschirm nicht ab und sperrt auch nicht automatisch.
 * Die JS-Seite ruft weiterhin beide Wege auf (siehe WakeLock in index.html).
 *
 * Der Flag hängt am Fenster der Activity und wird vom System automatisch
 * unwirksam, sobald die App in den Hintergrund geht – ein Vergessen kann
 * den Akku also nicht dauerhaft leeren.
 */
@CapacitorPlugin(name = "BildschirmWach")
public class BildschirmWachPlugin extends Plugin {

    @PluginMethod
    public void an(PluginCall call) {
        setzen(true, call);
    }

    @PluginMethod
    public void aus(PluginCall call) {
        setzen(false, call);
    }

    private void setzen(final boolean an, final PluginCall call) {
        final Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity nicht verfügbar");
            return;
        }
        // Fenster-Flags dürfen nur im UI-Thread verändert werden.
        activity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (an) {
                    activity.getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                } else {
                    activity.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                }
                call.resolve();
            }
        });
    }
}
