import { Link, useLocation } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Network, 
  FileText, 
  AlertTriangle, 
  BarChart3, 
  Settings,
  Shield
} from 'lucide-react'

const Sidebar = () => {
  const location = useLocation()

  const menuItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/subnets', icon: Network, label: 'Subnets' },
    { path: '/transactions', icon: FileText, label: 'Transactions' },
    { path: '/alerts', icon: AlertTriangle, label: 'Alerts' },
    { path: '/analytics', icon: BarChart3, label: 'Analytics' },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ]

  const isActive = (path) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard'
    }
    return location.pathname.startsWith(path)
  }

  return (
    <aside className="w-64 bg-dark-900 border-r border-dark-800 flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-dark-800">
        <Link to="/dashboard" className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">ChainGuard</h1>
            <p className="text-xs text-gray-400">AI Security</p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.path)
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                active
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-400 hover:bg-dark-800 hover:text-gray-200'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-dark-800">
        <p className="text-xs text-gray-500 text-center">
          ChainGuard AI v1.0.0
        </p>
      </div>
    </aside>
  )
}

export default Sidebar
