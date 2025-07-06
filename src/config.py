"""
Configuration management for Queensland Youth Justice Tracker
Centralizes all configuration values with environment variable support
"""

import os
from typing import Dict, Any, Optional
from dataclasses import dataclass
from loguru import logger


@dataclass
class DatabaseConfig:
    """Database configuration settings."""
    url: str = "sqlite:///data/youth_justice.db"
    pool_size: int = 5
    max_overflow: int = 10
    pool_timeout: int = 30
    echo: bool = False


@dataclass
class FlaskConfig:
    """Flask application configuration."""
    debug: bool = False
    testing: bool = False
    secret_key: Optional[str] = None
    host: str = "0.0.0.0"
    port: int = 5000


@dataclass
class ScrapingConfig:
    """Web scraping configuration."""
    timeout: int = 30
    max_retries: int = 3
    retry_delay: int = 5
    user_agent: str = "Queensland Youth Justice Tracker/1.0"
    max_concurrent_requests: int = 5
    pdf_cache_size: int = 10


@dataclass
class CostConfig:
    """Cost calculation configuration."""
    # Cost parameters - should be updated periodically
    fuel_cost_per_km: float = 0.15
    phone_cost_per_minute: float = 0.50
    average_daily_wage: float = 200.0
    
    # Official detention costs (from government sources)
    official_detention_cost_per_day: int = 857
    community_program_cost_per_day: int = 41
    
    # Hidden cost categories
    parking_cost_per_visit: int = 20
    tolls_per_trip: int = 10
    meals_per_person_per_visit: int = 30
    accommodation_per_night: int = 150
    
    # Legal costs
    private_lawyer_hourly: int = 350
    court_filing_fees: int = 200
    expert_witness_cost: int = 2000


@dataclass
class SecurityConfig:
    """Security-related configuration."""
    max_response_length: int = 10000
    min_participant_code_length: int = 2
    max_name_length: int = 255
    allowed_participant_code_pattern: str = r'^[a-zA-Z0-9_-]+$'
    
    # Rate limiting
    api_rate_limit: str = "100/hour"
    max_upload_size: int = 10 * 1024 * 1024  # 10MB


@dataclass
class UIConfig:
    """User interface configuration."""
    refresh_interval: int = 30000  # milliseconds
    chart_height: int = 300
    max_chart_points: int = 100
    default_currency: str = "AUD"
    date_format: str = "%Y-%m-%d"
    datetime_format: str = "%Y-%m-%d %H:%M:%S"


