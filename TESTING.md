# Testing Guide

This guide covers testing procedures for the Smart Energy Meter system.

## Backend Testing

### 1. Setup Test Environment

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Run Django Tests

```bash
# Run all tests
python manage.py test

# Run specific app tests
python manage.py test devices

# Run with coverage
pip install coverage
coverage run --source='.' manage.py test
coverage report
coverage html  # Generate HTML report
```

### 3. Test REST API Endpoints

```bash
# Start development server
python manage.py runserver

# Test endpoints (use curl or Postman):

# Get all devices
curl http://localhost:8000/api/devices/

# Get device statistics
curl http://localhost:8000/api/devices/statistics_all/

# Get device readings
curl http://localhost:8000/api/readings/?device=<device-id>&hours=24

# Get cost projection
curl http://localhost:8000/api/devices/<device-id>/cost_projection/?hours=24

# Get usage patterns
curl http://localhost:8000/api/devices/<device-id>/usage_pattern/?type=hourly&days=7

# Detect anomalies
curl http://localhost:8000/api/devices/<device-id>/detect_anomalies/?hours=24

# Detect appliances
curl http://localhost:8000/api/devices/<device-id>/detect_appliances/?hours=1
```

### 4. Test WebSocket Connections

```python
# Test script: test_websocket.py
import asyncio
import websockets
import json

async def test_device_connection():
    uri = "ws://localhost:8000/ws/device/your-device-token/"

    async with websockets.connect(uri) as websocket:
        # Send test reading
        message = {
            "type": "reading",
            "data": {
                "voltage": 220.5,
                "current": 1.234,
                "power": 272.1,
                "energy": 12.345,
                "frequency": 50.0,
                "power_factor": 0.99
            }
        }

        await websocket.send(json.dumps(message))
        response = await websocket.recv()
        print(f"Response: {response}")

asyncio.run(test_device_connection())
```

### 5. Test Analytics Functions

```python
# Django shell
python manage.py shell

from devices.models import Device
from devices.analytics import CostProjectionAnalyzer, UsagePatternAnalyzer, AnomalyDetector, ApplianceDetector

# Get a device
device = Device.objects.first()

# Test cost projection
projection = CostProjectionAnalyzer.project_daily_cost(device, hours=24)
print(projection)

# Test usage patterns
pattern = UsagePatternAnalyzer.analyze_hourly_pattern(device, days=7)
print(pattern)

# Test anomaly detection
anomalies = AnomalyDetector.detect_power_spikes(device, hours=24)
print(anomalies)

# Test appliance detection
appliances = ApplianceDetector.detect_appliances(device, hours=1)
print(appliances)
```

## Frontend Testing

### 1. Setup and Run

```bash
cd frontend
npm install
npm run dev
```

### 2. Manual Testing Checklist

- [ ] Dashboard loads successfully
- [ ] WebSocket connection indicator shows "Connected"
- [ ] Real-time power data updates (every 2-3 seconds)
- [ ] Cost projections display correctly
- [ ] Device status shows online/offline correctly
- [ ] Device selector works (if multiple devices)
- [ ] All charts render without errors
- [ ] Responsive design works on mobile

### 3. Browser Console Tests

```javascript
// Test API client
import { api } from "./shared/api/client";

// Test get devices
const devices = await api.getDevices();
console.log(devices);

// Test get statistics
const stats = await api.getAllDeviceStatistics();
console.log(stats);

// Test cost projection
const projection = await api.getCostProjection(deviceId, 24);
console.log(projection);
```

### 4. WebSocket Testing

Open browser console while on dashboard:

```javascript
// Check WebSocket connection
// Look for console messages:
// "WebSocket connected"
// "WS Message: ..." (for each incoming message)
```

## Firmware Testing

### 1. Serial Monitor Tests

Upload firmware and open Serial Monitor (115200 baud):

Expected output:

```
Smart Energy Meter v1.0.0
Connecting to WiFi: YourSSID
.....
WiFi connected!
IP: 192.168.1.xxx
Connecting to WebSocket server...
WebSocket connected!
V: 220.5V, I: 1.234A, P: 272.1W, E: 12.345kWh, F: 50.0Hz, PF: 0.99
Sent reading
```

### 2. LCD Display Tests

Verify LCD rotates through 3 screens every 5 seconds:

1. Voltage, Current, Power
2. Energy, Cost
3. Power Factor, Frequency, Status

### 3. WebSocket Communication Tests

Check that:

- [ ] Device sends readings every 2-3 seconds
- [ ] Device sends heartbeat every 30 seconds
- [ ] Device reconnects automatically if connection drops
- [ ] Commands from server are executed (reset_energy, lcd_on/off, reboot)

### 4. Sensor Accuracy Tests

