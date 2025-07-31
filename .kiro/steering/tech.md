# Technology Stack & Build System

## Backend Stack
- **Runtime**: Node.js 18+ with TypeScript
- **Framework**: Express.js with Socket.io for real-time communication
- **Database**: TiDB Cloud (primary) with SQLite fallback via better-sqlite3
- **Authentication**: JWT with bcrypt password hashing
- **File Storage**: Google Drive API v3
- **Testing**: Jest with ts-jest, Supertest for API testing

## Frontend Stack
- **Framework**: React.js 18 with TypeScript (planned)
- **Styling**: Tailwind CSS for iPad-optimized responsive design
- **Build Tool**: Vite or Create React App
- **State Management**: React Context/hooks

## Key Dependencies
- `express` - Web framework
- `socket.io` - Real-time bidirectional communication
- `jsonwebtoken` - JWT token handling
- `bcryptjs` - Password hashing
- `better-sqlite3` - Local SQLite database
- `mysql2` - TiDB/MySQL connection
- `cors`, `helmet` - Security middleware
- `express-validator` - Input validation
- `uuid` - ID generation

## Development Commands

### Backend
```bash
# Development with hot reload
npm run dev

# Build TypeScript to JavaScript
npm run build

# Production start
npm run start:prod

# Testing
npm test                # Run all tests
npm run test:watch      # Watch mode
npm run test:coverage   # Coverage report
```

### Environment Setup
- Copy `backend/.env.example` to `backend/.env`
- Configure TiDB connection, JWT secrets, Google Service Account
- Set REGISTRATION_KEY for user creation

## Code Quality
- **Linting**: ESLint with TypeScript rules
- **Formatting**: Prettier
- **Type Safety**: Strict TypeScript configuration
- **Testing**: Minimum 80% coverage target

## Deployment
- **Platform**: Render.com free tier
- **Build**: Automatic from Git pushes
- **Environment**: Production environment variables via Render dashboard