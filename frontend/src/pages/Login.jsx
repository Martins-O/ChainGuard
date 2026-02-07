import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Shield, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

const Login = () => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const result = await login(username, password)
      if (result.success) {
        toast.success('Login successful!')
        navigate('/dashboard')
      } else {
        toast.error(result.error || 'Invalid credentials')
      }
    } catch (error) {
      toast.error(error.error || 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-2xl mb-4">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">ChainGuard AI</h1>
          <p className="text-gray-400">Security Monitoring Platform</p>
        </div>

        {/* Login Form */}
        <div className="card">
          <h2 className="text-2xl font-semibold text-white mb-6">Sign In</h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input-field"
                placeholder="Enter your username"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="Enter your password"
                required
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-3 text-base font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Default credentials hint */}
          <div className="mt-6 p-4 bg-dark-800 rounded-lg border border-dark-700">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-gray-300 font-medium mb-1">Default Credentials</p>
                <p className="text-xs text-gray-400">
                  Username: <span className="font-mono text-gray-300">admin</span>
                  <br />
                  Password: <span className="font-mono text-gray-300">admin123</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-gray-500 mt-6">
          Securing the future of DeFi, one transaction at a time.
        </p>
      </div>
    </div>
  )
}

export default Login
