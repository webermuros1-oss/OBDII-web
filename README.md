# OBDII Diagnostics

Aplicación de escritorio multiplataforma para diagnosticar vehículos con el adaptador **ELM327 Mini Bluetooth** (el azul de la foto). Conecta al puerto OBD2 del coche, lee sensores en tiempo real, gestiona códigos de error DTC y guarda un historial de sesiones.

---

## Características

| Función | Descripción |
|---|---|
| 📊 Dashboard en tiempo real | RPM, velocidad, temperatura, nivel combustible, carga motor y más |
| 📈 Gráficas en vivo | Visualización temporal de cualquier sensor OBD2 |
| 🔍 Lectura de DTCs | Códigos de error almacenados, pendientes y permanentes con descripción ES/EN |
| 🗑️ Borrar DTCs | Elimina los códigos y apaga el testigo de avería (MIL / check engine) |
| 📁 Historial de sesiones | Cada conexión se guarda automáticamente en SQLite |
| 🚗 Info del vehículo | VIN, protocolo OBD2 detectado y lista de sensores soportados |

---

## Requisitos del sistema

| Sistema | Versión mínima |
|---|---|
| Windows | 10 (x64) |
| macOS | 11 Big Sur (Intel o Apple Silicon) |
| Adaptador | ELM327 Bluetooth (Classic SPP) |

> El coche debe tener conector OBD2 — obligatorio en Europa desde 2001, EE.UU. desde 1996.

---

## Instalación desde código fuente

### 1. Prerrequisitos

#### macOS
```bash
# Xcode Command Line Tools (compila módulos nativos como serialport)
xcode-select --install

# Node.js 20+ (recomendado via nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
nvm install 20
nvm use 20
```

