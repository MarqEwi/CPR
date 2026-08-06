package de.mercwerk.cprassist;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Eigene Plugins müssen VOR super.onCreate() registriert werden,
        // sonst kennt die Brücke sie beim Laden der Seite noch nicht.
        registerPlugin(BildschirmWachPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
