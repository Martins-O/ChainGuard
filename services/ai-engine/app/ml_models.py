import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from typing import List, Dict, Any, Optional
import pickle
import os
import logging
from collections import defaultdict, deque

logger = logging.getLogger(__name__)

class SignatureDetectionModel:
    """DNN classifier for known exploit patterns"""
    
    def __init__(self):
        self.model = None
        self.pattern_signatures = {
            'reentrancy': [
                '0xd09de08a',  # Some reentrancy patterns
                '0x8e12b94c',
            ],
            'flash_loan': [
                '0x85f81d8a',  # Aave flash loan
                '0x4515cef3',  # DyDx flash loan
                '0xa2c19ead',  # Uniswap V2 flash loan
            ],
            'oracle_manipulation': [
                '0x075dbe60',  # Some oracle interaction patterns
                '0x85572ffb',
            ],
            'access_control_bypass': [
                '0xf2fde38b',  # transferOwnership
                '0x4b43edcd',  # some access patterns
            ],
            'honeypot': [
                '0x2cc8687c',  # Some honeypot patterns
                '0x6a627842',
            ],
        }
        self.feature_extractor = TransactionFeatureExtractor()
        
    def load_model(self, model_path: str = None):
        """Load pre-trained model or create simple rule-based classifier"""
        if model_path and os.path.exists(model_path):
            with open(model_path, 'rb') as f:
                self.model = pickle.load(f)
            logger.info("Loaded signature detection model")
        else:
            logger.info("Using rule-based signature detection")
            # For now, we'll use rule-based detection
            self.model = None
    
    def predict(self, transaction: Dict[str, Any]) -> float:
        """Predict threat score based on known patterns"""
        if self.model:
            features = self.feature_extractor.extract_features(transaction)
            return self.model.predict_proba([features])[0][1]  # Probability of threat
        else:
            # Rule-based scoring
            score = self._rule_based_scoring(transaction)
            return min(score, 1.0)
    
    def _rule_based_scoring(self, transaction: Dict[str, Any]) -> float:
        """Simple rule-based threat scoring"""
        score = 0.0
        input_data = transaction.get('input', '')
        
        # Check for known malicious signatures
        if len(input_data) >= 10:
            signature = input_data[:10].lower()
            
            # High threat patterns
            for threat_type, signatures in self.pattern_signatures.items():
                if signature in signatures:
                    if threat_type in ['reentrancy', 'access_control_bypass']:
                        score += 0.8
                    elif threat_type == 'honeypot':
                        score += 0.9
                    elif threat_type == 'oracle_manipulation':
                        score += 0.7
                    elif threat_type == 'flash_loan':
                        score += 0.3  # Flash loans are not inherently malicious
        
        # Value-based heuristics
        value = int(transaction.get('value', '0'), 16)
        if value > 10**18:  # > 1 AVAX
            score += 0.1
        
        # Gas-based heuristics
        gas_used = int(transaction.get('gas', '0'), 16)
        gas_limit = int(transaction.get('gas_limit', '0'), 16)
        if gas_limit > 0:
            gas_usage_ratio = gas_used / gas_limit
            if gas_usage_ratio > 0.95:  # Very high gas usage
                score += 0.2
        
        # Contract interaction heuristics
        logs = transaction.get('logs', [])
        if len(logs) > 10:  # Many logs might indicate complex/suspicious activity
            score += 0.1
        
        return score


class AnomalyDetectionModel:
    """Isolation Forest + Autoencoder for anomaly detection"""
    
    def __init__(self):
        self.isolation_forest = IsolationForest(contamination=0.1, random_state=42)
        self.scaler = StandardScaler()
        self.is_trained = False
        self.feature_extractor = TransactionFeatureExtractor()
        self.feature_history = deque(maxlen=1000)  # Keep last 1000 transactions for adaptation
        
    def train(self, transactions: List[Dict[str, Any]]):
        """Train the anomaly detection model"""
        if len(transactions) < 10:
            logger.warning("Not enough data to train anomaly detection model")
            return
        
        features = []
        for tx in transactions:
            feature_vector = self.feature_extractor.extract_features(tx)
            features.append(feature_vector)
            self.feature_history.append(feature_vector)
        
        features_array = np.array(features)
        features_scaled = self.scaler.fit_transform(features_array)
        self.isolation_forest.fit(features_scaled)
        self.is_trained = True
        
        logger.info(f"Trained anomaly detection model on {len(transactions)} transactions")
    
    def predict(self, transaction: Dict[str, Any]) -> float:
        """Predict anomaly score (0-1, higher is more anomalous)"""
        if not self.is_trained:
            return 0.1  # Low anomaly score if not trained
        
        features = self.feature_extractor.extract_features(transaction)
        features_scaled = self.scaler.transform([features])
        
        # Isolation Forest returns -1 for anomalies, 1 for inliers
        anomaly_score = self.isolation_forest.decision_function(features_scaled)[0]
        # Convert to 0-1 scale (higher is more anomalous)
        anomaly_score = (-anomaly_score + 1) / 2
        
        # Add to history for potential retraining
        self.feature_history.append(features)
        
        return min(max(anomaly_score, 0.0), 1.0)


