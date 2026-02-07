import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { Moon, Bell, User, LogOut } from 'lucide-react'
import { useState } from 'react'

const Header = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [showUserMenu, setShowUserMenu] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="h-16 bg-dark-900 border-b border-dark-800 flex items-center justify-between px-6">
      <div className="flex items-center space-x-4">
        <h2 className="text-xl font-semibold text-white">
          Welcome back, {user?.username || 'User'}
        </h2>
      </div>

      <div className="flex items-center space-x-4">
        {/* Dark mode toggle */}
        <button className="p-2 rounded-lg hover:bg-dark-800 text-gray-400 hover:text-gray-200 transition-colors">
          <Moon className="w-5 h-5" />
        </button>

        {/* Notifications */}
        <button className="relative p-2 rounded-lg hover:bg-dark-800 text-gray-400 hover:text-gray-200 transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-dark-800 transition-colors"
          >
            <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
            <span className="text-gray-200 font-medium">{user?.username}</span>
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-dark-800 rounded-lg shadow-xl border border-dark-700 py-2 z-50">
              <div className="px-4 py-2 border-b border-dark-700">
                <p className="text-sm font-medium text-white">{user?.username}</p>
                <p className="text-xs text-gray-400">{user?.email}</p>
                <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium bg-primary-600 text-white rounded">
                  {user?.role}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center space-x-2 px-4 py-2 text-left text-gray-300 hover:bg-dark-700 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

export default Header
