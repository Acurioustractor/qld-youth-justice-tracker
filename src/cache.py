"""
Caching module for Queensland Youth Justice Tracker
Provides multiple caching strategies for different data types
"""

import time
import json
import hashlib
from typing import Any, Optional, Dict, Callable
from functools import wraps
from datetime import datetime, timedelta
from loguru import logger


class MemoryCache:
    """Simple in-memory cache with TTL support."""
    
    def __init__(self, default_ttl: int = 300):  # 5 minutes default
        self.cache: Dict[str, Dict[str, Any]] = {}
        self.default_ttl = default_ttl
    
    def get(self, key: str) -> Optional[Any]:
        """Get value from cache."""
        if key not in self.cache:
            return None
        
        entry = self.cache[key]
        if time.time() > entry['expires']:
            del self.cache[key]
            return None
        
        entry['hits'] += 1
        entry['last_accessed'] = time.time()
        return entry['value']
    
    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Set value in cache."""
        ttl = ttl or self.default_ttl
        self.cache[key] = {
            'value': value,
            'expires': time.time() + ttl,
            'created': time.time(),
            'last_accessed': time.time(),
            'hits': 0
        }
    
    def delete(self, key: str) -> bool:
        """Delete key from cache."""
        if key in self.cache:
            del self.cache[key]
            return True
        return False
    
    def clear(self) -> None:
        """Clear all cache entries."""
        self.cache.clear()
    
    def cleanup_expired(self) -> int:
        """Remove expired entries and return count."""
        current_time = time.time()
        expired_keys = [
            key for key, entry in self.cache.items()
            if current_time > entry['expires']
        ]
        
        for key in expired_keys:
            del self.cache[key]
        
        return len(expired_keys)
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        current_time = time.time()
        total_entries = len(self.cache)
        expired_entries = sum(
            1 for entry in self.cache.values()
            if current_time > entry['expires']
        )
        
        total_hits = sum(entry['hits'] for entry in self.cache.values())
        
        return {
            'total_entries': total_entries,
            'active_entries': total_entries - expired_entries,
            'expired_entries': expired_entries,
            'total_hits': total_hits,
            'memory_usage_estimate': sum(
                len(str(entry['value'])) for entry in self.cache.values()
            )
        }


class CacheManager:
    """Main cache manager with different strategies for different data types."""
    
    def __init__(self):
        # Different cache instances for different data types
        self.dashboard_cache = MemoryCache(ttl=60)  # 1 minute for dashboard data
        self.api_cache = MemoryCache(ttl=300)  # 5 minutes for API responses
        self.expensive_cache = MemoryCache(ttl=3600)  # 1 hour for expensive calculations
        self.static_cache = MemoryCache(ttl=86400)  # 24 hours for static data
        
        self.last_cleanup = time.time()
        self.cleanup_interval = 300  # Cleanup every 5 minutes
    
    def _maybe_cleanup(self):
        """Perform cleanup if needed."""
        if time.time() - self.last_cleanup > self.cleanup_interval:
            self._cleanup_all()
            self.last_cleanup = time.time()
    
    def _cleanup_all(self):
        """Clean up all cache instances."""
        total_cleaned = 0
        for cache_name, cache in [
            ('dashboard', self.dashboard_cache),
            ('api', self.api_cache),
            ('expensive', self.expensive_cache),
            ('static', self.static_cache)
        ]:
            cleaned = cache.cleanup_expired()
            total_cleaned += cleaned
            if cleaned > 0:
                logger.debug(f"Cleaned {cleaned} expired entries from {cache_name} cache")
        
        if total_cleaned > 0:
            logger.info(f"Cache cleanup: removed {total_cleaned} expired entries")
    
    def get_dashboard_data(self, key: str) -> Optional[Any]:
        """Get dashboard data from cache."""
        self._maybe_cleanup()
        return self.dashboard_cache.get(key)
    
    def set_dashboard_data(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Set dashboard data in cache."""
        self.dashboard_cache.set(key, value, ttl)
    
    def get_api_response(self, key: str) -> Optional[Any]:
        """Get API response from cache."""
        self._maybe_cleanup()
        return self.api_cache.get(key)
    
    def set_api_response(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Set API response in cache."""
        self.api_cache.set(key, value, ttl)
    
    def get_expensive_calculation(self, key: str) -> Optional[Any]:
        """Get expensive calculation result from cache."""
        return self.expensive_cache.get(key)
    
    def set_expensive_calculation(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Set expensive calculation result in cache."""
        self.expensive_cache.set(key, value, ttl)
    
    def get_static_data(self, key: str) -> Optional[Any]:
        """Get static data from cache."""
        return self.static_cache.get(key)
    
    def set_static_data(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Set static data in cache."""
        self.static_cache.set(key, value, ttl)
    
    def invalidate_dashboard(self) -> None:
        """Invalidate all dashboard cache."""
        self.dashboard_cache.clear()
        logger.info("Dashboard cache invalidated")
    
    def invalidate_all(self) -> None:
        """Invalidate all caches."""
        self.dashboard_cache.clear()
        self.api_cache.clear()
        self.expensive_cache.clear()
        self.static_cache.clear()
        logger.info("All caches invalidated")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get comprehensive cache statistics."""
        return {
            'dashboard': self.dashboard_cache.get_stats(),
            'api': self.api_cache.get_stats(),
            'expensive': self.expensive_cache.get_stats(),
            'static': self.static_cache.get_stats(),
            'last_cleanup': datetime.fromtimestamp(self.last_cleanup).isoformat()
        }


def cache_key(*args, **kwargs) -> str:
    """Generate a cache key from arguments."""
    # Create a string representation of all arguments
    key_data = str(args) + str(sorted(kwargs.items()))
    
    # Hash it to create a fixed-length key
    return hashlib.md5(key_data.encode()).hexdigest()


def cached_api_response(cache_manager: CacheManager, ttl: Optional[int] = None):
    """Decorator for caching API responses."""
    def decorator(func: Callable):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Generate cache key
            key = f"{func.__name__}:{cache_key(*args, **kwargs)}"
            
            # Try to get from cache
            cached_result = cache_manager.get_api_response(key)
            if cached_result is not None:
                logger.debug(f"Cache hit for {func.__name__}")
                return cached_result
            
            # Cache miss - execute function
            logger.debug(f"Cache miss for {func.__name__}")
            result = func(*args, **kwargs)
            
            # Store in cache
            cache_manager.set_api_response(key, result, ttl)
            
            return result
        return wrapper
    return decorator


def cached_expensive_calculation(cache_manager: CacheManager, ttl: Optional[int] = None):
    """Decorator for caching expensive calculations."""
    def decorator(func: Callable):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Generate cache key
            key = f"{func.__name__}:{cache_key(*args, **kwargs)}"
            
            # Try to get from cache
            cached_result = cache_manager.get_expensive_calculation(key)
            if cached_result is not None:
                logger.debug(f"Expensive calculation cache hit for {func.__name__}")
                return cached_result
            
            # Cache miss - execute function
            logger.debug(f"Expensive calculation cache miss for {func.__name__}")
            start_time = time.time()
            result = func(*args, **kwargs)
            execution_time = time.time() - start_time
            
            if execution_time > 0.1:  # Only cache if execution took more than 100ms
                cache_manager.set_expensive_calculation(key, result, ttl)
                logger.debug(f"Cached expensive calculation {func.__name__} (took {execution_time:.2f}s)")
            
            return result
        return wrapper
    return decorator


# Global cache manager instance
cache_manager = CacheManager()


def get_cache_manager() -> CacheManager:
    """Get the global cache manager instance."""
    return cache_manager


def invalidate_cache_on_data_update():
    """Invalidate relevant caches when data is updated."""
    cache_manager.invalidate_dashboard()
    logger.info("Cache invalidated due to data update")