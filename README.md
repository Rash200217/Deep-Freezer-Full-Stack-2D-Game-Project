<div align="center">

<img src="Frontend/public/favicon.png" alt="Deep Freezer Logo" width="120"/>

# ❄️ DEEP FREEZER

**A full-stack, cloud-connected 2D arcade game — built with Phaser 3, .NET 10, PostgreSQL, SignalR, and gRPC.**

[![Live Game](https://img.shields.io/badge/▶%20Play%20Now-Vercel-black?style=for-the-badge&logo=vercel)](https://deep-freezer-full-stack-2-d-game-pr.vercel.app/)
[![Backend API](https://img.shields.io/badge/API-AWS%20App%20Runner-orange?style=for-the-badge&logo=amazonaws)](https://deepfreeze-api.duckdns.org)
[![License](https://img.shields.io/badge/License-MIT-cyan?style=for-the-badge)](LICENSE)
[![.NET](https://img.shields.io/badge/.NET-10.0-purple?style=for-the-badge&logo=dotnet)](https://dotnet.microsoft.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org)

</div>

---

## 🎮 About The Game

**Deep Freezer** is a neon-styled, icy arcade platformer where players battle waves of frozen enemies across hand-crafted and community-made levels. Shoot enemies to freeze them into snowballs, then roll those snowballs to shatter them. The game features full online infrastructure — real-time multiplayer communication via SignalR, cloud leaderboards, user authentication, a community level editor with a publish/vote system, and an admin control panel.

**Video Link: (https://drive.google.com/file/d/1Gmq8oL72KkxsMx_k7jDZE3u7rNN3jAPI/view?usp=sharing)

<img width="1920" height="922" alt="Image" src="https://github.com/user-attachments/assets/82f4273d-4b7f-493e-a7be-fe2ebdf81885" />

<img width="1920" height="919" alt="Image" src="https://github.com/user-attachments/assets/20a492ac-f9c9-4334-917a-05a714f2aef0" />

<img width="1920" height="926" alt="Image" src="https://github.com/user-attachments/assets/c0dee207-d8a7-4dec-81af-efe41eb3be5d" />

<img width="1920" height="926" alt="Image" src="https://github.com/user-attachments/assets/068f345f-dd82-47af-93ba-ba9056bbcc0f" />

<img width="1918" height="922" alt="Image" src="https://github.com/user-attachments/assets/9445f3b9-a208-4912-a0e7-94f9c99fb250" />

<img width="1918" height="917" alt="Image" src="https://github.com/user-attachments/assets/391d6dd9-9392-4819-b92b-0a8d3ad0f94f" />

<img width="1918" height="917" alt="Image" src="https://github.com/user-attachments/assets/a5cc1082-fd16-46f0-9519-cabdce7d398f" />

<img width="1920" height="917" alt="Image" src="https://github.com/user-attachments/assets/5debb2b7-2fc0-40a0-a507-c17c3c3f2e37" />

> *"Freeze. Roll. Shatter. Repeat."*

---

## ✨ Features

### 🕹️ Gameplay
- **Solo & Co-op Modes** — Play alone or with a friend in local 2-player co-op (shared screen)
- **Freeze Mechanic** — Shoot ice bullets to freeze enemies into snowballs; push them to shatter foes
- **Enemy Variety** — Basic enemies, shielded enemies (front-armored), sniper enemies, and red variants
- **Arcade Boss** — Face a massive King Boss that requires multiple snowball hits to defeat
- **Power-Ups** — Hearts restore health; at full HP, they grant extra lives (max 5)
- **Parallax Backgrounds** — Multi-layer scrolling cavern backgrounds
- **Atmospheric Sound** — ZzFX procedural sound effects and ambient snow theme music
- **Mute Toggle** — Persistent audio preference via `localStorage`

### 🌐 Online Features
- **Cloud Leaderboard** — Submit and view top scores from the Menu's *Hall of Fame*
- **JWT Authentication** — Secure login/register system with token-based sessions
- **Real-Time Multiplayer** — SignalR hub (`/gamehub`) for live player-state synchronization
- **gRPC Telemetry** — Protobuf-based telemetry streaming via gRPC-Web
- **Community Hub** — Browse, play, upvote/downvote community-published levels
- **Level Editor** — In-game grid editor to design and publish custom levels with thumbnail previews
- **Achievements System** — Per-user achievement tracking stored in the cloud

### 🛠️ Admin Panel
- Dedicated `admin.html` control panel (separate from the player portal)
- Admin-tier JWT claims; admins cannot play the game or use the level editor
- User and content management features

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| **Game Engine** | [Phaser 3](https://phaser.io/) (`^3.90`) |
| **Frontend Language** | TypeScript 6 |
| **Frontend Build** | Vite 8 |
| **Frontend Hosting** | Vercel |
| **Real-Time Comms** | Microsoft SignalR (`@microsoft/signalr ^10.0`) |
| **Telemetry Protocol** | gRPC-Web + Protocol Buffers (`@protobuf-ts`) |
| **HTTP Client** | Axios |
| **Backend Framework** | ASP.NET Core 10 (.NET 10) |
| **Backend Language** | C# |
| **Backend Hosting** | AWS App Runner (Dockerized) |
| **Database** | PostgreSQL via [Neon](https://neon.tech/) (serverless) |
| **ORM** | Entity Framework Core 10 + Npgsql |
| **Authentication** | JWT Bearer Tokens |
| **API Docs** | ASP.NET OpenAPI |
| **Containerization** | Docker (multi-stage build) |

---

## 📁 Project Structure

```
Deep Freezer Full-Stack 2D Game Project/
│
├── Frontend/                      # Vite + TypeScript + Phaser 3
│   ├── public/
│   │   ├── assets/                # Game sprites, backgrounds, audio
│   │   │   ├── player_sheet.png
│   │   │   ├── boss_king_v3.png
│   │   │   ├── basic_enemies.png
│   │   │   ├── shield enemies.png
│   │   │   ├── red enemies.png
│   │   │   ├── sniper enemies.png
│   │   │   ├── iceball_sheet_processed.png
│   │   │   ├── bg_cavern_*.png    # Parallax background layers
│   │   │   ├── platform.png
│   │   │   └── snow_theme.ogg     # Menu background music
│   │   ├── portal.html            # Player login/register portal
│   │   ├── admin.html             # Admin control panel
│   │   ├── player_portal_bg.png
│   │   ├── admin_console_bg.png
│   │   └── favicon.png
│   ├── src/
│   │   ├── game/
│   │   │   ├── BootScene.ts       # Asset preloading & initial setup
│   │   │   ├── MenuScene.ts       # Main menu, leaderboard, auth UI
│   │   │   ├── GameScene.ts       # Core gameplay loop (enemies, physics, HUD)
│   │   │   ├── LevelEditorScene.ts# In-game level editor with publish
│   │   │   ├── CommunityScene.ts  # Browse & play community levels
│   │   │   ├── GameOverScene.ts   # Death / retry screen
│   │   │   ├── WinScene.ts        # Victory screen & score submission
│   │   │   └── zzfx.ts            # ZzFX procedural sound effects
│   │   ├── api/
│   │   │   ├── LevelsApi.ts       # REST calls for community levels
│   │   │   └── AchievementsApi.ts # REST calls for achievements
│   │   ├── Api.ts                 # Core API client (auth, leaderboard)
│   │   ├── SignalRClient.ts       # SignalR hub connection manager
│   │   ├── TelemetryClient.ts     # gRPC-Web telemetry client
│   │   ├── telemetry.ts           # Telemetry event definitions
│   │   └── main.ts                # Phaser game bootstrap
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json
│
└── Backend/
    └── DeepFreezeBackend/         # ASP.NET Core 10 API
        ├── Controllers/
        │   ├── AuthController.cs  # POST /api/auth/login, /register
        │   ├── ScoresController.cs# POST /api/scores, GET /api/scores/leaderboard
        │   ├── LevelsController.cs# GET /api/levels, POST /api/levels/publish, vote
        │   ├── AchievementsController.cs # GET/POST /api/achievements
        │   └── AdminController.cs # Admin-only user/content management
        ├── Hubs/
        │   └── GameHub.cs         # SignalR real-time hub
        ├── Models/
        │   ├── User.cs
        │   ├── Level.cs
        │   ├── Score.cs
        │   └── Dto.cs
        ├── Data/
        │   └── GameDbContext.cs   # EF Core DbContext
        ├── Services/
        │   └── TelemetryService.cs# gRPC Telemetry service impl
        ├── Protos/
        │   └── telemetry.proto    # Protobuf schema
        ├── Program.cs             # App bootstrap, CORS, auth, schema
        ├── Dockerfile             # Multi-stage Docker build
        └── DeepFreezeBackend.csproj
```

---

## 🗄️ Database Schema

The schema is auto-provisioned on startup via raw SQL (no EF Migrations needed):

```sql
Users         -- Id, Username, PasswordHash, CreatedAt, IsAdmin
Scores        -- Id, UserId → Users, Value, AchievedAt
Levels        -- Id, UserId → Users, AuthorName, Name, GridData (JSON), Thumbnail (base64), PlayCount, CreatedAt
LevelRatings  -- Id, LevelId → Levels, UserId → Users, Vote (+1/-1) [UNIQUE per user/level]
Achievements  -- Id, UserId → Users, AchievementKey, AchievedAt [UNIQUE per user/key]
```

---

## 🚀 Getting Started

### Prerequisites

| Tool | Version |
|---|---|
| [Node.js](https://nodejs.org) | 20+ |
| [.NET SDK](https://dotnet.microsoft.com/download) | 10.0 |
| [PostgreSQL](https://www.postgresql.org/) | 15+ (or a [Neon](https://neon.tech/) serverless instance) |

---

### 1. Clone the Repository

```bash
git clone https://github.com/Rash200217/Deep-Freezer-Full-Stack-2D-Game-Project.git
cd "Deep Freezer Full-Stack 2D Game Project"
```

---

### 2. Backend Setup

#### Configure the connection string & JWT

Create `Backend/DeepFreezeBackend/appsettings.Development.json` (already gitignored):

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=YOUR_DB_HOST;Port=5432;Database=deepfreeze;Username=YOUR_USER;Password=YOUR_PASSWORD;Ssl Mode=Require"
  },
  "JwtSettings": {
    "Secret": "YourSuperSecretKeyHere_AtLeast32Chars!!",
    "Issuer": "DeepFreezerAPI",
    "Audience": "DeepFreezerGame"
  }
}
```

#### Run the backend locally

```bash
cd Backend/DeepFreezeBackend
dotnet restore
dotnet run
```

The API starts on `http://localhost:8080`. The database schema is **auto-created** on first run.

> **Health check:** `GET http://localhost:8080/` → `{ "status": "Deep Freezer API is running 🧠❄️", "version": "1.0" }`

---

### 3. Frontend Setup

```bash
cd Frontend
npm install
npm run dev
```

The game opens at `http://localhost:5173`.

> Vite's dev proxy automatically forwards `/api`, `/gamehub`, and `/telemetry.*` calls to `http://localhost:5000` (or update `vite.config.ts` to match your local backend port).

---

### 4. Accessing the Portals

| Portal | URL | Purpose |
|---|---|---|
| Game | `http://localhost:5173` | Main game |
| Player Portal | `http://localhost:5173/portal.html` | Login / Register |
| Admin Panel | `http://localhost:5173/admin.html` | Admin dashboard |

> **Keyboard shortcuts in-game:**
> - `L` → Open Login portal
> - `R` → Open Register portal
> - `Backspace` → Logout

---

## 🐳 Docker Deployment (Backend)

```bash
cd Backend/DeepFreezeBackend

# Build the image
docker build -t deepfreeze-backend .

# Run with environment variables
docker run -p 8080:8080 \
  -e ConnectionStrings__DefaultConnection="<your_postgres_connection_string>" \
  -e JwtSettings__Secret="<your_jwt_secret>" \
  -e JwtSettings__Issuer="DeepFreezerAPI" \
  -e JwtSettings__Audience="DeepFreezerGame" \
  deepfreeze-backend
```

The image uses a **multi-stage build** (SDK → ASP.NET runtime), keeping the final image lean.

---

## ☁️ Production Deployment

### Backend → AWS App Runner
- Push Docker image to ECR, then deploy via App Runner
- The app reads the `PORT` environment variable dynamically
- CORS is pre-configured for the Vercel frontend origin

### Frontend → Vercel
- Connect the repository to Vercel
- Set the **Root Directory** to `Frontend`
- Set build command to `npm run build`, output dir to `dist`
- Set the environment variable:
  ```
  VITE_API_URL=https://deepfreeze-api.duckdns.org
  ```

> The frontend `Api.ts` hardcodes the production base URL — update it to match your deployed backend domain.

---

## 🎯 API Reference

### Authentication
| Method | Endpoint | Body | Auth |
|---|---|---|---|
| `POST` | `/api/Auth/register` | `{ username, password }` | ❌ |
| `POST` | `/api/Auth/login` | `{ username, password }` | ❌ |

### Scores / Leaderboard
| Method | Endpoint | Auth |
|---|---|---|
| `POST` | `/api/scores` | ✅ JWT |
| `GET` | `/api/scores/leaderboard` | ❌ |

### Levels (Community)
| Method | Endpoint | Notes |
|---|---|---|
| `GET` | `/api/levels?limit=20&sort=new` | `sort=top` for highest rated |
| `POST` | `/api/levels/publish` | ✅ JWT; includes base64 thumbnail |
| `POST` | `/api/levels/{id}/vote` | ✅ JWT; `{ "vote": 1 }` or `{ "vote": -1 }` |
| `GET` | `/api/levels/{id}/myvote` | ✅ JWT |

### Achievements
| Method | Endpoint | Auth |
|---|---|---|
| `GET` | `/api/achievements` | ✅ JWT |
| `POST` | `/api/achievements` | ✅ JWT |

### Real-Time
| Protocol | Endpoint | Purpose |
|---|---|---|
| WebSocket (SignalR) | `/gamehub` | Live player state sync |
| gRPC-Web | `/telemetry.TelemetryActivity` | Game telemetry streaming |

---

## 🕹️ How To Play

```
MOVEMENT:
  Player 1 — Arrow Keys
  Player 2 — WASD

SHOOTING:
  Player 1 — SPACE
  Player 2 — F

OBJECTIVE:
  1. Shoot enemies with ice bullets until they freeze into a snowball.
  2. Push the snowball to build momentum.
  3. Roll the snowball into other enemies to shatter them instantly!

ENEMIES:
  🔵 Basic      — Standard enemies, freeze with a few hits
  🛡 Shielded   — Armored front; hit from behind or with a snowball
  🔴 Red         — Tougher variant with more HP
  🎯 Sniper     — Ranged attackers; avoid their line of sight
  👑 Boss King  — Massive boss requiring multiple snowball impacts

POWER-UPS:
  ❤ Heart       — Restores 1 HP; grants an extra life if already full (max 5 lives)
```

---

## 🏆 Achievements

Achievements are unlocked automatically during gameplay and saved to your cloud profile:

| Key | Description |
|---|---|
| `first_kill` | Defeat your first enemy |
| `snowball_kill` | Shatter an enemy with a snowball |
| `boss_defeated` | Defeat the Boss King |
| `level_published` | Publish your first community level |
| *(and more...)* | |

---

## 🛡️ Security Notes

- Passwords are **hashed** server-side before storage (never stored in plaintext)
- JWT tokens are validated on every protected endpoint
- Admins are identified by a server-side `IsAdmin` flag — cannot be self-promoted
- CORS is restricted to specific origins (localhost + Vercel production URL)
- Guest players can play but cannot submit scores, publish levels, or earn achievements

---

## 🤝 Contributing

Contributions, bug reports, and feature ideas are welcome!

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m 'feat: add my feature'`
4. Push to the branch: `git push origin feature/my-feature`
5. Open a Pull Request

---

## 👤 Author

**Rashmika Dhananjaya**

[![GitHub](https://img.shields.io/badge/GitHub-Rash200217-181717?style=flat&logo=github)](https://github.com/Rash200217)

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

*Made by ❄️ Rashmika Dhananjaya*

</div>
