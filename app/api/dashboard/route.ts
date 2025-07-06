import { NextRequest, NextResponse } from 'next/server';
import { dashboardService } from '@/lib/features/dashboard/dashboardService';
import { handleDatabaseError } from '@/lib/supabase/errors';
import { queryTracker } from '@/lib/monitoring/performance';

export const dynamic = 'force-dynamic';

// Cache dashboard data for 5 minutes
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
let cachedData: any = null;
let cacheTimestamp: number = 0;

export async function GET(request: NextRequest) {
  try {
    // Check if we have cached data
    const now = Date.now();
    if (cachedData && (now - cacheTimestamp) < CACHE_DURATION) {
      return NextResponse.json({
        success: true,
        data: cachedData,
        cached: true,
        cacheAge: Math.round((now - cacheTimestamp) / 1000), // seconds
      });
    }

    // Track performance
    const metrics = await queryTracker.trackQuery(
      'dashboard_metrics',
      'multiple',
      async () => await dashboardService.getDashboardMetrics()
    );

    // Update cache
    cachedData = metrics;
    cacheTimestamp = now;

    return NextResponse.json({
      success: true,
      data: metrics,
      cached: false,
      performance: {
        queryTime: queryTracker.getStats(60000), // Last minute stats
      },
    });
  } catch (error) {
    const dbError = handleDatabaseError(error);
    return NextResponse.json({
      success: false,
      error: dbError.message,
    }, { status: dbError.statusCode });
  }
}

// Webhook endpoint for real-time updates
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate webhook secret (if configured)
    const webhookSecret = request.headers.get('x-webhook-secret');
    if (process.env.WEBHOOK_SECRET && webhookSecret !== process.env.WEBHOOK_SECRET) {
      return NextResponse.json({
        success: false,
        error: 'Invalid webhook secret',
      }, { status: 401 });
    }

    // Invalidate cache on data update
    cachedData = null;
    cacheTimestamp = 0;

    // You could also trigger notifications here
    console.log('Dashboard data updated:', body);

    return NextResponse.json({
      success: true,
      message: 'Cache invalidated',
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Invalid request',
    }, { status: 400 });
  }
}