package com.obdii.diagnostics

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothSocket
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.core.app.ActivityCompat
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream
import java.util.UUID
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.concurrent.thread

@CapacitorPlugin(
    name = "OBDPlugin",
    permissions = [
        Permission(strings = ["android.permission.BLUETOOTH"], alias = "bluetooth"),
        Permission(strings = ["android.permission.BLUETOOTH_ADMIN"], alias = "bluetoothAdmin"),
        Permission(
            strings = ["android.permission.BLUETOOTH_CONNECT"],
            alias = "bluetoothConnect"
        ),
        Permission(
            strings = ["android.permission.BLUETOOTH_SCAN"],
            alias = "bluetoothScan"
        ),
    ]
)
class OBDPlugin : Plugin() {

    companion object {
        private const val TAG = "OBDPlugin"
        private val SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
        private const val COMMAND_TIMEOUT_MS = 3000L
        private const val POLLING_INTERVAL_MS = 500L

        // PID table: pid → (name, formula, unit, min, max)
        private data class PIDInfo(
            val name: String,
            val unit: String,
            val min: Double,
            val max: Double,
            val formula: (Int, Int) -> Double
        )

        private val PID_TABLE: Map<String, PIDInfo> = mapOf(
            "0C" to PIDInfo("RPM", "rpm", 0.0, 8000.0) { a, b -> ((a * 256.0) + b) / 4.0 },
            "0D" to PIDInfo("Velocidad", "km/h", 0.0, 255.0) { a, _ -> a.toDouble() },
            "05" to PIDInfo("Temp. motor", "°C", -40.0, 215.0) { a, _ -> (a - 40).toDouble() },
            "11" to PIDInfo("Posición acelerador", "%", 0.0, 100.0) { a, _ -> a * 100.0 / 255.0 },
            "04" to PIDInfo("Carga motor", "%", 0.0, 100.0) { a, _ -> a * 100.0 / 255.0 },
            "0F" to PIDInfo("Temp. aire admisión", "°C", -40.0, 215.0) { a, _ -> (a - 40).toDouble() },
            "2F" to PIDInfo("Nivel combustible", "%", 0.0, 100.0) { a, _ -> a * 100.0 / 255.0 },
            "0E" to PIDInfo("Avance encendido", "°", -64.0, 63.5) { a, _ -> a / 2.0 - 64.0 }
        )
    }

    // ─── State ───────────────────────────────────────────────────────────────────

    private var bluetoothAdapter: BluetoothAdapter? = null
    private var socket: BluetoothSocket? = null
    private var inputStream: InputStream? = null
    private var outputStream: OutputStream? = null

    private val isPolling = AtomicBoolean(false)
    private val isConnected = AtomicBoolean(false)
    private var pollingThread: Thread? = null

    // Pending connect call — stored so permission callbacks can resume it
    private var pendingConnectCall: PluginCall? = null

    // ─── Lifecycle ────────────────────────────────────────────────────────────────

    override fun load() {
        super.load()
        bluetoothAdapter = BluetoothAdapter.getDefaultAdapter()
    }

    // ─── Plugin Methods ───────────────────────────────────────────────────────────

    @PluginMethod
    fun listDevices(call: PluginCall) {
        if (!hasBluetoothPermission()) {
            call.reject("PERMISSION_DENIED", "Bluetooth permission not granted")
            return
        }

        val adapter = bluetoothAdapter
        if (adapter == null || !adapter.isEnabled) {
            call.reject("BLUETOOTH_DISABLED", "Bluetooth is not available or not enabled")
            return
        }

        val devicesArray = JSArray()
        try {
            @Suppress("MissingPermission")
            val bonded: Set<BluetoothDevice> = adapter.bondedDevices ?: emptySet()
            for (device in bonded) {
                val obj = JSObject()
                @Suppress("MissingPermission")
                obj.put("address", device.address ?: "")
                @Suppress("MissingPermission")
                obj.put("name", device.name ?: "Unknown")
                devicesArray.put(obj)
            }
        } catch (e: SecurityException) {
            call.reject("PERMISSION_DENIED", "Missing Bluetooth permission: ${e.message}")
            return
        }

        val result = JSObject()
        result.put("devices", devicesArray)
        call.resolve(result)
    }

