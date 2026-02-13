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

## 🧪 Complete Route Testing Guide

This section provides a comprehensive step-by-step guide to test all frontend routes and ensure full integration with backend services.

### Prerequisites for Testing

Before testing routes, ensure:

1. **All backend services are running:**
   ```bash
   # Verify services are up
   curl http://localhost:3000/health  # API Server
   curl http://localhost:8000/health   # AI Engine
   curl http://localhost:3001/health   # Alert Service
   ```

2. **Frontend is running:**
   ```bash
   cd frontend
   npm run dev
   # Should be available at http://localhost:5173
   ```

3. **Default admin user exists:**
   - Username: `admin`
   - Password: `admin123`

### Route Testing Sequence

Follow these routes in order to test the complete application flow:

#### Route 1: Login Page (`/login`)

**URL**: `http://localhost:5173/login`

**What to Test:**
1. ✅ Navigate to `/login` - should show login form
2. ✅ Try logging in with invalid credentials - should show error
3. ✅ Login with valid credentials:
   - Username: `admin`
   - Password: `admin123`
4. ✅ After successful login, should redirect to `/dashboard`
5. ✅ Check browser localStorage - should contain `token` and `user`

**Expected Behavior:**
- Form validation on empty fields
- Error message for invalid credentials
- Success toast notification
- Redirect to dashboard after login
- Token stored in localStorage

**API Endpoint Used:**
- `POST /auth/login`

---

#### Route 2: Dashboard (`/dashboard`)

**URL**: `http://localhost:5173/dashboard` (or `/` redirects here)

**What to Test:**
1. ✅ Page loads with overview cards showing:
   - Total Subnets count
   - Active Subnets count
   - Total Transactions count
   - Total Alerts count
   - Critical Alerts count
2. ✅ Recent Alerts section displays (if any alerts exist)
3. ✅ Quick Actions section is visible
4. ✅ All cards are clickable and navigate correctly
5. ✅ Refresh page - data should reload

**Expected Behavior:**
- Loading state while fetching data
- Statistics cards display with numbers
- Recent alerts list (or empty state if none)
- Error handling if API fails
- Auto-refresh or manual refresh capability

**API Endpoints Used:**
- `GET /subnets` - Get all subnets
- `GET /subnets/:id/stats` - Get statistics for each subnet
- `GET /subnets/:id/alerts` - Get recent alerts

**Navigation Links to Test:**
- Click "View All Subnets" → should go to `/subnets`
- Click "View All Alerts" → should go to `/alerts`
- Click "View Transactions" → should go to `/transactions`

---

#### Route 3: Subnets List (`/subnets`)

**URL**: `http://localhost:5173/subnets`

**What to Test:**
1. ✅ Page loads and displays subnet list (or empty state)
2. ✅ If subnets exist, verify each subnet card shows:
   - Subnet name
   - Chain ID
   - Status (Active/Inactive)
   - Monitoring status (Enabled/Disabled)
   - Created date
3. ✅ Click on a subnet card → should navigate to `/subnets/:id`
4. ✅ Test "Create Subnet" button (admin only):
   - Click button
   - Fill form with:
     - Name: "Test Subnet"
     - Chain ID: "43113"
     - RPC URL: "https://api.avax-test.network/ext/bc/C/rpc"
     - WebSocket URL: "wss://api.avax-test.network/ext/bc/C/ws"
   - Submit form
   - Verify success message
   - New subnet appears in list
5. ✅ Test subnet actions (if admin):
   - Toggle Active/Inactive status
   - Toggle Monitoring Enabled/Disabled
   - Edit subnet details
   - Delete subnet (with confirmation)

**Expected Behavior:**
- List of subnets or empty state message
- Loading spinner while fetching
- Error handling for failed requests
- Success/error toast notifications
- Form validation for create/edit

