import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { alertsAPI, subnetsAPI } from '../services/api'
import { AlertTriangle, CheckCircle, XCircle, Filter } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'

const Alerts = () => {
  const [searchParams] = useSearchParams()
  const subnetId = searchParams.get('subnet')
  
  const [alerts, setAlerts] = useState([])
  const [subnets, setSubnets] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    subnet: subnetId || '',
    threatLevel: '',
    acknowledged: ''
  })

  useEffect(() => {
    loadSubnets()
  }, [])

  useEffect(() => {
    if (subnetId) {
      setFilters({ ...filters, subnet: subnetId })
      loadAlerts(subnetId)
    }
  }, [subnetId])

  const loadSubnets = async () => {
    try {
      const response = await subnetsAPI.getAll()
      if (response.success) {
        setSubnets(response.data || [])
      }
    } catch (error) {
      console.error(error)
    }
  }

  const loadAlerts = async (selectedSubnetId) => {
    if (!selectedSubnetId) {
      setAlerts([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const params = {}
      if (filters.threatLevel) params.threatLevel = filters.threatLevel
      if (filters.acknowledged) params.acknowledged = filters.acknowledged
      params.limit = 100

      const response = await alertsAPI.getBySubnet(selectedSubnetId, params)
      if (response.success) {
        setAlerts(response.data || [])
      }
    } catch (error) {
      toast.error('Failed to load alerts')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value }
    setFilters(newFilters)
    if (filters.subnet) {
      loadAlerts(filters.subnet)
    }
  }

  const handleAcknowledge = async (id) => {
    try {
      await alertsAPI.acknowledge(id)
      toast.success('Alert acknowledged')
      if (filters.subnet) {
        loadAlerts(filters.subnet)
      }
    } catch (error) {
      toast.error('Failed to acknowledge alert')
    }
  }

  const handleFalsePositive = async (id) => {
    if (!window.confirm('Mark this alert as a false positive?')) return
    
    try {
      await alertsAPI.markFalsePositive(id)
      toast.success('Alert marked as false positive')
      if (filters.subnet) {
        loadAlerts(filters.subnet)
      }
    } catch (error) {
      toast.error('Failed to mark as false positive')
    }
  }

  const getThreatLevelColor = (level) => {
    switch (level) {
      case 'CRITICAL':
        return 'bg-red-500 text-red-100'
      case 'HIGH':
        return 'bg-orange-500 text-orange-100'
      case 'MEDIUM':
        return 'bg-yellow-500 text-yellow-100'
      default:
        return 'bg-blue-500 text-blue-100'
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Security Alerts</h1>
        <p className="text-gray-400 mt-1">Monitor and manage security threats</p>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Subnet</label>
            <select
              value={filters.subnet}
              onChange={(e) => handleFilterChange('subnet', e.target.value)}
              className="input-field"
            >
              <option value="">Select Subnet</option>
              {subnets.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Threat Level</label>
            <select
              value={filters.threatLevel}
              onChange={(e) => handleFilterChange('threatLevel', e.target.value)}
              className="input-field"
            >
              <option value="">All Levels</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Status</label>
            <select
              value={filters.acknowledged}
              onChange={(e) => handleFilterChange('acknowledged', e.target.value)}
              className="input-field"
            >
              <option value="">All</option>
              <option value="false">Unacknowledged</option>
              <option value="true">Acknowledged</option>
            </select>
          </div>
        </div>
      </div>

      {/* Alerts List */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
          </div>
        ) : alerts.length === 0 ? (
          <div className="card text-center py-12">
            <AlertTriangle className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No alerts found</p>
            {!filters.subnet && (
              <p className="text-sm text-gray-500 mt-2">Select a subnet to view alerts</p>
            )}
          </div>
        ) : (
          alerts.map((alert) => (
            <div
              key={alert.id}
              className="card hover:border-dark-700 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4 flex-1">
                  <div className={`w-3 h-3 rounded-full mt-2 ${
                    alert.threat_level === 'CRITICAL' ? 'bg-red-500' :
                    alert.threat_level === 'HIGH' ? 'bg-orange-500' :
                    alert.threat_level === 'MEDIUM' ? 'bg-yellow-500' :
                    'bg-blue-500'
                  }`}></div>
                  
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <span className={`px-3 py-1 text-sm font-semibold rounded ${getThreatLevelColor(alert.threat_level)}`}>
                        {alert.threat_level}
                      </span>
                      <span className="text-sm text-gray-400">
                        Score: {alert.threat_score}
                      </span>
                      {alert.acknowledged && (
                        <span className="px-2 py-1 text-xs font-medium bg-green-600/20 text-green-400 rounded">
                          Acknowledged
                        </span>
                      )}
                      {alert.false_positive && (
                        <span className="px-2 py-1 text-xs font-medium bg-gray-600/20 text-gray-400 rounded">
                          False Positive
                        </span>
                      )}
                    </div>
                    
                    <p className="text-gray-300 mb-3">{alert.explanation}</p>
                    
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <span className="font-mono">TX: {alert.tx_hash?.slice(0, 16)}...</span>
                      <span>
                        {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>

                {!alert.acknowledged && !alert.false_positive && (
                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => handleAcknowledge(alert.id)}
                      className="px-3 py-1.5 text-sm bg-green-600/20 hover:bg-green-600/30 text-green-400 rounded-lg transition-colors flex items-center space-x-1"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>Acknowledge</span>
                    </button>
                    <button
                      onClick={() => handleFalsePositive(alert.id)}
                      className="px-3 py-1.5 text-sm bg-gray-600/20 hover:bg-gray-600/30 text-gray-400 rounded-lg transition-colors flex items-center space-x-1"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>False Positive</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default Alerts
