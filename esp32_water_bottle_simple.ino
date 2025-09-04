#include "BLEDevice.h"
#include "BLEServer.h"
#include "BLEUtils.h"
#include "BLE2902.h"
#include <Wire.h>
#include <Adafruit_VL53L0X.h>
#include <ArduinoJson.h>

// BLE Configuration - MUST match React Native app
#define SERVICE_UUID "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"
#define DEVICE_NAME "SmartWaterBottle"

// I2C Configuration
#define SDA_PIN 4
#define SCL_PIN 5

// Global variables
BLEServer* pServer = NULL;
BLECharacteristic* pCharacteristic = NULL;
Adafruit_VL53L0X lox = Adafruit_VL53L0X();
bool deviceConnected = false;
bool oldDeviceConnected = false;
unsigned long lastSensorRead = 0;
const unsigned long SENSOR_INTERVAL = 1000; // Read sensor every 1 second

class MyServerCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) {
      deviceConnected = true;
      Serial.println("📱 Client connected!");
    };

    void onDisconnect(BLEServer* pServer) {
      deviceConnected = false;
      Serial.println("📱 Client disconnected!");
    }
};

class MyCharacteristicCallbacks: public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic* pCharacteristic) {
      std::string rxValue = pCharacteristic->getValue();

      if (rxValue.length() > 0) {
        Serial.println("📨 Received from app: ");
        for (int i = 0; i < rxValue.length(); i++) {
          Serial.print(rxValue[i]);
        }
        Serial.println();
        
        // Simple command handling - app will handle all logic
        String command = String(rxValue.c_str());
        command.trim();
        
        if (command == "get_status") {
          sendDeviceStatus();
        } else {
          Serial.println("❓ Unknown command: " + command);
        }
      }
    }
};

void setup() {
  Serial.begin(115200);
  Serial.println("🚀 Starting Smart Water Bottle...");

  // Initialize I2C with custom pins
  Wire.begin(SDA_PIN, SCL_PIN);
  Serial.println("🔧 I2C initialized (SDA=4, SCL=5)");

  // Initialize VL53L0X sensor
  if (!lox.begin()) {
    Serial.println("❌ Failed to boot VL53L0X sensor!");
    Serial.println("💡 Check wiring: SDA=4, SCL=5, VCC=3.3V, GND=GND");
    while(1) {
      delay(1000);
      Serial.println("⚠️ Sensor error - check connections");
    }
  }
  Serial.println("✅ VL53L0X sensor initialized");

  // Initialize BLE
  BLEDevice::init(DEVICE_NAME);
  Serial.println("📡 BLE Device initialized");

  // Create BLE Server
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());
  Serial.println("🔧 BLE Server created");

  // Create BLE Service
  BLEService *pService = pServer->createService(SERVICE_UUID);
  Serial.println("📋 BLE Service created");

  // Create BLE Characteristic with proper properties
  pCharacteristic = pService->createCharacteristic(
    CHARACTERISTIC_UUID,
    BLECharacteristic::PROPERTY_READ |
    BLECharacteristic::PROPERTY_WRITE |
    BLECharacteristic::PROPERTY_NOTIFY |
    BLECharacteristic::PROPERTY_INDICATE
  );

  // Set callback for handling incoming data
  pCharacteristic->setCallbacks(new MyCharacteristicCallbacks());

  // Add BLE2902 descriptor for notifications (CRITICAL!)
  pCharacteristic->addDescriptor(new BLE2902());
  Serial.println("✅ BLE Characteristic created with notifications");

  // Start the service
  pService->start();
  Serial.println("🚀 BLE Service started");

  // Configure advertising
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(false);
  pAdvertising->setMinPreferred(0x0);
  
  // Enhanced advertising data for better discovery
  BLEAdvertisementData advertisementData;
  advertisementData.setName(DEVICE_NAME);
  advertisementData.setCompleteServices(BLEUUID(SERVICE_UUID));
  pAdvertising->setAdvertisementData(advertisementData);
  
  // Start advertising
  BLEDevice::startAdvertising();
  
  Serial.println("🎯 Setup complete! Device is advertising...");
  Serial.println("📱 Device Name: " + String(DEVICE_NAME));
  Serial.println("🔑 Service UUID: " + String(SERVICE_UUID));
  Serial.println("🔑 Characteristic UUID: " + String(CHARACTERISTIC_UUID));
  Serial.println("📡 Ready for connections!");
}

void loop() {
  // Handle BLE connection state changes
  if (!deviceConnected && oldDeviceConnected) {
    delay(500); // Give the bluetooth stack time to get ready
    pServer->startAdvertising(); // Restart advertising
    Serial.println("🔄 Restarting advertising...");
    oldDeviceConnected = deviceConnected;
  }
  
  if (deviceConnected && !oldDeviceConnected) {
    oldDeviceConnected = deviceConnected;
    Serial.println("🎉 Device connected - starting data transmission");
  }

  // Read sensor and send data if connected
  if (deviceConnected && (millis() - lastSensorRead > SENSOR_INTERVAL)) {
    readSensorAndSendData();
    lastSensorRead = millis();
  }

  delay(100); // Small delay for stability
}

void readSensorAndSendData() {
  // Read distance from VL53L0X sensor
  VL53L0X_RangingMeasurementData_t measure;
  
  Serial.print("📊 Reading sensor... ");
  lox.rangingTest(&measure, false);
  
  if (measure.RangeStatus != 4) { // Phase failures have incorrect data
    uint16_t distance = measure.RangeMilliMeter;
    
    // Create simple JSON data with raw sensor reading
    // App will handle calibration and water level calculation
    DynamicJsonDocument doc(200);
    doc["distance"] = distance;
    doc["timestamp"] = millis();
    doc["device"] = DEVICE_NAME;
    doc["status"] = "ok";
    
    String jsonString;
    serializeJson(doc, jsonString);
    
    // Send data via BLE
    pCharacteristic->setValue(jsonString.c_str());
    pCharacteristic->notify();
    
    Serial.print("Distance: ");
    Serial.print(distance);
    Serial.print("mm | Sent: ");
    Serial.println(jsonString);
    
  } else {
    // Sensor error
    Serial.println("❌ Sensor read error");
    
    // Send error status
    DynamicJsonDocument doc(150);
    doc["distance"] = -1;
    doc["timestamp"] = millis();
    doc["device"] = DEVICE_NAME;
    doc["status"] = "error";
    doc["error"] = "sensor_read_failed";
    
    String jsonString;
    serializeJson(doc, jsonString);
    
    pCharacteristic->setValue(jsonString.c_str());
    pCharacteristic->notify();
  }
}

void sendDeviceStatus() {
  if (!deviceConnected) return;
  
  DynamicJsonDocument doc(200);
  doc["type"] = "device_status";
  doc["uptime"] = millis();
  doc["freeHeap"] = ESP.getFreeHeap();
  doc["device"] = DEVICE_NAME;
  doc["timestamp"] = millis();
  doc["status"] = "ok";
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  pCharacteristic->setValue(jsonString.c_str());
  pCharacteristic->notify();
  
  Serial.println("📤 Device status sent: " + jsonString);
}