    @PluginMethod
    fun connect(call: PluginCall) {
        val address = call.getString("address")
        if (address.isNullOrBlank()) {
            call.reject("INVALID_ADDRESS", "A Bluetooth MAC address is required")
            return
        }

        if (!hasBluetoothPermission()) {
            pendingConnectCall = call
            requestPermissions(call)
            return
        }

        performConnect(call, address)
    }

    @PermissionCallback
    fun bluetoothConnectPermsCallback(call: PluginCall) {
        val pending = pendingConnectCall ?: call
        pendingConnectCall = null

        if (!hasBluetoothPermission()) {
            pending.reject("PERMISSION_DENIED", "Bluetooth permission was denied")
            return
        }

        val address = pending.getString("address")
        if (address.isNullOrBlank()) {
            pending.reject("INVALID_ADDRESS", "Address missing after permission grant")
            return
        }

        performConnect(pending, address)
    }

    @PluginMethod
    fun disconnect(call: PluginCall) {
        stopPollingInternal()
        closeConnection()
        emitConnectionStatus("disconnected")

        val result = JSObject()
        result.put("ok", true)
        call.resolve(result)
    }

    @PluginMethod
    fun sendCommand(call: PluginCall) {
        val command = call.getString("command")
        if (command.isNullOrBlank()) {
            call.reject("INVALID_COMMAND", "command is required")
            return
        }

        if (!isConnected.get()) {
            val result = JSObject()
            result.put("ok", false)
            result.put("error", "NOT_CONNECTED")
            call.resolve(result)
            return
        }

        thread(name = "obd-cmd") {
            try {
                val response = sendCommandSync(command)
                val result = JSObject()
                result.put("ok", true)
                result.put("response", response)
                call.resolve(result)
            } catch (e: Exception) {
                Log.e(TAG, "sendCommand error", e)
                val result = JSObject()
                result.put("ok", false)
                result.put("error", e.message ?: "UNKNOWN")
                call.resolve(result)
            }
        }
    }

    @PluginMethod
    fun startPolling(call: PluginCall) {
        if (!isConnected.get()) {
            val result = JSObject()
            result.put("ok", false)
            result.put("error", "NOT_CONNECTED")
            call.resolve(result)
            return
        }

        val pidsArray = call.getArray("pids")
        val pids = mutableListOf<String>()
        if (pidsArray != null) {
            for (i in 0 until pidsArray.length()) {
                pids.add(pidsArray.getString(i).uppercase())
            }
        }

        if (pids.isEmpty()) {
            val result = JSObject()
            result.put("ok", false)
            result.put("error", "NO_PIDS")
            call.resolve(result)
            return
        }

        if (isPolling.compareAndSet(false, true)) {
            pollingThread = thread(name = "obd-polling") {
                runPollingLoop(pids)
            }
        }

        val result = JSObject()
        result.put("ok", true)
        call.resolve(result)
    }

    @PluginMethod
    fun stopPolling(call: PluginCall) {
        stopPollingInternal()
        val result = JSObject()
        result.put("ok", true)
        call.resolve(result)
    }

    // ─── Internal: connect ────────────────────────────────────────────────────────

