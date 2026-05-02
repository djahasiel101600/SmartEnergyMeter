# Smart Energy Meter Firmware

ESP8266-based energy monitoring firmware with PZEM-004T sensor, LCD display, and WebSocket connectivity.

## Hardware Requirements

- ESP8266 NodeMCU v2 or compatible
- PZEM-004T AC energy meter
- LCD I2C 16x2 display
- 5V power supply

## Pin Connections

### PZEM-004T (Software Serial)

- RX Pin: GPIO12 (D6)
- TX Pin: GPIO13 (D7)

### LCD I2C

- SDA: GPIO4 (D2)
- SCL: GPIO5 (D1)

## PlatformIO Setup

The project is already configured with `platformio.ini`. All dependencies are automatically installed.

```bash
cd firmware

# Copy configuration template
cp include/config.h.example include/config.h
# Edit include/config.h with your settings

# Build
pio run

# Upload
pio run --target upload

# Monitor
pio run --target monitor

# Upload and monitor
pio run --target upload --target monitor
```

## Arduino IDE Setup

1. Install ESP8266 board support (Tools → Board → Boards Manager → ESP8266)
2. Install required libraries via Library Manager:
   - PZEM-004T-v30 by Jakub Mandula
   - LiquidCrystal I2C by Frank de Brabander
   - ArduinoWebsockets by Gil Maimon
   - ArduinoJson by Benoit Blanchon

3. Copy `include/config.h.example` to `include/config.h` and edit with your settings
4. Open `src/firmware.ino` in Arduino IDE
5. Select Board: NodeMCU 1.0 (ESP-12E Module)
6. Upload to ESP8266

## Configuration

Copy `include/config.h.example` to `include/config.h` and update with your credentials:

```cpp
// WiFi credentials
#define WIFI_SSID "your-wifi-ssid"
#define WIFI_PASSWORD "your-wifi-password"

// Backend server
#define WS_SERVER "192.168.1.100"  // Your backend server IP
#define WS_PORT 8000
#define WS_PATH "/ws/device/"
#define DEVICE_TOKEN "your-device-token"  // Get from Django admin

// LCD I2C address (usually 0x27 or 0x3F)
#define LCD_ADDRESS 0x27

// PZEM pins
#define PZEM_RX_PIN 12  // D6
#define PZEM_TX_PIN 13  // D7
```

## Features

- [x] Real-time energy monitoring with PZEM-004T
- [x] LCD display with rotating information
- [x] WiFi connectivity with auto-reconnect
- [x] WebSocket communication with backend
- [x] JSON data transmission
- [x] Heartbeat/ping mechanism
- [x] OTA updates support
- [x] Device reset via WebSocket command
- [x] LCD enable/disable control
- [x] Configurable LCD rotation interval

## LCD Display Screens

The LCD rotates through different screens every 5 seconds:

1. **Voltage & Current**

   ```
   220.5V  1.234A
   Power: 272.1W
   ```

2. **Energy & Cost**

   ```
   Energy: 12.34kWh
   Cost: PHP 123.45
   ```

3. **Power Factor & Frequency**
   ```
   PF: 0.99  50.0Hz
   Status: Online
   ```

## WebSocket Protocol

### Device → Server (Energy Reading)

```json
{
  "type": "reading",
  "data": {
    "voltage": 220.5,
    "current": 1.234,
    "power": 272.1,
    "energy": 12.345,
    "frequency": 50.0,
    "power_factor": 0.99
  },
  "timestamp": "2026-05-01T20:30:00Z"
}
```

### Device → Server (Status Update)

```json
{
  "type": "status",
  "data": {
    "firmware_version": "1.0.0",
    "mac_address": "AA:BB:CC:DD:EE:FF",
    "uptime": 3600
  }
}
```

### Server → Device (Command)

```json
{
  "type": "command",
  "command": "reset_energy",
  "params": {}
}
```

## Troubleshooting

1. **PZEM not reading**: Check TX/RX connections (they should be crossed)
2. **LCD not displaying**: Check I2C address (use I2C scanner sketch)
3. **WebSocket disconnects**: Check network stability and server availability
4. **Build errors**: Ensure all libraries are installed

## License

MIT License
