# 🚑 Karur Emergency Ambulance Portal

A real-time emergency ambulance coordination platform for Karur, Tamil Nadu — connecting civilians and ambulance drivers efficiently via WebSockets, OTP authentication, and live map tracking.

---

## 📁 Folder Structure

```
karur-ambulance/
├── backend/
│   ├── config/
│   │   └── database.js          # MongoDB connection
│   ├── controllers/
│   │   ├── authController.js    # OTP send/verify, login
│   │   ├── alertController.js   # SOS alert lifecycle
│   │   └── driverController.js  # Location, status, fleet
│   ├── middleware/
│   │   └── auth.js              # JWT protect + role guard
│   ├── models/
│   │   ├── User.js              # Civilians & drivers schema
│   │   └── Alert.js             # SOS alert schema
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── alertRoutes.js
│   │   └── driverRoutes.js
│   ├── utils/
│   │   ├── smsService.js        # Twilio / mock OTP sender
│   │   └── jwtService.js        # Token generation/verification
│   ├── server.js                # Express + Socket.io entry point
│   ├── package.json
│   └── .env.example
│
├── frontend/
│   └── index.html               # Complete React SPA (self-contained)
│
└── README.md
```

---

## ⚡ Quick Start

### Prerequisites
- Node.js 18+
- MongoDB 6+ (local or Atlas)
- npm or yarn

---

### Backend Setup

```bash
cd backend

# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env — set MONGODB_URI, JWT_SECRET, and optionally Twilio keys

# 3. Start development server
npm run dev
# → API running at http://localhost:5000
# → WebSocket server ready
```

**Default .env values for local dev:**
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/karur_ambulance
JWT_SECRET=change_this_to_a_random_32_char_string
OTP_MOCK=true       # Use 123456 as OTP, no real SMS
```

---

### Frontend Setup

The frontend is a **single self-contained HTML file** — no build step needed for development.

```bash
# Option 1: Open directly in browser
open frontend/index.html

# Option 2: Serve with any static server
npx serve frontend/
# or
python3 -m http.server 3000 --directory frontend/
```

> For production, build with Create React App or Vite by extracting the JSX into proper `.jsx` files.

---

## 🔌 API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/send-otp` | Send OTP to mobile (mock: always 123456) |
| POST | `/api/auth/verify-otp` | Verify OTP, get JWT token |
| GET | `/api/auth/me` | Get current user profile |

### Alerts (SOS)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/alerts` | Send SOS (civilians only, rate-limited) |
| GET | `/api/alerts` | Driver: pending alerts / Civilian: own history |
| PATCH | `/api/alerts/:id/accept` | Driver accepts alert |
| PATCH | `/api/alerts/:id/reject` | Driver rejects alert |
| PATCH | `/api/alerts/:id/complete` | Driver marks as complete |

### Drivers
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/drivers` | List all active drivers (for map) |
| PATCH | `/api/drivers/location` | Update GPS coordinates |
| PATCH | `/api/drivers/status` | Update availability status |

---

## 🔄 WebSocket Events

**Server → Client:**
| Event | Room | Payload |
|-------|------|---------|
| `new_sos_alert` | `drivers` | Alert details + civilian location |
| `alert_accepted` | `civilian_<id>` | Driver info + ETA message |
| `alert_rejected` | `civilian_<id>` | Status update |
| `alert_completed` | `civilian_<id>` | Completion notification |
| `driver_location_updated` | `civilians` | Driver GPS update |
| `driver_status_updated` | `civilians` | Driver availability change |

**Client → Server:**
| Event | Description |
|-------|-------------|
| `driver_location` | Driver pushes GPS update (every 5s) |

---

## 📱 OTP Integration (SMS)

### Mock Mode (Default)
- Set `OTP_MOCK=true` in `.env`
- OTP is always **123456**
- Logged to server console

### Production Mode (Twilio)
1. Create a [Twilio account](https://www.twilio.com)
2. Get Account SID, Auth Token, and a phone number
3. Set in `.env`:
```env
OTP_MOCK=false
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
```

---

## 🗺 Map Integration

The frontend currently uses a **mock SVG map** centered on Karur (10.9601°N, 78.0766°E).

### To integrate real maps:

**Option 1 — Google Maps:**
```html
<script src="https://maps.googleapis.com/maps/api/js?key=YOUR_KEY"></script>
```
Replace `KarurMap` component with a `<div id="map">` and initialize:
```js
const map = new google.maps.Map(document.getElementById('map'), {
  center: { lat: 10.9601, lng: 78.0766 },
  zoom: 14,
});
```

**Option 2 — Leaflet (OpenStreetMap, free):**
```bash
npm install leaflet react-leaflet
```
```jsx
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
<MapContainer center={[10.9601, 78.0766]} zoom={14}>
  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
</MapContainer>
```

---

## 🔐 Security Features

| Feature | Implementation |
|---------|---------------|
| OTP Verification | Mandatory for all users before access |
| JWT Auth | HS256 signed tokens, 7-day expiry |
| Role-based Access | Drivers cannot send SOS; civilians cannot accept alerts |
| OTP Rate Limiting | Max 5 OTP requests per 15 min per IP |
| Alert Rate Limiting | Max 1 SOS per 2 minutes per verified user |
| OTP Expiry | 10-minute window, 5 attempt limit |
| Input Validation | Mobile regex, role enum, required field checks |

---

## 🚀 Production Deployment

### Backend (Node.js)
```bash
# Deploy to Railway, Render, or EC2
# Set NODE_ENV=production
# Use MongoDB Atlas for database
# Enable real Twilio SMS (OTP_MOCK=false)
```

### Frontend
```bash
# Extract JSX to React + Vite project
npm create vite@latest karur-frontend -- --template react
# Copy components, deploy to Vercel or Netlify
```

---

## 🧪 Demo Flow

1. **Open** `frontend/index.html` in browser
2. **Driver Login:** Click "Ambulance Driver" → fill name/mobile/ambulance no. → OTP `123456`
3. **Civilian Login:** Open in another tab → "Civilian" → fill name/mobile → OTP `123456`
4. **As Civilian:** Click the red SOS button — alert broadcasts to all drivers
5. **As Driver:** See incoming SOS in sidebar → Accept → civilian gets notification

---

## 📞 Emergency Contacts (Karur)
- Ambulance: **108**
- Police: **100**  
- Fire: **101**
- Karur Govt. Hospital: **04324-220225**
