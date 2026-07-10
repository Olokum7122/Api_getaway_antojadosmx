# Api_getaway_antojadosmx

API Gateway Central del Ecosistema AntojadosMx

## Descripción

Gateway público que sirve como API Central para todo el ecosistema AntojadosMx.
Todos los clientes (apps-antojados iOS/Android, explorer-app, etc.) consumen
exclusivamente a través de `https://api.antojadosmx.mx`.

## Endpoints

- `/health` — Health check
- `/api/v1/antojados/auth/*` — Autenticación (login, register, profile, password-recovery)
- `/api/v1/antojados/places/*` — Lugares y Google Places
- `/api/v1/antojados/posts/*` — Posts
- `/api/v1/antojados/feed/*` — Feeds
- `/api/v1/antojados/social/*` — Red social
- `/api/v1/antojados/media/*` — Media
- `/api/v1/antojados/biz/*` — Sponsors/Negocios
- `/api/v1/antojados/gt/*` — GT Control (tenants, efirma, dimensions, etc.)
- `/api/v1/antojados/geo/*` — Geolocalización
- `/api/v1/antojados/rating/*` — Calificaciones
- `/api/v1/antojados/rewards/*` — Recompensas
- `/api/v1/antojados/rewards/*` — Analytics
- `/api/v1/config/*` — Configuración GT
- `/api/v1/solutions/*` — Soluciones GT
- `/api/v1/services/*` — Servicios GT
- `/api/v1/planning/*` — Planeación GT
- `/api/v1/finance/*` — Finanzas GT
- `/api/v1/analytics/*` — Analytics GT
- `/docs` — Swagger UI

## Stack

- Node.js + Express
- SQL Server (mssql) — 4 pools: APP, ANALYTICS, INTEGRATION, ANTOJADOS
- dotenv, sharp, fluent-ffmpeg

## Desarrollo

```bash
npm install
npm run dev     # node --watch src/index.js
npm start       # node src/index.js
```

## Producción (Contabo)

```bash
npm run pm2     # pm2 start src/index.js --name api_antojados
```

## Variables de Entorno (.env)

```
PORT=8010
GT_API_BASE_URL=http://localhost:4010
API_BASE_URL=http://localhost:8010
```

## Estructura

```
src/
├── index.js                    # Entry point
├── db.js                       # Conexiones SQL Server (4 pools)
├── routes/
│   ├── health.js
│   └── v1/
│       ├── antojados/          # Rutas del dominio AntojadosMx (29 archivos)
│       ├── config.js
│       ├── solutions.js
│       ├── services.js
│       ├── planning.js
│       ├── finance.js
│       ├── analytics.js
│       └── zonad.js
└── services/
    └── antojados/              # Lógica de negocio (services + mappers + resolvers)