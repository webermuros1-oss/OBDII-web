package com.obdii.diagnostics

import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: android.os.Bundle?) {
        registerPlugin(OBDPlugin::class.java)
        super.onCreate(savedInstanceState)
    }
}
