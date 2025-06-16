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