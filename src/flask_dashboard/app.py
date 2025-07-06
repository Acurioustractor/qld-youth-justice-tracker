from flask import Flask, render_template, jsonify
from flask_socketio import SocketIO, emit
from flask_cors import CORS
import json
from datetime import datetime, timedelta
import sys
import os
import logging
from sqlalchemy.exc import SQLAlchemyError

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from src.database import get_db, init_db, BudgetAllocation, YouthStatistics, CostComparison, ParliamentaryDocument
from src.analysis import CostAnalyzer, HiddenCostsCalculator
from src.config import get_config
from contextlib import contextmanager

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Load configuration
config = get_config()

# Apply Flask configuration
flask_config = config.get_flask_config()
app.config.update(flask_config)

# Generate secure secret key if not provided
if not app.config.get('SECRET_KEY'):
    import secrets
    app.config['SECRET_KEY'] = secrets.token_hex(32)
    logger.warning("No SECRET_KEY environment variable found. Generated temporary key. "
                  "Set SECRET_KEY environment variable for production use.")

app.config['DATABASE_URL'] = config.get_database_url()
CORS(app)

# Initialize SocketIO with proper configuration
socketio = SocketIO(
    app, 
    cors_allowed_origins="*",
    async_mode='threading',
    logger=True,
    engineio_logger=False
)

@contextmanager
def get_db_session():
    """Context manager for safe database operations."""
    db = None
    try:
        db = next(get_db())
        yield db
    except Exception as e:
        logger.error(f"Database session error: {e}")
        if db:
            try:
                db.rollback()
            except Exception as rollback_error:
                logger.error(f"Error during rollback: {rollback_error}")
        raise
    finally:
        if db is not None:
            try:
                db.close()
            except Exception as close_error:
                logger.warning(f"Error closing database session: {close_error}")

# Initialize analyzers
try:
    analyzer = CostAnalyzer()
    hidden_calc = HiddenCostsCalculator()
    logger.info("Analyzers initialized successfully")
except Exception as e:
    logger.error(f"Error initializing analyzers: {e}")
    analyzer = None
    hidden_calc = None

