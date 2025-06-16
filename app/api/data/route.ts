import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'



export async function GET() {
  try {
    const supabase = createClient()
    

    
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
    

    

    
    // Format response data
    const responseData = {
      timestamp: new Date().toISOString(),
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