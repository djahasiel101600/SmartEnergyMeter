/**
 * Smart Energy Meter Firmware
 *
 * ESP8266-based energy monitoring with PZEM-004T sensor, LCD I2C display,
 * and WebSocket connectivity to Django backend.
 *
 * Hardware:
 * - ESP8266 NodeMCU v2
 * - PZEM-004T AC Energy Meter
 * - LCD I2C 16x2 Display
 *
 * Author: Smart Energy Meter Project
 * Date: May 2026
 * Version: 1.0.0
 */

#include <ESP8266WiFi.h>
#include <ESP8266httpUpdate.h>
#include <ArduinoWebsockets.h>
#include <ArduinoJson.h>
#include <PZEM004Tv30.h>
#include <SoftwareSerial.h>
#include <LiquidCrystal_I2C.h>
#include <ArduinoOTA.h>
#include "config.h"

// Firmware version
#define FIRMWARE_VERSION "2.0.1"

// Update intervals (milliseconds)
#define READING_INTERVAL 2500      // Send readings every 2.5 seconds
#define LCD_ROTATION_INTERVAL 5000 // Rotate LCD screen every 5 seconds
#define HEARTBEAT_INTERVAL 30000   // Send heartbeat every 30 seconds
#define RECONNECT_INTERVAL 5000    // Try to reconnect every 5 seconds

// Initialize hardware
SoftwareSerial pzemSWSerial(PZEM_RX_PIN, PZEM_TX_PIN);
PZEM004Tv30 pzem(pzemSWSerial);
LiquidCrystal_I2C lcd(LCD_ADDRESS, 16, 2);
using namespace websockets;
WebsocketsClient wsClient;

// State variables
unsigned long lastReadingTime = 0;
unsigned long lastLCDRotationTime = 0;
unsigned long lastHeartbeatTime = 0;
unsigned long lastReconnectAttempt = 0;
int currentLCDScreen = 0;
bool lcdEnabled = true;
int lcdRotationInterval = LCD_ROTATION_INTERVAL;
bool wsConnected = false;

// Latest sensor readings
float voltage = 0;
float current = 0;
float power = 0;
float energy = 0;
float frequency = 0;
float powerFactor = 0;

// Rate configuration (updated from server)
float ratePerKwh = 12.0;      // Default PHP per kWh
float nominalVoltage = 230.0; // Default nominal voltage (Philippines standard)

// LCD templates (up to 8 custom screens from backend)
struct LCDTemplate
{
    char line1[17]; // max 16 chars + null
    char line2[17];
};
static LCDTemplate lcdTemplates[8];
static int numLcdTemplates = 0;

void setup()
{
    Serial.begin(115200);
    pzemSWSerial.begin(9600);
    Serial.println("\n\nSmart Energy Meter v" + String(FIRMWARE_VERSION));

    // Initialize LCD
    lcd.init();
    lcd.backlight();
    lcd.setCursor(0, 0);
    lcd.print("Smart Energy");
    lcd.setCursor(0, 1);
    lcd.print("Meter v" + String(FIRMWARE_VERSION));
    delay(2000);

    // Connect to WiFi
    connectWiFi();

    // Initialize PZEM
    lcd.clear();
    lcd.print("Init PZEM...");
    delay(1000);

    // Setup OTA
    setupOTA();

    // Connect to WebSocket
    connectWebSocket();

    lcd.clear();
    lcd.print("Ready!");
    delay(1000);
}

