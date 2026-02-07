import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { subnetsAPI, statsAPI, transactionsAPI, alertsAPI } from '../services/api'
import { Network, ArrowLeft, Activity, AlertTriangle, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'

const SubnetDetail = () => {
  const { id } = useParams()
  const [subnet, setSubnet] = useState(null)
  const [stats, setStats] = useState(null)
  const [recentTransactions, setRecentTransactions] = useState([])
  const [recentAlerts, setRecentAlerts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSubnetData()
  }, [id])

  const loadSubnetData = async () => {
    try {
      setLoading(true)
      
      const [subnetRes, statsRes, transactionsRes, alertsRes] = await Promise.all([
        subnetsAPI.getById(id),
        statsAPI.getSubnetStats(id).catch(() => ({ success: false })),
        transactionsAPI.getBySubnet(id, { limit: 5 }).catch(() => ({ success: false })),
        alertsAPI.getBySubnet(id, { limit: 5 }).catch(() => ({ success: false }))
      ])

      if (subnetRes.success) {
        setSubnet(subnetRes.data)
      }

      if (statsRes.success) {
        setStats(statsRes.data.statistics)
      }

      if (transactionsRes.success) {
        setRecentTransactions(transactionsRes.data || [])
      }

      if (alertsRes.success) {
        setRecentAlerts(alertsRes.data || [])
      }
    } catch (error) {
      toast.error('Failed to load subnet data')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!subnet) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">Subnet not found</p>
        <Link to="/subnets" className="text-primary-400 hover:text-primary-300 mt-4 inline-block">
          ← Back to Subnets
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Link
          to="/subnets"
          className="p-2 hover:bg-dark-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-400" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-white">{subnet.name}</h1>
          <p className="text-gray-400 mt-1">Chain ID: {subnet.chain_id}</p>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="card">
            <p className="text-sm text-gray-400 mb-1">Total Transactions</p>
            <p className="text-3xl font-bold text-white">
              {stats.total_transactions?.toLocaleString() || 0}
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-400 mb-1">Total Alerts</p>
            <p className="text-3xl font-bold text-white">{stats.total_alerts || 0}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-400 mb-1">Critical Alerts</p>
            <p className="text-3xl font-bold text-red-400">{stats.critical_alerts || 0}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-400 mb-1">Avg Threat Score</p>
            <p className="text-3xl font-bold text-white">
              {stats.avg_threat_score?.toFixed(1) || '0.0'}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Subnet Info */}
        <div className="card">
          <h2 className="text-xl font-semibold text-white mb-4">Subnet Information</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400">Name</label>
              <p className="text-white font-medium">{subnet.name}</p>
            </div>
            <div>
              <label className="text-sm text-gray-400">Chain ID</label>
              <p className="text-white font-mono text-sm">{subnet.chain_id}</p>
            </div>
            <div>
              <label className="text-sm text-gray-400">RPC URL</label>
              <p className="text-white font-mono text-sm break-all">{subnet.rpc_url}</p>
            </div>
            <div>
              <label className="text-sm text-gray-400">WebSocket URL</label>
              <p className="text-white font-mono text-sm break-all">{subnet.websocket_url}</p>
            </div>
            <div className="flex items-center space-x-4">
              <div>
                <label className="text-sm text-gray-400">Status</label>
                <p className="text-white">
                  {subnet.is_active ? (
                    <span className="text-green-400">Active</span>
                  ) : (
                    <span className="text-gray-400">Inactive</span>
                  )}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-400">Monitoring</label>
                <p className="text-white">
                  {subnet.monitoring_enabled ? (
                    <span className="text-green-400">Enabled</span>
                  ) : (
                    <span className="text-gray-400">Disabled</span>
                  )}
                </p>
              </div>
            </div>
            {subnet.description && (
              <div>
                <label className="text-sm text-gray-400">Description</label>
                <p className="text-white">{subnet.description}</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Alerts */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <span>Recent Alerts</span>
            </h2>
            <Link
              to={`/alerts?subnet=${id}`}
              className="text-sm text-primary-400 hover:text-primary-300"
            >
              View All →
            </Link>
          </div>
          {recentAlerts.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No recent alerts</p>
          ) : (
            <div className="space-y-3">
              {recentAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="p-3 bg-dark-800 rounded-lg border border-dark-700"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <span className={`w-2 h-2 rounded-full ${
                          alert.threat_level === 'CRITICAL' ? 'bg-red-500' :
                          alert.threat_level === 'HIGH' ? 'bg-orange-500' :
                          'bg-yellow-500'
                        }`}></span>
                        <span className="text-sm font-semibold text-white">
                          {alert.threat_level}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 line-clamp-2">{alert.explanation}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white flex items-center space-x-2">
            <FileText className="w-5 h-5 text-blue-400" />
            <span>Recent Transactions</span>
          </h2>
          <Link
            to={`/transactions?subnet=${id}`}
            className="text-sm text-primary-400 hover:text-primary-300"
          >
            View All →
          </Link>
        </div>
        {recentTransactions.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No recent transactions</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-800">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Hash</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">From</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">To</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Time</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-dark-800 hover:bg-dark-800/50">
                    <td className="py-3 px-4">
                      <Link
                        to={`/transactions/${tx.tx_hash}`}
                        className="text-primary-400 hover:text-primary-300 font-mono text-sm"
                      >
                        {tx.tx_hash?.slice(0, 16)}...
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-300 font-mono">
                      {tx.from_address?.slice(0, 10)}...
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-300 font-mono">
                      {tx.to_address?.slice(0, 10)}...
                    </td>
                    <td className="py-3 px-4">
                      {tx.status ? (
                        <span className="px-2 py-1 text-xs font-medium bg-green-600/20 text-green-400 rounded">
                          Success
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium bg-red-600/20 text-red-400 rounded">
                          Failed
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-400">
                      {formatDistanceToNow(new Date(tx.created_at), { addSuffix: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default SubnetDetail
