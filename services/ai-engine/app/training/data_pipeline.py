"""
Training Data Pipeline for ChainGuard AI Models

Collects and prepares training data from MongoDB:
- Fetches historical transactions with threat analyses
- Generates labels from existing analyses
- Creates synthetic normal samples if needed
- Prepares train/validation splits
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta
import numpy as np
import logging
import os
import sys
from typing import List, Dict, Any, Tuple

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from feature_extractor import TransactionFeatureExtractor

logger = logging.getLogger(__name__)


class TrainingDataPipeline:
    """Pipeline for collecting and preparing training data"""

    def __init__(self, mongodb_url: str = None):
        """
        Initialize the training data pipeline

        Args:
            mongodb_url: MongoDB connection URL
        """
        if mongodb_url is None:
            mongodb_url = os.getenv(
                'MONGODB_URL',
                'mongodb://chainguard:chainguard_password@localhost:27017/chainguard'
            )

        self.mongodb_url = mongodb_url
        self.client: AsyncIOMotorClient = None
        self.db = None
        self.feature_extractor = TransactionFeatureExtractor()

        logger.info("TrainingDataPipeline initialized")

    async def connect(self):
        """Connect to MongoDB"""
        self.client = AsyncIOMotorClient(self.mongodb_url)
        self.db = self.client.chainguard
        await self.client.admin.command('ping')
        logger.info("Connected to MongoDB")

    async def disconnect(self):
        """Disconnect from MongoDB"""
        if self.client:
            self.client.close()
            logger.info("Disconnected from MongoDB")

    async def collect_training_data(
        self,
        days_back: int = 30,
        min_samples: int = 1000
    ) -> List[Dict[str, Any]]:
        """
        Collect training data from ChainGuard MongoDB

        Args:
            days_back: Number of days of historical data to fetch
            min_samples: Minimum number of samples required

        Returns:
            List of samples with features and labels
        """
        logger.info(f"Collecting training data from last {days_back} days")

        cutoff_date = datetime.utcnow() - timedelta(days=days_back)

        # Fetch historical transactions
        transactions_cursor = self.db.transactions.find({
            'createdAt': {'$gte': cutoff_date}
        })

        transactions = await transactions_cursor.to_list(length=None)
        logger.info(f"Found {len(transactions)} transactions from last {days_back} days")

        # Join with threat analyses to get labels
        labeled_data = []

        for tx in transactions:
            # Get corresponding threat analysis
            analysis = await self.db.threat_analyses.find_one({'txHash': tx.get('txHash')})

            if analysis:
                # Convert transaction to feature format
                tx_for_features = self._format_transaction_for_features(tx)

                # Extract features
                features = self.feature_extractor.extract_features(tx_for_features)

                # Get label from analysis
                label = self._get_label(analysis)

                labeled_data.append({
                    'features': features,
                    'label': label,
                    'is_threat': label != 'normal',
                    'tx_hash': tx.get('txHash'),
                    'threat_level': analysis.get('threatLevel', 'UNKNOWN'),
                    'threat_score': analysis.get('scores', {}).get('final', 0.0)
                })

        logger.info(f"Collected {len(labeled_data)} labeled samples")

        # If insufficient data, use bootstrap approach
        if len(labeled_data) < min_samples:
            logger.warning(
                f"Insufficient labeled data ({len(labeled_data)} < {min_samples})"
            )
            logger.info("Using bootstrap approach with synthetic normal transactions")

            # Generate synthetic normal samples
            synthetic_samples = await self._generate_normal_samples(
                min_samples - len(labeled_data)
            )
            labeled_data.extend(synthetic_samples)
            logger.info(f"Generated {len(synthetic_samples)} synthetic samples")

        return labeled_data

    def _format_transaction_for_features(self, tx: Dict) -> Dict:
        """
        Convert MongoDB transaction to format expected by feature extractor

        Args:
            tx: MongoDB transaction document

        Returns:
            Formatted transaction dictionary
        """
        return {
            'hash': tx.get('txHash', ''),
            'from': tx.get('fromAddress', ''),
            'to': tx.get('toAddress'),
            'value': tx.get('value', '0x0'),
            'gas': tx.get('gasUsed', '0x0'),
            'gasLimit': tx.get('gasLimit', '0x0'),
            'gasPrice': tx.get('gasPrice', '0x0'),
            'input': tx.get('transactionData', {}).get('input', '0x'),
            'logs': tx.get('logs', []),
            'timestamp': tx.get('createdAt'),
            'blockNumber': tx.get('blockNumber', 0),
            'transactionIndex': tx.get('transactionIndex', 0),
            'status': tx.get('status', True)
        }

    def _get_label(self, analysis: Dict) -> str:
        """
        Convert threat analysis to label

        Args:
            analysis: Threat analysis document

        Returns:
            Label string ('threat' or 'normal')
        """
        # If marked as false positive, it's normal
        if analysis.get('falsePositive', False):
            return 'normal'

        threat_level = analysis.get('threatLevel', 'LOW')

        # CRITICAL and HIGH are threats, MEDIUM and LOW are normal
        if threat_level in ['CRITICAL', 'HIGH']:
            return 'threat'

        return 'normal'

    async def _generate_normal_samples(self, n_samples: int) -> List[Dict[str, Any]]:
        """
        Generate synthetic normal transaction samples

        Args:
            n_samples: Number of samples to generate

        Returns:
            List of synthetic samples
        """
        # Sample recent successful transactions (likely normal)
        normal_txs_cursor = self.db.transactions.find({
            'status': True
        }).limit(100)

        normal_txs = await normal_txs_cursor.to_list(length=100)

        if not normal_txs:
            logger.warning("No normal transactions found for bootstrapping")
            return []

        # Extract features and add gaussian noise
        samples = []
        for _ in range(n_samples):
            # Randomly select a base transaction
            base_tx = normal_txs[np.random.randint(0, len(normal_txs))]

            # Convert to feature format
            tx_for_features = self._format_transaction_for_features(base_tx)

            # Extract features
            features = self.feature_extractor.extract_features(tx_for_features)

            # Add small noise to features (but keep them non-negative)
            noise = np.random.normal(0, 0.1, size=features.shape)
            features_noisy = np.abs(features + noise * features)

            samples.append({
                'features': features_noisy,
                'label': 'normal',
                'is_threat': False,
                'tx_hash': f"synthetic_{_}",
                'threat_level': 'NONE',
                'threat_score': 0.0
            })

        return samples

    async def create_train_val_split(
        self,
        test_size: float = 0.2,
        days_back: int = 30
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
        """
        Create stratified train/validation split

        Args:
            test_size: Proportion of data for validation
            days_back: Number of days of historical data to use

        Returns:
            Tuple of (X_train, X_val, y_train, y_val)
        """
        from sklearn.model_selection import train_test_split

        # Collect data
        data = await self.collect_training_data(days_back=days_back)

        if not data:
            raise ValueError("No training data available")

        # Extract features and labels
        X = np.array([d['features'] for d in data])
        y = np.array([1 if d['is_threat'] else 0 for d in data])

        # Check class distribution
        n_threats = np.sum(y)
        n_normal = len(y) - n_threats
        logger.info(f"Total samples: {len(y)} ({n_threats} threats, {n_normal} normal)")

        # Stratified split
        try:
            X_train, X_val, y_train, y_val = train_test_split(
                X, y,
                test_size=test_size,
                stratify=y,
                random_state=42
            )
        except ValueError:
            # If stratification fails (not enough samples in one class), do random split
            logger.warning("Stratified split failed, using random split")
            X_train, X_val, y_train, y_val = train_test_split(
                X, y,
                test_size=test_size,
                random_state=42
            )

        logger.info(f"Train samples: {len(X_train)} ({np.sum(y_train)} threats)")
        logger.info(f"Val samples: {len(X_val)} ({np.sum(y_val)} threats)")

        return X_train, X_val, y_train, y_val

    async def create_sequence_data(
        self,
        sequence_length: int = 7,
        days_back: int = 30
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
        """
        Create sequential training data for LSTM

        Args:
            sequence_length: Length of sequences
            days_back: Number of days of historical data

        Returns:
            Tuple of (X_train_seq, X_val_seq, y_train, y_val)
        """
        # First get regular split
        X_train, X_val, y_train, y_val = await self.create_train_val_split(
            test_size=0.2,
            days_back=days_back
        )

        # Convert to sequences (simplified: just repeat single transactions)
        # In production, would group by address and create real sequences
        X_train_seq = np.repeat(X_train[:, np.newaxis, :], sequence_length, axis=1)
        X_val_seq = np.repeat(X_val[:, np.newaxis, :], sequence_length, axis=1)

        logger.info(f"Created sequence data: train={X_train_seq.shape}, val={X_val_seq.shape}")

        return X_train_seq, X_val_seq, y_train, y_val


async def main():
    """Test the data pipeline"""
    logging.basicConfig(level=logging.INFO)

    pipeline = TrainingDataPipeline()

    try:
        await pipeline.connect()

        # Test data collection
        data = await pipeline.collect_training_data(days_back=7, min_samples=100)
        logger.info(f"Collected {len(data)} samples")

        # Test train/val split
        X_train, X_val, y_train, y_val = await pipeline.create_train_val_split(
            test_size=0.2,
            days_back=7
        )

        logger.info("Data pipeline test completed successfully")

    except Exception as e:
        logger.error(f"Error in data pipeline: {e}", exc_info=True)

    finally:
        await pipeline.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
