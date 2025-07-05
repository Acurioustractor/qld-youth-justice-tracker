import { BaseScraper, ScraperResult } from './base-scraper'
import { YouthJusticeScraper } from './youth-justice-scraper'
import { BudgetScraper } from './budget-scraper'
import { PoliceScraper } from './police-scraper'

export interface OrchestratorConfig {
  maxConcurrent: number
  retryFailedScrapers: boolean
  healthCheckInterval: number // minutes
  alertOnFailures: boolean
}

export interface OrchestratorResult {
  totalScrapers: number
  successful: number
  failed: number
  totalRecords: number
  duration: number
  results: Array<{
    scraper: string
    success: boolean
    records: number
    duration: number
    error?: string
  }>
}

export class ScraperOrchestrator {
  private scrapers: BaseScraper[]
  private config: OrchestratorConfig
  private isRunning = false

  constructor(config: Partial<OrchestratorConfig> = {}) {
    this.config = {
      maxConcurrent: 3,
      retryFailedScrapers: true,
      healthCheckInterval: 60, // 1 hour
      alertOnFailures: true,
      ...config
    }

    // Initialize all scrapers
    this.scrapers = [
      new YouthJusticeScraper(),
      new BudgetScraper(),
      new PoliceScraper()
    ]
  }

  /**
   * Run all scrapers with orchestration
   */
  async runAll(): Promise<OrchestratorResult> {
    if (this.isRunning) {
      throw new Error('Orchestrator is already running')
    }

    this.isRunning = true
    const startTime = Date.now()

    try {
      console.log('🚀 Starting Scraper Orchestration')
      console.log('================================')
      console.log(`Running ${this.scrapers.length} scrapers with max ${this.config.maxConcurrent} concurrent`)
      console.log('')

      const results: OrchestratorResult['results'] = []
      
      // Run scrapers in batches to respect concurrency limits
      const batches = this.createBatches(this.scrapers, this.config.maxConcurrent)
      
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i]
        console.log(`📦 Running batch ${i + 1}/${batches.length} (${batch.length} scrapers)`)
        
        const batchResults = await this.runBatch(batch)
        results.push(...batchResults)
        
        // Small delay between batches to be respectful
        if (i < batches.length - 1) {
          await this.sleep(2000) // 2 second delay
        }
      }

      // Retry failed scrapers if configured
      if (this.config.retryFailedScrapers) {
        const failedScrapers = results
          .filter(r => !r.success)
          .map(r => this.scrapers.find(s => s.constructor.name.toLowerCase().includes(r.scraper.split('_')[0])))
          .filter(Boolean) as BaseScraper[]

        if (failedScrapers.length > 0) {
          console.log(`\n🔄 Retrying ${failedScrapers.length} failed scrapers...`)
          const retryResults = await this.runBatch(failedScrapers)
          
          // Update original results with retry results
          retryResults.forEach(retryResult => {
            const originalIndex = results.findIndex(r => r.scraper === retryResult.scraper)
            if (originalIndex !== -1) {
              results[originalIndex] = retryResult
            }
          })
        }
      }

      // Calculate final statistics
      const successful = results.filter(r => r.success).length
      const failed = results.filter(r => !r.success).length
      const totalRecords = results.reduce((sum, r) => sum + r.records, 0)
      const duration = Date.now() - startTime

      // Create summary
      const summary: OrchestratorResult = {
        totalScrapers: this.scrapers.length,
        successful,
        failed,
        totalRecords,
        duration,
        results
      }

      // Log summary
      this.logSummary(summary)

      // Create alerts if there are failures
      if (this.config.alertOnFailures && failed > 0) {
        await this.createFailureAlert(summary)
      }

      return summary

    } finally {
      this.isRunning = false
    }
  }

  /**
   * Run a specific scraper by name
   */
  async runScraper(scraperName: string): Promise<ScraperResult> {
    const scraper = this.scrapers.find(s => 
      s.constructor.name.toLowerCase().includes(scraperName.toLowerCase()) ||
      scraperName.toLowerCase().includes(s.constructor.name.toLowerCase().replace('scraper', ''))
    )

    if (!scraper) {
      throw new Error(`Scraper not found: ${scraperName}. Available: ${this.getScraperNames().join(', ')}`)
    }

    console.log(`🎯 Running single scraper: ${scraper.constructor.name}`)
    return await scraper.run()
  }

  /**
   * Get health status of all scrapers
   */
  async getHealthStatus(): Promise<any[]> {
    // This would query the scraper_health table to get current status
    // For now, return basic scraper info
    return this.scrapers.map(scraper => ({
      name: scraper.constructor.name,
      dataSource: (scraper as any).config.dataSource,
      schedule: (scraper as any).config.schedule
    }))
  }

  /**
   * Get list of available scrapers
   */
  getScraperNames(): string[] {
    return this.scrapers.map(s => s.constructor.name)
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = []
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize))
    }
    return batches
  }

  private async runBatch(scrapers: BaseScraper[]): Promise<OrchestratorResult['results']> {
    const promises = scrapers.map(async (scraper) => {
      const scraperName = scraper.constructor.name
      console.log(`  🏃 Starting ${scraperName}...`)
      
      try {
        const result = await scraper.run()
        console.log(`  ✅ ${scraperName}: ${result.recordsInserted} records in ${result.duration}ms`)
        
        return {
          scraper: scraperName,
          success: result.success,
          records: result.recordsInserted,
          duration: result.duration
        }
      } catch (error) {
        console.log(`  ❌ ${scraperName} failed: ${error}`)
        
        return {
          scraper: scraperName,
          success: false,
          records: 0,
          duration: 0,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    })

    return await Promise.all(promises)
  }

  private logSummary(summary: OrchestratorResult): void {
    console.log('\n' + '='.repeat(50))
    console.log('🎉 SCRAPER ORCHESTRATION COMPLETE')
    console.log('='.repeat(50))
    console.log(`⏱️  Duration: ${(summary.duration / 1000).toFixed(1)}s`)
    console.log(`📊 Results: ${summary.successful}/${summary.totalScrapers} scrapers successful`)
    console.log(`📈 Records: ${summary.totalRecords} total records collected`)
    console.log('')
    
    if (summary.successful > 0) {
      console.log('✅ Successful scrapers:')
      summary.results
        .filter(r => r.success)
        .forEach(r => {
          console.log(`   ${r.scraper}: ${r.records} records (${r.duration}ms)`)
        })
    }

    if (summary.failed > 0) {
      console.log('\n❌ Failed scrapers:')
      summary.results
        .filter(r => !r.success)
        .forEach(r => {
          console.log(`   ${r.scraper}: ${r.error || 'Unknown error'}`)
        })
    }

    console.log('')
    console.log('📊 Next steps:')
    console.log('   - Check scraper health dashboard at /monitoring')
    console.log('   - Review alerts for any data quality issues')
    console.log('   - Visit main dashboard to see updated data')
    console.log('='.repeat(50))
  }

  private async createFailureAlert(summary: OrchestratorResult): Promise<void> {
    try {
      const failedScrapers = summary.results.filter(r => !r.success)
      
      // This would insert into scraper_alerts table
      console.log(`⚠️  Creating alert for ${failedScrapers.length} failed scrapers`)
      
      // In a real implementation, would insert alert into database
    } catch (error) {
      console.warn('Failed to create failure alert:', error)
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Export a singleton instance for easy use
export const scraperOrchestrator = new ScraperOrchestrator()