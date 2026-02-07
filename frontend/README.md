# ChainGuard AI Frontend

Modern React-based frontend for the ChainGuard AI security monitoring platform. Built with React, Vite, and Tailwind CSS.

## Features

- 🎨 **Modern UI**: Beautiful, dark-themed interface inspired by modern security dashboards
- 🔐 **Authentication**: JWT-based authentication with protected routes
- 📊 **Real-time Monitoring**: Live dashboard with metrics and alerts
- 🔍 **Transaction Analysis**: Detailed transaction viewing and search
- 🚨 **Alert Management**: Comprehensive alert monitoring and management
- 📈 **Analytics**: Visual analytics with charts and statistics
- ⚙️ **Settings**: User preferences and configuration

## Tech Stack

- **React 18**: Modern React with hooks
- **Vite**: Fast build tool and dev server
- **Tailwind CSS 3**: Utility-first CSS framework
- **React Router**: Client-side routing
- **Axios**: HTTP client for API calls
- **Recharts**: Charting library for analytics
- **Lucide React**: Icon library
- **React Hot Toast**: Toast notifications
- **date-fns**: Date formatting utilities

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn
- ChainGuard API server running on `http://localhost:3000`

### Installation

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Or with yarn
yarn install
```

### Environment Configuration

Create a `.env` file in the frontend directory:

```bash
VITE_API_URL=http://localhost:3000
```

### Development

```bash
# Start development server
npm run dev

# The app will be available at http://localhost:5173
```

### Build for Production

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
frontend/
├── src/
│   ├── components/          # Reusable components
│   │   ├── Layout.jsx        # Main layout with sidebar
│   │   ├── Sidebar.jsx       # Navigation sidebar
│   │   ├── Header.jsx        # Top header bar
│   │   └── PrivateRoute.jsx  # Protected route wrapper
│   ├── contexts/             # React contexts
│   │   └── AuthContext.jsx   # Authentication context
│   ├── pages/                # Page components
│   │   ├── Login.jsx         # Login page
│   │   ├── Dashboard.jsx     # Main dashboard
│   │   ├── Subnets.jsx       # Subnet management
│   │   ├── SubnetDetail.jsx  # Subnet details
│   │   ├── Transactions.jsx  # Transaction list
│   │   ├── TransactionDetail.jsx # Transaction details
│   │   ├── Alerts.jsx        # Alert management
│   │   ├── Analytics.jsx     # Analytics dashboard
│   │   └── Settings.jsx      # User settings
│   ├── services/             # API services
│   │   └── api.js            # API client and endpoints
│   ├── App.jsx               # Main app component
│   ├── main.jsx              # Entry point
│   └── index.css             # Global styles
├── index.html                # HTML template
├── package.json              # Dependencies
├── vite.config.js            # Vite configuration
├── tailwind.config.js        # Tailwind configuration
└── postcss.config.js         # PostCSS configuration
```

## Pages Overview

### Dashboard (`/dashboard`)
- Overview of all subnets, transactions, and alerts
- Key metrics and statistics
- Recent alerts feed
- Quick action cards

### Subnets (`/subnets`)
- List all configured subnets
- Create, update, and delete subnets (admin only)
- Toggle subnet active status and monitoring
- View subnet details

### Subnet Detail (`/subnets/:id`)
- Detailed subnet information
- Subnet-specific statistics
- Recent transactions and alerts
- Monitoring status

### Transactions (`/transactions`)
- Browse transaction history
- Filter by subnet, address, status
- Search by hash or address
- View transaction details

### Transaction Detail (`/transactions/:hash`)
- Complete transaction information
- Addresses, values, gas information
- Transaction data and decoded calls
- Copy addresses and hashes

### Alerts (`/alerts`)
- View all security alerts
- Filter by subnet, threat level, status
- Acknowledge alerts
- Mark false positives

### Analytics (`/analytics`)
- Visual charts and graphs
- Threat level distribution
- Transaction trends
- Detailed statistics

### Settings (`/settings`)
- Profile management
- Password change
- Notification preferences
- Appearance settings

## API Integration