Compare PZEM readings with known reference:

- [ ] Voltage within ±1%
- [ ] Current within ±2%
- [ ] Power within ±3%
- [ ] Energy accumulation correct

### 5. OTA Update Tests

```bash
# From Arduino IDE:
# 1. Upload initial firmware via USB
# 2. Note device IP address
# 3. Tools → Port → Network Port (select device IP)
# 4. Upload updated firmware over WiFi
# 5. Verify update completes successfully
```

## Integration Testing

### 1. End-to-End Flow Test

1. **Device Startup**
   - ESP8266 boots
   - Connects to WiFi
   - Connects to WebSocket server
   - Backend marks device as online

2. **Data Flow**
   - ESP8266 reads PZEM sensor
   - Sends JSON data via WebSocket
   - Backend saves to database
   - Backend broadcasts to frontend
   - Frontend displays real-time data

3. **Analytics Flow**
   - Frontend requests cost projection
   - Backend analyzes last 24h of data
   - Returns daily/weekly/monthly projections
   - Frontend displays results

### 2. Stress Testing

```python
# Test script: stress_test.py
import asyncio
import websockets
import json
import random
from datetime import datetime

async def send_readings(device_token, count=1000):
    uri = f"ws://localhost:8000/ws/device/{device_token}/"

    async with websockets.connect(uri) as websocket:
        for i in range(count):
            message = {
                "type": "reading",
                "data": {
                    "voltage": 220 + random.uniform(-5, 5),
                    "current": 1.0 + random.uniform(-0.5, 0.5),
                    "power": 220 + random.uniform(-50, 50),
                    "energy": i * 0.001,
                    "frequency": 50.0,
                    "power_factor": 0.95 + random.uniform(-0.05, 0.05)
                },
                "timestamp": datetime.now().isoformat()
            }

            await websocket.send(json.dumps(message))
            await asyncio.sleep(0.1)  # 10 readings/second

            if i % 100 == 0:
                print(f"Sent {i} readings")

# Run stress test
asyncio.run(send_readings("your-device-token", 1000))
```

### 3. Load Testing

```bash
# Install locust
pip install locust

# Create locustfile.py
from locust import HttpUser, task, between

class EnergyMeterUser(HttpUser):
    wait_time = between(1, 3)

    @task(3)
    def get_devices(self):
        self.client.get("/api/devices/")

    @task(2)
    def get_readings(self):
        self.client.get("/api/readings/?hours=24")

    @task(1)
    def get_statistics(self):
        self.client.get("/api/devices/statistics_all/")

# Run load test
locust -f locustfile.py --host=http://localhost:8000
# Open http://localhost:8089 and start test
```

## Performance Testing

### Backend Performance

```bash
# Use Django Debug Toolbar
pip install django-debug-toolbar

# Add to INSTALLED_APPS in settings.py (development only)

# Measure query performance:
python manage.py shell
from django.test.utils import setup_test_environment
from django.db import connection

# Run queries and check count
len(connection.queries)
```

### Database Optimization

```sql
-- Check slow queries (PostgreSQL)
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;
```

## Security Testing

### 1. Authentication Tests

- [ ] Device requires valid token to connect
- [ ] Invalid tokens are rejected
- [ ] Admin interface requires login
- [ ] CORS properly configured

### 2. Input Validation Tests

```python
# Test invalid sensor data
curl -X POST http://localhost:8000/api/readings/ \
  -H "Content-Type: application/json" \
  -d '{
    "device": "invalid-id",
    "voltage": -100,  # Invalid: negative
    "current": 999,   # Invalid: too high
    "power": 0,
    "energy": 0,
    "frequency": 50,
    "power_factor": 2.0  # Invalid: >1
  }'

# Should return 400 Bad Request with validation errors
```

### 3. SQL Injection Tests

Try SQL injection patterns in query parameters:

```bash
curl "http://localhost:8000/api/devices/?search='; DROP TABLE devices; --"
# Should be safely escaped
```

## Continuous Integration

### GitHub Actions Example

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v2

      - name: Set up Python
        uses: actions/setup-python@v2
        with:
          python-version: 3.11

      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements.txt

      - name: Run tests
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost/test_db
          REDIS_URL: redis://localhost:6379/0
        run: |
          cd backend
          python manage.py test
```

## Test Coverage Goals

- **Backend**: >80% code coverage
- **Frontend**: >70% component coverage
- **Integration**: All critical paths tested
- **Performance**: <200ms API response time
- **Uptime**: >99.5% availability

## Reporting Issues

When reporting bugs, include:

1. Steps to reproduce
2. Expected behavior
3. Actual behavior
4. Environment (OS, Python version, etc.)
5. Logs/error messages
6. Screenshots (if UI related)