def get_dashboard_data():
    """Get all dashboard data with error handling."""
    try:
        with get_db_session() as db:
            # Get current spending split
            if analyzer:
                try:
                    spending_split = analyzer.calculate_spending_split()
                except Exception as e:
                    logger.warning(f"Error calculating spending split: {e}")
                    spending_split = {
                        'total_budget': 500_000_000,
                        'detention_total': 453_000_000,
                        'community_total': 47_000_000,
                        'detention_percentage': 90.6,
                        'community_percentage': 9.4
                    }
            else:
                spending_split = {
                    'total_budget': 500_000_000,
                    'detention_total': 453_000_000,
                    'community_total': 47_000_000,
                    'detention_percentage': 90.6,
                    'community_percentage': 9.4
                }
            
            # Get latest statistics
            latest_stats = db.query(YouthStatistics).order_by(
                YouthStatistics.date.desc()
            ).first()
            
            # Get Indigenous disparities
            if analyzer:
                try:
                    disparities = analyzer.analyze_indigenous_disparities()
                    # Ensure all required keys exist
                    if 'indigenous_percentage_detained' not in disparities:
                        disparities['indigenous_percentage_detained'] = 75.0
                    if 'indigenous_percentage_population' not in disparities:
                        disparities['indigenous_percentage_population'] = 4.5
                    if 'overrepresentation_factor' not in disparities:
                        disparities['overrepresentation_factor'] = 27.5
                except Exception as e:
                    logger.warning(f"Error analyzing disparities: {e}")
                    disparities = {
                        'indigenous_percentage_detained': 75.0,
                        'indigenous_percentage_population': 4.5,
                        'overrepresentation_factor': 27.5
                    }
            else:
                disparities = {
                    'indigenous_percentage_detained': 75.0,
                    'indigenous_percentage_population': 4.5,
                    'overrepresentation_factor': 27.5
                }
            
            # Count parliamentary documents
            doc_count = db.query(ParliamentaryDocument).filter(
                ParliamentaryDocument.mentions_youth_justice == True
            ).count()
            
            # Get recent documents
            recent_docs = db.query(ParliamentaryDocument).filter(
                ParliamentaryDocument.mentions_youth_justice == True
            ).order_by(ParliamentaryDocument.date.desc()).limit(5).all()
            
            # Calculate transparency score
            transparency_score = calculate_transparency_score()
            
            # Get cost comparisons over time
            comparisons = db.query(CostComparison).order_by(
                CostComparison.date.desc()
            ).limit(30).all()
            
            # Format data
            data = {
                'timestamp': datetime.now().isoformat(),
                'spending': {
                    'total_budget': spending_split['total_budget'] or 500_000_000,
                    'detention_total': spending_split['detention_total'] or 453_000_000,
                    'community_total': spending_split['community_total'] or 47_000_000,
                    'detention_percentage': spending_split['detention_percentage'] or 90.6,
                    'community_percentage': spending_split['community_percentage'] or 9.4,
                    'detention_daily_cost': 857,
                    'community_daily_cost': 41,
                    'cost_ratio': 20.9
                },
                'indigenous': {
                    'detention_percentage': disparities['indigenous_percentage_detained'],
                    'population_percentage': disparities['indigenous_percentage_population'],
                    'overrepresentation_factor': disparities['overrepresentation_factor'],
                    'min_factor': 22,
                    'max_factor': 33
                },
                'transparency': transparency_score,
                'documents': {
                    'total': doc_count,
                    'recent': [
                        {
                            'title': doc.title[:100],
                            'date': doc.date.strftime('%Y-%m-%d') if doc.date else 'Unknown',
                            'type': doc.document_type
                        }
                        for doc in recent_docs
                    ]
                },
                'trends': {
                    'dates': [c.date.strftime('%Y-%m-%d') for c in reversed(comparisons)] if comparisons else [],
                    'detention_percentages': [c.detention_spending_percentage for c in reversed(comparisons)] if comparisons else [],
                    'community_percentages': [c.community_spending_percentage for c in reversed(comparisons)] if comparisons else []
                }
            }
            
            return data
            
    except SQLAlchemyError as e:
        logger.error(f"Database error: {e}")
        return get_sample_data()
    except Exception as e:
        logger.error(f"Database connection or unexpected error: {e}")
        return get_sample_data()

def calculate_transparency_score():
    """Calculate government transparency score."""
    scores = {
        'budget_documents': {
            'weight': 25,
            'score': 70,  # PDFs available but not machine-readable
            'status': 'partial'
        },
        'real_time_data': {
            'weight': 25,
            'score': 10,  # No real-time data
            'status': 'poor'
        },
        'hidden_costs': {
            'weight': 25,
            'score': 0,   # Not tracked at all
            'status': 'none'
        },
        'outcome_data': {
            'weight': 25,
            'score': 40,  # Limited outcome reporting
            'status': 'limited'
        }
    }
    
    total_score = sum(cat['score'] * cat['weight'] / 100 for cat in scores.values())
    
    return {
        'overall_score': round(total_score),
        'grade': 'D' if total_score < 40 else 'C' if total_score < 60 else 'B' if total_score < 80 else 'A',
        'categories': scores
    }

@app.route('/')
def index():
    """Main dashboard page."""
    return render_template('index.html')

@app.route('/api/data')
def api_data():
    """Get dashboard data as JSON."""
    return jsonify(get_dashboard_data())

