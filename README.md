# ♻️ EcoHub — The Disconnected E-Waste Loop

> **Closing the gap between e-waste generation and responsible recycling through AI-verified collection and gamified citizen engagement.**

EcoHub is a full-stack platform that connects **citizens**, **collection centres**, and **recycling companies** into a transparent, fraud-resistant e-waste disposal pipeline — powered by AI image verification and a trust-scoring engine.

---

## 🎯 Problem Statement

India generates **3.2 million tonnes** of e-waste annually, yet only **20%** is formally recycled. The disconnected loop — citizens don't know where to dispose, centres can't verify authenticity, companies lack traceable supply — results in hazardous informal recycling that poisons communities.

## 💡 Our Solution

EcoHub creates a **verified, end-to-end e-waste lifecycle** with three key innovations:

1. **AI-Powered Fraud Detection** — Gemini 1.5 Flash performs an 11-point audit comparing citizen-uploaded and centre-captured photos to prevent fake disposals
2. **Trust Score Engine** — Multi-signal scoring (perceptual hashing, GPS proximity, timestamps, category matching) provides a second layer of verification
3. **Gamified EcoCredits** — Citizens earn redeemable credits for verified disposals, driving participation

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (React + Vite)                 │
├──────────┬──────────────┬───────────────┬───────────────────┤
│ Citizen  │  Collection  │   Company     │   Admin           │
│ Portal   │  Centre      │   Dashboard   │   Panel           │
│          │  Portal      │               │                   │
├──────────┴──────────────┴───────────────┴───────────────────┤
│                    REST API (Node.js)                        │
├──────────┬──────────────┬───────────────┬───────────────────┤
│ Auth     │ Disposal     │ EcoCredits    │ Reports           │
│ Service  │ Service      │ Service       │ Service           │
├──────────┴──────────────┴───────────────┴───────────────────┤
│              AI VERIFICATION LAYER                          │
│  ┌─────────────────────┐  ┌──────────────────────┐          │
│  │ Gemini 1.5 Flash    │  │ Trust Score Engine    │          │
│  │ (11-point audit)    │  │ (pHash + GPS + time)  │          │
│  └─────────────────────┘  └──────────────────────┘          │
├─────────────────────────────────────────────────────────────┤
│                   SQLite Database                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 🤖 AI Image Verification System

When a collection centre verifies a disposal, the system runs a **two-layer verification**:

### Layer 1: Gemini 1.5 Flash — 11-Point Fraud Audit
The AI compares citizen-uploaded photos with centre-captured photos and checks:

| # | Check | What It Detects |
|---|-------|-----------------|
| 1 | Same physical device | Different products swapped in |
| 2 | Brand & model match | Mismatched product claims |
| 3 | Serial/label match | Tampered or missing labels |
| 4 | Consistent damage/wear | Photoshopped or stock images |
| 5 | Real-world photo evidence | AI-generated or internet images |
| 6 | Lighting consistency | Photos from different environments |
| 7 | Background plausibility | Studio vs. real-world setting |
| 8 | Scale & proportion | Manipulated image dimensions |
| 9 | Screen-of-screen detection | Photos of photos on another device |
| 10 | Category match | E.g., claiming a phone is a laptop |
| 11 | Overall fraud probability | Combined confidence score |

### Layer 2: Trust Score Engine
Independent scoring using:
- **Perceptual Hash (pHash)** — structural image similarity
- **GPS proximity** — citizen location vs. centre location
- **Timestamp delta** — time between upload and verification
- **Category consistency** — declared vs. detected product type
- **File hash uniqueness** — duplicate submission detection

**Decision Matrix:**
| Score | Decision |
|-------|----------|
| ≥ 70 | ✅ VERIFIED |
| 40–69 | ⚠️ REQUIRES REVIEW |
| < 40 | ❌ REJECTED |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, Vite, React Router v6 |
| **Backend** | Node.js (vanilla HTTP server) |
| **Database** | SQLite (file-based, zero-config) |
| **AI/ML** | Google Gemini 1.5 Flash API |
| **Auth** | JWT (JSON Web Tokens) |
| **QR Codes** | qrcode.react, html5-qrcode |
| **Email** | Nodemailer (SMTP) |
| **PDF Reports** | jsPDF |

