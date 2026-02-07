import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { transactionsAPI } from '../services/api'
import { ArrowLeft, Copy, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

const TransactionDetail = () => {
  const { hash } = useParams()
  const [transaction, setTransaction] = useState(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState('')

  useEffect(() => {
    loadTransaction()
  }, [hash])

  const loadTransaction = async () => {
    try {
      setLoading(true)
      const response = await transactionsAPI.getByHash(hash)
      if (response.success) {
        setTransaction(response.data)
      } else {
        toast.error('Transaction not found')
      }
    } catch (error) {
      toast.error('Failed to load transaction')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text)
    setCopied(label)
    toast.success('Copied to clipboard')
    setTimeout(() => setCopied(''), 2000)
  }

  const formatValue = (value) => {
    if (!value) return '0'
    const num = BigInt(value)
    return (Number(num) / 1e18).toFixed(6)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!transaction) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">Transaction not found</p>
        <Link to="/transactions" className="text-primary-400 hover:text-primary-300 mt-4 inline-block">
          ← Back to Transactions
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Link
          to="/transactions"
          className="p-2 hover:bg-dark-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-400" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-white">Transaction Details</h1>
          <p className="text-gray-400 mt-1 font-mono text-sm">{hash}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic Info */}
        <div className="card">
          <h2 className="text-xl font-semibold text-white mb-4">Transaction Information</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400">Hash</label>
              <div className="flex items-center space-x-2 mt-1">
                <p className="text-white font-mono text-sm flex-1">{transaction.tx_hash}</p>
                <button
                  onClick={() => copyToClipboard(transaction.tx_hash, 'hash')}
                  className="p-2 hover:bg-dark-800 rounded-lg transition-colors"
                >
                  {copied === 'hash' ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-400">Block Number</label>
                <p className="text-white font-medium">{transaction.block_number?.toLocaleString()}</p>
              </div>
              <div>
                <label className="text-sm text-gray-400">Transaction Index</label>
                <p className="text-white font-medium">{transaction.transaction_index}</p>
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-400">Status</label>
              <div className="mt-1">
                {transaction.status ? (
                  <span className="px-3 py-1 text-sm font-medium bg-green-600/20 text-green-400 rounded">
                    Success
                  </span>
                ) : (
                  <span className="px-3 py-1 text-sm font-medium bg-red-600/20 text-red-400 rounded">
                    Failed
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-400">Timestamp</label>
              <p className="text-white font-medium">
                {format(new Date(transaction.created_at), 'PPpp')}
              </p>
            </div>
          </div>
        </div>

        {/* Addresses & Value */}
        <div className="card">
          <h2 className="text-xl font-semibold text-white mb-4">Addresses & Value</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400">From Address</label>
              <div className="flex items-center space-x-2 mt-1">
                <p className="text-white font-mono text-sm flex-1 break-all">
                  {transaction.from_address}
                </p>
                <button
                  onClick={() => copyToClipboard(transaction.from_address, 'from')}
                  className="p-2 hover:bg-dark-800 rounded-lg transition-colors"
                >
                  {copied === 'from' ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-400">To Address</label>
              <div className="flex items-center space-x-2 mt-1">
                <p className="text-white font-mono text-sm flex-1 break-all">
                  {transaction.to_address}
                </p>
                <button
                  onClick={() => copyToClipboard(transaction.to_address, 'to')}
                  className="p-2 hover:bg-dark-800 rounded-lg transition-colors"
                >
                  {copied === 'to' ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-400">Value</label>
              <p className="text-white font-semibold text-lg">
                {formatValue(transaction.value)} AVAX
              </p>
            </div>
          </div>
        </div>

        {/* Gas Information */}
        <div className="card">
          <h2 className="text-xl font-semibold text-white mb-4">Gas Information</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-400">Gas Used</label>
                <p className="text-white font-medium">
                  {transaction.gas_used?.toLocaleString() || '-'}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-400">Gas Limit</label>
                <p className="text-white font-medium">
                  {transaction.gas_limit?.toLocaleString() || '-'}
                </p>
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-400">Gas Price</label>
              <p className="text-white font-medium">
                {transaction.gas_price ? `${transaction.gas_price} wei` : '-'}
              </p>
            </div>
          </div>
        </div>

        {/* Transaction Data */}
        {transaction.transaction_data && (
          <div className="card">
            <h2 className="text-xl font-semibold text-white mb-4">Transaction Data</h2>
            <pre className="bg-dark-800 rounded-lg p-4 overflow-x-auto text-xs text-gray-300">
              {JSON.stringify(transaction.transaction_data, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Decoded Call */}
      {transaction.decoded_call && (
        <div className="card">
          <h2 className="text-xl font-semibold text-white mb-4">Decoded Function Call</h2>
          <pre className="bg-dark-800 rounded-lg p-4 overflow-x-auto text-xs text-gray-300">
            {JSON.stringify(transaction.decoded_call, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

export default TransactionDetail