    private fun performConnect(call: PluginCall, address: String) {
        // Close any previous connection first
        stopPollingInternal()
        closeConnection()

        emitConnectionStatus("connecting")

        thread(name = "obd-connect") {
            try {
                val adapter = bluetoothAdapter
                if (adapter == null || !adapter.isEnabled) {
                    emitConnectionStatus("error")
                    val result = JSObject()
                    result.put("ok", false)
                    result.put("error", "Bluetooth not available or disabled")
                    call.resolve(result)
                    return@thread
                }

                @Suppress("MissingPermission")
                val device: BluetoothDevice = adapter.getRemoteDevice(address)

                // Cancel discovery to avoid slowing down connection
                @Suppress("MissingPermission")
                if (adapter.isDiscovering) {
                    adapter.cancelDiscovery()
                }

                @Suppress("MissingPermission")
                val sock: BluetoothSocket = device.createRfcommSocketToServiceRecord(SPP_UUID)
                socket = sock

                @Suppress("MissingPermission")
                sock.connect()

                inputStream = sock.inputStream
                outputStream = sock.outputStream
                isConnected.set(true)

                Log.i(TAG, "Bluetooth socket connected to $address")

                // ELM327 initialisation sequence
                initializeELM327()

                emitConnectionStatus("connected")

                val result = JSObject()
                result.put("ok", true)
                call.resolve(result)

            } catch (e: Exception) {
                Log.e(TAG, "Connect failed", e)
                closeConnection()
                emitConnectionStatus("error")

                val result = JSObject()
                result.put("ok", false)
                result.put("error", e.message ?: "Connection failed")
                call.resolve(result)
            }
        }
    }

    // ─── ELM327 Initialisation ─────────────────────────────────────────────────

    private fun initializeELM327() {
        // ATZ — reset chip; ELM327 takes up to 1 s to restart
        try {
            sendRaw("ATZ\r")
        } catch (_: Exception) { /* ignore reset echo/garbage */ }
        Thread.sleep(1000)
        flushInput()

        // Standard init sequence
        val initCommands = listOf(
            "ATE0",   // Echo off
            "ATL0",   // Linefeeds off
            "ATS0",   // Spaces off  (makes parsing easier)
            "ATH1",   // Headers on  (we need mode byte to validate responses)
            "ATSP0"   // Auto-select OBD protocol
        )

        for (cmd in initCommands) {
            try {
                val resp = sendCommandSync("$cmd\r")
                Log.d(TAG, "Init [$cmd] → $resp")
            } catch (e: Exception) {
                Log.w(TAG, "Init command $cmd failed: ${e.message}")
            }
        }
    }

    // ─── Polling loop ─────────────────────────────────────────────────────────────

    private fun runPollingLoop(pids: List<String>) {
        Log.i(TAG, "Polling started for PIDs: $pids")

        while (isPolling.get() && isConnected.get()) {
            for (pid in pids) {
                if (!isPolling.get() || !isConnected.get()) break

                try {
                    val response = sendCommandSync("01 $pid\r")
                    parsePIDResponse(pid, response)?.let { liveData ->
                        notifyListeners("liveData", liveData)
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "Polling error for PID $pid: ${e.message}")
                    val errObj = JSObject()
                    errObj.put("code", "SERIAL_ERROR")
                    errObj.put("message", e.message ?: "Unknown polling error")
                    notifyListeners("obdError", errObj)

                    if (!isConnected.get()) break
                }

                // Small inter-PID delay to avoid overwhelming the adapter
                if (isPolling.get()) Thread.sleep(50)
            }

            if (isPolling.get()) Thread.sleep(POLLING_INTERVAL_MS)
        }

        Log.i(TAG, "Polling stopped")
    }

    // ─── PID Response Parsing ─────────────────────────────────────────────────────