void loop()
{
    // Handle WiFi reconnection
    if (WiFi.status() != WL_CONNECTED)
    {
        if (millis() - lastReconnectAttempt > RECONNECT_INTERVAL)
        {
            connectWiFi();
            lastReconnectAttempt = millis();
        }
    }

    // Handle WebSocket reconnection
    if (!wsConnected && WiFi.status() == WL_CONNECTED)
    {
        if (millis() - lastReconnectAttempt > RECONNECT_INTERVAL)
        {
            connectWebSocket();
            lastReconnectAttempt = millis();
        }
    }

    // Poll WebSocket
    if (wsConnected)
    {
        wsClient.poll();
    }

    // Handle OTA updates
    ArduinoOTA.handle();

    // Read sensors and send data
    if (millis() - lastReadingTime > READING_INTERVAL)
    {
        readSensors();
        if (wsConnected)
        {
            sendReading();
        }
        lastReadingTime = millis();
    }

    // Rotate LCD display
    if (lcdEnabled && millis() - lastLCDRotationTime > lcdRotationInterval)
    {
        updateLCD();
        lastLCDRotationTime = millis();
    }

    // Send heartbeat
    if (wsConnected && millis() - lastHeartbeatTime > HEARTBEAT_INTERVAL)
    {
        sendHeartbeat();
        lastHeartbeatTime = millis();
    }
}

void connectWiFi()
{
    Serial.println("Connecting to WiFi: " + String(WIFI_SSID));
    lcd.clear();
    lcd.print("WiFi...");

    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20)
    {
        delay(500);
        Serial.print(".");
        lcd.setCursor(0, 1);
        lcd.print("Attempt " + String(attempts + 1));
        attempts++;
    }

    if (WiFi.status() == WL_CONNECTED)
    {
        Serial.println("\nWiFi connected!");
        Serial.println("IP: " + WiFi.localIP().toString());
        lcd.clear();
        lcd.print("WiFi Connected!");
        lcd.setCursor(0, 1);
        lcd.print(WiFi.localIP().toString());
        delay(2000);
    }
    else
    {
        Serial.println("\nWiFi connection failed!");
        lcd.clear();
        lcd.print("WiFi Failed!");
        delay(2000);
    }
}

void connectWebSocket()
{
    if (WiFi.status() != WL_CONNECTED)
    {
        Serial.println("[WS] Aborting WebSocket connect: WiFi not connected");
        return;
    }

    Serial.println("[WS] Connecting to WebSocket server...");
    Serial.print("[WS] Device IP: ");
    Serial.println(WiFi.localIP());

    lcd.clear();
    lcd.print("Connecting WS...");

    String wsUrl = String("ws://") + WS_SERVER + ":" + String(WS_PORT) +
                   WS_PATH + DEVICE_TOKEN + "/";

    Serial.print("[WS] Target URL: ");
    Serial.println(wsUrl);

    // Set WebSocket callbacks
    wsClient.onMessage(onWebSocketMessage);
    wsClient.onEvent(onWebSocketEvent);

    Serial.println("[WS] Attempting connection...");
    bool connected = wsClient.connect(wsUrl);

    if (connected)
    {
        Serial.println("[WS] WebSocket connected successfully!");
        wsConnected = true;
        lcd.clear();
        lcd.print("WS Connected!");
        delay(1000);

        // Send initial status
        sendStatus();
    }
    else
    {
        Serial.println("[WS] WebSocket connection failed!");
        Serial.println("[WS] Check your WS_SERVER IP, ensure backend is bound to 0.0.0.0, and check Windows Firewall.");
        wsConnected = false;
        lcd.clear();
        lcd.print("WS Failed!");
        delay(2000);
    }
}

void onWebSocketMessage(WebsocketsMessage message)
{
    Serial.println("WS Message: " + message.data());

    // Parse JSON message
    StaticJsonDocument<512> doc;
    DeserializationError error = deserializeJson(doc, message.data());

    if (error)
    {
        Serial.println("JSON parsing failed!");
        return;
    }

    const char *type = doc["type"];

    if (strcmp(type, "command") == 0)
    {
        handleCommand(doc);
    }
    else if (strcmp(type, "config") == 0)
    {
        handleConfig(doc);
    }
    else if (strcmp(type, "reading_ack") == 0)
    {
        // Reading acknowledged by server
        Serial.println("Reading acknowledged");
    }
    else if (strcmp(type, "heartbeat_ack") == 0)
    {
        // Heartbeat acknowledged
        Serial.println("Heartbeat OK");
    }
}

