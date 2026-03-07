import { useState, useEffect } from 'react'
import api, { aiEngineAPI, alertServiceAPI, ingestionAPI } from '../services/api'
import { Server, CheckCircle, XCircle, Loader } from 'lucide-react'

const ServiceStatus = () => {
  const [services, setServices] = useState({
    api: { status: 'checking', label: 'API Server' },
    aiEngine: { status: 'checking', label: 'AI Engine' },
    alertService: { status: 'checking', label: 'Alert Service' },
    ingestion: { status: 'checking', label: 'Ingestion' },
  })

  useEffect(() => {
    checkServices()
    const interval = setInterval(checkServices, 30000)
    return () => clearInterval(interval)
  }, [])

  const checkServices = async () => {
    const results = {
      api: 'unknown',
      aiEngine: 'unknown',
      alertService: 'unknown',
      ingestion: 'unknown',
    }

    try {
      const apiRes = await api.get('/health')
      results.api = apiRes.status === 'healthy' ? 'healthy' : 'unhealthy'
    } catch {
      results.api = 'offline'
    }

    try {
      const aiRes = await aiEngineAPI.health()
      results.aiEngine = aiRes.status === 'healthy' ? 'healthy' : 'unhealthy'
    } catch {
      results.aiEngine = 'offline'
    }

    try {
      const alertRes = await alertServiceAPI.health()
      results.alertService = alertRes.status === 'healthy' ? 'healthy' : 'unhealthy'
    } catch {
      results.alertService = 'offline'
    }

    try {
      const ingRes = await ingestionAPI.health()
      results.ingestion = ingRes.status === 'healthy' ? 'healthy' : 'unhealthy'
    } catch {
      results.ingestion = 'offline'
    }

    setServices(prev => ({
      api: { ...prev.api, status: results.api },
      aiEngine: { ...prev.aiEngine, status: results.aiEngine },
      alertService: { ...prev.alertService, status: results.alertService },
      ingestion: { ...prev.ingestion, status: results.ingestion },
    }))
  }

  const getStatusIcon = (status) => {
    if (status === 'checking') {
      return <Loader className="w-4 h-4 animate-spin text-yellow-500" />
    }
    if (status === 'healthy') {
      return <CheckCircle className="w-4 h-4 text-green-500" />
    }
    if (status === 'unhealthy') {
      return <XCircle className="w-4 h-4 text-yellow-500" />
    }
    return <XCircle className="w-4 h-4 text-red-500" />
  }

  const getStatusText = (status) => {
    if (status === 'checking') return 'Checking...'
    if (status === 'healthy') return 'Online'
    if (status === 'unhealthy') return 'Degraded'
    return 'Offline'
  }

  const getStatusColor = (status) => {
    if (status === 'checking') return 'text-yellow-500'
    if (status === 'healthy') return 'text-green-500'
    if (status === 'unhealthy') return 'text-yellow-500'
    return 'text-red-500'
  }

  return (
    <div className="card">
      <div className="flex items-center space-x-2 mb-4">
        <Server className="w-5 h-5 text-primary-400" />
        <h3 className="text-lg font-semibold text-white">Service Status</h3>
      </div>
      <div className="space-y-3">
        {Object.entries(services).map(([key, service]) => (
          <div key={key} className="flex items-center justify-between">
            <span className="text-gray-300">{service.label}</span>
            <div className="flex items-center space-x-2">
              {getStatusIcon(service.status)}
              <span className={`text-sm ${getStatusColor(service.status)}`}>
                {getStatusText(service.status)}
              </span>
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={checkServices}
        className="mt-4 text-sm text-primary-400 hover:text-primary-300"
      >
        Refresh Status
      </button>
    </div>
  )
}

export default ServiceStatus
