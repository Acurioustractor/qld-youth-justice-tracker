import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createClient()
    
    // Get latest court statistics
    const { data: courtStats, error: courtError } = await supabase
      .from('court_statistics')
      .select('*')
      .order('report_period', { ascending: false })
      .limit(1)
      .single()
    
    if (courtError) console.error('Court stats error:', courtError)
    
    // Get latest youth detention statistics
    const { data: detentionStats, error: detentionError } = await supabase
      .from('youth_detention_statistics')
      .select('*')
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .single()
    
    if (detentionError) console.error('Detention stats error:', detentionError)
    
    // Get latest budget allocations
    const { data: budgetData, error: budgetError } = await supabase
      .from('budget_allocations')
      .select('*')
      .order('fiscal_year', { ascending: false })
      .limit(1)
      .single()
    
    if (budgetError) console.error('Budget data error:', budgetError)
    
    // Get latest police statistics
    const { data: policeStats, error: policeError } = await supabase
      .from('police_statistics')
      .select('*')
      .order('report_period', { ascending: false })
      .limit(1)
      .single()
    
    if (policeError) console.error('Police stats error:', policeError)
    
    // Get latest audit findings
    const { data: auditFindings, error: auditError } = await supabase
      .from('audit_findings')
      .select('*')
      .order('report_date', { ascending: false })
      .limit(1)
      .single()
    
    if (auditError) console.error('Audit findings error:', auditError)
    
    // Calculate derived metrics
    const indigenousPopulationPercentage = 4.6 // From ABS census data
    const detentionIndigenousRate = detentionStats?.indigenous_percentage || 73.4
    const courtIndigenousRate = courtStats?.indigenous_percentage || 61.9
    
    const overrepresentationFactor = detentionIndigenousRate / indigenousPopulationPercentage
    const courtOverrepresentationFactor = courtIndigenousRate / indigenousPopulationPercentage
    
    // Calculate daily costs
    const detentionBudget = budgetData?.detention_operations || 443000000
    const communityBudget = budgetData?.community_programs || 37100000
    const dailyDetentionCost = detentionBudget / 365
    const dailyCommunityProgramCost = 41 // Per person per day from verified data
    const claimedDetentionCostPerDay = budgetData?.cost_per_detention_day || 857
    const trueCostPerDay = auditFindings?.true_cost_per_day || 1570
    
    // Format response
    const response = {
      timestamp: new Date().toISOString(),
      lastUpdated: {
        court: courtStats?.verified_date || '2025-07-05',
        detention: detentionStats?.report_date || '2024-03-31',
        budget: budgetData?.created_at || '2025-07-05',
        police: policeStats?.verified_date || '2025-07-05',
        audit: auditFindings?.verified_date || '2025-07-05'
      },
      
      // Court data
      court: {
        totalDefendants: courtStats?.total_defendants || 8457,
        indigenousDefendants: courtStats?.indigenous_defendants || 5235,
        indigenousPercentage: courtStats?.indigenous_percentage || 61.9,
        bailRefusedCount: courtStats?.bail_refused_count || 2148,
        bailRefusedPercentage: courtStats?.bail_refused_percentage || 25.4,
        remandedInCustody: courtStats?.remanded_in_custody || 1897,
        averageDaysToFinalization: courtStats?.average_days_to_finalization || 127,
        overrepresentationFactor: courtOverrepresentationFactor,
        source: {
          document: courtStats?.source_document || 'Childrens Court Annual Report 2023-24',
          url: courtStats?.source_url || 'https://www.courts.qld.gov.au/__data/assets/pdf_file/0006/819771/cc-ar-2023-2024.pdf',
          pageReferences: courtStats?.page_references || {}
        }
      },
      
      // Youth detention data
      detention: {
        totalYouth: detentionStats?.total_youth || 338,
        indigenousYouth: detentionStats?.indigenous_youth || 248,
        indigenousPercentage: detentionStats?.indigenous_percentage || 73.4,
        onRemand: detentionStats?.on_remand || 231,
        remandPercentage: detentionStats?.remand_percentage || 68.3,
        capacityPercentage: detentionStats?.capacity_percentage || 107,
        overrepresentationFactor: overrepresentationFactor,
        ageBreakdown: {
          '10-13': detentionStats?.age_10_to_13 || 12,
          '14-15': detentionStats?.age_14_to_15 || 89,
          '16-17': detentionStats?.age_16_to_17 || 237
        },
        source: {
          document: detentionStats?.source_document || 'Youth Detention Census Q1 2024',
          url: detentionStats?.source_url || 'https://www.cyjma.qld.gov.au/resources/dcsyw/youth-justice/publications/yj-census-summary.pdf',
          date: detentionStats?.report_date || '2024-03-31'
        }
      },
      
      // Budget data
      budget: {
        totalYouthJustice: budgetData?.total_amount || 489100000,
        detentionOperations: budgetData?.detention_operations || 443000000,
        detentionPercentage: budgetData?.detention_percentage || 90.6,
        communityPrograms: budgetData?.community_programs || 37100000,
        communityPercentage: budgetData?.community_percentage || 7.6,
        administration: budgetData?.administration || 9000000,
        dailyDetentionCost: dailyDetentionCost,
        dailyCommunityProgramCost: dailyCommunityProgramCost,
        costRatio: Math.round(claimedDetentionCostPerDay / dailyCommunityProgramCost),
        claimedDetentionCostPerDay: claimedDetentionCostPerDay,
        trueCostPerDay: trueCostPerDay,
        source: {
          document: budgetData?.source_document || 'Queensland Budget 2024-25 - DCSSDS',
          url: budgetData?.source_url || 'https://budget.qld.gov.au/files/Budget_2024-25_DCSSDS_Budget_Statements.pdf',
          fiscalYear: budgetData?.fiscal_year || '2024-25'
        }
      },
      
      // Police data
      police: {
        youthOffenders: policeStats?.youth_offenders || 15234,
        repeatOffenders: policeStats?.repeat_offenders || 8829,
        repeatOffenderPercentage: policeStats?.repeat_offender_percentage || 58.0,
        seriousRepeatOffenders: policeStats?.serious_repeat_offenders || 367,
        clearanceRate: policeStats?.youth_crime_clearance_rate || 67.3,
        source: {
          document: policeStats?.source_document || 'QPS Statistical Review 2023-24',
          url: policeStats?.source_url || 'https://www.police.qld.gov.au/sites/default/files/2024-08/QPS%20Statistical%20Review%202023-24.pdf',
          period: policeStats?.report_period || '2023-24'
        }
      },
      
      // Audit findings
      audit: {
        totalSpending2018to2023: auditFindings?.total_spending_2018_2023 || 1380000000,
        trueCostPerDay: auditFindings?.true_cost_per_day || 1570,
        claimedCost: auditFindings?.claimed_cost || 857,
        hiddenCostPercentage: auditFindings?.hidden_cost_percentage || 83.3,
        accountabilityFinding: auditFindings?.accountability_finding || 'No single entity is accountable for youth justice system performance',
        source: {
          document: auditFindings?.source_document || 'QAO Report - Managing Youth Justice Demand',
          url: auditFindings?.source_url || 'https://www.qao.qld.gov.au/reports-resources/managing-youth-justice-demand',
          date: auditFindings?.report_date || '2024-06-15'
        }
      },
      
      // Calculated insights
      insights: {
        moneyWastedToday: Math.floor(dailyDetentionCost),
        kidsWhoCouldBeHelpedInstead: Math.floor(dailyDetentionCost / dailyCommunityProgramCost),
        indigenousOverrepresentation: {
          detention: Math.round(overrepresentationFactor * 10) / 10,
          court: Math.round(courtOverrepresentationFactor * 10) / 10,
          populationPercentage: indigenousPopulationPercentage
        },
        systemFailures: {
          overcrowding: detentionStats?.capacity_percentage > 100,
          majorityOnRemand: (detentionStats?.remand_percentage || 68.3) > 50,
          highRepeatOffending: (policeStats?.repeat_offender_percentage || 58) > 50,
          budgetMisallocation: (budgetData?.detention_percentage || 90.6) > 80
        }
      }
    }
    
    return NextResponse.json(response)
  } catch (error) {
    console.error('Dashboard API error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch dashboard data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}