void onWebSocketEvent(WebsocketsEvent event, String data)
{
    if (event == WebsocketsEvent::ConnectionOpened)
    {
        Serial.println("[WS EVENT] WebSocket opened");
        wsConnected = true;
    }
    else if (event == WebsocketsEvent::ConnectionClosed)
    {
        Serial.print("[WS EVENT] WebSocket closed. Reason/Data: ");
        Serial.println(data);
        wsConnected = false;
    }
    else if (event == WebsocketsEvent::GotPing)
    {
        Serial.println("[WS EVENT] Got ping");
    }
    else if (event == WebsocketsEvent::GotPong)
    {
        Serial.println("[WS EVENT] Got pong");
    }
}

void readSensors()
{
    float raw_voltage = pzem.voltage();
    if (isnan(raw_voltage))
    {
        Serial.println("ERROR: Error reading PZEM-004T. Check wiring, power, and pin assignments!");
    }
    else
    {
        Serial.println("SUCCESS: PZEM communication established.");
    }

    voltage = raw_voltage;
    current = pzem.current();
    power = pzem.power();
    energy = pzem.energy();
    frequency = pzem.frequency();
    powerFactor = pzem.pf();

    // Check for NaN values
    if (isnan(voltage))
        voltage = 0;
    if (isnan(current))
        current = 0;
    if (isnan(power))
        power = 0;
    if (isnan(energy))
        energy = 0;
    if (isnan(frequency))
        frequency = 0;
    if (isnan(powerFactor))
        powerFactor = 0;

    Serial.printf("V: %.1fV, I: %.3fA, P: %.1fW, E: %.3fkWh, F: %.1fHz, PF: %.2f\n",
                  voltage, current, power, energy, frequency, powerFactor);
}

void sendReading()
{
    StaticJsonDocument<512> doc;
    doc["type"] = "reading";

    JsonObject data = doc.createNestedObject("data");
    data["voltage"] = round(voltage * 100) / 100.0;
    data["current"] = round(current * 1000) / 1000.0;
    data["power"] = round(power * 100) / 100.0;
    data["energy"] = round(energy * 1000) / 1000.0;
    data["frequency"] = round(frequency * 100) / 100.0;
    data["power_factor"] = round(powerFactor * 100) / 100.0;

    String jsonString;
    serializeJson(doc, jsonString);

    wsClient.send(jsonString);
    Serial.println("Sent reading");
}

void sendStatus()
{
    StaticJsonDocument<512> doc;
    doc["type"] = "status";

    JsonObject data = doc.createNestedObject("data");
    data["firmware_version"] = FIRMWARE_VERSION;
    data["mac_address"] = WiFi.macAddress();
    data["uptime"] = millis() / 1000;
    data["rssi"] = WiFi.RSSI();

    String jsonString;
    serializeJson(doc, jsonString);

    wsClient.send(jsonString);
    Serial.println("Sent status");
}

void sendHeartbeat()
{
    StaticJsonDocument<256> doc;
    doc["type"] = "heartbeat";

    String jsonString;
    serializeJson(doc, jsonString);

    wsClient.send(jsonString);
    Serial.println("Sent heartbeat");
}

