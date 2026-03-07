"""
MongoDB Database Module for ChainGuard AI Engine
Replaces SQLAlchemy with Motor (async MongoDB driver)
"""
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import IndexModel, ASCENDING, DESCENDING
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
import os
import logging

logger = logging.getLogger(__name__)

from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# MongoDB connection URL
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://chainguard:chainguard_password@localhost:27017/chainguard")

__all__ = ['Database', 'get_database', 'init_db', 'close_db', 'get_db']

class Database:
    """MongoDB Database Manager"""

    def __init__(self):
        self.client: Optional[AsyncIOMotorClient] = None
        self.db = None

    async def connect(self):
        """Connect to MongoDB"""
        try:
            self.client = AsyncIOMotorClient(MONGODB_URL)
            self.db = self.client.chainguard

            # Test connection
            await self.db.command('ping')
            logger.info("Successfully connected to MongoDB")

            # Ensure indexes exist
            await self._ensure_indexes()

        except Exception as e:
            logger.error(f"Failed to connect to MongoDB: {e}")
            raise

    async def disconnect(self):
        """Disconnect from MongoDB"""
        if self.client:
            self.client.close()
            logger.info("Disconnected from MongoDB")

    def _check_connection(self):
        """Check if database is connected"""
        if self.db is None:
            raise RuntimeError(
                "Database not connected. Call await init_db() or await db.connect() first."
            )

    async def _ensure_indexes(self):
        """Ensure all necessary indexes exist"""
        try:
            # Threat analyses indexes
            await self.db.threat_analyses.create_indexes([
                IndexModel([('txHash', ASCENDING)], unique=True),
                IndexModel([('subnet.subnetId', ASCENDING), ('threatLevel', ASCENDING)]),
                IndexModel([('subnet.subnetId', ASCENDING), ('scores.final', DESCENDING)]),
                IndexModel([('createdAt', DESCENDING)])
            ])

            # Transactions indexes
            await self.db.transactions.create_indexes([
                IndexModel([('txHash', ASCENDING)], unique=True),
                IndexModel([('subnet.subnetId', ASCENDING)]),
                IndexModel([('fromAddress', ASCENDING)]),
                IndexModel([('toAddress', ASCENDING)]),
                IndexModel([('createdAt', DESCENDING)])
            ])
            
            # Subnets indexes
            await self.db.subnets.create_indexes([
                IndexModel([('chainId', ASCENDING)]),
                IndexModel([('isActive', ASCENDING)])
            ])

            # Feature store indexes (for ML retraining)
            await self.db.feature_store.create_indexes([
                IndexModel([('txHash', ASCENDING)]),
                IndexModel([('modelVersion', ASCENDING), ('humanVerified', ASCENDING)]),
                IndexModel([('capturedAt', DESCENDING)])
            ])

            logger.info("Database indexes verified")

        except Exception as e:
            logger.warning(f"Error creating indexes: {e}")

    async def save_threat_analysis(self, analysis_dict: Dict[str, Any]) -> str:
        """
        Save threat analysis to MongoDB

        Args:
            analysis_dict: Dictionary containing analysis data

        Returns:
            str: Inserted document ID
        """
        self._check_connection()

        try:
            # Add timestamps
            analysis_dict['createdAt'] = datetime.now(timezone.utc)
            analysis_dict['updatedAt'] = datetime.now(timezone.utc)

            result = await self.db.threat_analyses.insert_one(analysis_dict)
            logger.info(f"Saved threat analysis for tx: {analysis_dict.get('txHash')}")
            return str(result.inserted_id)

        except Exception as e:
            logger.error(f"Error saving threat analysis: {e}")
            raise

    async def save_transaction(self, tx_data: Dict[str, Any], subnet_id: str) -> str:
        """
        Save transaction to MongoDB

        Args:
            tx_data: Transaction data dictionary
            subnet_id: MongoDB ObjectId of the subnet

        Returns:
            str: Inserted document ID
        """
        self._check_connection()

        try:
            # Format transaction for storage
            tx_doc = {
                'txHash': tx_data.get('hash', ''),
                'fromAddress': tx_data.get('from', ''),
                'toAddress': tx_data.get('to', ''),
                'value': tx_data.get('value', '0'),
                'gasLimit': tx_data.get('gas', '0'),
                'gasPrice': tx_data.get('gasPrice', '0'),
                'input': tx_data.get('input', '0x'),
                'nonce': tx_data.get('nonce', 0),
                'chainId': tx_data.get('chainId', ''),
                'blockNumber': tx_data.get('blockNumber'),
                'status': tx_data.get('status', False),
                'subnet': {
                    'subnetId': subnet_id
                },
                'createdAt': datetime.now(timezone.utc)
            }

            result = await self.db.transactions.insert_one(tx_doc)
            logger.info(f"Saved transaction: {tx_doc.get('txHash')}")
            return str(result.inserted_id)

        except Exception as e:
            # Ignore duplicate key errors (transaction already exists)
            if 'duplicate key' in str(e).lower():
                logger.debug(f"Transaction already exists: {tx_data.get('hash')}")
                return None
            logger.error(f"Error saving transaction: {e}")
            raise

    async def get_subnet_by_chain_id(self, chain_id: str) -> Optional[Dict[str, Any]]:
        """
        Get subnet by chain ID

        Args:
            chain_id: The blockchain chain ID

        Returns:
            Dict or None: Subnet document
        """
        self._check_connection()

        try:
            subnet = await self.db.subnets.find_one({
                'chainId': chain_id,
                'isActive': True
            })
            return subnet

        except Exception as e:
            logger.error(f"Error getting subnet by chain ID: {e}")
            return None

    async def get_analysis_by_hash(self, tx_hash: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve threat analysis by transaction hash

        Args:
            tx_hash: Transaction hash

        Returns:
            Dict or None: Analysis document
        """
        try:
            analysis = await self.db.threat_analyses.find_one({'txHash': tx_hash})
            return analysis

        except Exception as e:
            logger.error(f"Error retrieving analysis for {tx_hash}: {e}")
            return None

    async def update_analysis(self, tx_hash: str, updates: Dict[str, Any]) -> bool:
        """
        Update threat analysis

        Args:
            tx_hash: Transaction hash
            updates: Fields to update

        Returns:
            bool: Success status
        """
        try:
            updates['updatedAt'] = datetime.now(timezone.utc)

            result = await self.db.threat_analyses.update_one(
                {'txHash': tx_hash},
                {'$set': updates}
            )

            return result.modified_count > 0

        except Exception as e:
            logger.error(f"Error updating analysis: {e}")
            return False

    async def save_features(
        self,
        tx_hash: str,
        features: List[float],
        predicted_label: str,
        model_version: str = 'v1'
    ) -> str:
        """
        Save extracted features to feature store for model retraining

        Args:
            tx_hash: Transaction hash
            features: Extracted feature vector
            predicted_label: Model prediction ('threat' or 'normal')
            model_version: Model version identifier

        Returns:
            str: Inserted document ID
        """
        self._check_connection()

        try:
            feature_doc = {
                'txHash': tx_hash,
                'features': features,
                'predictedLabel': predicted_label,
                'actualLabel': None,  # Will be updated when human verifies
                'humanVerified': False,
                'modelVersion': model_version,
                'capturedAt': datetime.now(timezone.utc)
            }

            result = await self.db.feature_store.insert_one(feature_doc)
            return str(result.inserted_id)

        except Exception as e:
            logger.error(f"Error saving features: {e}")
            raise

    async def update_feature_label(
        self,
        tx_hash: str,
        actual_label: str,
        human_verified: bool = True
    ) -> bool:
        """
        Update the actual label for a feature (human feedback)

        Args:
            tx_hash: Transaction hash
            actual_label: Verified label
            human_verified: Whether verified by human

        Returns:
            bool: Success status
        """
        try:
            result = await self.db.feature_store.update_one(
                {'txHash': tx_hash},
                {
                    '$set': {
                        'actualLabel': actual_label,
                        'humanVerified': human_verified,
                        'verifiedAt': datetime.now(timezone.utc)
                    }
                }
            )

            return result.modified_count > 0

        except Exception as e:
            logger.error(f"Error updating feature label: {e}")
            return False

    async def get_training_data(
        self,
        model_version: Optional[str] = None,
        human_verified_only: bool = False,
        limit: int = 10000
    ) -> List[Dict[str, Any]]:
        """
        Retrieve training data from feature store

        Args:
            model_version: Filter by model version
            human_verified_only: Only return human-verified samples
            limit: Maximum number of samples

        Returns:
            List of feature documents
        """
        try:
            query = {}

            if model_version:
                query['modelVersion'] = model_version

            if human_verified_only:
                query['humanVerified'] = True

            cursor = self.db.feature_store.find(query).limit(limit)
            training_data = await cursor.to_list(length=limit)

            logger.info(f"Retrieved {len(training_data)} training samples")
            return training_data

        except Exception as e:
            logger.error(f"Error retrieving training data: {e}")
            return []

    async def get_recent_analyses(
        self,
        subnet_id: Optional[str] = None,
        threat_level: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        Get recent threat analyses

        Args:
            subnet_id: Filter by subnet
            threat_level: Filter by threat level
            limit: Maximum number of results

        Returns:
            List of analysis documents
        """
        try:
            query = {}

            if subnet_id:
                query['subnet.subnetId'] = subnet_id

            if threat_level:
                query['threatLevel'] = threat_level

            cursor = self.db.threat_analyses.find(query)\
                .sort('createdAt', DESCENDING)\
                .limit(limit)

            analyses = await cursor.to_list(length=limit)
            return analyses

        except Exception as e:
            logger.error(f"Error retrieving analyses: {e}")
            return []

# Global database instance
_db_instance: Optional[Database] = None

def get_database() -> Database:
    """Get or create database instance"""
    global _db_instance
    if _db_instance is None:
        _db_instance = Database()
    return _db_instance

async def init_db():
    """Initialize database connection"""
    db = get_database()
    await db.connect()
    logger.info("Database initialized")

async def close_db():
    """Close database connection"""
    db = get_database()
    await db.disconnect()

# For backward compatibility with old code using get_db()
def get_db():
    """Compatibility function - returns database instance"""
    return get_database()
