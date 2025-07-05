import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Redirect to the new dashboard API
export async function GET() {
  try {
    // Fetch from our new dashboard API
    const response = await fetch(`${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/api/dashboard`)
    const dashboardData = await response.json()
    
    // Transform to match the expected format of the homepage
    const responseData = {
      timestamp: dashboardData.timestamp,
      spending: {
        total_budget: dashboardData.budget.totalYouthJustice,
        detention_total: dashboardData.budget.detentionOperations,
        community_total: dashboardData.budget.communityPrograms,
        detention_percentage: dashboardData.budget.detentionPercentage,
        community_percentage: dashboardData.budget.communityPercentage,
        detention_daily_cost: dashboardData.budget.claimedDetentionCostPerDay,
        community_daily_cost: dashboardData.budget.dailyCommunityProgramCost,
        cost_ratio: dashboardData.budget.costRatio
      },
      indigenous: {
        detention_percentage: dashboardData.detention.indigenousPercentage,
        population_percentage: dashboardData.insights.indigenousOverrepresentation.populationPercentage,
        overrepresentation_factor: dashboardData.insights.indigenousOverrepresentation.detention,
        min_factor: 15,
        max_factor: 20
      },
      trends: {
        dates: [],
        detention_percentages: [],
        community_percentages: []
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