void handleCommand(JsonDocument &doc)
{
    const char *command = doc["command"];

    Serial.println("Command: " + String(command));

    if (strcmp(command, "reset_energy") == 0)
    {
        pzem.resetEnergy();
        Serial.println("Energy counter reset");
        lcd.clear();
        lcd.print("Energy Reset!");
        delay(2000);
    }
    else if (strcmp(command, "reboot") == 0)
    {
        Serial.println("Rebooting...");
        lcd.clear();
        lcd.print("Rebooting...");
        delay(1000);
        ESP.restart();
    }
    else if (strcmp(command, "lcd_on") == 0)
    {
        lcdEnabled = true;
        lcd.backlight();
        Serial.println("LCD enabled");
    }
    else if (strcmp(command, "lcd_off") == 0)
    {
        lcdEnabled = false;
        lcd.noBacklight();
        Serial.println("LCD disabled");
    }
    else if (strcmp(command, "ota_update") == 0)
    {
        const char *raw_url = doc["url"];
        String url = String(raw_url);

        // Replace localhost or 127.0.0.1 with the known server IP (WS_SERVER)
        // since the ESP needs to reach the PC, not itself.
        url.replace("localhost", WS_SERVER);
        url.replace("127.0.0.1", WS_SERVER);

        Serial.println("Starting OTA from URL: " + url);
        lcd.clear();
        lcd.print("Downloading OTA");
        lcd.setCursor(0, 1);
        lcd.print("Please wait...");

        WiFiClient client;
        ESPhttpUpdate.onProgress([](int cur, int total)
                                 { 
                                     Serial.printf("Downloading %d of %d bytes...\n", cur, total); 
                                     
                                     // Report progress to backend via WS
                                     if (total > 0) {
                                         static int last_progress = -1;
                                         int progress = (cur * 100) / total;
                                         
                                         // Throttle updates to every 5%
                                         if (progress != last_progress && progress % 5 == 0) {
                                             last_progress = progress;
                                             StaticJsonDocument<256> pdoc;
                                             pdoc["type"] = "ota_progress";
                                             pdoc["progress"] = progress;
                                             String pjson;
                                             serializeJson(pdoc, pjson);
                                             wsClient.send(pjson);
                                         }
                                     } });

        // Use ESPhttpUpdate to fetch and apply the firmware
        t_httpUpdate_return ret = ESPhttpUpdate.update(client, url);

        switch (ret)
        {
        case HTTP_UPDATE_FAILED:
            Serial.printf("HTTP_UPDATE_FAILED Error (%d): %s\n", ESPhttpUpdate.getLastError(), ESPhttpUpdate.getLastErrorString().c_str());
            lcd.clear();
            lcd.print("Update Failed!");
            delay(2000);
            break;
        case HTTP_UPDATE_NO_UPDATES:
            Serial.println("HTTP_UPDATE_NO_UPDATES");
            break;
        case HTTP_UPDATE_OK:
            Serial.println("HTTP_UPDATE_OK");
            // The device automatically reboots upon success
            break;
        }
    }
}

void handleConfig(JsonDocument &doc)
{
    JsonObject config = doc["config"];

    if (config.containsKey("lcd_rotation_interval"))
    {
        lcdRotationInterval = config["lcd_rotation_interval"];
        Serial.println("LCD rotation interval: " + String(lcdRotationInterval));
    }

    if (config.containsKey("rate_per_kwh"))
    {
        ratePerKwh = config["rate_per_kwh"];
        Serial.println("Rate per kWh: " + String(ratePerKwh));
    }

    if (config.containsKey("nominal_voltage"))
    {
        nominalVoltage = config["nominal_voltage"];
        Serial.println("Nominal voltage: " + String(nominalVoltage) + "V");
    }

    // Parse custom LCD templates array
    if (config.containsKey("lcd_templates") && config["lcd_templates"].is<JsonArray>())
    {
        JsonArray arr = config["lcd_templates"].as<JsonArray>();
        int count = 0;
        for (JsonObject tmpl : arr)
        {
            if (count >= 8)
                break;
            const char *l1 = tmpl["line1"] | "";
            const char *l2 = tmpl["line2"] | "";
            strncpy(lcdTemplates[count].line1, l1, 16);
            lcdTemplates[count].line1[16] = '\0';
            strncpy(lcdTemplates[count].line2, l2, 16);
            lcdTemplates[count].line2[16] = '\0';
            count++;
        }
        numLcdTemplates = count;
        currentLCDScreen = 0; // reset rotation on template change
        Serial.println("LCD templates loaded: " + String(numLcdTemplates));
    }
}