#### Windows
- Node.js 20+ desde [nodejs.org](https://nodejs.org)
- Visual Studio Build Tools con "Desktop development with C++" para compilar módulos nativos

---

### 2. Clonar e instalar

```bash
git clone https://github.com/webermuros1-oss/OBDII-web.git
cd OBDII-web
npm install
```

> En **macOS**, `npm install` compilará automáticamente `serialport` (módulo nativo). Necesitas Xcode CLI Tools instalado.

---

### 3. Modo desarrollo

```bash
npm run dev
```

Abre la ventana Electron con hot-reload. Vite sirve el renderer en `http://localhost:5173` y el proceso principal de Electron se conecta a él automáticamente.

---

### 4. Generar instalador

#### macOS → `.dmg`
```bash
npm run dist:mac
# Salida: release/1.0.0/OBDII Diagnostics-1.0.0.dmg
```

#### Windows → instalador NSIS `.exe`
```bash
npm run dist:win
# Salida: release/1.0.0/OBDII Diagnostics-1.0.0-Setup.exe
```

> **Nota Windows**: Si ves el error `Cannot create symbolic link`, activa el **Modo de desarrollador** en Ajustes → Sistema → Para desarrolladores, o ejecuta la terminal como Administrador.

---

## Configuración del adaptador ELM327

### macOS — Emparejar el ELM327

1. Enciende el contacto del coche (no hace falta arrancar el motor)
2. Conecta el ELM327 al puerto OBD2 (bajo el volante, lado conductor)
3. Abre **Preferencias del Sistema** → **Bluetooth**
4. Busca el dispositivo "OBDII" o "ELM327" y emparéjalo (PIN: `1234` o `0000`)
5. Abre Terminal y busca el puerto asignado:
   ```bash
   ls /dev/tty.* | grep -i "ELM\|OBD\|BT"
   # Ejemplo: /dev/tty.OBDII-Port  o  /dev/tty.ELM327-BT
   ```
6. Apunta ese nombre — lo necesitarás en la app

### Windows — Emparejar el ELM327

1. Conecta el ELM327 al puerto OBD2 y enciende el contacto
2. **Configuración** → **Bluetooth y dispositivos** → **Agregar dispositivo**
3. Selecciona el ELM327 (puede aparecer como "OBDII" o "ELM327")
4. PIN por defecto: `1234` o `0000`
5. Windows crea un puerto COM virtual — búscalo en **Administrador de dispositivos** → **Puertos (COM y LPT)**
6. Apunta el número, p.ej. `COM3`

---

## Uso de la aplicación

```
┌─────────────────────────────────────────────────────┐
│  OBDII Diag                                          │
│  ─────────────────────────────────────────────────  │
│  🔲 Dashboard      ← Sensores en tiempo real        │
│  📈 Datos en vivo  ← Gráficas históricas            │
│  ⚠️  Códigos DTC   ← Leer y borrar errores          │
│  🕐 Historial      ← Sesiones guardadas             │
│  🚗 Vehículo       ← VIN e info del ECU             │
│                                                     │
│  ────── Conexión ──────                             │
│  Puerto: /dev/tty.OBDII-Port  ▼                     │
│  Baudrate: 38400              ▼                     │
│  [ Conectar ]                                       │
└─────────────────────────────────────────────────────┘
```

1. **Selecciona el puerto** en el panel inferior izquierdo (botón ↻ para refrescar)
2. **Baudrate**: prueba `38400` primero. Si no conecta, prueba `9600`
3. Pulsa **Conectar** — el indicador inferior cambia a verde
4. Ve a **Dashboard** → pulsa **▶ Iniciar lectura**
5. Para leer errores: **Códigos DTC** → **🔍 Leer DTCs**
6. Para borrar errores: **🗑 Borrar DTCs** (confirma el diálogo)

---

## Protocolos OBD2 soportados

El ELM327 detecta el protocolo automáticamente (`ATSP0`):

| Protocolo | Coches |
|---|---|
| ISO 15765-4 CAN | Mayoría de coches modernos (2008+) |
| ISO 14230-4 KWP | Europeos y asiáticos (2001-2008) |
| ISO 9141-2 | Europeos y asiáticos (1996-2004) |
| SAE J1850 PWM/VPW | Ford y GM americanos |

---

## Scripts disponibles

```bash
npm run dev          # Modo desarrollo (Vite + Electron)
npm run build        # Build de producción (Vite + tsc)
npm run dist:win     # Instalador Windows (.exe NSIS)
npm run dist:mac     # Imagen de disco macOS (.dmg)
npm run dist:linux   # AppImage Linux
npm run dist         # Los tres a la vez
```

---

## Estructura del proyecto

```
OBDII-web/
├── electron/                  # Proceso principal Electron (Node.js)
│   ├── main.ts                # Entry point
│   ├── preload.ts             # Bridge IPC → window.obd API
│   ├── obd/
│   │   ├── elm327.ts          # Driver ELM327 (AT commands)
│   │   ├── pids.ts            # 15 PIDs con parsers de conversión
│   │   ├── dtc.ts             # Decodificador de códigos DTC
│   │   ├── scanner.ts         # Loop de polling (250ms)
│   │   └── dto/               # Tipos y patrón Result<T>
│   ├── ipc/                   # Handlers IPC (conexión, OBD2, sesiones)
│   ├── db/                    # SQLite via sql.js (WASM)
│   └── data/dtc-codes.json    # Base de datos de ~117 códigos DTC (ES/EN)
├── src/                       # Renderer React
│   ├── types/obd.ts           # DTOs compartidos + Result<T>
│   ├── store/obdStore.ts      # Estado global (Zustand)
│   ├── hooks/                 # useOBDConnection, useLiveData, useDTC
│   ├── pages/                 # Dashboard, LiveData, DtcManager, History, VehicleInfo
│   └── components/            # Layout, ConnectionPanel, SensorCard, LiveChart, etc.
├── electron-builder.yml       # Config de empaquetado Win/Mac/Linux
└── package.json
```

---

## Stack tecnológico

- **Electron 31** — proceso principal (Node.js CommonJS)
- **React 18 + Vite 5** — renderer con hot-reload
- **TypeScript** — tipado estricto en toda la app
- **Tailwind CSS** — dark theme
- **Recharts** — gráficas en tiempo real
- **Zustand** — estado global
- **serialport** — comunicación serie con el ELM327
- **sql.js** — SQLite en WebAssembly (sin compilación nativa)
- **electron-builder** — empaquetado multiplataforma

---

## Licencia

MIT — úsalo, modifícalo y distribúyelo libremente.