    private fun parsePIDResponse(pid: String, raw: String): JSObject? {
        val info = PID_TABLE[pid.uppercase()] ?: return null

        // Expected pattern with headers on (ATH1): "41 {pid} {A} {B?} ..."
        // or without headers (ATS0 removes spaces between bytes but ATH1 adds mode/pid prefix)
        // We normalise by stripping non-hex, splitting into byte tokens
        val cleaned = raw
            .replace("\r", " ")
            .replace("\n", " ")
            .replace(">", "")
            .trim()

        // Find the response line that starts with "41" (positive response to mode 01)
        val responseLine = cleaned.split("\\s+".toRegex())
            .joinToString(" ")
            .uppercase()

        // Locate "41 XX" where XX is the requested PID (2 hex chars)
        val pidUpper = pid.uppercase().padStart(2, '0')
        val searchToken = "41 $pidUpper"
        val idx = responseLine.indexOf(searchToken)
        if (idx < 0) {
            Log.w(TAG, "PID $pid: no '41 $pidUpper' in response: $raw")
            return null
        }

        // Extract data bytes after "41 XX"
        val afterHeader = responseLine.substring(idx + searchToken.length).trim()
        val bytes = afterHeader.split(" ").filter { it.matches(Regex("[0-9A-F]{2}")) }

        if (bytes.isEmpty()) return null

        val a = bytes.getOrNull(0)?.toInt(16) ?: 0
        val b = bytes.getOrNull(1)?.toInt(16) ?: 0

        val value = info.formula(a, b)

        val obj = JSObject()
        obj.put("pid", pid.uppercase())
        obj.put("name", info.name)
        obj.put("value", value)
        obj.put("unit", info.unit)
        obj.put("min", info.min)
        obj.put("max", info.max)
        obj.put("timestamp", System.currentTimeMillis())
        return obj
    }

    // ─── Low-level I/O ────────────────────────────────────────────────────────────

    /**
     * Send a command string (already includes \r) and wait for the ELM327 prompt '>'.
     * Returns the response text (without the trailing '>').
     */
    @Synchronized
    private fun sendCommandSync(command: String): String {
        val out = outputStream ?: throw IOException("Output stream is null")
        val inp = inputStream ?: throw IOException("Input stream is null")

        // Send command
        out.write(command.toByteArray(Charsets.US_ASCII))
        out.flush()

        // Read until '>' or timeout
        val sb = StringBuilder()
        val deadline = System.currentTimeMillis() + COMMAND_TIMEOUT_MS

        while (System.currentTimeMillis() < deadline) {
            if (inp.available() > 0) {
                val byte = inp.read()
                if (byte == -1) throw IOException("Stream closed")
                val ch = byte.toChar()
                if (ch == '>') break
                sb.append(ch)
            } else {
                Thread.sleep(10)
            }
        }

        return sb.toString().trim()
    }

    /** Write raw bytes without waiting for a response. */
    private fun sendRaw(command: String) {
        val out = outputStream ?: return
        out.write(command.toByteArray(Charsets.US_ASCII))
        out.flush()
    }

    /** Discard any buffered input (e.g. after ATZ reset garbage). */
    private fun flushInput() {
        val inp = inputStream ?: return
        try {
            val deadline = System.currentTimeMillis() + 500
            while (System.currentTimeMillis() < deadline) {
                if (inp.available() > 0) inp.read() else Thread.sleep(20)
            }
        } catch (_: Exception) {}
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────────

    private fun stopPollingInternal() {
        isPolling.set(false)
        pollingThread?.join(2000)
        pollingThread = null
    }

    private fun closeConnection() {
        isConnected.set(false)
        try { inputStream?.close() } catch (_: Exception) {}
        try { outputStream?.close() } catch (_: Exception) {}
        try { socket?.close() } catch (_: Exception) {}
        inputStream = null
        outputStream = null
        socket = null
    }

    private fun emitConnectionStatus(status: String) {
        val obj = JSObject()
        obj.put("status", status)
        notifyListeners("connectionStatus", obj)
    }

    private fun hasBluetoothPermission(): Boolean {
        val ctx = context
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            ActivityCompat.checkSelfPermission(ctx, android.Manifest.permission.BLUETOOTH_CONNECT) ==
                PackageManager.PERMISSION_GRANTED
        } else {
            ActivityCompat.checkSelfPermission(ctx, android.Manifest.permission.BLUETOOTH) ==
                PackageManager.PERMISSION_GRANTED
        }
    }
}