---

## 👥 User Roles

### 🧑 Citizen
- Register & log in
- Submit e-waste disposal requests with product photos
- Complete video verification challenges
- Earn & redeem EcoCredits
- Track disposal history

### 🏢 Collection Centre
- Verify citizen disposals with live photos
- AI-powered fraud detection on verification
- Manage incoming disposal requests
- Generate QR codes for tracking

### 🏭 Recycling Company
- View verified e-waste inventory
- Order eco-bags for collection
- Access analytics dashboard
- Track material flow

### 🔐 Admin
- Approve/reject company & centre registrations
- Monitor platform activity
- Access system-wide reports

---

## 📂 Project Structure

```
Ecohub1R/
├── Ecohub1R/
│   ├── frontend/               # React + Vite frontend
│   │   ├── src/
│   │   │   ├── pages/          # All page components
│   │   │   │   ├── LandingPage.jsx
│   │   │   │   ├── CitizenDisposalFlow.jsx
│   │   │   │   ├── CollectionCentrePortal.jsx
│   │   │   │   ├── CompanyDashboard.jsx
│   │   │   │   ├── EcoCreditsWallet.jsx
│   │   │   │   ├── GamificationHub.jsx
│   │   │   │   └── ...
│   │   │   ├── layouts/        # Layout wrappers per role
│   │   │   ├── api.js          # API client
│   │   │   └── main.jsx        # App entry point
│   │   └── package.json
│   │
│   └── server/                 # Node.js backend
│       ├── server.js           # HTTP server & routing
│       ├── db.js               # SQLite database setup
│       ├── controllers/
│       │   ├── authController.js
│       │   ├── disposalController.js
│       │   ├── collectionCentreController.js
│       │   ├── companyController.js
│       │   ├── adminController.js
│       │   └── ecoCreditsController.js
│       ├── services/
│       │   ├── productImageVerificationService.js  # Gemini AI
│       │   ├── trustScoreEngine.js                 # pHash scoring
│       │   ├── videoVerificationService.js
│       │   ├── emailService.js
│       │   └── reportService.js
│       └── middleware/
│           └── auth.js         # JWT authentication
│
├── .env.example                # Environment template
├── .gitignore
├── package.json                # Root scripts
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** v18+
- **npm** v9+
- **Gemini API Key** from [Google AI Studio](https://aistudio.google.com/apikey)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/cseclubs-auts/EcoHub-The-Disconnected-E-Waste-Loop..git
cd EcoHub-The-Disconnected-E-Waste-Loop.

# 2. Install backend dependencies
npm install

# 3. Install frontend dependencies
cd Ecohub1R/frontend
npm install
cd ../..

# 4. Configure environment
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY, JWT_SECRET, etc.

# 5. Start the backend server
npm start

# 6. Start the frontend (in a new terminal)
npm run dev:frontend
```

The backend runs on `http://localhost:3000` and the frontend on `http://localhost:5173`.

---

## 🔐 Environment Variables

Create a `.env` file in the root directory:

```env
GEMINI_API_KEY=your-gemini-api-key        # Required for AI verification
JWT_SECRET=your-jwt-secret                 # Required for authentication
DATABASE_URL=./Ecohub1R/server/ecohub.sqlite
ADMIN_EMAIL=admin@example.com
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
```

---

## 📊 Key Features Summary

| Feature | Description |
|---------|-------------|
| 🔍 AI Fraud Detection | 11-point Gemini-powered photo verification |
| 🛡️ Trust Score Engine | Multi-signal authenticity scoring |
| 🎮 Gamified EcoCredits | Earn rewards for verified disposals |
| 📱 QR Code Tracking | End-to-end disposal traceability |
| 🎥 Video Challenges | Live video verification for high-value items |
| 📧 Email Notifications | Automated status updates |
| 📄 PDF Reports | Downloadable disposal certificates |
| 🗺️ Collection Centre Map | Find nearest verified centres |

---

## 👨‍💻 Team

**CSE Clubs — AUTS**

---

## 📄 License

This project is built for the hackathon and is available under the MIT License.