class Config:
    """Main configuration class that loads and manages all settings."""
    
    def __init__(self):
        self.database = DatabaseConfig()
        self.flask = FlaskConfig()
        self.scraping = ScrapingConfig()
        self.costs = CostConfig()
        self.security = SecurityConfig()
        self.ui = UIConfig()
        
        self._load_from_environment()
        self._validate_config()
    
    def _load_from_environment(self):
        """Load configuration from environment variables."""
        # Database configuration
        self.database.url = os.getenv('DATABASE_URL', self.database.url)
        self.database.pool_size = int(os.getenv('DB_POOL_SIZE', self.database.pool_size))
        self.database.echo = os.getenv('DB_ECHO', 'false').lower() == 'true'
        
        # Flask configuration
        self.flask.debug = os.getenv('FLASK_DEBUG', 'false').lower() == 'true'
        self.flask.testing = os.getenv('TESTING', 'false').lower() == 'true'
        self.flask.secret_key = os.getenv('SECRET_KEY')
        self.flask.host = os.getenv('FLASK_HOST', self.flask.host)
        self.flask.port = int(os.getenv('FLASK_PORT', self.flask.port))
        
        # Scraping configuration
        self.scraping.timeout = int(os.getenv('SCRAPING_TIMEOUT', self.scraping.timeout))
        self.scraping.max_retries = int(os.getenv('SCRAPING_MAX_RETRIES', self.scraping.max_retries))
        self.scraping.user_agent = os.getenv('USER_AGENT', self.scraping.user_agent)
        
        # Cost configuration (allow override for different regions/years)
        self.costs.fuel_cost_per_km = float(os.getenv('FUEL_COST_PER_KM', self.costs.fuel_cost_per_km))
        self.costs.phone_cost_per_minute = float(os.getenv('PHONE_COST_PER_MINUTE', self.costs.phone_cost_per_minute))
        self.costs.average_daily_wage = float(os.getenv('AVERAGE_DAILY_WAGE', self.costs.average_daily_wage))
        
        # Security configuration
        self.security.max_response_length = int(os.getenv('MAX_RESPONSE_LENGTH', self.security.max_response_length))
        self.security.api_rate_limit = os.getenv('API_RATE_LIMIT', self.security.api_rate_limit)
        
        # UI configuration
        self.ui.refresh_interval = int(os.getenv('UI_REFRESH_INTERVAL', self.ui.refresh_interval))
        self.ui.default_currency = os.getenv('DEFAULT_CURRENCY', self.ui.default_currency)
    
    def _validate_config(self):
        """Validate configuration values."""
        # Validate positive integers
        positive_int_fields = [
            (self.database.pool_size, 'Database pool size'),
            (self.flask.port, 'Flask port'),
            (self.scraping.timeout, 'Scraping timeout'),
            (self.scraping.max_retries, 'Max retries'),
            (self.costs.official_detention_cost_per_day, 'Detention cost per day'),
            (self.security.max_response_length, 'Max response length'),
            (self.ui.refresh_interval, 'UI refresh interval')
        ]
        
        for value, name in positive_int_fields:
            if not isinstance(value, int) or value <= 0:
                raise ValueError(f"{name} must be a positive integer, got {value}")
        
        # Validate positive floats
        positive_float_fields = [
            (self.costs.fuel_cost_per_km, 'Fuel cost per km'),
            (self.costs.phone_cost_per_minute, 'Phone cost per minute'),
            (self.costs.average_daily_wage, 'Average daily wage')
        ]
        
        for value, name in positive_float_fields:
            if not isinstance(value, (int, float)) or value <= 0:
                raise ValueError(f"{name} must be a positive number, got {value}")
        
        # Validate port range
        if not (1 <= self.flask.port <= 65535):
            raise ValueError(f"Flask port must be between 1 and 65535, got {self.flask.port}")
        
        logger.info("Configuration validation completed successfully")
    
    def get_database_url(self) -> str:
        """Get database connection URL."""
        return self.database.url
    
    def get_flask_config(self) -> Dict[str, Any]:
        """Get Flask configuration as dictionary."""
        return {
            'DEBUG': self.flask.debug,
            'TESTING': self.flask.testing,
            'SECRET_KEY': self.flask.secret_key,
        }
    
    def get_scraping_headers(self) -> Dict[str, str]:
        """Get HTTP headers for web scraping."""
        return {
            'User-Agent': self.scraping.user_agent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
        }
    
    def export_for_frontend(self) -> Dict[str, Any]:
        """Export safe configuration values for frontend use."""
        return {
            'ui': {
                'refreshInterval': self.ui.refresh_interval,
                'defaultCurrency': self.ui.default_currency,
                'dateFormat': self.ui.date_format,
                'chartHeight': self.ui.chart_height,
                'maxChartPoints': self.ui.max_chart_points
            },
            'costs': {
                'detentionCostPerDay': self.costs.official_detention_cost_per_day,
                'communityCostPerDay': self.costs.community_program_cost_per_day
            }
        }


# Global configuration instance
config = Config()


def get_config() -> Config:
    """Get the global configuration instance."""
    return config


def reload_config():
    """Reload configuration from environment variables."""
    global config
    config = Config()
    logger.info("Configuration reloaded")


# Backwards compatibility functions
def get_database_url() -> str:
    """Get database URL (backwards compatibility)."""
    return config.get_database_url()


def get_flask_config() -> Dict[str, Any]:
    """Get Flask configuration (backwards compatibility)."""
    return config.get_flask_config()