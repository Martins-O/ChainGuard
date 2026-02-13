"""
Enhanced Transaction Feature Extractor for ChainGuard AI Engine

Extracts 25+ features from blockchain transactions for ML model training and inference.
Features are organized into categories:
- Basic transaction features (5)
- Input data features (4)
- Log features (4)
- Address features (6)
- Temporal features (3)
- Derived features (3)
"""

import numpy as np
from typing import Dict, Any, List, Set
from collections import defaultdict
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class TransactionFeatureExtractor:
    """Extract comprehensive features from blockchain transactions"""

    def __init__(self):
        # Track address history for behavioral features
        self.address_history = defaultdict(lambda: {
            'first_seen': None,
            'tx_count': 0,
            'total_value_sent': 0,
            'total_value_received': 0
        })

        # Known contract addresses (could be loaded from database)
        self.known_contracts: Set[str] = set()

        # Flash loan function signatures
        self.flash_loan_signatures = {
            '0x5cffe9de',  # Aave flashLoan
            '0xab9c4b5d',  # Uniswap V3 flash
            '0x490e6cbc',  # Balancer flashLoan
        }

        logger.info("TransactionFeatureExtractor initialized")

    def extract_features(self, transaction: Dict[str, Any]) -> np.ndarray:
        """
        Extract 25+ features from a transaction

        Args:
            transaction: Transaction dictionary with keys:
                - hash, from, to, value, gas, gasLimit, gasPrice
                - input, logs, timestamp, blockNumber, etc.

        Returns:
            NumPy array of 25+ float features
        """
        features = []

        # ===== Basic transaction features (5) =====
        value = self._parse_hex_int(transaction.get('value', '0x0'))
        gas_used = self._parse_hex_int(transaction.get('gas', '0x0'))
        gas_limit = self._parse_hex_int(transaction.get('gasLimit', '0x0'))
        gas_price = self._parse_hex_int(transaction.get('gasPrice', '0x0'))

        features.extend([
            float(value),  # Feature 0: Transaction value in wei
            float(gas_used),  # Feature 1: Gas used
            float(gas_price),  # Feature 2: Gas price
            gas_used / gas_limit if gas_limit > 0 else 0,  # Feature 3: Gas efficiency
            value / gas_used if gas_used > 0 else 0  # Feature 4: Value to gas ratio
        ])

        # ===== Input data features (4) =====
        input_data = transaction.get('input', '0x')
        if input_data.startswith('0x'):
            input_data = input_data[2:]

        features.extend([
            float(len(input_data)),  # Feature 5: Input data length
            float(len(input_data) > 0),  # Feature 6: Has input data (0 or 1)
            self._calculate_entropy(input_data),  # Feature 7: Input data entropy
            float(self._check_flash_loan_signature(input_data))  # Feature 8: Is flash loan
        ])

        # ===== Log features (4) =====
        logs = transaction.get('logs', [])
        unique_topics = set()
        total_log_data_length = 0

        for log in logs:
            topics = log.get('topics', [])
            unique_topics.update(topics)
            log_data = log.get('data', '0x')
            if log_data.startswith('0x'):
                log_data = log_data[2:]
            total_log_data_length += len(log_data)

        features.extend([
            float(len(logs)),  # Feature 9: Number of logs/events
            float(len(unique_topics)),  # Feature 10: Number of unique topics
            float(total_log_data_length),  # Feature 11: Total log data length
            len(logs) / max(len(unique_topics), 1)  # Feature 12: Events per topic ratio
        ])

        # ===== Address features (6) =====
        from_addr = transaction.get('from', '').lower()
        to_addr = transaction.get('to', '').lower() if transaction.get('to') else None

        # Update address history
        if from_addr:
            self.address_history[from_addr]['tx_count'] += 1
            self.address_history[from_addr]['total_value_sent'] += value
            if self.address_history[from_addr]['first_seen'] is None:
                self.address_history[from_addr]['first_seen'] = datetime.now()

        if to_addr:
            if to_addr not in self.address_history:
                self.address_history[to_addr]['first_seen'] = datetime.now()
            self.address_history[to_addr]['total_value_received'] += value

        from_history = self.address_history.get(from_addr, {'tx_count': 0})
        to_history = self.address_history.get(to_addr, {'tx_count': 0}) if to_addr else {'tx_count': 0}

        features.extend([
            float(from_history['tx_count']),  # Feature 13: From address transaction count
            float(to_history['tx_count']),  # Feature 14: To address transaction count
            float(to_addr is None),  # Feature 15: Is contract creation (1 if to is None)
            float(to_addr in self.known_contracts if to_addr else 0),  # Feature 16: Is known contract
            float(from_history['tx_count'] < 5),  # Feature 17: Is new address
            float(value > 10**18)  # Feature 18: Is high value (> 1 token)
        ])

        # ===== Temporal features (3) =====
        timestamp = transaction.get('timestamp')
        if timestamp:
            if isinstance(timestamp, (int, float)):
                dt = datetime.fromtimestamp(timestamp)
            elif isinstance(timestamp, datetime):
                dt = timestamp
            else:
                dt = datetime.now()

            features.extend([
                float(dt.hour),  # Feature 19: Hour of day (0-23)
                float(dt.weekday()),  # Feature 20: Day of week (0-6)
                float(dt.weekday() >= 5)  # Feature 21: Is weekend (1 if Sat/Sun)
            ])
        else:
            features.extend([0.0, 0.0, 0.0])

        # ===== Derived features (3) =====
        features.extend([
            float(gas_used > 1000000),  # Feature 22: Unusual gas usage
            float(len(logs) > 10),  # Feature 23: Multiple transfers/events
            float(value > 0 and len(input_data) > 8)  # Feature 24: Complex value transfer
        ])

        # ===== Additional advanced features (1) =====
        features.append(
            self._calculate_address_interaction_score(from_addr, to_addr)  # Feature 25
        )

        return np.array(features, dtype=np.float32)

    def _parse_hex_int(self, hex_str: str) -> int:
        """Parse hex string to integer, handling edge cases"""
        try:
            if isinstance(hex_str, int):
                return hex_str
            if isinstance(hex_str, str):
                if hex_str.startswith('0x'):
                    return int(hex_str, 16)
                return int(hex_str)
            return 0
        except (ValueError, TypeError):
            return 0

    def _calculate_entropy(self, data: str) -> float:
        """
        Calculate Shannon entropy of data string
        High entropy might indicate encrypted/random data
        """
        if not data or len(data) < 2:
            return 0.0

        # Count byte frequencies
        byte_counts = {}
        for char in data:
            byte_counts[char] = byte_counts.get(char, 0) + 1

        # Calculate Shannon entropy
        entropy = 0.0
        data_len = len(data)
        for count in byte_counts.values():
            prob = count / data_len
            entropy -= prob * np.log2(prob)

        return entropy

    def _check_flash_loan_signature(self, input_data: str) -> int:
        """Check if transaction uses flash loan function signature"""
        if len(input_data) < 8:
            return 0

        function_sig = '0x' + input_data[:8]
        return 1 if function_sig in self.flash_loan_signatures else 0

    def _calculate_address_interaction_score(self, from_addr: str, to_addr: str) -> float:
        """
        Calculate interaction score based on address history
        Higher score = more unusual interaction pattern
        """
        if not from_addr or not to_addr:
            return 0.0

        from_history = self.address_history.get(from_addr, {})
        to_history = self.address_history.get(to_addr, {})

        from_tx_count = from_history.get('tx_count', 0)
        to_tx_count = to_history.get('tx_count', 0)

        # Unusual if both addresses are new (< 3 transactions each)
        if from_tx_count < 3 and to_tx_count < 3:
            return 0.8

        # Unusual if from is new but to is established
        if from_tx_count < 3 and to_tx_count > 100:
            return 0.6

        # Normal interaction
        return 0.2

    def get_feature_names(self) -> List[str]:
        """Return list of feature names for interpretability"""
        return [
            # Basic transaction features (5)
            'value',
            'gas_used',
            'gas_price',
            'gas_efficiency',
            'value_to_gas_ratio',

            # Input data features (4)
            'input_data_length',
            'has_input_data',
            'input_data_entropy',
            'is_flash_loan',

            # Log features (4)
            'log_count',
            'unique_topics_count',
            'total_log_data_length',
            'events_per_topic_ratio',

            # Address features (6)
            'from_tx_count',
            'to_tx_count',
            'is_contract_creation',
            'is_known_contract',
            'is_new_address',
            'is_high_value',

            # Temporal features (3)
            'hour_of_day',
            'day_of_week',
            'is_weekend',

            # Derived features (3)
            'unusual_gas_usage',
            'multiple_transfers',
            'complex_value_transfer',

            # Advanced features (1)
            'address_interaction_score'
        ]

    def reset_history(self):
        """Reset address history (useful for batch processing)"""
        self.address_history.clear()
        logger.info("Address history reset")

    def update_known_contracts(self, contract_addresses: Set[str]):
        """Update the set of known contract addresses"""
        self.known_contracts.update(addr.lower() for addr in contract_addresses)
        logger.info(f"Updated known contracts. Total: {len(self.known_contracts)}")

    def get_feature_count(self) -> int:
        """Return total number of features extracted"""
        return 26  # Updated to 26 features
