# ChainGuard AI Frontend Setup & Integration Guide

Complete guide for setting up and integrating the ChainGuard AI frontend with all backend components.

## 📋 What Was Created

### Frontend Structure
```
frontend/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── Layout.jsx       # Main app layout
│   │   ├── Sidebar.jsx      # Navigation sidebar
│   │   ├── Header.jsx       # Top header bar
│   │   └── PrivateRoute.jsx # Route protection
│   ├── contexts/
│   │   └── AuthContext.jsx  # Authentication state
│   ├── pages/               # All application pages
│   │   ├── Login.jsx        # Authentication page
│   │   ├── Dashboard.jsx    # Main dashboard
│   │   ├── Subnets.jsx      # Subnet management
│   │   ├── SubnetDetail.jsx # Subnet details
│   │   ├── Transactions.jsx # Transaction browser
│   │   ├── TransactionDetail.jsx # Transaction details
│   │   ├── Alerts.jsx       # Alert management
│   │   ├── Analytics.jsx   # Analytics dashboard
│   │   └── Settings.jsx     # User settings
│   ├── services/
│   │   └── api.js           # API integration layer
│   ├── App.jsx              # Main app component
│   ├── main.jsx             # Entry point
│   └── index.css            # Global styles
├── package.json             # Dependencies
├── vite.config.js          # Vite configuration
├── tailwind.config.js       # Tailwind CSS config
├── postcss.config.js        # PostCSS config
└── README.md               # Frontend documentation
```

### Documentation Files
- `frontend/README.md` - Frontend-specific documentation
- `database/MONGODB_SETUP.md` - Complete MongoDB setup guide
- `FRONTEND_INTEGRATION.md` - Integration guide for frontend with backend
- `FRONTEND_SETUP_GUIDE.md` - This file (quick start guide)

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Configure Environment

Create `frontend/.env`:

```bash
VITE_API_URL=http://localhost:3000
```

### 3. Start Development Server

```bash
npm run dev
```

Frontend will be available at: **http://localhost:5173**

### 4. Start Backend Services

In a separate terminal:

```bash
# Start all services
docker-compose up -d

# Or start API server manually
cd services/api-server
npm install
npm start
```

### 5. Access the Application

1. Open browser: http://localhost:5173
2. Login with default credentials:
   - Username: `admin`
   - Password: `admin123`

## 🎨 UI Features

### Pages Implemented

1. **Login Page** (`/login`)
   - Clean authentication interface
   - Default credentials hint
   - Error handling

2. **Dashboard** (`/dashboard`)
   - Overview metrics cards
   - Recent alerts feed
   - Quick action links
   - Real-time statistics

3. **Subnets** (`/subnets`)
   - List all subnets
   - Create/Edit/Delete (admin)
   - Toggle active/monitoring status
   - Subnet cards with key info

4. **Subnet Detail** (`/subnets/:id`)
   - Complete subnet information
   - Statistics overview
   - Recent transactions
   - Recent alerts

5. **Transactions** (`/transactions`)
   - Filterable transaction list
   - Search by hash/address
   - Status filtering
   - Pagination support

6. **Transaction Detail** (`/transactions/:hash`)
   - Complete transaction data
   - Address copying
   - Gas information
   - Decoded function calls

7. **Alerts** (`/alerts`)
   - Alert list with filters
   - Threat level indicators
   - Acknowledge/Mark false positive
   - Real-time updates

8. **Analytics** (`/analytics`)
   - Visual charts (Recharts)
   - Threat distribution
   - Transaction trends
   - Detailed statistics

9. **Settings** (`/settings`)
   - Profile management
   - Password change
   - Notification preferences
   - Appearance settings

### Design Features

- **Dark Theme**: Modern dark UI with green accents
- **Responsive**: Works on desktop, tablet, and mobile
- **Accessible**: Proper ARIA labels and keyboard navigation
- **Fast**: Optimized with Vite and code splitting
- **Beautiful**: Clean, modern design inspired by security dashboards

## 🔌 Integration Points

### API Server Integration

The frontend communicates with the API server at `http://localhost:3000`:

```javascript
// All API calls go through the api.js service layer
import { subnetsAPI, transactionsAPI, alertsAPI } from './services/api'

// Example: Fetch subnets
const response = await subnetsAPI.getAll()
```

### Database Integration

The frontend **does not** directly connect to the database. All database operations go through the API server:

```
Frontend → API Server → MongoDB Database
```

### Authentication Flow

1. User logs in via `/login`
2. Frontend sends credentials to `/auth/login`
3. API returns JWT token
4. Token stored in localStorage
5. Token included in all API requests
6. Protected routes check authentication

## 📊 Database Setup

### Quick Setup

```bash
cd database
chmod +x setup.sh
./setup.sh
```

### Manual Setup

See `database/MONGODB_SETUP.md` for detailed instructions.

**Quick commands**:

```bash
# Start MongoDB (Docker)
docker-compose up -d mongodb

# Connect to MongoDB
mongosh "mongodb://chainguard:chainguard_password@localhost:27017/chainguard?authSource=admin"

# Run setup script
cd database
chmod +x setup.sh
./setup.sh
```

## 🔄 Data Flow Examples

### Loading Dashboard Data

```javascript
// 1. Frontend requests data
const response = await subnetsAPI.getAll()

// 2. API server queries database
// (In api-server/src/routes/subnets.js)
const subnets = await db.getSubnets(limit, offset)

// 3. Database returns results
// (MongoDB query executed)

// 4. API formats response
res.json({ success: true, data: subnets })

// 5. Frontend receives and displays
setSubnets(response.data)
```

### Creating a Subnet

```javascript
// 1. User fills form and submits
await subnetsAPI.create({
  name: "My Subnet",
  chainId: "43114",
  rpcUrl: "https://...",
  websocketUrl: "wss://..."
})

// 2. API validates and saves to database
// (In api-server/src/routes/subnets.js)
const subnet = await db.createSubnet(data)

// 3. Frontend updates UI
toast.success('Subnet created')
loadSubnets() // Refresh list
```

### Acknowledging an Alert

```javascript
// 1. User clicks "Acknowledge"
await alertsAPI.acknowledge(alertId)

// 2. API updates database
// (In api-server/src/routes/alerts.js)
await db.acknowledgeAlert(alertId, userId)

// 3. Frontend refreshes alerts
loadAlerts()
```

## 🛠️ Development Workflow

### Adding a New Feature

1. **Create API endpoint** (if needed) in `services/api-server/src/routes/`
2. **Add API method** in `frontend/src/services/api.js`
3. **Create component/page** in `frontend/src/pages/`
4. **Add route** in `frontend/src/App.jsx`
5. **Add navigation** in `frontend/src/components/Sidebar.jsx`

### Testing Integration

```bash
# Test API health
curl http://localhost:3000/health

# Test authentication
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Test with token
curl http://localhost:3000/subnets \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 📦 Production Deployment

### Build Frontend

```bash
cd frontend
npm run build
```

Output in `frontend/dist/`

### Deploy Options

**Option 1: Nginx**
```nginx
server {
    listen 80;
    root /var/www/chainguard/dist;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location /api {
        proxy_pass http://localhost:3000;
    }
}
```

**Option 2: Docker**
```bash
# Build frontend image
docker build -t chainguard-frontend ./frontend

# Run container
docker run -p 80:80 chainguard-frontend
```

**Option 3: Static Hosting**
- Deploy `dist/` folder to:
  - Vercel
  - Netlify
  - AWS S3 + CloudFront
  - GitHub Pages

## 🔍 Troubleshooting

### Frontend won't start
- Check Node.js version (18+)
- Delete `node_modules` and reinstall
- Check for port conflicts (5173)

### API connection fails
- Verify API server is running
- Check `VITE_API_URL` in `.env`
- Test API directly: `curl http://localhost:3000/health`

### Authentication issues
- Check browser localStorage for token
- Verify JWT_SECRET matches in API server
- Clear localStorage and re-login

### Database connection errors
- Verify MongoDB is running
- Check connection string in API server `.env`
- Test database: `psql -U chainguard -d chainguard`

### CORS errors
- Ensure API server CORS allows frontend origin
- Check `FRONTEND_URL` in API server `.env`
- Verify both services are on same domain or properly configured

## 📚 Documentation Reference

- **Frontend Details**: `frontend/README.md`
- **MongoDB Setup**: `database/MONGODB_SETUP.md`
- **Integration Guide**: `FRONTEND_INTEGRATION.md`
- **Main Project**: `README.md`

## ✅ Checklist

Before deploying:

- [ ] MongoDB installed and configured
- [ ] Database created and migrations run
- [ ] API server running and accessible
- [ ] Frontend dependencies installed
- [ ] Environment variables configured
- [ ] Default admin password changed
- [ ] CORS properly configured
- [ ] All services tested
- [ ] Production build created
- [ ] Error handling verified

## 🎯 Next Steps

1. **Start Development**:
   ```bash
   # Terminal 1: Start backend
   docker-compose up -d
   
   # Terminal 2: Start frontend
   cd frontend && npm run dev
   ```

2. **Access Application**:
   - Frontend: http://localhost:5173
   - API: http://localhost:3000
   - Login: admin / admin123

3. **Explore Features**:
   - Create a subnet
   - View transactions
   - Monitor alerts
   - Check analytics

4. **Customize**:
   - Update colors in `tailwind.config.js`
   - Add new pages/components
   - Extend API integration
   - Configure notifications

## 🆘 Support

For issues:
1. Check relevant documentation files
2. Review error messages in browser console
3. Check API server logs
4. Verify database connectivity
5. Open an issue on GitHub

---

**Built with ❤️ for ChainGuard AI**

*Securing the future of DeFi, one transaction at a time.*