**API Endpoints Used:**
- `GET /subnets` - List all subnets
- `POST /subnets` - Create subnet (admin)
- `PATCH /subnets/:id` - Update subnet (admin)
- `DELETE /subnets/:id` - Delete subnet (admin)

---

#### Route 4: Subnet Detail (`/subnets/:id`)

**URL**: `http://localhost:5173/subnets/1` (replace `1` with actual subnet ID)

**What to Test:**
1. ✅ Page loads with subnet details:
   - Subnet name and chain ID
   - RPC and WebSocket URLs
   - Status indicators
   - Created date
2. ✅ Statistics section displays:
   - Total transactions
   - Total alerts
   - Alert breakdown by level
   - Recent activity
3. ✅ Recent Transactions section:
   - Shows last 10 transactions
   - Each transaction shows hash, from/to addresses, value
   - Click transaction → should navigate to `/transactions/:hash`
4. ✅ Recent Alerts section:
   - Shows last 10 alerts
   - Each alert shows threat level, score, timestamp
   - Click alert → should navigate to alerts page or show details
5. ✅ Test "View All Transactions" link → should go to `/transactions?subnet=:id`
6. ✅ Test "View All Alerts" link → should go to `/alerts?subnet=:id`
7. ✅ Test back button or breadcrumb → should return to `/subnets`

**Expected Behavior:**
- Detailed subnet information displayed
- Statistics cards with real data
- Transaction and alert lists
- Loading states for each section
- Error handling if subnet not found

**API Endpoints Used:**
- `GET /subnets/:id` - Get subnet details
- `GET /subnets/:id/stats` - Get subnet statistics
- `GET /subnets/:id/transactions` - Get recent transactions
- `GET /subnets/:id/alerts` - Get recent alerts

---

#### Route 5: Transactions List (`/transactions`)

**URL**: `http://localhost:5173/transactions`

**What to Test:**
1. ✅ Page loads with transaction list (or empty state)
2. ✅ Test filters:
   - Filter by Subnet (dropdown)
   - Filter by Status (Success/Failed toggle)
   - Search by Transaction Hash
   - Search by Address (from/to)
   - Date range filter (if available)
3. ✅ Test pagination:
   - Navigate to next page
   - Navigate to previous page
   - Change items per page
4. ✅ Transaction table displays:
   - Transaction hash (truncated)
   - From address (truncated)
   - To address (truncated)
   - Value (formatted)
   - Gas used
   - Status badge
   - Timestamp
   - Threat score (if available)
5. ✅ Click on transaction row → should navigate to `/transactions/:hash`
6. ✅ Test sorting (if available):
   - Sort by timestamp
   - Sort by value
   - Sort by threat score
7. ✅ Test "Clear Filters" button

**Expected Behavior:**
- Filtered results update in real-time
- Pagination controls work correctly
- Loading state while fetching
- Empty state when no results
- Error handling for failed requests

**API Endpoints Used:**
- `GET /subnets/:id/transactions` - Get transactions with filters
- Query parameters: `limit`, `offset`, `fromAddress`, `toAddress`, `status`, `startDate`, `endDate`

---

#### Route 6: Transaction Detail (`/transactions/:hash`)

**URL**: `http://localhost:5173/transactions/0x...` (use actual transaction hash)

**What to Test:**
1. ✅ Page loads with complete transaction details:
   - Full transaction hash (with copy button)
   - Block number and transaction index
   - From address (with copy button)
   - To address (with copy button)
   - Value (formatted in AVAX/ETH)
   - Gas information (used, limit, price)
   - Transaction status (Success/Failed)
   - Timestamp
2. ✅ Transaction Data section:
   - Raw transaction data (JSON view)
   - Decoded function call (if available)
   - Input data (hex)
3. ✅ Transaction Logs section:
   - List of event logs
   - Event names and parameters
4. ✅ Threat Analysis section (if analyzed):
   - Threat score
   - Threat level badge
   - Explanation
   - Model scores breakdown
