import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

export interface ScraperConfig {
  name: string
  dataSource: string
  schedule?: string // cron expression
  timeout?: number // milliseconds
  retryAttempts?: number
  retryDelay?: number // milliseconds
  rateLimit?: {
    maxRequests: number
    perMilliseconds: number
  }
}

export interface ScraperResult {
  success: boolean
  recordsScraped: number
  recordsInserted: number
  errors: string[]
  warnings: string[]
  duration: number
  metadata?: Record<string, any>
}

export interface RetryPolicy {
  attempts: number
  delay: number
  backoffMultiplier?: number
  maxDelay?: number
}

export abstract class BaseScraper {
  protected supabase: SupabaseClient<Database>
  protected config: Required<ScraperConfig>
  protected startTime: number = 0
  protected errors: string[] = []
  protected warnings: string[] = []
  protected cache = new Map<string, { data: any; timestamp: number }>()
  protected cacheTimeout = 5 * 60 * 1000 // 5 minutes default
  
  constructor(config: ScraperConfig) {
    // Initialize Supabase client
    this.supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )
    
    // Set default config values
    this.config = {
      timeout: 30000, // 30 seconds
      retryAttempts: 3,
      retryDelay: 1000, // 1 second
      schedule: '0 */6 * * *', // Every 6 hours
      rateLimit: {
        maxRequests: 10,
        perMilliseconds: 1000
      },
      ...config
    }
  }

  /**
   * Main entry point for running the scraper
   */
  async run(): Promise<ScraperResult> {
    this.startTime = Date.now()
    this.errors = []
    this.warnings = []
    
    try {
      // Update scraper health - starting
      await this.updateHealth('running')
      
      // Run the actual scraping logic with retry
      const result = await this.runWithRetry()
      
      // Update scraper health - success
      await this.updateHealth('active', {
        success_count: result.recordsInserted,
        last_error: null
      })
      
      // Log the run
      await this.logRun(result)
      
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.errors.push(errorMessage)
      
      // Update scraper health - error
      await this.updateHealth('error', {
        last_error: errorMessage,
        consecutive_failures: 1 // Will be incremented by DB
      })
      
      const result: ScraperResult = {
        success: false,
        recordsScraped: 0,
        recordsInserted: 0,
        errors: this.errors,
        warnings: this.warnings,
        duration: Date.now() - this.startTime
      }
      
      await this.logRun(result)
      
      throw error
    }
  }

  /**
   * Abstract method that child classes must implement
   */
  protected abstract scrape(): Promise<ScraperResult>

  /**
   * Run scraper with retry logic
   */
  private async runWithRetry(): Promise<ScraperResult> {
    let lastError: Error | null = null
    
    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        console.log(`🔄 ${this.config.name}: Attempt ${attempt}/${this.config.retryAttempts}`)
        
        // Set timeout for this attempt
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Scraper timeout')), this.config.timeout)
        })
        
        // Race between scraper and timeout
        const result = await Promise.race([
          this.scrape(),
          timeoutPromise
        ])
        
        return result
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        console.error(`❌ ${this.config.name}: Attempt ${attempt} failed:`, lastError.message)
        
        if (attempt < this.config.retryAttempts) {
          const delay = this.calculateRetryDelay(attempt)
          console.log(`⏳ Waiting ${delay}ms before retry...`)
          await this.sleep(delay)
        }
      }
    }
    
    throw lastError || new Error('All retry attempts failed')
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attempt: number): number {
    const baseDelay = this.config.retryDelay
    const multiplier = 2 // Exponential backoff
    const maxDelay = 30000 // 30 seconds max
    
    const delay = Math.min(baseDelay * Math.pow(multiplier, attempt - 1), maxDelay)
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.3 * delay
    
    return Math.floor(delay + jitter)
  }

  /**
   * Update scraper health in database
   */
  protected async updateHealth(
    status: 'active' | 'running' | 'error' | 'warning',
    updates: Record<string, any> = {}
  ): Promise<void> {
    try {
      const now = new Date().toISOString()
      
      const healthData = {
        scraper_name: this.config.name,
        data_source: this.config.dataSource,
        status,
        last_run_at: now,
        updated_at: now,
        ...updates
      }
      
      // If success, update success fields
      if (status === 'active') {
        healthData.last_success_at = now
        healthData.consecutive_failures = 0
      }
      
      const { error } = await this.supabase
        .from('scraper_health')
        .upsert(healthData, { onConflict: 'scraper_name' })
      
      if (error) {
        console.warn(`Failed to update scraper health: ${error.message}`)
      }
    } catch (error) {
      console.warn('Error updating scraper health:', error)
    }
  }

  /**
   * Log scraper run to database
   */
  protected async logRun(result: ScraperResult): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('scraper_runs')
        .insert({
          scraper_name: this.config.name,
          status: result.success ? 'success' : 'failure',
          records_scraped: result.recordsScraped,
          records_inserted: result.recordsInserted,
          duration_seconds: Math.floor(result.duration / 1000),
          error_messages: result.errors.length > 0 ? result.errors : null,
          warnings: result.warnings.length > 0 ? result.warnings : null,
          metadata: result.metadata
        })
      
      if (error) {
        console.warn(`Failed to log scraper run: ${error.message}`)
      }
    } catch (error) {
      console.warn('Error logging scraper run:', error)
    }
  }

  /**
   * Check if data exists in cache
   */
  protected getCached<T>(key: string): T | null {
    const cached = this.cache.get(key)
    
    if (!cached) return null
    
    // Check if cache is expired
    if (Date.now() - cached.timestamp > this.cacheTimeout) {
      this.cache.delete(key)
      return null
    }
    
    return cached.data as T
  }

  /**
   * Store data in cache
   */
  protected setCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    })
  }

  /**
   * Sleep helper for delays
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Rate limiter for API calls
   */
  private lastRequestTime = 0
  protected async rateLimit(): Promise<void> {
    const now = Date.now()
    const timeSinceLastRequest = now - this.lastRequestTime
    const minInterval = this.config.rateLimit.perMilliseconds / this.config.rateLimit.maxRequests
    
    if (timeSinceLastRequest < minInterval) {
      await this.sleep(minInterval - timeSinceLastRequest)
    }
    
    this.lastRequestTime = Date.now()
  }

  /**
   * Validate scraped data before insertion
   */
  protected validateData<T extends Record<string, any>>(
    data: T[],
    requiredFields: (keyof T)[]
  ): T[] {
    const validData: T[] = []
    
    for (const record of data) {
      let isValid = true
      const missingFields: string[] = []
      
      for (const field of requiredFields) {
        if (record[field] === undefined || record[field] === null || record[field] === '') {
          missingFields.push(String(field))
          isValid = false
        }
      }
      
      if (isValid) {
        validData.push(record)
      } else {
        this.warnings.push(`Record missing required fields: ${missingFields.join(', ')}`)
      }
    }
    
    return validData
  }

  /**
   * Batch insert data with proper error handling
   */
  protected async batchInsert<T extends Record<string, any>>(
    table: string,
    data: T[],
    conflictColumns?: string | string[],
    batchSize: number = 100
  ): Promise<number> {
    let totalInserted = 0
    
    // Process in batches to avoid payload size limits
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize)
      
      try {
        let query = this.supabase.from(table).upsert(batch)
        
        if (conflictColumns) {
          query = query.onConflict(conflictColumns)
        }
        
        const { data: result, error } = await query.select()
        
        if (error) {
          this.errors.push(`Failed to insert batch into ${table}: ${error.message}`)
        } else {
          totalInserted += result?.length || 0
        }
      } catch (error) {
        this.errors.push(`Batch insert error: ${error}`)
      }
    }
    
    return totalInserted
  }

  /**
   * Get scraper statistics
   */
  async getStatistics(): Promise<{
    totalRuns: number
    successRate: number
    averageDuration: number
    lastRun: Date | null
  }> {
    const { data, error } = await this.supabase
      .from('scraper_runs')
      .select('*')
      .eq('scraper_name', this.config.name)
      .order('started_at', { ascending: false })
      .limit(100)
    
    if (error || !data || data.length === 0) {
      return {
        totalRuns: 0,
        successRate: 0,
        averageDuration: 0,
        lastRun: null
      }
    }
    
    const successfulRuns = data.filter(run => run.status === 'success').length
    const totalDuration = data.reduce((sum, run) => sum + (run.duration_seconds || 0), 0)
    
    return {
      totalRuns: data.length,
      successRate: (successfulRuns / data.length) * 100,
      averageDuration: totalDuration / data.length,
      lastRun: data[0].started_at ? new Date(data[0].started_at) : null
    }
  }
}