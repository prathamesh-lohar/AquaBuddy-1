# 🔧 ESP32 + React Native BLE Connection Guide

## 📋 **Prerequisites**

### ESP32 Libraries Required:
```cpp
#include <BLEDevice.h>  // ESP32 BLE Arduino library
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <Wire.h>       // I2C communication
#include <VL53L0X.h>    // VL53L0X sensor library
```

### Arduino IDE Setup:
1. Install ESP32 board package
2. Install VL53L0X library by Adafruit or Pololu
3. Select your ESP32 board (ESP32 Dev Module)
4. Set correct COM port

## 🔌 **Hardware Connections**

### VL53L0X to ESP32:
- **VCC** → 3.3V
- **GND** → GND  
- **SDA** → GPIO 4
- **SCL** → GPIO 5
- **LED** → GPIO 2 (status indicator)

## 📡 **BLE Configuration**

### UUIDs (Must Match Both Sides):
- **Service UUID**: `4fafc201-1fb5-459e-8fcc-c5c9c331914b`
- **Characteristic UUID**: `beb5483e-36e1-4688-b7f5-ea07361b26a8`
- **Device Name**: `SmartWaterBottle`

## 🚀 **Step-by-Step Setup**

### 1. Upload ESP32 Code
- Use the provided `esp32_water_bottle.ino` file
- Monitor Serial output to verify:
  - VL53L0X sensor initialization
  - BLE service start
  - Device advertising

### 2. Test ESP32 Functionality
Expected Serial Output:
```
Starting Smart Water Bottle...
VL53L0X sensor initialized successfully
Characteristic defined! Now you can connect...
Device name: SmartWaterBottle
Distance: 142 mm
Distance: 140 mm
```

### 3. React Native App Connection
- Ensure Bluetooth is enabled
- Grant Bluetooth permissions
- Click "Connect to Bottle" button
- Check console logs for connection progress

## 🔍 **Troubleshooting**

### ESP32 Issues:

**Sensor Not Working:**
- Check wiring connections
- Verify 3.3V power supply
- Check I2C pins (SDA=4, SCL=5)
- Serial should show "VL53L0X sensor initialized successfully"

**BLE Not Advertising:**
- Check Serial Monitor for BLE start messages
- Verify ESP32 BLE library installation
- Try restarting ESP32
- LED should blink 3 times on successful init

**Connection Drops:**
- Check power supply stability
- Verify ESP32 is not sleeping
- Check antenna connection
- Keep devices within 5 meters

### React Native Issues:

**Device Not Found:**
- Enable Bluetooth and location services
- Grant all permissions
- Check device name matches exactly
- Try scanning with a BLE scanner app first

**Connection Fails:**
- Clear app cache
- Restart Bluetooth
- Check UUIDs match exactly
- Try from Android settings → Paired devices

**No Data Received:**
- Check ESP32 Serial for data transmission
- Verify characteristic notifications are enabled
- Check JSON parsing in React Native logs

## 📊 **Data Format**

ESP32 sends JSON data:
```json
{
  "distance": 142,
  "timestamp": 12345
}
```

React Native processes:
- Distance in millimeters
- Converts to water level percentage
- Updates UI in real-time

## 🧪 **Testing Tools**

### BLE Scanner Apps:
- **nRF Connect** (Nordic Semiconductor)
- **BLE Scanner** 
- **LightBlue Explorer**

### Testing Steps:
1. Scan for "SmartWaterBottle"
2. Connect to device
3. Find service `4fafc201-1fb5-459e-8fcc-c5c9c331914b`
4. Enable notifications on characteristic
5. Verify data reception

## ⚡ **Performance Tips**

- **Update Rate**: 2 seconds (configurable)
- **Range**: Keep within 10 meters
- **Battery**: Use deep sleep when not connected
- **Reliability**: Implement auto-reconnection

## 🔧 **Advanced Configuration**

### Modify Update Rate:
Change `delay(2000)` in ESP32 loop() function

### Adjust Sensor Range:
Modify timing budget: `sensor.setMeasurementTimingBudget(33000)`

### Custom Device Name:
Change `String deviceName = "SmartWaterBottle"`

## 📞 **Quick Diagnostics**

If connection fails, check in this order:
1. ✅ ESP32 LED status (should blink then stay on when connected)
2. ✅ Serial output shows distance readings
3. ✅ BLE scanner app can find and connect to device
4. ✅ Android Bluetooth permissions granted
5. ✅ React Native app can scan for devices
6. ✅ UUIDs match exactly between ESP32 and React Native

## 🎯 **Success Indicators**

**ESP32 Working:**
- LED blinks 3 times on startup
- Continuous distance readings in Serial Monitor
- LED stays on when React Native connects

**React Native Working:**
- "Connected to Smart Water Bottle" message
- Real-time distance and water level updates
- Green connection status indicator