The frontend communicates with the ChainGuard API server through the `api.js` service layer.

### Authentication

```javascript
import { authAPI } from './services/api'

// Login
const response = await authAPI.login(username, password)

// Verify token
const response = await authAPI.verify(token)
```

### Subnets

```javascript
import { subnetsAPI } from './services/api'

// Get all subnets
const response = await subnetsAPI.getAll()

// Get subnet by ID
const response = await subnetsAPI.getById(id)

// Create subnet (admin only)
const response = await subnetsAPI.create(subnetData)

// Update subnet (admin only)
const response = await subnetsAPI.update(id, updateData)

// Delete subnet (admin only)
const response = await subnetsAPI.delete(id)
```

### Transactions

```javascript
import { transactionsAPI } from './services/api'

// Get transactions by subnet
const response = await transactionsAPI.getBySubnet(subnetId, params)

// Get transaction by hash
const response = await transactionsAPI.getByHash(hash)
```

### Alerts

```javascript
import { alertsAPI } from './services/api'

// Get alerts by subnet
const response = await alertsAPI.getBySubnet(subnetId, params)

// Acknowledge alert
const response = await alertsAPI.acknowledge(alertId)

// Mark false positive
const response = await alertsAPI.markFalsePositive(alertId)
```

### Statistics

```javascript
import { statsAPI } from './services/api'

// Get subnet statistics
const response = await statsAPI.getSubnetStats(subnetId)
```

## Styling

The project uses Tailwind CSS with a custom dark theme. Key color classes:

- **Primary**: `primary-*` (green shades)
- **Dark**: `dark-*` (dark gray/black shades)
- **Status Colors**: 
  - Success: `green-*`
  - Error: `red-*`
  - Warning: `yellow-*` / `orange-*`
  - Info: `blue-*`

### Custom Components

Reusable component classes in `index.css`:

- `.btn-primary` - Primary button
- `.btn-secondary` - Secondary button
- `.card` - Card container
- `.input-field` - Form input field

## Authentication Flow

1. User enters credentials on login page
2. Frontend sends request to `/auth/login`
3. API returns JWT token and user data
4. Token stored in localStorage
5. Token added to all subsequent API requests
6. Protected routes check authentication status
7. On 401 response, user redirected to login

## State Management

- **AuthContext**: Manages authentication state globally
- **Local State**: Component-level state with React hooks
- **API State**: Fetched data stored in component state

## Error Handling

- API errors caught and displayed via toast notifications
- 401 errors trigger automatic logout
- Network errors show user-friendly messages
- Form validation provides inline feedback

## Development Tips

### Adding a New Page

1. Create component in `src/pages/`
2. Add route in `src/App.jsx`
3. Add navigation link in `src/components/Sidebar.jsx`
4. Create API methods if needed in `src/services/api.js`

### Adding a New API Endpoint

1. Add method to appropriate API object in `src/services/api.js`
2. Use in components via import
3. Handle loading, success, and error states

### Styling Guidelines

- Use Tailwind utility classes
- Follow existing color scheme
- Maintain consistent spacing (4px grid)
- Use card component for containers
- Follow button and input patterns

## Building for Production

```bash
# Build
npm run build

# Output will be in dist/ directory
# Serve with any static file server:

# Using serve
npx serve dist

# Using nginx
# Copy dist/ contents to nginx html directory
```

## Docker Deployment

Create a `Dockerfile`:

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## Troubleshooting

### API Connection Issues

- Verify API server is running on correct port
- Check `VITE_API_URL` in `.env`
- Check CORS settings on API server
- Verify network connectivity

### Build Errors

- Clear `node_modules` and reinstall
- Check Node.js version (18+)
- Verify all dependencies are installed
- Check for TypeScript errors if using TS

### Styling Issues

- Verify Tailwind is processing correctly
- Check `tailwind.config.js` content paths
- Ensure PostCSS is configured
- Clear browser cache

## Contributing

1. Follow existing code style
2. Use functional components and hooks
3. Add error handling to API calls
4. Include loading states
5. Test on multiple browsers
6. Ensure responsive design

## License

MIT License - see LICENSE file for details
