# Backend API

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file:
```env
PORT=5000
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
FIREBASE_PROJECT_ID=your-firebase-project-id (optional)
FIREBASE_PRIVATE_KEY=your-firebase-private-key (optional)
FIREBASE_CLIENT_EMAIL=your-firebase-client-email (optional)
OPENAI_API_KEY=your-openai-api-key (optional)
```

3. Run the server:
```bash
npm run dev
```

The server will start on `http://localhost:5000`

## API Endpoints

All endpoints except `/api/auth/*` require authentication via JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Expenses
- `GET /api/expenses` - Get all expenses
- `POST /api/expenses` - Create expense
- `PUT /api/expenses/:id` - Update expense
- `DELETE /api/expenses/:id` - Delete expense

### Analytics
- `GET /api/analytics?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` - Get analytics

### Export
- `GET /api/export/csv?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` - Export CSV
- `GET /api/export/pdf?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` - Export PDF

### Predictions
- `GET /api/predictions` - Get spending predictions
