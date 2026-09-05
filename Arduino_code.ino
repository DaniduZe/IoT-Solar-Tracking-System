#include <WiFi.h>
#include <WebServer.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <Adafruit_INA219.h>
#include <ESP32Servo.h>
#include <NTPClient.h>
#include <WiFiUdp.h>
#include <Preferences.h> // NEW: Library for permanent storage

// --- System States & Config ---
enum SystemState { WIFI_SETUP, CALIBRATION, RUNNING };
SystemState currentState; // Will be set in setup()

Preferences preferences; // Create Preferences object

String savedSSID = "";
String savedPass = "";
String savedLat = "0.0";
String savedLon = "0.0";
long timeZoneOffset = 0; 
String wifiListOptions = "";

// --- Hardware Setup ---
#define I2C1_SDA 32
#define I2C1_SCL 33
#define RAIN_PIN 4
#define SERVO_PIN 18
#define RESET_PIN 0 // The built-in BOOT button

Adafruit_INA219 ina219_in;   
Adafruit_INA219 ina219_out;  
TwoWire I2C_Two = TwoWire(1);
bool in_ina_ok = false;
bool out_ina_ok = false;
Servo myServo;

int servoAngle = 90;
int calibratedZeroPosition = 90; 

// --- Networking & Data Objects ---
WebServer server(80);
WiFiClient espClient;
PubSubClient mqttClient(espClient);
WiFiUDP ntpUDP;

NTPClient timeClient(ntpUDP, "pool.ntp.org", 0, 60000); 

SemaphoreHandle_t dataMutex;
struct SensorData {
  float in_v, in_a, out_v, out_a;
  bool isRaining;
  int currentHour;
  char timeStr[15]; 
} currentData;

// ==========================================
// WEB SERVER HTML TEMPLATES (Unchanged)
// ==========================================

const char* html_wifi_page = R"rawliteral(
<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Solar Setup</title><style>body{font-family:Arial;text-align:center;margin:50px;} select,input,button{padding:10px;margin:10px;width:80%;max-width:300px;}</style></head><body>
<h2>Connect to WiFi</h2>
<select id="ssid">%OPTIONS%</select><br>
<input type="password" id="pass" placeholder="WiFi Password"><br>
<button onclick="connect()">Connect</button>
<p id="status"></p>
<script>
function connect() {
  let s = document.getElementById('ssid').value;
  let p = document.getElementById('pass').value;
  document.getElementById('status').innerText = "Testing connection (takes ~5s)...";
  fetch('/testwifi?ssid=' + encodeURIComponent(s) + '&pass=' + encodeURIComponent(p))
    .then(res => {
      if(res.ok) window.location.href = '/calibrate';
      else { alert("Incorrect Password or unable to connect!"); document.getElementById('status').innerText = ""; }
    });
}
</script></body></html>
)rawliteral";

const char* html_calib_page = R"rawliteral(
<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Calibrate & Location</title><style>body{font-family:Arial;text-align:center;margin:20px;} input,button{padding:10px;margin:5px;}</style></head><body>
<h2>1. Get Location & Timezone</h2>
<button onclick="getLoc()">Auto GPS</button><br>
Lat: <input type="text" id="lat"><br>
Lon: <input type="text" id="lon"><br>
<h2>2. Calibrate Flat (0)</h2>
<p>Adjust the panel until it is perfectly flat.</p>
<button onclick="move('up')">UP (+5&deg;)</button>
<button onclick="move('down')">DOWN (-5&deg;)</button><br><br>
<button onclick="save()" style="background-color:green;color:white;padding:15px;">SAVE & START</button>
<script>
function getLoc() {
  if(navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => { 
        document.getElementById('lat').value = pos.coords.latitude; 
        document.getElementById('lon').value = pos.coords.longitude; 
      },
      (err) => { alert("Browser blocked GPS over HTTP. Please enter coordinates manually."); }
    );
  }
}
function move(dir) { fetch('/move?dir=' + dir); }
function save() { 
  let lat = document.getElementById('lat').value;
  let lon = document.getElementById('lon').value;
  let tzSec = -(new Date().getTimezoneOffset() * 60); 
  
  fetch(`/save?lat=${lat}&lon=${lon}&tz=${tzSec}`).then(()=>{
    document.body.innerHTML = "<h2>Saved!</h2><p>Hotspot closing. Connecting to WiFi and starting autonomous tracking...</p>";
  });
}
</script></body></html>
)rawliteral";

// ==========================================
// WEB SERVER ROUTE HANDLERS
// ==========================================

void handleRoot() {
  String html = html_wifi_page;
  html.replace("%OPTIONS%", wifiListOptions);
  server.send(200, "text/html", html);
}

