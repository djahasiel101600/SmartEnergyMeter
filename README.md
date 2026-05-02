# Smart Energy Meter

A comprehensive full-stack IoT energy monitoring system with ESP8266 firmware, Django backend with WebSocket support, and React TypeScript frontend.

## 🌟 Overview

This system provides real-time electrical parameter monitoring using PZEM-004T sensor, cost projections, usage analytics, multi-device support, OTA firmware updates, and advanced insights including anomaly detection and appliance identification.

## 🏗️ Architecture

```
┌─────────────┐                    ┌──────────────┐                    ┌──────────────┐
│             │  WebSocket (2-3s)  │              │  WebSocket + REST  │              │
│   ESP8266   │◄──────────────────►│    Django    │◄──────────────────►│    React     │
│             │    PZEM Readings   │   Backend    │    Real-time UI    │   Frontend   │
│  + PZEM     │                    │  + Channels  │                    │  + Vite      │
│  + LCD      │                    │  + Redis     │                    │  + Tailwind  │
└─────────────┘                    └──────────────┘                    └──────────────┘
                                           │
                                           ▼
                                   ┌──────────────┐
                                   │  PostgreSQL  │
                                   │  + 1yr data  │
                                   └──────────────┘
```

**Components:**

- **Firmware**: ESP8266 NodeMCU + PZEM-004T sensor + LCD I2C (16x2)
- **Backend**: Django 5.0 + DRF 3.17 + Channels 4.3 + WebSocket + Redis
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + Shadcn UI + FSD
- **Database**: SQLite (dev), PostgreSQL (prod) with 1-year retention
- **Real-time**: Direct WebSocket (ESP8266 ↔ Backend ↔ Frontend)
- **Deployment**: Render.com (Web Service + PostgreSQL + Redis)

## ✨ Features

### 📱 Firmware (ESP8266)

- ✅ Real-time monitoring: Voltage, Current, Power, Energy, Frequency, Power Factor
- ✅ LCD display with 3 rotating screens (configurable interval)
- ✅ WebSocket client with auto-reconnect
- ✅ OTA firmware updates
- ✅ Remote device reset
- ✅ Device status reporting
- ✅ Heartbeat mechanism (30s interval)
- ✅ WiFi auto-reconnect

### 🖥️ Backend (Django)

- ✅ RESTful API (devices, readings, rates, firmware, OTA)
- ✅ WebSocket support (device & frontend consumers)
- ✅ Multi-device management
- ✅ Advanced Analytics:
  - Cost projections (daily/weekly/monthly)
  - Hourly & daily usage patterns
  - Period comparisons
  - Anomaly detection (power spikes, unusual consumption)
  - Appliance detection (20+ appliance signatures)
  - Power state change detection
- ✅ Rate configuration (PHP per kWh, time-based rates)
- ✅ OTA update management
- ✅ Device authentication (token-based)
- ✅ 1-year data retention
- ✅ Philippine timezone support

### 🌐 Frontend (React)

- ✅ Real-time dashboard with live metrics
- ✅ WebSocket integration
- ✅ Cost tracking in PHP
- ✅ Device status monitoring
- ✅ Cost projections display
- ✅ Responsive design (mobile/tablet/desktop)
- ✅ Feature Slice Design architecture
- ✅ Dark/light theme support (Tailwind)

## 📁 Project Structure