@app.route('/api/locations')
def api_locations():
    """Get list of available locations for hidden costs calculation."""
    if not hidden_calc:
        return jsonify({'error': 'Hidden costs calculator not available'}), 503
    
    try:
        if hasattr(hidden_calc, 'queensland_towns'):
            locations = list(hidden_calc.queensland_towns.keys())
            return jsonify({
                'locations': sorted(locations),
                'total_count': len(locations),
                'detention_centers': list(hidden_calc.detention_centers.keys()) if hasattr(hidden_calc, 'detention_centers') else []
            })
        else:
            return jsonify({'error': 'Location data not available'}), 503
    except Exception as e:
        logger.error(f"Error retrieving locations: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/config')
def api_config():
    """Get frontend-safe configuration values."""
    try:
        frontend_config = config.export_for_frontend()
        return jsonify(frontend_config)
    except Exception as e:
        logger.error(f"Error retrieving configuration: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/hidden-costs/<location>')
def api_hidden_costs(location):
    """Calculate hidden costs for a specific location."""
    # Input validation
    if not location or len(location.strip()) == 0:
        return jsonify({'error': 'Location parameter is required'}), 400
    
    # Sanitize location parameter
    location = location.strip()
    
    if not hidden_calc:
        return jsonify({'error': 'Hidden costs calculator not available'}), 503
    
    # Check if location is valid by checking against available locations
    if hasattr(hidden_calc, 'queensland_towns') and location not in hidden_calc.queensland_towns:
        available_locations = list(hidden_calc.queensland_towns.keys())[:10]  # Show first 10
        return jsonify({
            'error': f'Invalid location: {location}',
            'available_locations': available_locations,
            'note': 'Use exact location names from available list'
        }), 400
    
    try:
        calc = hidden_calc.calculate_total_family_burden(
            family_location=location,
            detention_center='Cleveland Youth Detention Centre',
            visits_per_month=2,
            calls_per_week=3,
            work_days_missed=2,
            private_lawyer=True
        )
        
        return jsonify({
            'location': location,
            'monthly_cost': calc['total_monthly_cost'],
            'annual_cost': calc['total_annual_cost'],
            'percentage_of_official': calc['family_cost_percentage'],
            'breakdown': calc['breakdown']
        })
    except ValueError as e:
        logger.warning(f"Invalid input for hidden costs calculation: {e}")
        return jsonify({'error': f'Invalid location or parameters: {str(e)}'}), 400
    except Exception as e:
        logger.error(f"Error calculating hidden costs: {e}")
        return jsonify({'error': 'Internal server error during calculation'}), 500

@socketio.on('connect')
def handle_connect():
    """Handle client connection."""
    emit('connected', {'data': 'Connected to Queensland Youth Justice Dashboard'})
    
    # Send initial data
    emit('data_update', get_dashboard_data())

@socketio.on('request_update')
def handle_update_request():
    """Handle request for data update."""
    emit('data_update', get_dashboard_data())

def emit_updates():
    """Emit updates to all connected clients."""
    socketio.emit('data_update', get_dashboard_data())

# Background task to emit updates every 30 seconds
def background_updates():
    """Send updates periodically."""
    while True:
        socketio.sleep(30)
        emit_updates()

def get_sample_data():
    """Return sample data when database is unavailable."""
    logger.info("Using sample data due to database unavailability")
    return {
        'timestamp': datetime.now().isoformat(),
        'spending': {
            'total_budget': 500_000_000,
            'detention_total': 453_000_000,
            'community_total': 47_000_000,
            'detention_percentage': 90.6,
            'community_percentage': 9.4,
            'detention_daily_cost': 857,
            'community_daily_cost': 41,
            'cost_ratio': 20.9
        },
        'indigenous': {
            'detention_percentage': 75.0,
            'population_percentage': 4.5,
            'overrepresentation_factor': 27.5,
            'min_factor': 22,
            'max_factor': 33
        },
        'transparency': {
            'overall_score': 30,
            'grade': 'D',
            'categories': {
                'budget_documents': {'weight': 25, 'score': 70, 'status': 'partial'},
                'real_time_data': {'weight': 25, 'score': 10, 'status': 'poor'},
                'hidden_costs': {'weight': 25, 'score': 0, 'status': 'none'},
                'outcome_data': {'weight': 25, 'score': 40, 'status': 'limited'}
            }
        },
        'documents': {
            'total': 0,
            'recent': []
        },
        'trends': {
            'dates': [],
            'detention_percentages': [],
            'community_percentages': []
        }
    }

def initialize_app():
    """Initialize the app."""
    try:
        init_db()
        logger.info("Database initialized")
    except Exception as e:
        logger.error(f"Error initializing database: {e}")

# Initialize app when module is imported
try:
    with app.app_context():
        initialize_app()
except Exception as e:
    logger.error(f"Error during app initialization: {e}")
    # Continue anyway - app can still run with sample data

# Only start background task if running directly
if __name__ == '__main__':
    # Start background task when running
    socketio.start_background_task(background_updates)
    socketio.run(app, debug=True, port=5000)