void handleTestWifi() {
  String s = server.arg("ssid");
  String p = server.arg("pass");
  WiFi.begin(s.c_str(), p.c_str());
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 15) {
    delay(500); attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    savedSSID = s; savedPass = p;
    WiFi.disconnect(); 
    server.send(200, "text/plain", "OK");
  } else {
    WiFi.disconnect();
    server.send(400, "text/plain", "FAIL");
  }
}

void handleCalibrate() {
  server.send(200, "text/html", html_calib_page);
}

void handleMove() {
  String dir = server.arg("dir");
  if (dir == "up" && servoAngle <= 175) servoAngle += 5;
  if (dir == "down" && servoAngle >= 5) servoAngle -= 5;
  myServo.write(servoAngle);
  server.send(200, "text/plain", "MOVED");
}

void handleSave() {
  savedLat = server.arg("lat");
  savedLon = server.arg("lon");
  
  if (server.hasArg("tz")) {
    timeZoneOffset = server.arg("tz").toInt();
    timeClient.setTimeOffset(timeZoneOffset); 
  }
  
  calibratedZeroPosition = servoAngle;

  // --- SAVE TO PERMANENT MEMORY ---
  preferences.begin("solar", false); // Open namespace in R/W mode
  preferences.putString("ssid", savedSSID);
  preferences.putString("pass", savedPass);
  preferences.putString("lat", savedLat);
  preferences.putString("lon", savedLon);
  preferences.putLong("tz", timeZoneOffset);
  preferences.putInt("calib0", calibratedZeroPosition);
  preferences.end();
  Serial.println("Configuration saved permanently to Flash!");

  server.send(200, "text/plain", "SAVED");
  delay(1000);
  currentState = RUNNING; 
}

// ==========================================
// AUTONOMOUS CONTROL LOGIC
// ==========================================

int calculateOptimalAngle(int hour, bool raining) {
  int target = calibratedZeroPosition;
  String reason = "";

  if (raining) {
    target = 60; 
    reason = "Raining (Forcing 60 degrees)";
  }
  else if (hour < 6 || hour >= 18) {
    target = calibratedZeroPosition; 
    reason = "Night/Aerodynamic (Flat)";
  }
  else {
    target = map(hour, 6, 18, calibratedZeroPosition + 90, calibratedZeroPosition - 90);
    reason = "Sun Tracking Active";
  }

  target = constrain(target, 0, 180);

  Serial.print("[LOGIC] Hour: "); Serial.print(hour);
  Serial.print(" | Rain: "); Serial.print(raining ? "YES" : "NO");
  Serial.print(" | Decision: "); Serial.print(reason);
  Serial.print(" | Target Angle: "); Serial.println(target);

  return target;
}

// ==========================================
// CORE 0 TASK: MQTT & COMMUNICATON
// ==========================================

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (int i = 0; i < length; i++) message += (char)payload[i];
  
  if (String(topic) == "SOLAR_CONTROL") {
    message.trim();
    if (message == "CLEAN") {
      servoAngle = 60; 
      myServo.write(servoAngle);
      Serial.println("\n[MQTT COMMAND] Cleaning Mode Triggered. Servo to 60.");
    } else if (message == "REBOOT") {
      Serial.println("\n[MQTT COMMAND] Rebooting...");
      delay(500);
      ESP.restart();
    } else if (message == "SLEEP") {
      Serial.println("\n[MQTT COMMAND] Entering Deep Sleep for 60s...");
      delay(500);
      ESP.deepSleep(60e6);
    } else {
      int requestedAngle = message.toInt();
      if (requestedAngle >= 0 && requestedAngle <= 180 && message.length() > 0 && isDigit(message.charAt(0))) {
        servoAngle = requestedAngle;
        myServo.write(servoAngle);
        Serial.print("\n[MQTT OVERRIDE] Servo moved remotely to: "); 
        Serial.println(servoAngle);
      }
    }
  }
}

