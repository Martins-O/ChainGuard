import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { transactionsAPI, subnetsAPI } from '../services/api'
import { FileText, Search, Filter } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'

const Transactions = () => {
  const [searchParams] = useSearchParams()
  const subnetId = searchParams.get('subnet')
  
  const [transactions, setTransactions] = useState([])
  const [subnets, setSubnets] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    subnet: subnetId || '',
    fromAddress: '',
    toAddress: '',
    status: '',
    search: ''
  })

  useEffect(() => {
    loadSubnets()
  }, [])

  useEffect(() => {
    if (subnetId) {
      setFilters({ ...filters, subnet: subnetId })
      loadTransactions(subnetId)
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

  const loadTransactions = async (selectedSubnetId) => {
    if (!selectedSubnetId) {
      setTransactions([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const params = {}
      if (filters.fromAddress) params.fromAddress = filters.fromAddress
      if (filters.toAddress) params.toAddress = filters.toAddress
      if (filters.status) params.status = filters.status === 'success'
      params.limit = 100

      const response = await transactionsAPI.getBySubnet(selectedSubnetId, params)
      if (response.success) {
        let data = response.data || []
        
        // Client-side search filter
        if (filters.search) {
          const searchLower = filters.search.toLowerCase()
          data = data.filter(tx => 
            tx.tx_hash?.toLowerCase().includes(searchLower) ||
            tx.from_address?.toLowerCase().includes(searchLower) ||
            tx.to_address?.toLowerCase().includes(searchLower)
          )
        }
        
        setTransactions(data)
      }
    } catch (error) {
      toast.error('Failed to load transactions')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value }
    setFilters(newFilters)
    if (key === 'subnet' && value) {
      loadTransactions(value)
    } else if (filters.subnet) {
      loadTransactions(filters.subnet)
    }
  }

  const formatValue = (value) => {
    if (!value) return '0'
    const num = BigInt(value)
    return (Number(num) / 1e18).toFixed(4)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Transactions</h1>
        <p className="text-gray-400 mt-1">Browse and search transaction history</p>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Subnet</label>
            <select
              value={filters.subnet}
              onChange={(e) => handleFilterChange('subnet', e.target.value)}
              className="input-field"
            >
              <option value="">All Subnets</option>
              {subnets.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="input-field pl-10"
                placeholder="Hash, address..."
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">From Address</label>
            <input
              type="text"
              value={filters.fromAddress}
              onChange={(e) => handleFilterChange('fromAddress', e.target.value)}
              className="input-field font-mono text-sm"
              placeholder="0x..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">To Address</label>
            <input
              type="text"
              value={filters.toAddress}
              onChange={(e) => handleFilterChange('toAddress', e.target.value)}
              className="input-field font-mono text-sm"
              placeholder="0x..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Status</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="input-field"
            >
              <option value="">All</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No transactions found</p>
            {!filters.subnet && (
              <p className="text-sm text-gray-500 mt-2">Select a subnet to view transactions</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-800">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Hash</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Block</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">From</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">To</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Value</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Gas</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Time</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className="border-b border-dark-800 hover:bg-dark-800/50 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <Link
                        to={`/transactions/${tx.tx_hash}`}
                        className="text-primary-400 hover:text-primary-300 font-mono text-sm"
                      >
                        {tx.tx_hash?.slice(0, 16)}...
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-300">
                      {tx.block_number?.toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-gray-300 font-mono">
                        {tx.from_address?.slice(0, 12)}...
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-gray-300 font-mono">
                        {tx.to_address?.slice(0, 12)}...
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-300">
                      {formatValue(tx.value)} AVAX
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-400">
                      {tx.gas_used?.toLocaleString() || '-'}
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

export default Transactions
