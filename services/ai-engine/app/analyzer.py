import asyncio
import json
import logging
from typing import List, Dict, Any, Optional
import redis.asyncio as redis
from datetime import datetime
import os

from app.models import TransactionInput, ThreatAnalysis, ThreatLevel, ModelScores
from app.database import get_db, ThreatAnalysis as DBThreatAnalysis
from app.ml_models import SignatureDetectionModel, AnomalyDetectionModel, BehavioralSequenceModel

logger = logging.getLogger(__name__)

class AIThreatAnalyzer:
    """Main AI analysis engine that combines multiple models"""
    
    def __init__(self):
        self.redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
        self.threat_threshold = float(os.getenv("THREAT_THRESHOLD", "70"))
        
        # Initialize models
        self.signature_model = SignatureDetectionModel()
        self.anomaly_model = AnomalyDetectionModel()
        self.behavioral_model = BehavioralSequenceModel()
        
        # Redis connection
        self.redis_client = None
        
        # Model weights for final score calculation
        self.model_weights = {
            'signature': 0.4,
            'anomaly': 0.3,
            'behavioral': 0.3
        }
    
    async def initialize(self):
        """Initialize the analyzer"""
        try:
            # Connect to Redis
            self.redis_client = redis.from_url(self.redis_url)
            await self.redis_client.ping()
            logger.info("Connected to Redis")
            
            # Load models
            model_path = os.getenv("MODEL_PATH", "./models")
            self.signature_model.load_model(f"{model_path}/signature_model.pkl")
            
            # Train anomaly model with historical data if available
            await self._train_anomaly_model()
            
            logger.info("AI Threat Analyzer initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize AI Threat Analyzer: {e}")
            raise
    
    async def analyze_transaction(self, transaction_data: Dict[str, Any]) -> ThreatAnalysis:
        """Analyze a single transaction"""
        try:
            # Extract features and run models
            signature_score = self.signature_model.predict(transaction_data)
            anomaly_score = self.anomaly_model.predict(transaction_data)
            behavioral_score = self.behavioral_model.predict(transaction_data)
            
            # Update behavioral model with new transaction
            self.behavioral_model.update_sequence(transaction_data)
            
            # Calculate final weighted score
            final_score = (
                signature_score * self.model_weights['signature'] +
                anomaly_score * self.model_weights['anomaly'] +
                behavioral_score * self.model_weights['behavioral']
            ) * 100  # Convert to 0-100 scale
            
            # Determine threat level
            threat_level = self._determine_threat_level(final_score)
            
            # Generate explanation
            explanation = self._generate_explanation(
                signature_score, anomaly_score, behavioral_score, 
                transaction_data, final_score
            )
            
            # Create analysis result
            analysis = ThreatAnalysis(
                tx_hash=transaction_data.get('hash', ''),
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
            
            # Save to database
            await self._save_analysis(analysis)
            
            # Trigger alert if score exceeds threshold
            if final_score >= self.threat_threshold:
                await self._trigger_alert(analysis)
            
            return analysis
            
        except Exception as e:
            logger.error(f"Error analyzing transaction {transaction_data.get('hash', 'unknown')}: {e}")
            raise
    
    async def process_transaction_queue(self):
        """Process transactions from Redis queue"""
        queue_name = "transactions"
        
        while True:
            try:
                # Get transaction from queue
                _, message = await self.redis_client.blpop(queue_name, timeout=5)
                
                if message:
                    transaction_data = json.loads(message)
                    
                    # Analyze transaction
                    analysis = await self.analyze_transaction(transaction_data)
                    
                    logger.info(
                        f"Analyzed transaction {analysis.tx_hash}: "
                        f"Score={analysis.final_score:.1f}, "
                        f"Level={analysis.threat_level}"
                    )
                    
            except Exception as e:
                logger.error(f"Error processing transaction queue: {e}")
                await asyncio.sleep(1)
    
    async def get_analysis_by_hash(self, tx_hash: str) -> Optional[ThreatAnalysis]:
        """Get existing analysis by transaction hash"""
        try:
            db = next(get_db())
            analysis = db.query(DBThreatAnalysis).filter(
                DBThreatAnalysis.tx_hash == tx_hash
            ).first()
            
            if analysis:
                return ThreatAnalysis(
                    id=analysis.id,
                    tx_hash=analysis.tx_hash,
                    raw_transaction=analysis.raw_transaction,
                    model_scores=ModelScores(
                        signature_detection=analysis.signature_score,
                        anomaly_detection=analysis.anomaly_score,
                        behavioral_sequence=analysis.behavioral_score
                    ),
                    final_score=analysis.final_score,
                    threat_level=ThreatLevel(analysis.threat_level),
                    explanation=analysis.explanation,
                    created_at=analysis.created_at
                )
            return None
            
        except Exception as e:
            logger.error(f"Error getting analysis for {tx_hash}: {e}")
            return None
    
    def _determine_threat_level(self, score: float) -> ThreatLevel:
        """Determine threat level based on score"""
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
        final_score: float
    ) -> str:
        """Generate human-readable explanation"""
        explanations = []
        
        if signature_score > 0.7:
            explanations.append("Transaction matches known exploit patterns")
        
        if anomaly_score > 0.6:
            explanations.append("Transaction behavior is anomalous compared to historical patterns")
        
        if behavioral_score > 0.6:
            explanations.append("Unusual behavioral sequence detected")
        
        if not explanations:
            if final_score < 30:
                explanations.append("Transaction appears normal with low risk indicators")
            else:
                explanations.append("Transaction shows some unusual patterns but within acceptable range")
        
        # Add specific transaction characteristics
        value = int(transaction.get('value', '0'), 16)
        if value > 10**18:  # > 1 AVAX
            explanations.append(f"High value transaction: {value / 10**18:.2f} AVAX")
        
        logs = transaction.get('logs', [])
        if len(logs) > 10:
            explanations.append(f"High log count: {len(logs)} events")
        
        return "; ".join(explanations)
    
    async def _save_analysis(self, analysis: ThreatAnalysis):
        """Save analysis to database"""
        try:
            db = next(get_db())
            
            db_analysis = DBThreatAnalysis(
                tx_hash=analysis.tx_hash,
                raw_transaction=analysis.raw_transaction,
                signature_score=analysis.model_scores.signature_detection,
                anomaly_score=analysis.model_scores.anomaly_detection,
                behavioral_score=analysis.model_scores.behavioral_sequence,
                final_score=analysis.final_score,
                threat_level=analysis.threat_level.value,
                explanation=analysis.explanation
            )
            
            db.add(db_analysis)
            db.commit()
            
        except Exception as e:
            logger.error(f"Error saving analysis to database: {e}")
    
    async def _trigger_alert(self, analysis: ThreatAnalysis):
        """Trigger alert by publishing to alert queue"""
        try:
            alert_data = {
                "type": "threat_detected",
                "tx_hash": analysis.tx_hash,
                "score": analysis.final_score,
                "level": analysis.threat_level.value,
                "explanation": analysis.explanation,
                "timestamp": datetime.utcnow().isoformat(),
                "transaction": analysis.raw_transaction
            }
            
            await self.redis_client.lpush("alerts", json.dumps(alert_data))
            logger.info(f"Alert triggered for transaction {analysis.tx_hash}")
            
        except Exception as e:
            logger.error(f"Error triggering alert: {e}")
    
    async def _train_anomaly_model(self):
        """Train anomaly model with historical data"""
        try:
            # In a real implementation, you'd load historical transactions from database
            # For now, we'll start with an untrained model
            logger.info("Anomaly model will be trained as data accumulates")
            
        except Exception as e:
            logger.error(f"Error training anomaly model: {e}")
    
    async def get_queue_length(self) -> int:
        """Get current transaction queue length"""
        try:
            return await self.redis_client.llen("transactions")
        except:
            return 0