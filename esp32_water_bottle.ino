#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <Wire.h>
#include <VL53L0X.h>

// BLE Service and Characteristic UUIDs (must match React Native app)
#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

// VL53L0X sensor
VL53L0X sensor;

// BLE variables
BLEServer* pServer = NULL;
BLECharacteristic* pCharacteristic = NULL;
bool deviceConnected = false;
bool oldDeviceConnected = false;

// Device name (must match React Native app)
String deviceName = "SmartWaterBottle";

// I2C pins for VL53L0X
#define SDA_PIN 4
#define SCL_PIN 5

// LED pin for status indication
#define LED_PIN 2

class MyServerCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) {
      deviceConnected = true;
      digitalWrite(LED_PIN, HIGH); // LED on when connected
      Serial.println("Device connected!");
    };

    void onDisconnect(BLEServer* pServer) {
      deviceConnected = false;
      digitalWrite(LED_PIN, LOW); // LED off when disconnected
      Serial.println("Device disconnected!");
    }
};

void setup() {
  Serial.begin(115200);
  Serial.println("Starting Smart Water Bottle...");

  // Initialize LED
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  // Initialize I2C with custom pins
  Wire.begin(SDA_PIN, SCL_PIN);
  
  // Initialize VL53L0X sensor
  sensor.setTimeout(500);
  if (!sensor.init()) {
    Serial.println("Failed to detect and initialize VL53L0X sensor!");
    // Blink LED to indicate sensor error
    for(int i = 0; i < 10; i++) {
      digitalWrite(LED_PIN, HIGH);
      delay(100);
      digitalWrite(LED_PIN, LOW);
      delay(100);
    }
    return;
  }
  
  // Set sensor to long range mode
  sensor.setMeasurementTimingBudget(33000);
  Serial.println("VL53L0X sensor initialized successfully");

  // Initialize BLE
  BLEDevice::init(deviceName.c_str());

  // Create BLE Server
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  // Create BLE Service
  BLEService *pService = pServer->createService(SERVICE_UUID);

  // Create BLE Characteristic
  pCharacteristic = pService->createCharacteristic(
                      CHARACTERISTIC_UUID,
                      BLECharacteristic::PROPERTY_READ   |
                      BLECharacteristic::PROPERTY_WRITE  |
                      BLECharacteristic::PROPERTY_NOTIFY |
                      BLECharacteristic::PROPERTY_INDICATE
                    );

  // Add descriptor for notifications
  pCharacteristic->addDescriptor(new BLE2902());

  // Start the service
  pService->start();

  // Start advertising
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(false);
  pAdvertising->setMinPreferred(0x0);  // set value to 0x00 to not advertise this parameter
  
  // Enhanced advertising for better discoverability
  BLEAdvertisementData advertisementData;
  advertisementData.setName(deviceName);
  advertisementData.setCompleteServices(BLEUUID(SERVICE_UUID));
  advertisementData.setShortName("SmartWater");
  pAdvertising->setAdvertisementData(advertisementData);
  
  BLEDevice::startAdvertising();
  
  Serial.println("Characteristic defined! Now you can connect and read/write/notify it in your phone!");
  Serial.print("Device name: ");
  Serial.println(deviceName);
  Serial.print("Service UUID: ");
  Serial.println(SERVICE_UUID);
  Serial.print("Characteristic UUID: ");
  Serial.println(CHARACTERISTIC_UUID);
  
  // Blink LED 3 times to indicate successful initialization
  for(int i = 0; i < 3; i++) {
    digitalWrite(LED_PIN, HIGH);
    delay(500);
    digitalWrite(LED_PIN, LOW);
    delay(500);
  }
}

void loop() {
  // Read distance from VL53L0X sensor
  uint16_t distance = sensor.readRangeSingleMillimeters();
  
  if (sensor.timeoutOccurred()) {
    Serial.println("VL53L0X TIMEOUT");
    return;
  }

  // Print distance for debugging
  Serial.print("Distance: ");
  Serial.print(distance);
  Serial.println(" mm");

  // If device is connected, send data via BLE
  if (deviceConnected) {
    // Create JSON string with sensor data
    String jsonData = "{\"distance\":" + String(distance) + ",\"timestamp\":" + String(millis()) + "}";
    
    // Send data via BLE characteristic
    pCharacteristic->setValue(jsonData.c_str());
    pCharacteristic->notify();
    
    Serial.print("Sent data: ");
    Serial.println(jsonData);
    
    // Blink LED briefly to indicate data transmission
    digitalWrite(LED_PIN, LOW);
    delay(50);
    digitalWrite(LED_PIN, HIGH);
  }

  // Handle disconnection and reconnection
  if (!deviceConnected && oldDeviceConnected) {
    delay(500); // give the bluetooth stack the chance to get things ready
    pServer->startAdvertising(); // restart advertising
    Serial.println("Start advertising");
    oldDeviceConnected = deviceConnected;
  }
  
  // Handle new connection
  if (deviceConnected && !oldDeviceConnected) {
    oldDeviceConnected = deviceConnected;
  }

  delay(2000); // Send data every 2 seconds
}