5. ✅ Test "View on Explorer" link (if available) → opens blockchain explorer
6. ✅ Test copy buttons for addresses and hash
7. ✅ Test back button → should return to transactions list

**Expected Behavior:**
- All transaction data displayed correctly
- Copy buttons work and show success message
- JSON data formatted nicely
- Loading state while fetching
- Error handling if transaction not found

**API Endpoints Used:**
- `GET /transactions/:hash` - Get transaction by hash
- May also use: `GET /subnets/:id` to get subnet info

---

#### Route 7: Alerts List (`/alerts`)

**URL**: `http://localhost:5173/alerts`

**What to Test:**
1. ✅ Page loads with alerts list (or empty state)
2. ✅ Test filters:
   - Filter by Subnet (dropdown)
   - Filter by Threat Level (CRITICAL, HIGH, MEDIUM, LOW)
   - Filter by Status (Acknowledged/Unacknowledged)
   - Filter by False Positive (Yes/No)
   - Date range filter
3. ✅ Alert cards/table display:
   - Alert ID
   - Transaction hash (linked)
   - Threat level badge (color-coded)
   - Threat score
   - Explanation/description
   - Timestamp
   - Acknowledged status
   - False positive status
4. ✅ Test alert actions:
   - Click "Acknowledge" button → alert marked as acknowledged
   - Click "Mark as False Positive" → alert marked as false positive
   - Verify success toast notification
   - Verify alert updates in UI
5. ✅ Test pagination (if many alerts)
6. ✅ Click on transaction hash → should navigate to `/transactions/:hash`
7. ✅ Click on subnet name → should navigate to `/subnets/:id`

**Expected Behavior:**
- Alerts displayed with proper threat level colors
- Filters update results immediately
- Action buttons work and show feedback
- Loading states during API calls
- Error handling for failed actions

**API Endpoints Used:**
- `GET /subnets/:id/alerts` - Get alerts with filters
- `PATCH /alerts/:id/acknowledge` - Acknowledge alert
- `POST /alerts/:id/false-positive` - Mark as false positive
- Query parameters: `limit`, `offset`, `threatLevel`, `acknowledged`, `startDate`, `endDate`

---

#### Route 8: Analytics (`/analytics`)

**URL**: `http://localhost:5173/analytics`

**What to Test:**
1. ✅ Page loads with analytics dashboard
2. ✅ Charts and graphs display:
   - Threat Level Distribution (pie/bar chart)
   - Transaction Trends (line chart over time)
   - Alert Trends (line chart over time)
   - Subnet Activity Comparison (bar chart)
3. ✅ Statistics cards show:
   - Total transactions
   - Total alerts
   - Average threat score
   - Alert breakdown by level
4. ✅ Test date range selector:
   - Select different time periods (Last 7 days, 30 days, etc.)
   - Verify charts update
5. ✅ Test subnet filter:
   - Select specific subnet
   - Verify analytics update for that subnet
6. ✅ Test chart interactions:
   - Hover over chart elements → tooltip shows data
   - Click chart elements → may filter or show details

**Expected Behavior:**
- Charts render correctly with data
- Loading states while fetching
- Empty states if no data
- Interactive chart elements
- Responsive design for different screen sizes

**API Endpoints Used:**
- `GET /subnets/:id/stats` - Get statistics for analytics
- May aggregate data from multiple subnets

---

#### Route 9: Settings (`/settings`)

**URL**: `http://localhost:5173/settings`

**What to Test:**
1. ✅ Page loads with settings sections:
   - Profile Information
   - Change Password
   - Notification Preferences
   - Appearance Settings
2. ✅ Profile Section:
   - Display current username and email
   - Edit profile information (if available)
   - Save changes
3. ✅ Change Password:
   - Enter current password
   - Enter new password
   - Confirm new password
   - Submit form
   - Verify success message
   - Test login with new password
4. ✅ Notification Preferences:
   - Toggle email notifications
   - Toggle SMS notifications
   - Toggle Slack notifications
   - Save preferences
