import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { subnetsAPI, statsAPI, alertsAPI } from '../services/api'
import { 
  Network, 
  FileText, 
  AlertTriangle, 
  TrendingUp,
  Activity,
  Shield,
  CheckCircle,
  XCircle
} from 'lucide-react'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalSubnets: 0,
    activeSubnets: 0,
    totalTransactions: 0,
    totalAlerts: 0,
    criticalAlerts: 0,
    recentAlerts: []
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      
      // Get all subnets
      const subnetsRes = await subnetsAPI.getAll()
      const subnets = subnetsRes.data || []
      const activeSubnets = subnets.filter(s => s.is_active && s.monitoring_enabled)
      
      // Get stats for each subnet
      let totalTransactions = 0
      let totalAlerts = 0
      let criticalAlerts = 0
      const recentAlertsList = []

      for (const subnet of activeSubnets.slice(0, 5)) {
        try {
          const statsRes = await statsAPI.getSubnetStats(subnet.id)
          if (statsRes.success && statsRes.data?.statistics) {
            const s = statsRes.data.statistics
            totalTransactions += s.total_transactions || 0
            totalAlerts += s.total_alerts || 0
            criticalAlerts += s.critical_alerts || 0
          }

          // Get recent alerts
          const alertsRes = await alertsAPI.getBySubnet(subnet.id, { limit: 5 })
          if (alertsRes.success && alertsRes.data) {
            recentAlertsList.push(...alertsRes.data.slice(0, 3))
          }
        } catch (error) {
          console.error(`Error loading stats for subnet ${subnet.id}:`, error)
        }
      }

      setStats({
        totalSubnets: subnets.length,
        activeSubnets: activeSubnets.length,
        totalTransactions,
        totalAlerts,
        criticalAlerts,
        recentAlerts: recentAlertsList
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, 5)
      })
    } catch (error) {
      toast.error('Failed to load dashboard data')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const getThreatLevelColor = (level) => {
    switch (level) {
      case 'CRITICAL':
        return 'bg-red-500'
      case 'HIGH':
        return 'bg-orange-500'
      case 'MEDIUM':
        return 'bg-yellow-500'
      default:
        return 'bg-blue-500'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400 mt-1">Monitor and manage your Avalanche subnet security</p>
        </div>
        <button
          onClick={loadDashboardData}
          className="btn-secondary flex items-center space-x-2"
        >
          <Activity className="w-4 h-4" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400 mb-1">Total Subnets</p>
              <p className="text-3xl font-bold text-white">{stats.totalSubnets}</p>
              <p className="text-sm text-gray-500 mt-1">{stats.activeSubnets} active</p>
            </div>
            <div className="w-12 h-12 bg-primary-600/20 rounded-lg flex items-center justify-center">
              <Network className="w-6 h-6 text-primary-400" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400 mb-1">Total Transactions</p>
              <p className="text-3xl font-bold text-white">
                {stats.totalTransactions.toLocaleString()}
              </p>
              <p className="text-sm text-green-500 mt-1">
                <TrendingUp className="w-3 h-3 inline mr-1" />
                Monitored
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-600/20 rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6 text-blue-400" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400 mb-1">Total Alerts</p>
              <p className="text-3xl font-bold text-white">{stats.totalAlerts}</p>
              <p className="text-sm text-red-500 mt-1">{stats.criticalAlerts} critical</p>
            </div>
            <div className="w-12 h-12 bg-red-600/20 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400 mb-1">System Status</p>
              <p className="text-3xl font-bold text-green-500">Active</p>
              <p className="text-sm text-gray-500 mt-1">All systems operational</p>
            </div>
            <div className="w-12 h-12 bg-green-600/20 rounded-lg flex items-center justify-center">
              <Shield className="w-6 h-6 text-green-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Alerts */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <span>Recent Alerts</span>
            {stats.recentAlerts.length > 0 && (
              <span className="px-2 py-1 text-xs font-medium bg-red-600/20 text-red-400 rounded">
                {stats.recentAlerts.length}
              </span>
            )}
          </h2>
          <Link to="/alerts" className="text-sm text-primary-400 hover:text-primary-300">
            View All →
          </Link>
        </div>

        {stats.recentAlerts.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <p className="text-gray-400">No recent alerts</p>
            <p className="text-sm text-gray-500 mt-1">All systems are secure</p>
          </div>
        ) : (
          <div className="space-y-4">
            {stats.recentAlerts.map((alert) => (
              <div
                key={alert.id}
                className="p-4 bg-dark-800 rounded-lg border border-dark-700 hover:border-red-500/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    <div className={`w-3 h-3 rounded-full mt-2 ${getThreatLevelColor(alert.threat_level)}`}></div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-sm font-semibold text-white">
                          {alert.threat_level}
                        </span>
                        <span className="text-xs text-gray-500">
                          Score: {alert.threat_score}
                        </span>
                      </div>
                      <p className="text-sm text-gray-300 mb-2">{alert.explanation}</p>
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span>TX: {alert.tx_hash?.slice(0, 10)}...</span>
                        <span>
                          {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </div>
                  {!alert.acknowledged && (
                    <span className="px-2 py-1 text-xs font-medium bg-yellow-600/20 text-yellow-400 rounded">
                      New
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          to="/subnets"
          className="card hover:border-primary-500/50 transition-colors cursor-pointer"
        >
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-primary-600/20 rounded-lg flex items-center justify-center">
              <Network className="w-6 h-6 text-primary-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Manage Subnets</h3>
              <p className="text-sm text-gray-400">Configure monitoring</p>
            </div>
          </div>
        </Link>

        <Link
          to="/transactions"
          className="card hover:border-primary-500/50 transition-colors cursor-pointer"
        >
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-blue-600/20 rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">View Transactions</h3>
              <p className="text-sm text-gray-400">Browse transaction history</p>
            </div>
          </div>
        </Link>

        <Link
          to="/analytics"
          className="card hover:border-primary-500/50 transition-colors cursor-pointer"
        >
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-purple-600/20 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Analytics</h3>
              <p className="text-sm text-gray-400">View detailed insights</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  )
}

export default Dashboard
