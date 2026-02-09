"""
Behavioral LSTM for Short Transaction Sequences

Analyzes short sequences of transactions (5-10) from the same address
to detect anomalous behavioral patterns. Uses LSTM to capture temporal
dependencies in transaction patterns.
"""

import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
from sklearn.preprocessing import StandardScaler
import numpy as np
from collections import defaultdict, deque
import pickle
import os
import logging
from typing import Optional, Dict

logger = logging.getLogger(__name__)


class BehavioralLSTM:
    """LSTM for detecting anomalous transaction sequences"""

    def __init__(self, feature_dim: int = 26, sequence_length: int = 7):
        """
        Initialize the Behavioral LSTM

        Args:
            feature_dim: Number of features per transaction
            sequence_length: Length of transaction sequences (default: 7)
        """
        self.feature_dim = feature_dim
        self.sequence_length = sequence_length

        # LSTM model
        self.model: Optional[keras.Model] = None
        self.model = self._build_model(feature_dim, sequence_length)

        # Store recent transaction sequences per address
        self.address_sequences: Dict[str, deque] = defaultdict(
            lambda: deque(maxlen=sequence_length)
        )

        # Feature scaler
        self.scaler = StandardScaler()

        # Training state
        self.is_trained = False

        logger.info(f"BehavioralLSTM initialized (features={feature_dim}, seq_len={sequence_length})")

    def _build_model(self, feature_dim: int, sequence_length: int) -> keras.Model:
        """
        Build LSTM model for short sequence patterns

        Architecture:
        - Input: (sequence_length, feature_dim)
        - LSTM(32, return_sequences=True)
        - Dropout(0.3)
        - LSTM(16)
        - Dropout(0.3)
        - Dense(8, relu)
        - Output(1, sigmoid)

        Args:
            feature_dim: Number of features per transaction
            sequence_length: Length of sequences

        Returns:
            Compiled LSTM model
        """
        model = keras.Sequential([
            layers.Input(shape=(sequence_length, feature_dim), name='input'),

            # First LSTM layer (return sequences for stacking)
            layers.LSTM(32, return_sequences=True, name='lstm_1'),
            layers.Dropout(0.3, name='dropout_1'),

            # Second LSTM layer
            layers.LSTM(16, name='lstm_2'),
            layers.Dropout(0.3, name='dropout_2'),

            # Dense layers
            layers.Dense(8, activation='relu', name='dense'),

            # Binary output (anomaly or not)
            layers.Dense(1, activation='sigmoid', name='output')
        ], name='BehavioralLSTM')

        model.compile(
            optimizer=keras.optimizers.Adam(learning_rate=0.001),
            loss='binary_crossentropy',
            metrics=[
                'accuracy',
                keras.metrics.AUC(name='auc')
            ]
        )

        return model

    def update_sequence(self, address: str, features: np.ndarray):
        """
        Add transaction features to address history

        Args:
            address: Address identifier
            features: Transaction feature vector
        """
        self.address_sequences[address].append(features)

    def get_sequence(self, address: str) -> np.ndarray:
        """
        Get padded sequence for address

        If address has fewer than sequence_length transactions,
        pads with zeros at the beginning.

        Args:
            address: Address identifier

        Returns:
            Sequence array of shape (sequence_length, feature_dim)
        """
        sequence = list(self.address_sequences[address])

        # Pad with zeros if too short
        while len(sequence) < self.sequence_length:
            sequence.insert(0, np.zeros(self.feature_dim))

        # Take last sequence_length transactions
        sequence = sequence[-self.sequence_length:]

        return np.array(sequence)

    def train(
        self,
        X_sequences: np.ndarray,
        y_labels: np.ndarray,
        X_val: Optional[np.ndarray] = None,
        y_val: Optional[np.ndarray] = None,
        epochs: int = 50,
        batch_size: int = 32
    ) -> keras.callbacks.History:
        """
        Train LSTM on transaction sequences

        Args:
            X_sequences: Training sequences (N, sequence_length, feature_dim)
            y_labels: Binary labels (N,) - 0 for normal, 1 for anomaly
            X_val: Validation sequences
            y_val: Validation labels
            epochs: Number of training epochs
            batch_size: Batch size

        Returns:
            Training history
        """
        logger.info(f"Training BehavioralLSTM with {len(X_sequences)} sequences")

        # Fit scaler on flattened training data
        X_flat = X_sequences.reshape(-1, self.feature_dim)
        self.scaler.fit(X_flat)

        # Scale sequences
        X_scaled = self._scale_sequences(X_sequences)

        # Scale validation data if provided
        validation_data = None
        if X_val is not None and y_val is not None:
            X_val_scaled = self._scale_sequences(X_val)
            validation_data = (X_val_scaled, y_val)

        # Callbacks
        callbacks = [
            keras.callbacks.EarlyStopping(
                monitor='val_loss' if X_val is not None else 'loss',
                patience=5,
                restore_best_weights=True,
                verbose=1
            ),
            keras.callbacks.ReduceLROnPlateau(
                monitor='val_loss' if X_val is not None else 'loss',
                factor=0.5,
                patience=3,
                min_lr=1e-6,
                verbose=1
            )
        ]

        # Train model
        history = self.model.fit(
            X_scaled, y_labels,
            validation_data=validation_data,
            epochs=epochs,
            batch_size=batch_size,
            callbacks=callbacks,
            verbose=1
        )

        self.is_trained = True
        logger.info("BehavioralLSTM training completed")

        return history

    def _scale_sequences(self, sequences: np.ndarray) -> np.ndarray:
        """
        Scale sequence features

        Args:
            sequences: Array of shape (N, sequence_length, feature_dim)

        Returns:
            Scaled sequences of same shape
        """
        N, seq_len, feat_dim = sequences.shape

        # Reshape to (N * seq_len, feat_dim)
        flat = sequences.reshape(-1, feat_dim)

        # Scale
        scaled_flat = self.scaler.transform(flat)

        # Reshape back to (N, seq_len, feat_dim)
        scaled = scaled_flat.reshape(N, seq_len, feat_dim)

        return scaled

    def predict(self, address: str, current_features: np.ndarray) -> float:
        """
        Predict anomaly probability for current transaction in context of address history

        Args:
            address: Address identifier
            current_features: Features of current transaction

        Returns:
            Anomaly probability (0-1)
        """
        # Update sequence with current transaction
        self.update_sequence(address, current_features)

        # Need at least 3 transactions for meaningful pattern
        if len(self.address_sequences[address]) < 3:
            return 0.0

        # Use fallback if model not trained
        if not self.is_trained:
            return self._fallback_heuristic(address, current_features)

        # Get sequence and predict
        sequence = self.get_sequence(address)
        sequence_scaled = self._scale_sequences(sequence.reshape(1, self.sequence_length, -1))

        anomaly_proba = self.model.predict(sequence_scaled, verbose=0)[0][0]

        return float(anomaly_proba)

    def _fallback_heuristic(self, address: str, current_features: np.ndarray) -> float:
        """
        Simple heuristic when model is not trained

        Checks if current transaction deviates significantly from address history:
        - Value deviation
        - Gas usage deviation

        Args:
            address: Address identifier
            current_features: Current transaction features

        Returns:
            Heuristic anomaly score (0-1)
        """
        history = list(self.address_sequences[address])
        if len(history) < 3:
            return 0.0

        # Get historical values (feature 0 = value)
        values = [h[0] for h in history[:-1]]  # Exclude current transaction
        current_value = current_features[0]

        if not values or len(values) < 2:
            return 0.0

        # Calculate statistics
        avg_value = np.mean(values)
        std_value = np.std(values)

        # Check for unusual value (> 3 standard deviations)
        if std_value > 0 and abs(current_value - avg_value) > 3 * std_value:
            return 0.5

        return 0.0

    def save(self, path: str):
        """
        Save model to disk

        Args:
            path: Directory path to save model files
        """
        os.makedirs(path, exist_ok=True)

        # Save LSTM model
        model_path = os.path.join(path, 'behavioral_lstm.h5')
        self.model.save(model_path)
        logger.info(f"LSTM model saved to {model_path}")

        # Save configuration
        config = {
            'scaler': self.scaler,
            'sequence_length': self.sequence_length,
            'feature_dim': self.feature_dim,
            'is_trained': self.is_trained
        }
        config_path = os.path.join(path, 'behavioral_config.pkl')
        with open(config_path, 'wb') as f:
            pickle.dump(config, f)
        logger.info(f"Configuration saved to {config_path}")

    def load(self, path: str):
        """
        Load model from disk

        Args:
            path: Directory path containing model files
        """
        # Load LSTM model
        model_path = os.path.join(path, 'behavioral_lstm.h5')
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"LSTM model file not found: {model_path}")

        self.model = keras.models.load_model(model_path)
        logger.info(f"LSTM model loaded from {model_path}")

        # Load configuration
        config_path = os.path.join(path, 'behavioral_config.pkl')
        if os.path.exists(config_path):
            with open(config_path, 'rb') as f:
                config = pickle.load(f)
            self.scaler = config['scaler']
            self.sequence_length = config['sequence_length']
            self.feature_dim = config['feature_dim']
            self.is_trained = config.get('is_trained', True)
            logger.info(f"Configuration loaded from {config_path}")
        else:
            logger.warning("Configuration file not found, using defaults")
            self.is_trained = True

    def reset_history(self):
        """Clear all address sequences"""
        self.address_sequences.clear()
        logger.info("Address sequence history cleared")

    def get_address_count(self) -> int:
        """Get number of addresses being tracked"""
        return len(self.address_sequences)

    def get_model_summary(self) -> str:
        """Get model architecture summary"""
        from io import StringIO
        stream = StringIO()
        self.model.summary(print_fn=lambda x: stream.write(x + '\n'))
        return stream.getvalue()