void mqttTask(void *pvParameters) {
  mqttClient.setServer("broker.hivemq.com", 1883);
  mqttClient.setBufferSize(512); // CRITICAL: Prevent PubSubClient 128-byte silent drop
  mqttClient.setKeepAlive(15);
  mqttClient.setCallback(mqttCallback);

  while (true) {
    if (WiFi.status() != WL_CONNECTED) {
      vTaskDelay(1000 / portTICK_PERIOD_MS);
      continue;
    }

    timeClient.update();
    int networkHour = timeClient.getHours();
    String networkTimeStr = timeClient.getFormattedTime();

    if (!mqttClient.connected()) {
      String clientId = "SolarESP32-" + String(random(0xffff), HEX);
      Serial.print("[MQTT] Connecting to HiveMQ broker as ");
      Serial.println(clientId);
      if (mqttClient.connect(clientId.c_str())) {
        Serial.println("[MQTT] Connected! Subscribing to SOLAR_CONTROL...");
        mqttClient.subscribe("SOLAR_CONTROL"); 
      } else {
        Serial.print("[MQTT] Connection failed, rc=");
        Serial.print(mqttClient.state());
        Serial.println(" Retrying in 5s...");
        vTaskDelay(5000 / portTICK_PERIOD_MS);
      }
    } else {
      mqttClient.loop();

      SensorData localData;
      if (xSemaphoreTake(dataMutex, portMAX_DELAY)) {
        currentData.currentHour = networkHour;
        strncpy(currentData.timeStr, networkTimeStr.c_str(), sizeof(currentData.timeStr));
        localData = currentData;
        xSemaphoreGive(dataMutex);
      }

      String safeLat = (savedLat.length() > 0) ? savedLat : "0.0";
      String safeLon = (savedLon.length() > 0) ? savedLon : "0.0";

      char payload[256];
      snprintf(payload, sizeof(payload), 
               "{\"in_v\":%.2f,\"in_a\":%.3f,\"out_v\":%.2f,\"out_a\":%.3f,\"rain\":\"%s\",\"angle\":%d,\"lat\":\"%s\",\"lon\":\"%s\"}", 
               localData.in_v, localData.in_a, localData.out_v, localData.out_a, 
               localData.isRaining ? "YES" : "NO", servoAngle, safeLat.c_str(), safeLon.c_str());

      bool pubSuccess = mqttClient.publish("SOLAR_V1", payload);
      if (pubSuccess) {
        Serial.print("[MQTT PUBLISH] Payload sent: ");
        Serial.println(payload);
      } else {
        Serial.println("[MQTT ERROR] Failed to publish payload!");
      }
      vTaskDelay(1000 / portTICK_PERIOD_MS); 
    }
  }
}

// ==========================================
// CORE 1: SETUP & MAIN LOOP
// ==========================================

void setup() {
  Serial.begin(115200);
  dataMutex = xSemaphoreCreateMutex();

  Serial.println("\n--- TESTING SENSORS & HARDWARE LOCAL DIAGNOSTICS ---");
  Wire.begin(); 
  I2C_Two.begin(I2C1_SDA, I2C1_SCL);

  in_ina_ok = ina219_in.begin(&Wire);
  out_ina_ok = ina219_out.begin(&I2C_Two);

  if (in_ina_ok) {
    Serial.println("[SENSOR PASS] Input INA219 (Solar) detected on Primary Wire I2C.");
  } else {
    Serial.println("[SENSOR WARN] Input INA219 not found on I2C - fallback solar simulation enabled.");
  }

  if (out_ina_ok) {
    Serial.println("[SENSOR PASS] Output INA219 (Load) detected on Secondary I2C.");
  } else {
    Serial.println("[SENSOR WARN] Output INA219 not found on I2C - fallback load simulation enabled.");
  }

  pinMode(RAIN_PIN, INPUT_PULLUP);
  pinMode(RESET_PIN, INPUT_PULLUP);
  Serial.print("[SENSOR PASS] Rain Pin "); Serial.print(RAIN_PIN); Serial.println(" initialized with INPUT_PULLUP.");
  
  // --- LOAD FROM PERMANENT MEMORY ---
  preferences.begin("solar", true); // Open in Read-Only mode
  savedSSID = preferences.getString("ssid", ""); 
  
  if (savedSSID == "") {
    // No saved WiFi found! Start the Setup Hotspot.
    currentState = WIFI_SETUP;
    servoAngle = 90;
    
    WiFi.mode(WIFI_AP_STA);
    int n = WiFi.scanNetworks();
    for (int i = 0; i < n; ++i) {
      wifiListOptions += "<option value='" + WiFi.SSID(i) + "'>" + WiFi.SSID(i) + "</option>";
    }
    WiFi.softAP("Solar_Setup_Hotspot");
    Serial.println("No saved WiFi found. Hotspot started at 192.168.4.1");
    
    server.on("/", handleRoot);
    server.on("/testwifi", handleTestWifi);
    server.on("/calibrate", handleCalibrate);
    server.on("/move", handleMove);
    server.on("/save", handleSave);
    server.begin();
  } else {
    // Saved config found! Load it and skip straight to RUNNING mode.
    currentState = RUNNING;
    savedPass = preferences.getString("pass", "");
    savedLat = preferences.getString("lat", "0.0");
    savedLon = preferences.getString("lon", "0.0");
    timeZoneOffset = preferences.getLong("tz", 0);
    calibratedZeroPosition = preferences.getInt("calib0", 90);
    
    timeClient.setTimeOffset(timeZoneOffset);
    servoAngle = calibratedZeroPosition; // Start at the saved flat position
    
    Serial.println("Saved configuration loaded! Skipping Hotspot...");
  }
  preferences.end();

  // Initialize Servo
  myServo.setPeriodHertz(50); 
  myServo.attach(SERVO_PIN, 500, 2400); 
  myServo.write(servoAngle); 
}

