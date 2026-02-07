import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Settings as SettingsIcon, User, Shield, Bell, Moon } from 'lucide-react'
import toast from 'react-hot-toast'

const Settings = () => {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('profile')

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'appearance', label: 'Appearance', icon: Moon },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Settings</h1>
        <p className="text-gray-400 mt-1">Manage your account and preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="card p-0">
            <nav className="space-y-1 p-2">
              {tabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                      activeTab === tab.id
                        ? 'bg-primary-600 text-white'
                        : 'text-gray-400 hover:bg-dark-800 hover:text-gray-200'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{tab.label}</span>
                  </button>
                )
              })}
            </nav>
          </div>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          {activeTab === 'profile' && <ProfileSettings user={user} />}
          {activeTab === 'security' && <SecuritySettings />}
          {activeTab === 'notifications' && <NotificationSettings />}
          {activeTab === 'appearance' && <AppearanceSettings />}
        </div>
      </div>
    </div>
  )
}

const ProfileSettings = ({ user }) => {
  const [formData, setFormData] = useState({
    username: user?.username || '',
    email: user?.email || '',
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    // TODO: Implement profile update API
    setTimeout(() => {
      toast.success('Profile updated successfully')
      setLoading(false)
    }, 1000)
  }

  return (
    <div className="card">
      <h2 className="text-xl font-semibold text-white mb-6">Profile Information</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Username</label>
          <input
            type="text"
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            className="input-field"
            disabled
          />
          <p className="text-xs text-gray-500 mt-1">Username cannot be changed</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="input-field"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Role</label>
          <input
            type="text"
            value={user?.role || ''}
            className="input-field"
            disabled
          />
        </div>

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  )
}

const SecuritySettings = () => {
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (formData.newPassword !== formData.confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    if (formData.newPassword.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }

    setLoading(true)
    // TODO: Implement password change API
    setTimeout(() => {
      toast.success('Password changed successfully')
      setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setLoading(false)
    }, 1000)
  }

  return (
    <div className="card">
      <h2 className="text-xl font-semibold text-white mb-6">Change Password</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Current Password</label>
          <input
            type="password"
            value={formData.currentPassword}
            onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
            className="input-field"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">New Password</label>
          <input
            type="password"
            value={formData.newPassword}
            onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
            className="input-field"
            required
            minLength={8}
          />
          <p className="text-xs text-gray-500 mt-1">Must be at least 8 characters</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Confirm New Password</label>
          <input
            type="password"
            value={formData.confirmPassword}
            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
            className="input-field"
            required
          />
        </div>

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Changing...' : 'Change Password'}
        </button>
      </form>
    </div>
  )
}

const NotificationSettings = () => {
  const [settings, setSettings] = useState({
    emailAlerts: true,
    slackAlerts: false,
    criticalOnly: false,
  })
  const [loading, setLoading] = useState(false)

  const handleToggle = (key) => {
    setSettings({ ...settings, [key]: !settings[key] })
  }

  const handleSave = async () => {
    setLoading(true)
    // TODO: Implement notification settings API
    setTimeout(() => {
      toast.success('Notification settings saved')
      setLoading(false)
    }, 1000)
  }

  return (
    <div className="card">
      <h2 className="text-xl font-semibold text-white mb-6">Notification Preferences</h2>
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-dark-800 rounded-lg">
          <div>
            <p className="font-medium text-white">Email Alerts</p>
            <p className="text-sm text-gray-400">Receive alerts via email</p>
          </div>
          <button
            onClick={() => handleToggle('emailAlerts')}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              settings.emailAlerts ? 'bg-primary-600' : 'bg-dark-700'
            }`}
          >
            <span
              className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                settings.emailAlerts ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between p-4 bg-dark-800 rounded-lg">
          <div>
            <p className="font-medium text-white">Slack Alerts</p>
            <p className="text-sm text-gray-400">Receive alerts via Slack</p>
          </div>
          <button
            onClick={() => handleToggle('slackAlerts')}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              settings.slackAlerts ? 'bg-primary-600' : 'bg-dark-700'
            }`}
          >
            <span
              className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                settings.slackAlerts ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between p-4 bg-dark-800 rounded-lg">
          <div>
            <p className="font-medium text-white">Critical Alerts Only</p>
            <p className="text-sm text-gray-400">Only receive critical threat alerts</p>
          </div>
          <button
            onClick={() => handleToggle('criticalOnly')}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              settings.criticalOnly ? 'bg-primary-600' : 'bg-dark-700'
            }`}
          >
            <span
              className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                settings.criticalOnly ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <button onClick={handleSave} className="btn-primary w-full" disabled={loading}>
          {loading ? 'Saving...' : 'Save Preferences'}
        </button>
      </div>
    </div>
  )
}

const AppearanceSettings = () => {
  const [theme, setTheme] = useState('dark')

  return (
    <div className="card">
      <h2 className="text-xl font-semibold text-white mb-6">Appearance</h2>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Theme</label>
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            className="input-field"
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
            <option value="auto">Auto</option>
          </select>
        </div>
        <p className="text-sm text-gray-400">
          Theme changes will be applied after page refresh.
        </p>
      </div>
    </div>
  )
}

export default Settings