5. ✅ Appearance Settings:
   - Toggle dark/light mode (if available)
   - Change theme colors (if available)
   - Save preferences
6. ✅ Test logout button:
   - Click logout
   - Verify token removed from localStorage
   - Verify redirect to `/login`

**Expected Behavior:**
- All settings sections functional
- Form validation
- Success/error messages
- Changes persist after page refresh
- Logout clears session

**API Endpoints Used:**
- May use user profile endpoints (if available)
- Logout is client-side (clears localStorage)

---

#### Route 10: Protected Route Access

**What to Test:**
1. ✅ Without authentication:
   - Try accessing `/dashboard` directly → should redirect to `/login`
   - Try accessing `/subnets` directly → should redirect to `/login`
   - Try accessing any protected route → should redirect to `/login`
2. ✅ With expired token:
   - Wait for token to expire (or manually remove from localStorage)
   - Try accessing any route → should redirect to `/login`
3. ✅ With invalid token:
   - Manually set invalid token in localStorage
   - Try accessing any route → should redirect to `/login`
4. ✅ After logout:
   - Logout from settings
   - Try accessing protected routes → should redirect to `/login`

**Expected Behavior:**
- All protected routes check authentication
- Unauthenticated users redirected to login
- Token validation on each request
- Automatic logout on 401 responses

---

### Complete Testing Checklist

Use this checklist to ensure all routes are tested:

- [ ] **Route 1**: Login page (`/login`)
  - [ ] Invalid credentials show error
  - [ ] Valid credentials redirect to dashboard
  - [ ] Token stored in localStorage

- [ ] **Route 2**: Dashboard (`/dashboard`)
  - [ ] Statistics cards display
  - [ ] Recent alerts show
  - [ ] Navigation links work

- [ ] **Route 3**: Subnets list (`/subnets`)
  - [ ] Subnet list displays
  - [ ] Create subnet works (admin)
  - [ ] Edit/delete subnet works (admin)
  - [ ] Toggle status works

- [ ] **Route 4**: Subnet detail (`/subnets/:id`)
  - [ ] Subnet info displays
  - [ ] Statistics show
  - [ ] Recent transactions show
  - [ ] Recent alerts show

- [ ] **Route 5**: Transactions list (`/transactions`)
  - [ ] Transaction list displays
  - [ ] Filters work
  - [ ] Pagination works
  - [ ] Click transaction navigates to detail

- [ ] **Route 6**: Transaction detail (`/transactions/:hash`)
  - [ ] All transaction data displays
  - [ ] Copy buttons work
  - [ ] Threat analysis shows (if available)

- [ ] **Route 7**: Alerts list (`/alerts`)
  - [ ] Alerts list displays
  - [ ] Filters work
  - [ ] Acknowledge works
  - [ ] Mark false positive works

- [ ] **Route 8**: Analytics (`/analytics`)
  - [ ] Charts render
  - [ ] Statistics display
  - [ ] Filters update charts

- [ ] **Route 9**: Settings (`/settings`)
  - [ ] Profile displays
  - [ ] Change password works
  - [ ] Preferences save
  - [ ] Logout works

- [ ] **Route 10**: Protected routes
  - [ ] Unauthenticated access redirects
  - [ ] Expired token redirects
  - [ ] Invalid token redirects

### Testing Tips

1. **Use Browser DevTools:**
   - Network tab to monitor API calls
   - Console tab to check for errors
   - Application tab to verify localStorage

2. **Test Error Scenarios:**
   - Stop API server → test error handling
   - Use invalid data → test validation
   - Test network failures

3. **Test Responsive Design:**
   - Resize browser window
   - Test on mobile viewport
   - Check sidebar behavior

4. **Test Performance:**
   - Check loading times
   - Verify no unnecessary API calls
   - Test with large datasets

5. **Test Accessibility:**
   - Keyboard navigation
   - Screen reader compatibility
   - Color contrast

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