void updateLCD()
{
    lcd.clear();

    // ── Custom templates (from backend) ─────────────────────────────────────
    if (numLcdTemplates > 0)
    {
        LCDTemplate &tmpl = lcdTemplates[currentLCDScreen % numLcdTemplates];

        // Render line1
        String l1 = String(tmpl.line1);
        String l2 = String(tmpl.line2);

        // Token substitution helper lambda
        auto sub = [&](String &s, const char *token, String value)
        {
            s.replace(token, value);
        };

        sub(l1, "{v}", String(voltage, 1));
        sub(l1, "{i}", String(current, 3));
        sub(l1, "{p}", String(power, 1));
        sub(l1, "{e}", String(energy, 3));
        sub(l1, "{f}", String(frequency, 1));
        sub(l1, "{pf}", String(powerFactor, 2));
        sub(l1, "{cost}", String(energy * ratePerKwh, 2));
        sub(l1, "{status}", wsConnected ? String("Online") : String("Offline"));

        sub(l2, "{v}", String(voltage, 1));
        sub(l2, "{i}", String(current, 3));
        sub(l2, "{p}", String(power, 1));
        sub(l2, "{e}", String(energy, 3));
        sub(l2, "{f}", String(frequency, 1));
        sub(l2, "{pf}", String(powerFactor, 2));
        sub(l2, "{cost}", String(energy * ratePerKwh, 2));
        sub(l2, "{status}", wsConnected ? String("Online") : String("Offline"));

        lcd.setCursor(0, 0);
        lcd.print(l1.substring(0, 16));
        lcd.setCursor(0, 1);
        lcd.print(l2.substring(0, 16));

        currentLCDScreen = (currentLCDScreen + 1) % numLcdTemplates;
        return;
    }

    // ── Fallback: built-in screens ───────────────────────────────────────────
    switch (currentLCDScreen)
    {
    case 0:
        // Screen 1: Voltage & Current
        lcd.setCursor(0, 0);
        lcd.print(String(voltage, 1) + "V  " + String(current, 3) + "A");
        lcd.setCursor(0, 1);
        // Show voltage status based on nominal (±10%)
        if (voltage > 0 && (voltage < nominalVoltage * 0.9 || voltage > nominalVoltage * 1.1))
            lcd.print("Warn: " + String(nominalVoltage, 0) + "V nom");
        else
            lcd.print("Power: " + String(power, 1) + "W");
        break;

    case 1:
        // Screen 2: Energy & Cost
        lcd.setCursor(0, 0);
        lcd.print("E: " + String(energy, 2) + "kWh");
        lcd.setCursor(0, 1);
        lcd.print("PHP " + String(energy * ratePerKwh, 2));
        break;

    case 2:
        // Screen 3: Power Factor & Frequency
        lcd.setCursor(0, 0);
        lcd.print("PF:" + String(powerFactor, 2) + " " + String(frequency, 1) + "Hz");
        lcd.setCursor(0, 1);
        if (wsConnected)
        {
            lcd.print("Status: Online");
        }
        else
        {
            lcd.print("Status: Offline");
        }
        break;
    }

    currentLCDScreen = (currentLCDScreen + 1) % 3;
}

void setupOTA()
{
    ArduinoOTA.setHostname("SmartEnergyMeter");
    ArduinoOTA.setPassword("admin");

    ArduinoOTA.onStart([]()
                       {
    String type;
    if (ArduinoOTA.getCommand() == U_FLASH) {
      type = "sketch";
    } else {
      type = "filesystem";
    }
    Serial.println("Start updating " + type);
    lcd.clear();
    lcd.print("OTA Update..."); });

    ArduinoOTA.onEnd([]()
                     {
    Serial.println("\nEnd");
    lcd.clear();
    lcd.print("Update Complete!"); });

    ArduinoOTA.onProgress([](unsigned int progress, unsigned int total)
                          {
    Serial.printf("Progress: %u%%\r", (progress / (total / 100)));
    lcd.setCursor(0, 1);
    lcd.print(String((progress / (total / 100))) + "%"); });

    ArduinoOTA.onError([](ota_error_t error)
                       {
    Serial.printf("Error[%u]: ", error);
    if (error == OTA_AUTH_ERROR) {
      Serial.println("Auth Failed");
    } else if (error == OTA_BEGIN_ERROR) {
      Serial.println("Begin Failed");
    } else if (error == OTA_CONNECT_ERROR) {
      Serial.println("Connect Failed");
    } else if (error == OTA_RECEIVE_ERROR) {
      Serial.println("Receive Failed");
    } else if (error == OTA_END_ERROR) {
      Serial.println("End Failed");
    }
    lcd.clear();
    lcd.print("Update Failed!"); });

    ArduinoOTA.begin();
    Serial.println("OTA Ready");
}
