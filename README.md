# DataDabble

A modern web application for creating and managing custom databases with a flexible schema design.

## Tech Stack

### Backend
- **Flask 3.x** - Python web framework
- **MongoEngine** - MongoDB ODM
- **Flask-JWT-Extended** - JWT authentication
- **Marshmallow** - Validation and serialization
- **pytest** - Testing framework

### Frontend
- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **React Query** - Data fetching
- **Zustand** - State management
- **React Router** - Routing

### Database
- **MongoDB** - Document database

## Project Structure

```
datadabble/
├── backend/
│   ├── app/
│   │   ├── __init__.py          # App factory
│   │   ├── config.py            # Configuration
│   │   ├── extensions.py        # Flask extensions
│   │   ├── api/v1/              # API endpoints
│   │   │   ├── auth.py          # Authentication
│   │   │   ├── databases.py     # Database CRUD
│   │   │   ├── fields.py        # Field CRUD
│   │   │   └── entries.py       # Entry CRUD
│   │   ├── api/schemas/         # Marshmallow schemas
│   │   ├── models/              # MongoEngine models
│   │   └── utils/               # Utilities
│   ├── tests/                   # pytest tests
│   ├── requirements.txt
│   └── run.py
├── frontend/
│   ├── src/
│   │   ├── api/                 # API client
│   │   ├── components/          # React components
│   │   ├── pages/               # Page components
│   │   ├── hooks/               # Custom hooks
│   │   ├── store/               # Zustand stores
│   │   └── types/               # TypeScript types
│   ├── tests/                   # Vitest tests
│   ├── package.json
│   └── vite.config.ts
├── docker-compose.yml
└── .env.example
```

## Getting Started

### Prerequisites
- Python 3.12+
- Node.js 20+
- MongoDB 7+

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment variables
cp ../.env.example .env

# Run the server
python run.py
```

The API will be available at http://localhost:5000

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev
```

The frontend will be available at http://localhost:5173

### Docker Setup

```bash
# Copy environment variables
cp .env.example .env

# Start all services
docker-compose up -d
```

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Register new user |
| POST | `/api/v1/auth/login` | Login, returns JWT |
| POST | `/api/v1/auth/logout` | Logout |
| POST | `/api/v1/auth/refresh` | Refresh token |
| GET | `/api/v1/auth/me` | Get current user |

### Databases
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/databases` | List databases |
| POST | `/api/v1/databases` | Create database |
| GET | `/api/v1/databases/<slug>` | Get database |
| PUT | `/api/v1/databases/<slug>` | Update database |
| DELETE | `/api/v1/databases/<slug>` | Delete database |

### Fields
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/databases/<slug>/fields` | List fields |
| POST | `/api/v1/databases/<slug>/fields` | Create field |
| GET | `/api/v1/databases/<slug>/fields/<id>` | Get field |
| PUT | `/api/v1/databases/<slug>/fields/<id>` | Update field |
| DELETE | `/api/v1/databases/<slug>/fields/<id>` | Delete field |

### Entries
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/databases/<slug>/entries` | List entries (paginated) |
| POST | `/api/v1/databases/<slug>/entries` | Create entry |
| GET | `/api/v1/databases/<slug>/entries/<id>` | Get entry |
| PUT | `/api/v1/databases/<slug>/entries/<id>` | Update entry |
| DELETE | `/api/v1/databases/<slug>/entries/<id>` | Delete entry |

## Testing

### Backend Tests
```bash
cd backend
pytest -v --cov=app
```

### Frontend Tests
```bash
cd frontend
npm test
```

## Environment Variables

See `.env.example` for all configuration options:

- `SECRET_KEY` - Flask secret key
- `JWT_SECRET_KEY` - JWT signing key
- `MONGODB_HOST` - MongoDB host
- `MONGODB_PORT` - MongoDB port
- `MONGODB_DB` - Database name
- `CORS_ORIGINS` - Allowed CORS origins

## License

MIT
