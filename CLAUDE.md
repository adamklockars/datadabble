# DataDabble - Developer Guide

## Architecture Overview

DataDabble is a full-stack application for creating custom databases with flexible schemas. It uses a Flask backend with MongoDB and a React frontend.

### Backend Architecture

- **App Factory Pattern**: `backend/app/__init__.py` creates the Flask app
- **Blueprints**: API routes organized under `backend/app/api/v1/`
- **MongoEngine ODM**: Models in `backend/app/models/`
- **JWT Authentication**: Using flask-jwt-extended
- **Marshmallow Schemas**: Validation in `backend/app/api/schemas/`

### Frontend Architecture

- **React 18** with TypeScript
- **React Query** for server state management
- **Zustand** for client state (auth, toasts)
- **React Router** for routing
- **Tailwind CSS** for styling

## Key Files

### Backend
- `backend/app/__init__.py` - App factory
- `backend/app/config.py` - Configuration classes
- `backend/app/extensions.py` - Flask extensions (db, jwt, marshmallow)
- `backend/app/api/v1/auth.py` - Authentication endpoints
- `backend/app/api/v1/databases.py` - Database CRUD
- `backend/app/api/v1/fields.py` - Field CRUD
- `backend/app/api/v1/entries.py` - Entry CRUD (paginated)
- `backend/app/models/*.py` - MongoEngine document models

### Frontend
- `frontend/src/App.tsx` - Main app with routing
- `frontend/src/api/client.ts` - Axios client with JWT interceptors
- `frontend/src/store/authStore.ts` - Zustand auth state
- `frontend/src/pages/Dashboard.tsx` - Database list
- `frontend/src/pages/DatabaseDetail.tsx` - Fields and entries management

## Commands

### Backend
```bash
cd backend

# Run development server
python run.py

# Run tests
pytest -v

# Run tests with coverage
pytest -v --cov=app --cov-report=html

# Format code
black app tests

# Lint
flake8 app tests
```

### Frontend
```bash
cd frontend

# Run development server
npm run dev

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Build for production
npm run build

# Lint
npm run lint
```

### Docker
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild after changes
docker-compose up -d --build
```

## Data Models

### User
- email (unique, required)
- password_hash (bcrypt)
- first_name, last_name
- created_at, updated_at

### Database
- title (required)
- slug (auto-generated, unique per user)
- description
- user (reference)

### Field
- name (required, unique per database)
- field_type: BOOL, INT, DEC, STR, DATE, EMAIL, URL, DICT, LIST
- required (boolean)
- default_value
- order

### Entry
- database (reference)
- values (dict)
- created_at, updated_at

## API Authentication

All API endpoints except auth endpoints require JWT authentication:

```
Authorization: Bearer <access_token>
```

Access tokens expire after 1 hour (configurable). Use the refresh endpoint to get a new access token.

## Testing

### Backend Tests
Tests use mongomock for in-memory MongoDB. Fixtures in `backend/tests/conftest.py`.

### Frontend Tests
Tests use Vitest + React Testing Library. Setup in `frontend/tests/setup.ts`.

## Common Tasks

### Add a new API endpoint
1. Add route in `backend/app/api/v1/<resource>.py`
2. Add Marshmallow schema if needed in `backend/app/api/schemas/`
3. Write tests in `backend/tests/`
4. Add API function in `frontend/src/api/`
5. Create React Query hook in `frontend/src/hooks/`

### Add a new field type
1. Add to FIELD_TYPES in `backend/app/models/field.py`
2. Update FIELD_TYPE_OPTIONS in `frontend/src/pages/DatabaseDetail.tsx`
3. Handle parsing in entry form submission

### Modify authentication
1. Backend: `backend/app/api/v1/auth.py` and `backend/app/extensions.py`
2. Frontend: `frontend/src/store/authStore.ts` and `frontend/src/api/client.ts`