class BehavioralSequenceModel:
    """LSTM/Transformer for transaction sequence analysis"""
    
    def __init__(self):
        self.address_sequences = defaultdict(lambda: deque(maxlen=50))
        self.contract_interactions = defaultdict(lambda: deque(maxlen=100))
        self.model = None  # Would load pre-trained LSTM/Transformer here
        
    def update_sequence(self, transaction: Dict[str, Any]):
        """Update historical sequences with new transaction"""
        from_addr = transaction.get('from', '').lower()
        to_addr = transaction.get('to', '').lower()
        
        # Update address sequences
        self.address_sequences[from_addr].append(transaction)
        
        if to_addr:
            self.contract_interactions[to_addr].append(transaction)
    
    def predict(self, transaction: Dict[str, Any]) -> float:
        """Predict threat score based on behavioral patterns"""
        from_addr = transaction.get('from', '').lower()
        to_addr = transaction.get('to', '').lower()
        
        score = 0.0
        
        # Analyze sender behavior
        if from_addr in self.address_sequences:
            sender_history = list(self.address_sequences[from_addr])
            score += self._analyze_sender_behavior(transaction, sender_history)
        
        # Analyze contract interaction patterns
        if to_addr and to_addr in self.contract_interactions:
            contract_history = list(self.contract_interactions[to_addr])
            score += self._analyze_contract_patterns(transaction, contract_history)
        
        return min(score, 1.0)
    
    def _analyze_sender_behavior(self, transaction: Dict[str, Any], history: List[Dict[str, Any]]) -> float:
        """Analyze sender's transaction patterns"""
        if len(history) < 5:
            return 0.0
        
        score = 0.0
        
        # Check for rapid successive transactions
        current_time = transaction.get('timestamp')
        if current_time and history:
            last_tx = history[-1]
            if 'timestamp' in last_tx:
                time_diff = (current_time - last_tx['timestamp']).total_seconds()
                if time_diff < 1:  # Very rapid transactions
                    score += 0.3
        
        # Check for unusual values
        current_value = int(transaction.get('value', '0'), 16)
        values = [int(tx.get('value', '0'), 16) for tx in history]
        
        if values:
            avg_value = np.mean(values)
            std_value = np.std(values)
            
            if current_value > avg_value + 3 * std_value:  # Outlier transaction value
                score += 0.2
        
        return score
    
    def _analyze_contract_patterns(self, transaction: Dict[str, Any], history: List[Dict[str, Any]]) -> float:
        """Analyze contract interaction patterns"""
        if len(history) < 10:
            return 0.0
        
        score = 0.0
        
        # Check if this is a new function being called
        current_input = transaction.get('input', '')
        if len(current_input) >= 10:
            current_signature = current_input[:10]
            
            signatures = set()
            for tx in history:
                tx_input = tx.get('input', '')
                if len(tx_input) >= 10:
                    signatures.add(tx_input[:10])
            
            if current_signature not in signatures:
                score += 0.2  # New function call
        
        return score


class TransactionFeatureExtractor:
    """Extract features from transactions for ML models"""
    
    def extract_features(self, transaction: Dict[str, Any]) -> List[float]:
        """Extract numerical features from transaction"""
        features = []
        
        # Basic transaction features
        value = int(transaction.get('value', '0'), 16)
        gas = int(transaction.get('gas', '0'), 16)
        gas_price = int(transaction.get('gasPrice', '0'), 16)
        
        features.append(float(value))
        features.append(float(gas))
        features.append(float(gas_price))
        
        # Input data features
        input_data = transaction.get('input', '')
        features.append(float(len(input_data)))
        
        # Log features
        logs = transaction.get('logs', [])
        features.append(float(len(logs)))
        
        # Contract interaction features
        is_contract = transaction.get('to') is not None and transaction.get('to') != '0x0'
        features.append(float(is_contract))
        
        # Time features (if timestamp available)
        if 'timestamp' in transaction:
            timestamp = transaction['timestamp']
            if hasattr(timestamp, 'hour'):
                features.append(float(timestamp.hour))
                features.append(float(timestamp.weekday()))
            else:
                features.extend([0.0, 0.0])
        else:
            features.extend([0.0, 0.0])
        
        return features