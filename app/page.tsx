'use client'

import { useEffect, useState } from 'react'
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title } from 'chart.js'
import { Doughnut, Bar } from 'react-chartjs-2'
import { formatCurrency, formatNumber } from '@/lib/utils'
import MetricCard from '@/components/MetricCard'
import IndigenousDisparity from '@/components/IndigenousDisparity'
import HiddenCosts from '@/components/HiddenCosts'

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title)

interface DashboardData {
  timestamp: string
  spending: {
    total_budget: number
    detention_total: number
    community_total: number
    detention_percentage: number
    community_percentage: number
    detention_daily_cost: number
    community_daily_cost: number
    cost_ratio: number
  }
  indigenous: {
    detention_percentage: number
    population_percentage: number
    overrepresentation_factor: number
    min_factor: number
    max_factor: number
  }

  trends: {
    dates: string[]
    detention_percentages: number[]
    community_percentages: number[]
  }
}

export default function HomePage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000) // Update every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const fetchData = async () => {
    try {
      const response = await fetch('/api/data')
      if (!response.ok) throw new Error('Failed to fetch data')
      const data = await response.json()
      setData(data)
      setLoading(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-qld-maroon mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard data...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center text-red-600">
          <p className="text-xl mb-2">Error loading dashboard</p>
          <p>{error || 'No data available'}</p>
        </div>
      </div>
    )
  }

  const spendingChartData = {
    labels: ['Detention', 'Community Programs'],
    datasets: [{
      label: 'Budget Allocation',
      data: [data.spending.detention_total, data.spending.community_total],
      backgroundColor: ['#EF4444', '#10B981'],
      borderColor: ['#DC2626', '#059669'],
      borderWidth: 1
    }]
  }

  const spendingChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
      },
      title: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const label = context.label || ''
            const value = formatCurrency(context.parsed)
            const percentage = context.dataIndex === 0 
              ? data.spending.detention_percentage 
              : data.spending.community_percentage
            return `${label}: ${value} (${percentage.toFixed(1)}%)`
          }
        }
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-qld-maroon text-white py-8">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl font-bold mb-2">Queensland Youth Justice Spending Tracker</h1>
          <p className="text-xl opacity-90">Real-time transparency for public spending</p>
          <div className="mt-4 flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-qld-gold opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-qld-gold"></span>
            </span>
            <span className="text-sm">LIVE DATA</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Key Metrics */}
        <section className="mb-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
              title="Total Youth Justice Budget"
              value={formatCurrency(data.spending.total_budget)}
              subtitle="Annual spending"
              variant="primary"
            />
            <MetricCard
              title="Detention Spending"
              value={formatCurrency(data.spending.detention_total)}
              subtitle={`${data.spending.detention_percentage.toFixed(1)}% of budget`}
              variant="danger"
            />
            <MetricCard
              title="Community Programs"
              value={formatCurrency(data.spending.community_total)}
              subtitle={`${data.spending.community_percentage.toFixed(1)}% of budget`}
              variant="success"
            />
            <MetricCard
              title="Cost Ratio"
              value={`${data.spending.cost_ratio.toFixed(1)}x`}
              subtitle="Detention vs Community"
              variant="warning"
            />
          </div>
        </section>

        {/* Spending Split */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6">Where Your Tax Dollars Go</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="h-80">
                <Doughnut data={spendingChartData} options={spendingChartOptions} />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-red-500 rounded-lg flex-shrink-0"></div>
                  <div>
                    <h4 className="text-xl font-semibold">Detention</h4>
                    <p className="text-3xl font-bold text-red-600">${data.spending.detention_daily_cost}/day</p>
                    <p className="text-gray-600">Per youth in detention</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-green-500 rounded-lg flex-shrink-0"></div>
                  <div>
                    <h4 className="text-xl font-semibold">Community</h4>
                    <p className="text-3xl font-bold text-green-600">${data.spending.community_daily_cost}/day</p>
                    <p className="text-gray-600">Per youth in programs</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Indigenous Disparity */}
        <IndigenousDisparity data={data.indigenous} />

        {/* Hidden Costs */}
        <HiddenCosts />
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-8 mt-12">
        <div className="container mx-auto px-4 text-center">
          <p className="mb-2">Data sourced from Queensland Government publications. Updated in real-time.</p>
          <p>This is a transparency project to inform public debate about youth justice spending.</p>
        </div>
      </footer>
    </div>
  )
}