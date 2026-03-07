"""
AI Threat Analyzer - Enhanced with Production ML Models

Combines three ML models for comprehensive threat detection:
1. Signature Detection DNN - Classifies known threat patterns
2. Anomaly Detection Ensemble - Detects unusual behavior
3. Behavioral LSTM - Analyzes transaction sequences

All models use the enhanced 26-feature extractor and MongoDB for persistence.
"""

import asyncio
import json
import logging
from typing import Dict, Any, Optional
import redis.asyncio as redis
from datetime import datetime
import os
import numpy as np

from app.schemas import TransactionInput, ThreatAnalysis, ThreatLevel, ModelScores
from app.database import get_database
from app.feature_extractor import TransactionFeatureExtractor
from app.models.signature_detection import SignatureDetectionDNN
from app.models.anomaly_detection import AnomalyDetectionEnsemble
from app.models.behavioral_sequence import BehavioralLSTM

logger = logging.getLogger(__name__)


class AIThreatAnalyzer:
    """Main AI analysis engine that combines multiple ML models"""

    def __init__(self):
        self.redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
        self.threat_threshold = float(os.getenv("THREAT_THRESHOLD", "70"))

        # Feature extractor (26 features)
        self.feature_extractor = TransactionFeatureExtractor()

        # Initialize new ML models
        self.signature_model = SignatureDetectionDNN(input_dim=26)
        self.anomaly_model = AnomalyDetectionEnsemble(input_dim=26)
        self.behavioral_model = BehavioralLSTM(feature_dim=26, sequence_length=7)

        # Database connection (use singleton)
        self.db = get_database()

        # Redis connection
        self.redis_client = None

        # Model weights for final score calculation
        self.model_weights = {
            'signature': 0.4,
            'anomaly': 0.3,
            'behavioral': 0.3
        }

        logger.info("AIThreatAnalyzer initialized with enhanced ML models")

    async def initialize(self):
        """Initialize the analyzer"""
        try:
            # Connect to Redis
            self.redis_client = redis.from_url(self.redis_url)
            await self.redis_client.ping()
            logger.info("Connected to Redis")

            # Note: MongoDB connection is handled by init_db() in main.py
            # The database singleton is already connected when this is called

            # Load trained models if available
            model_path = os.getenv("MODEL_PATH", "./models/v1")
            if os.path.exists(model_path):
                try:
                    logger.info(f"Loading models from {model_path}...")
                    self.signature_model.load(model_path)
                    self.anomaly_model.load(model_path)
                    self.behavioral_model.load(model_path)
                    logger.info("✓ All models loaded successfully")
                except Exception as e:
                    logger.warning(f"Could not load trained models: {e}")
                    logger.warning("Models will use fallback heuristics until trained")
            else:
                logger.warning(f"Model path {model_path} not found")
                logger.warning("Models will use fallback heuristics until trained")

            logger.info("AI Threat Analyzer initialized successfully")

        except Exception as e:
            logger.error(f"Failed to initialize AI Threat Analyzer: {e}")
            raise

    def _normalize_transaction_fields(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Normalize field names from Rust ingestion format to Python format"""
        field_mapping = {
            'tx_hash': 'hash',
            'from': 'from',
            'to': 'to',
            'value': 'value',
            'gas_limit': 'gas',
            'gas_price': 'gasPrice',
            'gas_used': 'gasUsed',
            'block_number': 'blockNumber',
            'transaction_index': 'transactionIndex',
            'chain_id': 'chainId',
            'timestamp': 'timestamp',
            'nonce': 'nonce',
            'raw': 'input',
            'status': 'status',
        }
        
        normalized = {}
        for key, value in data.items():
            new_key = field_mapping.get(key, key)
            normalized[new_key] = value
        
        # Convert chainId from hex to decimal if needed
        if 'chainId' in normalized and normalized['chainId']:
            chain_id = normalized['chainId']
            if isinstance(chain_id, str) and chain_id.startswith('0x'):
                try:
                    normalized['chainId'] = str(int(chain_id, 16))
                except:
                    pass
        
        return normalized

    async def analyze_transaction(self, transaction_data: Dict[str, Any]) -> ThreatAnalysis:
        """
        Analyze a single transaction using all ML models

        Args:
            transaction_data: Transaction dictionary with keys:
                hash, from, to, value, gas, gasLimit, gasPrice, input, logs, etc.

        Returns:
            ThreatAnalysis object with scores and threat level
        """
        try:
            tx_hash = transaction_data.get('hash', '')
            
            # Skip if no valid transaction hash
            if not tx_hash or tx_hash == 'null':
                logger.warning("Skipping transaction with no valid hash")
                return None
            
            logger.debug(f"Analyzing transaction {tx_hash}")

            # Extract features (26 features)
            features = self.feature_extractor.extract_features(transaction_data)

            # Run all three models
            signature_score = self.signature_model.predict(features)
            anomaly_score = self.anomaly_model.predict(features)

            # Behavioral model needs address context
            from_addr = transaction_data.get('from', '').lower()
            behavioral_score = self.behavioral_model.predict(from_addr, features)

            # Calculate final weighted score (0-100)
            final_score = (
                signature_score * self.model_weights['signature'] +
                anomaly_score * self.model_weights['anomaly'] +
                behavioral_score * self.model_weights['behavioral']
            ) * 100

            # Determine threat level
            threat_level = self._determine_threat_level(final_score)

            # Generate explanation
            explanation = self._generate_explanation(
                signature_score, anomaly_score, behavioral_score,
                transaction_data, final_score, features
            )

            # Create analysis result
            analysis = ThreatAnalysis(
                tx_hash=tx_hash,
                raw_transaction=transaction_data,
                model_scores=ModelScores(
                    signature_detection=signature_score * 100,
                    anomaly_detection=anomaly_score * 100,
                    behavioral_sequence=behavioral_score * 100
                ),
                final_score=final_score,
                threat_level=threat_level,
                explanation=explanation
            )

            # Save to MongoDB
            await self._save_analysis(analysis, features)
            
            # Save transaction to database
            chain_id = transaction_data.get('chainId', '')
            if chain_id:
                # Get subnet ID from chain_id
                subnet = await self.db.get_subnet_by_chain_id(chain_id)
                if subnet:
                    subnet_id = str(subnet.get('_id', ''))
                    await self.db.save_transaction(transaction_data, subnet_id)

            # Save features to feature store for retraining
            await self.db.save_features(
                tx_hash=tx_hash,
                features=features.tolist(),
                predicted_label='threat' if final_score >= self.threat_threshold else 'normal',
                model_version='v1'
            )

            # Trigger alert if score exceeds threshold
            if final_score >= self.threat_threshold:
                await self._trigger_alert(analysis)

            logger.info(
                f"Analyzed {tx_hash}: score={final_score:.1f}, level={threat_level.value}"
            )

            return analysis

        except Exception as e:
            logger.error(f"Error analyzing transaction {transaction_data.get('hash', 'unknown')}: {e}")
            raise

    async def process_transaction_queue(self):
        """Process transactions from Redis queue"""
        queue_name = "transactions"
        logger.info(f"Starting transaction queue processor (queue={queue_name})")

        while True:
            try:
                # Get transaction from queue (blocking with 5s timeout)
                result = await self.redis_client.blpop(queue_name, timeout=5)

                if result:
                    _, message = result
                    transaction_data = json.loads(message)
                    
                    # Normalize field names from Rust format to Python format
                    transaction_data = self._normalize_transaction_fields(transaction_data)

                    # Analyze transaction
                    analysis = await self.analyze_transaction(transaction_data)
                    
                    if analysis:
                        logger.info(
                            f"Processed {analysis.tx_hash}: "
                            f"Score={analysis.final_score:.1f}, "
                            f"Level={analysis.threat_level.value}"
                        )

            except Exception as e:
                logger.error(f"Error processing transaction queue: {e}")
                await asyncio.sleep(1)

    async def get_analysis_by_hash(self, tx_hash: str) -> Optional[Dict]:
        """
        Get existing analysis by transaction hash

        Args:
            tx_hash: Transaction hash

        Returns:
            Analysis dictionary or None if not found
        """
        try:
            analysis = await self.db.get_analysis_by_hash(tx_hash)
            return analysis

        except Exception as e:
            logger.error(f"Error getting analysis for {tx_hash}: {e}")
            return None

    def _determine_threat_level(self, score: float) -> ThreatLevel:
        """
        Determine threat level based on final score

        Args:
            score: Final threat score (0-100)

        Returns:
            ThreatLevel enum value
        """
        if score >= 90:
            return ThreatLevel.CRITICAL
        elif score >= 70:
            return ThreatLevel.HIGH
        elif score >= 40:
            return ThreatLevel.MEDIUM
        else:
            return ThreatLevel.LOW

    def _generate_explanation(
        self,
        signature_score: float,
        anomaly_score: float,
        behavioral_score: float,
        transaction: Dict[str, Any],
        final_score: float,
        features: np.ndarray
    ) -> str:
        """
        Generate human-readable explanation of threat analysis

        Args:
            signature_score: Signature detection score (0-1)
            anomaly_score: Anomaly detection score (0-1)
            behavioral_score: Behavioral sequence score (0-1)
            transaction: Transaction data
            final_score: Final threat score (0-100)
            features: Extracted feature vector

        Returns:
            Explanation string
        """
        explanations = []

        # Model-specific explanations
        if signature_score > 0.7:
            # Get predicted class from signature model
            predicted_class, confidence = self.signature_model.predict_class(features)
            if predicted_class != 'normal':
                explanations.append(
                    f"Signature detection: matches {predicted_class} pattern "
                    f"(confidence: {confidence:.1%})"
                )
            else:
                explanations.append("Signature detection: high threat probability detected")

        if anomaly_score > 0.6:
            # Get anomaly details
            details = self.anomaly_model.predict_with_details(features)
            explanations.append(
                f"Anomaly detection: unusual behavior detected "
                f"(IsolationForest: {details['iso_score']:.2f}, "
                f"Autoencoder: {details['ae_score']:.2f})"
            )

        if behavioral_score > 0.6:
            explanations.append(
                f"Behavioral analysis: unusual transaction sequence pattern "
                f"for this address"
            )

        # Feature-based explanations
        value = self.feature_extractor._parse_hex_int(transaction.get('value', '0x0'))
        if value > 10**18:  # > 1 token
            explanations.append(f"High value transfer: {value / 10**18:.2f} tokens")

        # Feature 8: is_flash_loan
        if features[8] > 0:
            explanations.append("Flash loan function detected")

        # Feature 9: log_count
        logs = transaction.get('logs', [])
        if len(logs) > 10:
            explanations.append(f"High event count: {len(logs)} logs emitted")

        # Feature 15: is_contract_creation
        if features[15] > 0:
            explanations.append("Contract deployment transaction")

        # Feature 17: is_new_address
        if features[17] > 0:
            explanations.append("Transaction from new address (< 5 previous transactions)")

        # Default explanation if nothing specific
        if not explanations:
            if final_score < 30:
                explanations.append("Transaction appears normal with low risk indicators")
            else:
                explanations.append("Transaction shows some unusual patterns but within acceptable range")

        return "; ".join(explanations)

    async def _save_analysis(self, analysis: ThreatAnalysis, features: np.ndarray):
        """
        Save analysis to MongoDB

        Args:
            analysis: ThreatAnalysis object
            features: Extracted feature vector
        """
        try:
            analysis_dict = {
                'txHash': analysis.tx_hash,
                'subnet': None,  # Would be populated by ingestion service
                'scores': {
                    'signature': analysis.model_scores.signature_detection,
                    'anomaly': analysis.model_scores.anomaly_detection,
                    'behavioral': analysis.model_scores.behavioral_sequence,
                    'final': analysis.final_score
                },
                'threatLevel': analysis.threat_level.value,
                'explanation': analysis.explanation,
                'rawTransaction': analysis.raw_transaction,
                'features': features.tolist(),
                'modelVersions': {
                    'signatureVersion': 'v1',
                    'anomalyVersion': 'v1',
                    'behavioralVersion': 'v1'
                }
            }

            await self.db.save_threat_analysis(analysis_dict)
            logger.debug(f"Saved analysis for {analysis.tx_hash} to MongoDB")

        except Exception as e:
            logger.error(f"Error saving analysis to MongoDB: {e}")

    async def _trigger_alert(self, analysis: ThreatAnalysis):
        """
        Trigger alert by publishing to alert queue

        Args:
            analysis: ThreatAnalysis object
        """
        try:
            alert_data = {
                "type": "threat_detected",
                "tx_hash": analysis.tx_hash,
                "score": analysis.final_score,
                "level": analysis.threat_level.value,
                "explanation": analysis.explanation,
                "timestamp": datetime.utcnow().isoformat(),
                "transaction": analysis.raw_transaction,
                "model_scores": {
                    "signature": analysis.model_scores.signature_detection,
                    "anomaly": analysis.model_scores.anomaly_detection,
                    "behavioral": analysis.model_scores.behavioral_sequence
                }
            }

            await self.redis_client.lpush("alerts", json.dumps(alert_data))
            logger.info(f"Alert triggered for transaction {analysis.tx_hash} (score: {analysis.final_score:.1f})")

        except Exception as e:
            logger.error(f"Error triggering alert: {e}")

    async def get_queue_length(self) -> int:
        """
        Get current transaction queue length

        Returns:
            Number of transactions in queue
        """
        try:
            return await self.redis_client.llen("transactions")
        except Exception as e:
            logger.error(f"Error getting queue length: {e}")
            return 0

    async def get_model_status(self) -> Dict[str, Any]:
        """
        Get status of all ML models

        Returns:
            Dictionary with model status information
        """
        return {
            'signature_model': {
                'is_trained': self.signature_model.is_trained,
                'input_dim': self.signature_model.input_dim,
                'threat_types': self.signature_model.threat_types
            },
            'anomaly_model': {
                'is_trained': self.anomaly_model.is_trained,
                'input_dim': self.anomaly_model.input_dim,
                'reconstruction_threshold': self.anomaly_model.reconstruction_threshold
            },
            'behavioral_model': {
                'is_trained': self.behavioral_model.is_trained,
                'feature_dim': self.behavioral_model.feature_dim,
                'sequence_length': self.behavioral_model.sequence_length,
                'addresses_tracked': self.behavioral_model.get_address_count()
            },
            'feature_extractor': {
                'feature_count': self.feature_extractor.get_feature_count(),
                'feature_names': self.feature_extractor.get_feature_names()
            }
        }