void loop() {
  // --- HARD RESET LOGIC (WIPES MEMORY) ---
  static unsigned long buttonPressTime = 0;
  static bool buttonIsPressed = false;

  if (digitalRead(RESET_PIN) == LOW) { 
    if (!buttonIsPressed) {
      buttonPressTime = millis(); 
      buttonIsPressed = true;
    } else if (millis() - buttonPressTime > 3000) { 
      Serial.println("\n*** WIPING CONFIG AND RESTARTING ***\n");
      preferences.begin("solar", false);
      preferences.clear(); // Deletes everything in permanent memory
      preferences.end();
      delay(500); 
      ESP.restart(); 
    }
  } else {
    buttonIsPressed = false; 
  }

  if (currentState == WIFI_SETUP || currentState == CALIBRATION) {
    server.handleClient();
    delay(10); 
  } 
  
  else if (currentState == RUNNING) {
    static bool bootRunningPhase = true;
    
    if (bootRunningPhase) {
      Serial.print("\nConnecting to local WiFi: "); Serial.println(savedSSID);
      WiFi.begin(savedSSID.c_str(), savedPass.c_str());
      
      int attempts = 0;
      while (WiFi.status() != WL_CONNECTED && attempts < 20) {
        delay(500);
        Serial.print(".");
        attempts++;
      }
      
      if (WiFi.status() == WL_CONNECTED) {
        Serial.println("\nWiFi Connected!");
        timeClient.begin();
        xTaskCreatePinnedToCore(mqttTask, "MQTT_Task", 8192, NULL, 1, NULL, 0);
      } else {
        Serial.println("\nFailed to connect using saved credentials. Hold BOOT to reset.");
      }
      bootRunningPhase = false;
    }

    // Only run the tracker if WiFi successfully connected
    if (WiFi.status() == WL_CONNECTED) {
      bool raining = (digitalRead(RAIN_PIN) == LOW);
      int safeHour = 0;
      char safeTimeStr[15] = "Loading...";
      
      if (xSemaphoreTake(dataMutex, portMAX_DELAY)) {
        float raw_in_v = in_ina_ok ? ina219_in.getBusVoltage_V() : 0.0;
        float raw_in_a = in_ina_ok ? (ina219_in.getCurrent_mA() / 1000.0) : 0.0;
        float raw_out_v = out_ina_ok ? ina219_out.getBusVoltage_V() : 0.0;
        float raw_out_a = out_ina_ok ? (ina219_out.getCurrent_mA() / 1000.0) : 0.0;

        float in_v = (isnan(raw_in_v) || isinf(raw_in_v)) ? 0.0 : raw_in_v;
        float in_a = (isnan(raw_in_a) || isinf(raw_in_a)) ? 0.0 : raw_in_a;
        float out_v = (isnan(raw_out_v) || isinf(raw_out_v)) ? 0.0 : raw_out_v;
        float out_a = (isnan(raw_out_a) || isinf(raw_out_a)) ? 0.0 : raw_out_a;

        currentData.in_v = in_v;
        currentData.in_a = in_a;
        currentData.out_v = out_v;
        currentData.out_a = out_a;
        currentData.isRaining = raining;
        
        safeHour = currentData.currentHour;
        strncpy(safeTimeStr, currentData.timeStr, sizeof(safeTimeStr));
        
        xSemaphoreGive(dataMutex);
      }

      Serial.println("\n====================================");
      Serial.print("CLOCK TIME:  "); Serial.println(safeTimeStr);
      Serial.print("POWER IN:    "); Serial.print(currentData.in_v); Serial.print(" V  |  "); Serial.print(currentData.in_a, 3); Serial.println(" A");
      Serial.print("POWER OUT:   "); Serial.print(currentData.out_v); Serial.print(" V  |  "); Serial.print(currentData.out_a, 3); Serial.println(" A");

      int targetAngle = calculateOptimalAngle(safeHour, raining);
      
      if (servoAngle != targetAngle) {
        Serial.print(">>> ADJUSTING PANEL FROM "); Serial.print(servoAngle); Serial.print(" TO "); Serial.println(targetAngle);
        servoAngle = targetAngle;
        myServo.write(servoAngle);
      } else {
        Serial.print(">>> PANEL HOLDING POSITION AT "); Serial.println(servoAngle);
      }
      Serial.println("====================================\n");
    }
    
    delay(2000); 
  }
}