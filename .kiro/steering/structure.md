# Project Structure & Organization

## Repository Layout
```
├── backend/                 # Node.js/Express API server
├── frontend/               # React.js client (to be implemented)
├── chorus-school-festival-app/  # Project documentation
└── .kiro/                  # Kiro configuration and specs
```

## Backend Structure (`backend/`)
```
backend/
├── src/
│   ├── routes/             # API route handlers
│   │   ├── auth.ts         # Authentication endpoints
│   │   ├── users.ts        # User management
│   │   ├── channels.ts     # Channel operations
│   │   ├── profile.ts      # User profile management
│   │   └── roles.ts        # Role-based access control
│   ├── services/           # Business logic layer
│   │   ├── auth.ts         # Authentication service
│   │   ├── user.ts         # User operations
│   │   ├── channel.ts      # Channel management
│   │   ├── profile.ts      # Profile management
│   │   ├── role.ts         # Role management
│   │   └── database/       # Database abstraction
│   │       ├── sync.ts     # Data synchronization service
│   │       ├── sqlite.ts   # SQLite implementation
│   │       └── tidb.ts     # TiDB implementation
│   ├── models/             # Data models and validation
│   │   ├── User.ts         # User model with validation
│   │   ├── Channel.ts      # Channel model
│   │   ├── Message.ts      # Message model
│   │   └── Role.ts         # Role model
│   ├── middleware/         # Express middleware
│   │   ├── auth.ts         # JWT authentication
│   │   └── permissions.ts  # Role-based permissions
│   ├── socket/             # Socket.io handlers
│   │   └── handlers/
│   │       └── presence.ts # User presence tracking
│   ├── tests/              # Test files
│   │   ├── auth.test.ts    # Authentication tests
│   │   ├── channel.test.ts # Channel tests
│   │   └── *.test.ts       # Other test files
│   ├── types/              # TypeScript type definitions
│   │   └── index.ts        # Shared types
│   └── index.ts            # Application entry point
├── dist/                   # Compiled JavaScript output
├── data/                   # SQLite database files
├── node_modules/           # Dependencies
├── package.json            # Dependencies and scripts
├── tsconfig.json           # TypeScript configuration
├── jest.config.js          # Test configuration
├── .env.example            # Environment variables template
└── .env                    # Environment variables (gitignored)
```

## Architectural Patterns

### Service Layer Pattern
- Routes handle HTTP concerns only
- Services contain business logic
- Models handle data validation and transformation
- Database layer abstracts storage implementation

### Database Abstraction
- `DataSyncService` provides unified interface
- Automatic fallback from TiDB to SQLite
- Consistent API regardless of storage backend

### Authentication Flow
- JWT-based stateless authentication
- Middleware validates tokens on protected routes
- Role-based access control via permissions middleware

### Real-time Communication
- Socket.io for bidirectional communication
- Presence tracking for online status
- Event-driven architecture for real-time updates

## Naming Conventions
- **Files**: PascalCase for classes/models, camelCase for utilities
- **Routes**: RESTful naming (`/api/resource` pattern)
- **Database**: snake_case for column names, camelCase in TypeScript
- **Environment Variables**: UPPER_SNAKE_CASE
- **Test Files**: `*.test.ts` suffix

## Configuration Files
- `tsconfig.json`: Strict TypeScript with ES2022 target
- `jest.config.js`: Test configuration with coverage reporting
- `.eslintrc.js`: TypeScript ESLint rules
- `.prettierrc`: Code formatting rules
- `nodemon.json`: Development server configuration