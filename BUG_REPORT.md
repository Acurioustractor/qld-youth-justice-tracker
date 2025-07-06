# Bug Report - Queensland Youth Justice Tracker

## Summary
This report identifies potential bugs, security issues, and code quality problems found during the codebase review.

## Critical Issues

### 1. Bare Exception Handling (High Priority)
**Files affected:**
- `src/analysis/hidden_costs_calculator.py:396`
- `src/scrapers/treasury_budget_scraper.py:391`
- `src/interviews/interview_manager.py:437, 500`
- `test_system.py:184, 191`

**Issue:** Bare `except:` clauses mask all exceptions, making debugging difficult and potentially hiding critical errors.

**Fix:** Replace with specific exception types:
```python
# Instead of:
except:
    pass

# Use:
except (ValueError, TypeError) as e:
    logger.error(f"Specific error: {e}")
```

### 2. Missing Error Handling in API Endpoints

**File:** `src/flask_dashboard/app.py`

**Issue:** The `/api/hidden-costs/<location>` endpoint (line 233) doesn't validate the location parameter, which could lead to runtime errors.

**Fix:** Add input validation:
```python
@app.route('/api/hidden-costs/<location>')
def api_hidden_costs(location):
    if not location or location not in valid_locations:
        return jsonify({'error': 'Invalid location'}), 400
```

### 3. Potential Race Condition in Database Operations

**File:** `src/flask_dashboard/app.py`

**Issue:** The `get_dashboard_data()` function creates database connections without proper connection pooling, potentially leading to race conditions or connection exhaustion.

**Fix:** Implement proper connection pooling and session management.

### 4. Insecure Secret Key

**File:** `src/flask_dashboard/app.py:22`

**Issue:** Default secret key is hardcoded and predictable.

**Fix:** Use environment variables with strong random defaults:
```python
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', os.urandom(24).hex())
```

## Medium Priority Issues

### 5. Inconsistent Error Handling in React Components

**File:** `components/UnifiedDashboard.tsx`

**Issue:** The component shows generic error messages without proper error boundaries or specific error handling.

**Fix:** Implement React error boundaries and specific error states.

### 6. Missing Null Checks in Data Processing

**File:** `hooks/useDashboardData.ts`

**Issue:** The `useMoneyCounter` hook doesn't handle null data gracefully (line 234).

**Fix:** Add null checks:
```typescript
if (!data || !data.budget || !data.budget.dailyDetentionCost) {
  return { moneyWasted: 0, kidsHelped: 0 }
}
```

### 7. Potential Memory Leak in PDF Processing

**File:** `src/scrapers/treasury_budget_scraper.py`

**Issue:** PDF files are cached in memory (line 47) but not properly cleaned up, potentially causing memory leaks.

**Fix:** Implement proper cleanup in finally blocks and use weak references.

### 8. Missing Input Validation in Interview Manager

**File:** `src/interviews/interview_manager.py`

**Issue:** The `conduct_interview` method doesn't validate input parameters, potentially allowing malicious data injection.

**Fix:** Add comprehensive input validation for all user inputs.

## Low Priority Issues

### 9. Hardcoded Configuration Values

**Files:** Multiple files contain hardcoded values that should be configurable

**Issue:** Values like detention costs, phone rates, and other constants are hardcoded throughout the codebase.

**Fix:** Move to a configuration file or environment variables.

### 10. Inconsistent Logging

**Issue:** Some modules use different logging approaches (print vs logger vs console.log).

**Fix:** Standardize on a single logging framework.

### 11. Missing TypeScript Strict Mode Configuration

**File:** `tsconfig.json`

**Issue:** While strict mode is enabled, some additional strict checks could be enabled for better type safety.

**Fix:** Consider adding:
```json
{
  "compilerOptions": {
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true
  }
}
```

### 12. Potential SQL Injection in Database Queries

**File:** `src/flask_dashboard/app.py`

**Issue:** While using SQLAlchemy ORM which protects against SQL injection, some raw text queries could be vulnerable.

**Fix:** Review all database queries and ensure parameterized queries are used.

## Performance Issues

### 13. Inefficient Database Queries

**File:** `src/flask_dashboard/app.py`

**Issue:** Multiple database queries are made sequentially instead of using joins or batch operations.

**Fix:** Optimize queries using proper joins and batch operations.

### 14. Missing Caching Strategy

**Issue:** API responses are not cached, leading to repeated expensive operations.

**Fix:** Implement Redis or in-memory caching for frequently accessed data.

### 15. Large Bundle Size

**Issue:** The Next.js bundle likely includes unused dependencies.

**Fix:** Run bundle analysis and remove unused imports.

## Security Issues

### 16. Missing CSRF Protection

**File:** `src/flask_dashboard/app.py`

**Issue:** Flask app doesn't implement CSRF protection for forms.

**Fix:** Add Flask-WTF CSRF protection.

### 17. Potential XSS Vulnerability

**File:** `app/layout.tsx`

**Issue:** The service worker registration uses `dangerouslySetInnerHTML` which could be vulnerable to XSS if user input is included.

**Fix:** Use safer alternatives or ensure all content is properly sanitized.

## Code Quality Issues

### 18. Inconsistent Code Style

**Issue:** Mixed indentation, inconsistent naming conventions, and formatting.

**Fix:** Implement ESLint/Prettier for JavaScript/TypeScript and Black for Python.

### 19. Missing Documentation

**Issue:** Many functions lack proper docstrings or type hints.

**Fix:** Add comprehensive documentation for all public APIs.

### 20. Unused Imports and Dead Code

**Issue:** Several files contain unused imports and unreachable code.

**Fix:** Use tools like `autoflake` for Python and ES6 lint rules for JavaScript.

## Testing Issues

### 21. Insufficient Test Coverage

**Issue:** No unit tests found for critical business logic.

**Fix:** Implement comprehensive test suite with pytest for Python and Jest for JavaScript.

### 22. Missing Integration Tests

**Issue:** No integration tests for API endpoints or database operations.

**Fix:** Add integration tests for all API endpoints.

## Recommendations

1. **Immediate Actions:**
   - Fix all bare except clauses
   - Add input validation to all API endpoints
   - Implement proper error handling in React components
   - Secure the Flask secret key

2. **Short-term:**
   - Add comprehensive logging
   - Implement caching strategy
   - Add CSRF protection
   - Create test suite

3. **Long-term:**
   - Implement proper monitoring and alerting
   - Add performance profiling
   - Consider migration to more robust database connection pooling
   - Implement comprehensive security audit

## Priority Matrix

| Issue | Impact | Effort | Priority |
|-------|--------|---------|----------|
| Bare exception handling | High | Low | Critical |
| Missing input validation | High | Medium | Critical |
| Insecure secret key | High | Low | Critical |
| Memory leaks | Medium | Medium | High |
| Missing tests | High | High | High |
| Code style | Low | Medium | Medium |

This bug report should be addressed systematically, starting with the critical issues and working down to the lower priority items.