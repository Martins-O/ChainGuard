import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { subnetsAPI } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { Network, Plus, Edit, Trash2, Power, PowerOff, Eye } from 'lucide-react'
import toast from 'react-hot-toast'

const Subnets = () => {
  const [subnets, setSubnets] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const { isAdmin } = useAuth()

  useEffect(() => {
    loadSubnets()
  }, [])

  const loadSubnets = async () => {
    try {
      setLoading(true)
      const response = await subnetsAPI.getAll()
      if (response.success) {
        setSubnets(response.data || [])
      }
    } catch (error) {
      toast.error('Failed to load subnets')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleActive = async (id, currentStatus) => {
    try {
      await subnetsAPI.update(id, { isActive: !currentStatus })
      toast.success(`Subnet ${!currentStatus ? 'activated' : 'deactivated'}`)
      loadSubnets()
    } catch (error) {
      toast.error('Failed to update subnet')
    }
  }

  const handleToggleMonitoring = async (id, currentStatus) => {
    try {
      await subnetsAPI.update(id, { monitoringEnabled: !currentStatus })
      toast.success(`Monitoring ${!currentStatus ? 'enabled' : 'disabled'}`)
      loadSubnets()
    } catch (error) {
      toast.error('Failed to update monitoring')
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this subnet?')) return
    
    try {
      await subnetsAPI.delete(id)
      toast.success('Subnet deleted')
      loadSubnets()
    } catch (error) {
      toast.error('Failed to delete subnet')
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Subnets</h1>
          <p className="text-gray-400 mt-1">Manage Avalanche subnet configurations</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add Subnet</span>
          </button>
        )}
      </div>

      {subnets.length === 0 ? (
        <div className="card text-center py-12">
          <Network className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No Subnets</h3>
          <p className="text-gray-400 mb-6">Get started by adding your first subnet</p>
          {isAdmin && (
            <button onClick={() => setShowCreateModal(true)} className="btn-primary">
              Add Your First Subnet
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {subnets.map((subnet) => (
            <div key={subnet.id} className="card">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-primary-600/20 rounded-lg flex items-center justify-center">
                    <Network className="w-6 h-6 text-primary-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{subnet.name}</h3>
                    <p className="text-sm text-gray-400">{subnet.chain_id}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {subnet.is_active ? (
                    <span className="px-2 py-1 text-xs font-medium bg-green-600/20 text-green-400 rounded">
                      Active
                    </span>
                  ) : (
                    <span className="px-2 py-1 text-xs font-medium bg-gray-600/20 text-gray-400 rounded">
                      Inactive
                    </span>
                  )}
                </div>
              </div>

              {subnet.description && (
                <p className="text-sm text-gray-400 mb-4 line-clamp-2">{subnet.description}</p>
              )}

              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Monitoring</span>
                  <span className={subnet.monitoring_enabled ? 'text-green-400' : 'text-gray-500'}>
                    {subnet.monitoring_enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">RPC</span>
                  <span className="text-gray-300 font-mono text-xs truncate ml-2">
                    {subnet.rpc_url?.slice(0, 20)}...
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-4 border-t border-dark-800">
                <Link
                  to={`/subnets/${subnet.id}`}
                  className="flex-1 btn-secondary text-center flex items-center justify-center space-x-2"
                >
                  <Eye className="w-4 h-4" />
                  <span>View</span>
                </Link>
                {isAdmin && (
                  <>
                    <button
                      onClick={() => handleToggleActive(subnet.id, subnet.is_active)}
                      className="p-2 bg-dark-800 hover:bg-dark-700 rounded-lg transition-colors"
                      title={subnet.is_active ? 'Deactivate' : 'Activate'}
                    >
                      {subnet.is_active ? (
                        <PowerOff className="w-4 h-4 text-gray-400" />
                      ) : (
                        <Power className="w-4 h-4 text-green-400" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(subnet.id)}
                      className="p-2 bg-dark-800 hover:bg-red-600/20 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateSubnetModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false)
            loadSubnets()
          }}
        />
      )}
    </div>
  )
}

const CreateSubnetModal = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    chainId: '',
    rpcUrl: '',
    websocketUrl: '',
    description: ''
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      await subnetsAPI.create(formData)
      toast.success('Subnet created successfully')
      onSuccess()
    } catch (error) {
      toast.error(error.error || 'Failed to create subnet')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-900 rounded-xl border border-dark-800 w-full max-w-md p-6">
        <h2 className="text-2xl font-semibold text-white mb-6">Create New Subnet</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input-field"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Chain ID</label>
            <input
              type="text"
              value={formData.chainId}
              onChange={(e) => setFormData({ ...formData, chainId: e.target.value })}
              className="input-field"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">RPC URL</label>
            <input
              type="url"
              value={formData.rpcUrl}
              onChange={(e) => setFormData({ ...formData, rpcUrl: e.target.value })}
              className="input-field"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">WebSocket URL</label>
            <input
              type="url"
              value={formData.websocketUrl}
              onChange={(e) => setFormData({ ...formData, websocketUrl: e.target.value })}
              className="input-field"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Description (Optional)</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="input-field"
              rows={3}
            />
          </div>

          <div className="flex items-center space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 btn-primary"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Subnet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default Subnets
