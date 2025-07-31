# ScaenaHub v2

ScaenaHub v2 is a web-based communication platform designed for theater projects, featuring real-time chat, script management, and collaborative editing capabilities.

## Features

- 🎭 **Script Management**: Create, edit, and collaborate on theater scripts
- 💬 **Real-time Chat**: Channel-based communication with mentions and reactions
- 👥 **User Management**: Role-based access control and permissions
- 📱 **iPad Optimized**: Touch-first responsive design
- 🖨️ **Print Optimization**: Professional script printing with A4 layout
- 🔄 **Data Synchronization**: Automatic sync between TiDB Cloud and SQLite
- 🔒 **Security**: JWT authentication with bcrypt password hashing

## Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd scaenahub-v2
```

2. Install all dependencies:
```bash
npm run install:all
```

3. Set up environment variables:
   - Copy `backend/.env.example` to `backend/.env`
   - Copy `frontend/.env.example` to `frontend/.env`
   - Configure your database and API keys

### Development

Start both backend and frontend servers:

```bash
npm run dev
```

Or use the platform-specific startup scripts:

**Windows:**
```bash
start.bat
```

**Linux/Mac:**
```bash
./start.sh
```

This will start:
- Backend server: http://localhost:3001
- Frontend server: http://localhost:5173

### Individual Server Commands

**Backend only:**
```bash
npm run dev:backend
```

**Frontend only:**
```bash
npm run dev:frontend
```

## Project Structure

```
scaenahub-v2/
├── backend/                 # Node.js/Express API server
│   ├── src/
│   │   ├── routes/         # API route handlers
│   │   ├── services/       # Business logic layer
│   │   ├── models/         # Data models and validation
│   │   ├── middleware/     # Express middleware
│   │   └── types/          # TypeScript type definitions
│   └── package.json
├── frontend/               # React.js client
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Page components
│   │   ├── services/       # API services
│   │   ├── hooks/          # Custom React hooks
│   │   └── types/          # TypeScript type definitions
│   └── package.json
├── package.json            # Root package.json with scripts
├── start.bat              # Windows startup script
├── start.sh               # Linux/Mac startup script
└── README.md
```

## Technology Stack

### Backend
- **Runtime**: Node.js 18+ with TypeScript
- **Framework**: Express.js with Socket.io
- **Database**: TiDB Cloud (primary) with SQLite fallback
- **Authentication**: JWT with bcrypt
- **File Storage**: Google Drive API v3

### Frontend
- **Framework**: React.js 18 with TypeScript
- **Styling**: Tailwind CSS
- **Build Tool**: Vite
- **State Management**: React Context/hooks

## Scripts

- `npm run dev` - Start both servers in development mode
- `npm run build` - Build both backend and frontend for production
- `npm run start` - Start production backend server
- `npm run install:all` - Install dependencies for all projects
- `npm test` - Run backend tests

## Environment Variables

### Backend (.env)
```
# Database
TIDB_HOST=your-tidb-host
TIDB_USER=your-username
TIDB_PASSWORD=your-password
TIDB_DATABASE=your-database

# JWT
JWT_SECRET=your-jwt-secret

# Google Drive
GOOGLE_SERVICE_ACCOUNT_KEY=path-to-service-account.json

# Server
PORT=3001
NODE_ENV=development
```

### Frontend (.env)
```
VITE_API_URL=http://localhost:3001/api
VITE_SOCKET_URL=http://localhost:3001
```

## Features in Detail

### Script Management
- Create and organize theater scripts
- Real-time collaborative editing
- Version control and history tracking
- Print-optimized formatting
- Scene-based organization

### Communication
- Channel-based chat system
- Real-time messaging with Socket.io
- User mentions and reactions
- File sharing via Google Drive

### User Management
- Role-based access control (admin, moderator, member)
- User profiles and status
- Permission management

## Deployment

The application is designed to run on free-tier services:
- **Hosting**: Render.com
- **Database**: TiDB Cloud Serverless
- **File Storage**: Google Drive API

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For support and questions, please open an issue on GitHub.