import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'



export async function GET() {
  try {
    const supabase = createClient()
    
    // Fetch latest cost comparison
    const { data: costComparison } = await supabase
      .from('cost_comparisons')
      .select('*')
      .order('date', { ascending: false })
      .limit(1)
      .single()
    
    // Fetch budget allocations
    const { data: budgetAllocations } = await supabase
      .from('budget_allocations')
      .select('*')
      .eq('fiscal_year', '2024-25')
    
    // Calculate spending totals
    const detentionTotal = budgetAllocations
      ?.filter(a => a.category === 'detention')
      .reduce((sum, a) => sum + parseFloat(a.amount), 0) || 453_000_000
    
    const communityTotal = budgetAllocations
      ?.filter(a => a.category === 'community')
      .reduce((sum, a) => sum + parseFloat(a.amount), 0) || 47_000_000
    
    const totalBudget = detentionTotal + communityTotal
    
    // Fetch youth statistics
    const { data: youthStats } = await supabase
      .from('youth_statistics')
      .select('*')
      .order('date', { ascending: false })
      .limit(1)
      .single()
    

    
    // Fetch trend data
    const { data: trends } = await supabase
      .from('cost_comparisons')
      .select('date, detention_spending_percentage, community_spending_percentage')
      .order('date', { ascending: false })
      .limit(30)
    

    
    const detentionPercentage = (detentionTotal / totalBudget) * 100
    const communityPercentage = (communityTotal / totalBudget) * 100
    
    // Format response data
    const responseData = {
      timestamp: new Date().toISOString(),
      spending: {
        total_budget: totalBudget,
        detention_total: detentionTotal,
        community_total: communityTotal,
        detention_percentage: detentionPercentage,
        community_percentage: communityPercentage,
        detention_daily_cost: costComparison?.detention_daily_cost || 857,
        community_daily_cost: costComparison?.community_daily_cost || 41,
        cost_ratio: costComparison?.cost_ratio || 20.9
      },
      indigenous: {
        detention_percentage: youthStats?.indigenous_percentage || 75.0,
        population_percentage: 4.5,
        overrepresentation_factor: (youthStats?.indigenous_percentage || 75.0) / 4.5,
        min_factor: 22,
        max_factor: 33
      },
      trends: {
        dates: trends?.map(t => t.date) || [],
        detention_percentages: trends?.map(t => t.detention_spending_percentage) || [],
        community_percentages: trends?.map(t => t.community_spending_percentage) || []
      }
    }

    return NextResponse.json(responseData)
  } catch (error) {
    console.error('Error fetching data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch data' },
      { status: 500 }
    )
  }
}