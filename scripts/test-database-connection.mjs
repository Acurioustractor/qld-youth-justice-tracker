#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env.local') })

console.log('🔍 Database Connection Test')
console.log('============================')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

console.log('\n📋 Environment Check:')
console.log(`   Supabase URL: ${supabaseUrl ? '✅ Set' : '❌ Missing'}`)
console.log(`   Anon Key: ${supabaseAnonKey ? '✅ Set' : '❌ Missing'}`)
console.log(`   Service Key: ${supabaseServiceKey ? '✅ Set' : '❌ Missing'}`)

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('\n❌ Missing required environment variables!')
  process.exit(1)
}

// Test with service key (what scrapers should use)
const supabaseService = createClient(supabaseUrl, supabaseServiceKey)

async function testConnection() {
  console.log('\n🔌 Testing Database Connection...')
  
  try {
    // Test basic connection
    const { data, error } = await supabaseService
      .from('budget_allocations')
      .select('count', { count: 'exact', head: true })
    
    if (error) {
      console.error(`❌ Connection failed: ${error.message}`)
      console.error(`   Code: ${error.code}`)
      console.error(`   Details: ${error.details}`)
      console.error(`   Hint: ${error.hint}`)
      return false
    }
    
    console.log('✅ Connection successful!')
    console.log(`   Found ${data} records in budget_allocations`)
    return true
    
  } catch (error) {
    console.error(`❌ Connection error: ${error.message}`)
    return false
  }
}

async function testAllTables() {
  console.log('\n📊 Testing All Tables...')
  
  const tables = [
    'court_statistics', 'court_sentencing', 'youth_crimes', 'youth_crime_patterns',
    'rti_requests', 'youth_statistics', 'budget_allocations', 'parliamentary_documents',
    'scraped_content', 'scraper_health'
  ]
  
  const results = {}
  
  for (const table of tables) {
    try {
      const { count, error } = await supabaseService
        .from(table)
        .select('*', { count: 'exact', head: true })
      
      if (error) {
        results[table] = { status: 'ERROR', error: error.message, count: 0 }
      } else {
        results[table] = { status: 'OK', count: count || 0 }
      }
    } catch (error) {
      results[table] = { status: 'MISSING', error: error.message, count: 0 }
    }
  }
  
  console.log('\n📋 Table Status:')
  Object.entries(results).forEach(([table, result]) => {
    const icon = result.status === 'OK' ? '✅' : '❌'
    console.log(`   ${icon} ${table}: ${result.status} (${result.count} records)`)
    if (result.error) {
      console.log(`      ${result.error}`)
    }
  })
  
  return results
}

async function testSimpleInsert() {
  console.log('\n💾 Testing Simple Insert...')
  
  try {
    // Try inserting a test record
    const { data, error } = await supabaseService
      .from('scraped_content')
      .insert([{
        type: 'connection_test',
        content: 'Database connection test record',
        source: 'test_script',
        source_url: 'localhost',
        data_type: 'test',
        scraped_at: new Date().toISOString()
      }])
      .select()
    
    if (error) {
      console.error(`❌ Insert failed:`, error)
      return false
    }
    
    console.log('✅ Insert successful!')
    console.log(`   Inserted record ID: ${data[0]?.id || 'Unknown'}`)
    
    // Clean up test record
    if (data[0]?.id) {
      await supabaseService
        .from('scraped_content')
        .delete()
        .eq('id', data[0].id)
      console.log('🧹 Cleaned up test record')
    }
    
    return true
    
  } catch (error) {
    console.error(`❌ Insert error: ${error.message}`)
    return false
  }
}

async function runFullTest() {
  console.log('🚀 Starting comprehensive database test...\n')
  
  const connectionOk = await testConnection()
  const tableResults = await testAllTables()
  const insertOk = await testSimpleInsert()
  
  console.log('\n📈 TEST SUMMARY')
  console.log('===============')
  
  const workingTables = Object.values(tableResults).filter(r => r.status === 'OK').length
  const totalTables = Object.keys(tableResults).length
  const totalRecords = Object.values(tableResults).reduce((sum, r) => sum + r.count, 0)
  
  console.log(`✅ Connection: ${connectionOk ? 'WORKING' : 'FAILED'}`)
  console.log(`📊 Tables: ${workingTables}/${totalTables} accessible`)
  console.log(`💾 Insert: ${insertOk ? 'WORKING' : 'FAILED'}`)
  console.log(`📝 Total Records: ${totalRecords}`)
  
  if (connectionOk && insertOk && workingTables > 0) {
    console.log('\n🎯 DIAGNOSIS: Database is working!')
    console.log('   The issue is likely in the scraper code, not the database connection.')
    console.log('   Scrapers should be able to insert data successfully.')
  } else {
    console.log('\n⚠️  DIAGNOSIS: Database issues found!')
    console.log('   Need to fix connection/permissions before scrapers will work.')
  }
  
  console.log('\n📋 NEXT STEPS:')
  if (connectionOk && insertOk) {
    console.log('   1. Update scraper error handling')
    console.log('   2. Fix scraper database insertion logic')
    console.log('   3. Test individual scrapers')
  } else {
    console.log('   1. Check .env.local file for correct keys')
    console.log('   2. Verify Supabase project permissions')
    console.log('   3. Check if service key has expired')
  }
}

runFullTest().catch(console.error)