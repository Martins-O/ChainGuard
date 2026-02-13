from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, DuplicateKeyError
from datetime import datetime, timezone
import os
from typing import Optional, Dict, Any

DATABASE_URL = os.getenv("DATABASE_URL", "mongodb://chainguard:chainguard_password@localhost:27017/chainguard?authSource=admin")

class Database:
    def __init__(self):
        self.client = None
        self.db = None
    
    def connect(self):
        """Connect to MongoDB"""
        try:
            self.client = MongoClient(
                DATABASE_URL,
                serverSelectionTimeoutMS=5000
            )
            # Test connection
            self.client.admin.command('ping')
            self.db = self.client['chainguard']
            self._create_indexes()
            return True
        except ConnectionFailure:
            return False
    
    def _create_indexes(self):
        """Create indexes for threat_analyses collection"""
        try:
            collection = self.db['threat_analyses']
            collection.create_indexes([
                ('tx_hash', 1), {'unique': True},
                ('subnet_id', 1),
                ('threat_level', 1),
                ('final_score', 1),
                ('created_at', -1)
            ])
        except Exception as e:
            print(f"Error creating indexes: {e}")
    
    def close(self):
        """Close database connection"""
        if self.client:
            self.client.close()

class ThreatAnalysis:
    """MongoDB model for threat analyses"""
    
    @staticmethod
    def create(db: Database, analysis_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Create a new threat analysis"""
        try:
            collection = db.db['threat_analyses']
            
            document = {
                'tx_hash': analysis_data['tx_hash'],
                'subnet_id': analysis_data.get('subnet_id'),
                'signature_score': analysis_data.get('signature_score'),
                'anomaly_score': analysis_data.get('anomaly_score'),
                'behavioral_score': analysis_data.get('behavioral_score'),
                'final_score': analysis_data['final_score'],
                'threat_level': analysis_data['threat_level'],
                'explanation': analysis_data['explanation'],
                'raw_transaction': analysis_data.get('raw_transaction', {}),
                'created_at': datetime.now(timezone.utc),
                'updated_at': datetime.now(timezone.utc)
            }
            
            result = collection.insert_one(document)
            document['_id'] = result.inserted_id
            return ThreatAnalysis._format_document(document)
        except DuplicateKeyError:
            # Update existing if duplicate
            return ThreatAnalysis.update_by_tx_hash(db, analysis_data['tx_hash'], analysis_data)
        except Exception as e:
            print(f"Error creating threat analysis: {e}")
            return None
    
    @staticmethod
    def get_by_tx_hash(db: Database, tx_hash: str) -> Optional[Dict[str, Any]]:
        """Get threat analysis by transaction hash"""
        try:
            collection = db.db['threat_analyses']
            document = collection.find_one({'tx_hash': tx_hash})
            return ThreatAnalysis._format_document(document) if document else None
        except Exception as e:
            print(f"Error getting threat analysis: {e}")
            return None
    
    @staticmethod
    def update_by_tx_hash(db: Database, tx_hash: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update threat analysis by transaction hash"""
        try:
            collection = db.db['threat_analyses']
            update_doc = {
                '$set': {
                    **{k: v for k, v in updates.items() if k != 'tx_hash'},
                    'updated_at': datetime.now(timezone.utc)
                }
            }
            
            result = collection.find_one_and_update(
                {'tx_hash': tx_hash},
                update_doc,
                return_document=True
            )
            return ThreatAnalysis._format_document(result) if result else None
        except Exception as e:
            print(f"Error updating threat analysis: {e}")
            return None
    
    @staticmethod
    def _format_document(doc: Dict[str, Any]) -> Dict[str, Any]:
        """Format MongoDB document to match expected format"""
        if not doc:
            return None
        
        formatted = {
            'id': str(doc['_id']),
            'tx_hash': doc.get('tx_hash'),
            'subnet_id': str(doc['subnet_id']) if doc.get('subnet_id') else None,
            'signature_score': doc.get('signature_score'),
            'anomaly_score': doc.get('anomaly_score'),
            'behavioral_score': doc.get('behavioral_score'),
            'final_score': doc.get('final_score'),
            'threat_level': doc.get('threat_level'),
            'explanation': doc.get('explanation'),
            'raw_transaction': doc.get('raw_transaction', {}),
            'created_at': doc.get('created_at'),
            'updated_at': doc.get('updated_at')
        }
        return formatted

def get_db():
    """Get database connection (for compatibility)"""
    db = Database()
    if db.connect():
    try:
        yield db
    finally:
        db.close()
    else:
        raise ConnectionError("Failed to connect to MongoDB")

def init_db():
    """Initialize database (create indexes)"""
    db = Database()
    if db.connect():
        db._create_indexes()
        db.close()