```
SmartEnergyMeter/
├── backend/                 # Django backend application
│   ├── backend/            # Django project settings
│   │   ├── settings.py     # ✅ Dual DB, WebSocket, CORS, REST config
│   │   ├── asgi.py         # ✅ ASGI + WebSocket routing
│   │   ├── routing.py      # ✅ WebSocket URL patterns
│   │   └── urls.py         # ✅ REST API routes
│   ├── devices/            # Main Django app
│   │   ├── models.py       # ✅ 5 models (Device, Reading, Rate, Firmware, OTA)
│   │   ├── serializers.py  # ✅ DRF serializers
│   │   ├── views.py        # ✅ REST API viewsets + analytics endpoints
│   │   ├── consumers.py    # ✅ WebSocket consumers (Device, Frontend)
│   │   ├── analytics.py    # ✅ Advanced analytics utilities
│   │   ├── admin.py        # ✅ Django admin configuration
│   │   └── urls.py         # ✅ API URL routing
│   ├── requirements.txt    # ✅ Python dependencies
│   ├── .env.example        # ✅ Environment variables template
│   └── README.md           # ✅ Backend documentation
│
├── frontend/               # React TypeScript frontend
│   ├── src/
│   │   ├── app/            # Application layer (FSD)
│   │   ├── pages/          # ✅ Page components (Dashboard, etc.)
│   │   ├── widgets/        # Widget components
│   │   ├── features/       # Feature components
│   │   ├── entities/       # Business entities
│   │   └── shared/         # Shared resources
│   │       ├── ui/         # ✅ UI components (Button, Card)
│   │       ├── api/        # ✅ API client + WebSocket hook
│   │       ├── lib/        # ✅ Utilities (formatters, cn())
│   │       └── types/      # ✅ TypeScript types
│   ├── package.json        # ✅ Dependencies (230 packages)
│   ├── tailwind.config.js  # ✅ Tailwind + Shadcn UI theme
│   ├── .env.example        # ✅ Environment variables
│   └── README.md           # ✅ Frontend documentation
│
├── firmware/               # ESP8266 firmware (PlatformIO)
│   ├── src/
│   │   └── firmware.ino    # ✅ Main firmware (550+ lines)
│   ├── include/
│   │   └── config.h.example # ✅ Configuration template
│   ├── platformio.ini      # ✅ PlatformIO configuration
│   ├── .gitignore          # ✅ Ignore build files & config.h
│   └── README.md           # ✅ Firmware documentation
│
├── build.sh                # ✅ Render build script
├── render.yaml             # ✅ Render deployment config
├── DEPLOYMENT.md           # ✅ Deployment guide
├── TESTING.md              # ✅ Testing guide
├── PROGRESS.md             # ✅ Implementation status
└── README.md               # This file
```

## 🚀 Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL 14+ (production)
- Redis 7+ (for WebSocket)
- ESP8266 + PZEM-004T + LCD I2C (for hardware)

### 1. Backend Setup

```bash
# Clone repository
git clone <your-repo-url>
cd SmartEnergyMeter/backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Setup environment
cp .env.example .env
# Edit .env with your settings

# Run migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Run development server (WebSocket support)
daphne backend.asgi:application
```

Backend will be available at: http://localhost:8000

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with backend URL

# Run development server
npm run dev
```

Frontend will be available at: http://localhost:5173

### 3. Firmware Setup

**Option 1: PlatformIO (Recommended)**

```bash
cd firmware

# Copy config template
cp include/config.h.example include/config.h
# Edit include/config.h with WiFi credentials and device token

# Build and upload
pio run --target upload

# Monitor serial output
pio run --target monitor
```

**Option 2: Arduino IDE**

```bash
cd firmware
cp include/config.h.example include/config.h
# Edit include/config.h

# Open src/firmware.ino in Arduino IDE
# Select Board: NodeMCU 1.0 (ESP-12E Module)
# Upload
```

### 4. Create Device in Django Admin

1. Access admin: http://localhost:8000/admin/
2. Login with superuser
3. Add Device:
   - Name: "Living Room Meter"
   - Token: (generate random UUID)
   - Rate: 12.00 PHP/kWh
4. Copy token to firmware config.h
5. Upload firmware to ESP8266

## 📚 Documentation

- **[Backend Setup](backend/README.md)** - Django configuration and API
- **[Frontend Setup](frontend/README.md)** - React app configuration
- **[Firmware Setup](firmware/README.md)** - ESP8266 firmware guide
- **[Deployment Guide](DEPLOYMENT.md)** - Deploy to Render.com
- **[Testing Guide](TESTING.md)** - Testing procedures
- **[Progress Status](PROGRESS.md)** - Implementation checklist

## 🔌 API Endpoints

### REST API

Base URL: `http://localhost:8000/api/`

**Devices:**

- `GET /devices/` - List all devices
- `GET /devices/{id}/` - Get device details
- `POST /devices/` - Create device
- `PATCH /devices/{id}/` - Update device
- `DELETE /devices/{id}/` - Delete device
- `GET /devices/statistics_all/` - All devices statistics

**Device Actions:**

- `GET /devices/{id}/statistics/?hours=24` - Device statistics
- `GET /devices/{id}/readings/?hours=24` - Device readings
- `GET /devices/{id}/cost_projection/?hours=24` - Cost projections
- `GET /devices/{id}/usage_pattern/?type=hourly&days=7` - Usage patterns
- `GET /devices/{id}/detect_anomalies/?hours=24` - Anomaly detection
- `GET /devices/{id}/detect_appliances/?hours=1` - Appliance detection
- `POST /devices/{id}/compare_periods/` - Compare two periods
- `POST /devices/{id}/reset_energy/` - Reset energy counter

**Readings:**

- `GET /readings/?device={id}&hours=24` - Get readings
- `GET /readings/statistics/` - Reading statistics

**Rates:**

- `GET /rates/?device={id}` - Get rate configurations
- `POST /rates/` - Create rate
- `PATCH /rates/{id}/` - Update rate
- `POST /rates/{id}/set_default/` - Set as default

