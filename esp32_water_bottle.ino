#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_VL53L0X.h>
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>
#include <BLE2902.h>  // CRITICAL: This was missing!

// BLE UUIDs (must match React Native exactly)
#define SERVICE_UUID "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

// Custom I2C pins
#define SDA_PIN 4
#define SCL_PIN 5

Adafruit_VL53L0X lox = Adafruit_VL53L0X();
BLECharacteristic *pCharacteristic;
BLEServer *pServer;
bool deviceConnected = false;
bool oldDeviceConnected = false;

// BLE Server callbacks
class MyServerCallbacks: public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) {
    deviceConnected = true;
    Serial.println("✅ Device connected!");
  }

  void onDisconnect(BLEServer* pServer) {
    deviceConnected = false;
    Serial.println("❌ Device disconnected");
    // Don't restart advertising here - do it in loop()
  }
};

void setup() {
  Serial.begin(115200);
  
  // Initialize I2C with custom pins
  Wire.begin(SDA_PIN, SCL_PIN);
  
  Serial.println("🚀 Starting SmartWaterBottle...");
  
  // Initialize VL53L0X sensor
  if (!lox.begin()) {
    Serial.println("❌ Failed to boot VL53L0X");
    Serial.println("Check wiring: SDA=4, SCL=5, VCC=3.3V, GND=GND");
    while(1) {
      delay(1000);
      Serial.println("Sensor error - please check connections");
    }
  }
  Serial.println("✅ VL53L0X sensor initialized");
  
  // Initialize BLE
  BLEDevice::init("SmartWaterBottle");
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());
  
  // Create BLE Service
  BLEService *pService = pServer->createService(SERVICE_UUID);
  
  // Create BLE Characteristic with proper properties
  pCharacteristic = pService->createCharacteristic(
    CHARACTERISTIC_UUID,
    BLECharacteristic::PROPERTY_READ |
    BLECharacteristic::PROPERTY_WRITE |
    BLECharacteristic::PROPERTY_NOTIFY |
    BLECharacteristic::PROPERTY_INDICATE
  );
  
  // CRITICAL: Add BLE2902 descriptor for notifications
  pCharacteristic->addDescriptor(new BLE2902());
  
  // Start the service
  pService->start();
  
  // Configure advertising properly
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(false);
  pAdvertising->setMinPreferred(0x0);
  
  // Enhanced advertising data
  BLEAdvertisementData advertisementData;
  advertisementData.setName("SmartWaterBottle");
  advertisementData.setCompleteServices(BLEUUID(SERVICE_UUID));
  pAdvertising->setAdvertisementData(advertisementData);
  
  // Start advertising
  BLEDevice::startAdvertising();
  
  Serial.println("📡 BLE Advertising started");
  Serial.println("📱 Device name: SmartWaterBottle");
  Serial.println("🔑 Service UUID: " + String(SERVICE_UUID));
  Serial.println("🔑 Characteristic UUID: " + String(CHARACTERISTIC_UUID));
  Serial.println("🎯 Ready for connections!");
}

void loop() {
  // Read sensor data
  VL53L0X_RangingMeasurementData_t measure;
  lox.rangingTest(&measure, false);
  
  if (measure.RangeStatus != 4) {
    int distance_mm = measure.RangeMilliMeter;
    
    // Create JSON data for better parsing
    String jsonData = "{\"distance\":" + String(distance_mm) + ",\"timestamp\":" + String(millis()) + "}";
    
    Serial.print("📏 Distance: ");
    Serial.print(distance_mm);
    Serial.println(" mm");
    
    // Send data if connected
    if (deviceConnected && pCharacteristic) {
      pCharacteristic->setValue(jsonData.c_str());
      pCharacteristic->notify();
      Serial.println("📤 Sent: " + jsonData);
      
      // Brief LED flash to indicate data sent
      digitalWrite(LED_PIN, LOW);
      delay(50);
      digitalWrite(LED_PIN, HIGH);
    }
  } else {
    Serial.println("⚠️ Sensor out of range");
  }
  
  // Handle disconnection and reconnection
  if (!deviceConnected && oldDeviceConnected) {
    delay(500); // Give bluetooth stack time to get ready
    pServer->startAdvertising(); // Restart advertising
    Serial.println("🔄 Restarting advertising...");
    oldDeviceConnected = deviceConnected;
  }
  
  // Handle new connection
  if (deviceConnected && !oldDeviceConnected) {
    oldDeviceConnected = deviceConnected;
    Serial.println("🎉 New connection established!");
  }
  
  delay(1000); // Send data every 1 second for better responsiveness
}