**Firmware:**

- `GET /firmware/` - List firmware versions
- `GET /firmware/latest/` - Get latest version
- `POST /firmware/` - Upload firmware

**OTA Updates:**

- `GET /ota-updates/?device={id}` - Get OTA updates
- `POST /ota-updates/` - Create OTA update
- `POST /ota-updates/{id}/cancel/` - Cancel update
- `POST /ota-updates/{id}/retry/` - Retry failed update

### WebSocket API

**Device Connection:**

```
ws://localhost:8000/ws/device/{device_token}/
```

**Frontend Connection:**

```
ws://localhost:8000/ws/energy/
```

**Message Types:**

- Device → Server: `reading`, `status`, `heartbeat`, `error`
- Server → Device: `command`, `config`, `reading_ack`
- Server → Frontend: `energy_update`, `device_status`, `notification`

## 🛠️ Tech Stack

### Backend

- **Framework**: Django 5.0.14
- **REST API**: Django REST Framework 3.17.1
- **WebSocket**: Django Channels 4.3.2 + Redis
- **Database**: PostgreSQL 14 (prod), SQLite (dev)
- **ASGI Server**: Daphne 4.2.1

### Frontend

- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS + Shadcn UI
- **HTTP Client**: Axios
- **WebSocket**: Native WebSocket API
- **Charts**: Recharts 3.8.1
- **Routing**: React Router DOM
- **Icons**: Lucide React

### Firmware

- **MCU**: ESP8266 NodeMCU v2
- **Sensor**: PZEM-004T (ModBus RTU)
- **Display**: LCD I2C 16x2
- **Libraries**: PZEM-004Tv30, LiquidCrystal_I2C, ArduinoWebsockets, ArduinoJson, ArduinoOTA

## 🌐 Deployment

Deploy to Render.com with one click:

1. Push code to GitHub
2. Create Render account
3. New → Blueprint
4. Connect repository
5. Configure environment variables
6. Deploy!

See **[DEPLOYMENT.md](DEPLOYMENT.md)** for detailed guide.

**Production URLs:**

- Backend: `https://smart-energy-backend.onrender.com`
- Frontend: `https://smart-energy-frontend.onrender.com`
- Admin: `https://smart-energy-backend.onrender.com/admin/`

## 📊 Analytics Features

### Cost Projections

- Daily, weekly, monthly cost estimates
- Based on recent consumption patterns
- Confidence levels (low/medium/high)
- Supports time-based rates

### Usage Patterns

- Hourly usage analysis (24-hour profile)
- Daily usage trends
- Peak/low usage identification
- Weekday vs weekend comparison

### Anomaly Detection

- Power spike detection
- Unusual consumption alerts
- Threshold-based monitoring
- Historical comparison

### Appliance Detection

- 20+ appliance signatures
- Confidence-based matching
- Power state change detection
- On/off event tracking

## 🔒 Security

- Token-based device authentication
- CORS configuration for frontend
- Environment variables for secrets
- HTTPS/WSS in production
- Input validation and sanitization
- SQL injection protection

## 📈 Performance

- **Data Frequency**: 2-3 second intervals
- **WebSocket Latency**: <100ms
- **API Response Time**: <200ms
- **Database**: Indexed queries
- **Data Retention**: 1 year
- **Uptime Goal**: >99.5%

## 🧪 Testing

Run comprehensive tests:

```bash
# Backend tests
cd backend
python manage.py test
coverage run --source='.' manage.py test
coverage report

# Frontend tests
cd frontend
npm run test

# Integration tests
python test_websocket.py
```

See **[TESTING.md](TESTING.md)** for detailed testing guide.

## 📝 License

MIT License - See LICENSE file for details

## 👥 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 🐛 Known Issues

- Free tier Render services sleep after 15 min inactivity
- WebSocket reconnection may take 30-60s after sleep
- PZEM sensor requires stable AC connection

## 🗺️ Roadmap

- [ ] Mobile app (React Native)
- [ ] Email/SMS notifications
- [ ] Multi-user support with authentication
- [ ] Advanced charts and visualizations
- [ ] Export data (CSV, PDF)
- [ ] Scheduled reports
- [ ] Power factor correction recommendations
- [ ] Solar panel integration

## 📞 Support

- **Documentation**: See docs in each folder
- **Issues**: GitHub Issues
- **Email**: your-email@example.com

## 🙏 Acknowledgments

- Django & DRF communities
- React & TypeScript communities
- ESP8266 & Arduino communities
- PZEM-004T library contributors
- Shadcn UI & Tailwind CSS teams

---

**Built with ❤️ using Django, React, and ESP8266**

**Version**: 1.0.0  
**Last Updated**: May 2026
