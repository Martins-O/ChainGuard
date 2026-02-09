"""
Signature Detection Deep Neural Network

Classifies blockchain transactions into threat types using a multi-class DNN classifier.
Threat types include:
- reentrancy
- flash_loan_attack
- oracle_manipulation
- access_control_bypass
- honeypot
- front_running
- sandwich_attack
- rug_pull
- normal
"""

import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
import numpy as np
import pickle
import os
import logging
from typing import Optional, List, Tuple

logger = logging.getLogger(__name__)


class SignatureDetectionDNN:
    """Deep Neural Network for threat signature detection"""

    def __init__(self, input_dim: int = 26):
        """
        Initialize the Signature Detection DNN

        Args:
            input_dim: Number of input features (default: 26)
        """
        self.input_dim = input_dim
        self.model: Optional[keras.Model] = None
        self.threat_types = [
            'reentrancy',
            'flash_loan_attack',
            'oracle_manipulation',
            'access_control_bypass',
            'honeypot',
            'front_running',
            'sandwich_attack',
            'rug_pull',
            'normal'
        ]
        self.is_trained = False

        # Build model architecture
        self.model = self._build_model(input_dim)
        logger.info(f"SignatureDetectionDNN initialized with {input_dim} input features")

    def _build_model(self, input_dim: int) -> keras.Model:
        """
        Build DNN classifier architecture

        Architecture:
        - Input layer (input_dim features)
        - Dense(128) + BatchNorm + Dropout(0.3)
        - Dense(64) + BatchNorm + Dropout(0.3)
        - Dense(32)
        - Output(9) with softmax

        Args:
            input_dim: Number of input features

        Returns:
            Compiled Keras model
        """
        model = keras.Sequential([
            layers.Input(shape=(input_dim,), name='input'),
            layers.Dense(128, activation='relu', name='dense_1'),
            layers.BatchNormalization(name='batch_norm_1'),
            layers.Dropout(0.3, name='dropout_1'),

            layers.Dense(64, activation='relu', name='dense_2'),
            layers.BatchNormalization(name='batch_norm_2'),
            layers.Dropout(0.3, name='dropout_2'),

            layers.Dense(32, activation='relu', name='dense_3'),

            layers.Dense(len(self.threat_types), activation='softmax', name='output')
        ], name='SignatureDetectionDNN')

        model.compile(
            optimizer=keras.optimizers.Adam(learning_rate=0.001),
            loss='sparse_categorical_crossentropy',
            metrics=[
                'accuracy',
                keras.metrics.Precision(name='precision'),
                keras.metrics.Recall(name='recall')
            ]
        )

        return model

    def train(
        self,
        X_train: np.ndarray,
        y_train: np.ndarray,
        X_val: Optional[np.ndarray] = None,
        y_val: Optional[np.ndarray] = None,
        epochs: int = 50,
        batch_size: int = 32
    ) -> keras.callbacks.History:
        """
        Train the DNN classifier

        Args:
            X_train: Training features (N, input_dim)
            y_train: Training labels (N,) with values 0-8
            X_val: Validation features
            y_val: Validation labels
            epochs: Number of training epochs
            batch_size: Batch size for training

        Returns:
            Training history object
        """
        logger.info(f"Training SignatureDetectionDNN with {len(X_train)} samples")

        # Define callbacks
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

        # Prepare validation data
        validation_data = None
        if X_val is not None and y_val is not None:
            validation_data = (X_val, y_val)

        # Train model
        history = self.model.fit(
            X_train, y_train,
            validation_data=validation_data,
            epochs=epochs,
            batch_size=batch_size,
            callbacks=callbacks,
            verbose=1
        )

        self.is_trained = True
        logger.info("SignatureDetectionDNN training completed")

        return history

    def predict(self, features: np.ndarray) -> float:
        """
        Predict threat probability for a single transaction

        Args:
            features: Feature vector (input_dim,)

        Returns:
            Threat probability (0-1), where higher is more likely to be a threat
        """
        if not self.is_trained:
            logger.warning("Model not trained, using fallback heuristic")
            return self._fallback_rule_based(features)

        # Ensure features are 2D
        if features.ndim == 1:
            features = features.reshape(1, -1)

        # Get predictions
        proba = self.model.predict(features, verbose=0)[0]

        # Return probability of NOT being normal (i.e., threat probability)
        # The last class (index 8) is 'normal', so threat probability is 1 - P(normal)
        threat_proba = 1 - proba[-1]

        return float(threat_proba)

    def predict_class(self, features: np.ndarray) -> Tuple[str, float]:
        """
        Predict threat class and confidence

        Args:
            features: Feature vector (input_dim,)

        Returns:
            Tuple of (predicted_class_name, confidence)
        """
        if not self.is_trained:
            return ('unknown', 0.5)

        # Ensure features are 2D
        if features.ndim == 1:
            features = features.reshape(1, -1)

        # Get predictions
        proba = self.model.predict(features, verbose=0)[0]

        # Get class with highest probability
        predicted_idx = np.argmax(proba)
        confidence = float(proba[predicted_idx])

        predicted_class = self.threat_types[predicted_idx]

        return (predicted_class, confidence)

    def _fallback_rule_based(self, features: np.ndarray) -> float:
        """
        Fallback rule-based scoring when model is not trained

        Uses simple heuristics based on feature values:
        - High value transactions
        - High gas usage
        - Presence of input data
        - Multiple events/logs

        Args:
            features: Feature vector

        Returns:
            Heuristic threat score (0-1)
        """
        score = 0.0

        # Feature 0: value (high value = more risky)
        if features[0] > 10**18:  # > 1 token
            score += 0.2

        # Feature 3: gas_efficiency (very high usage)
        if features[3] > 0.95:
            score += 0.2

        # Feature 6: has_input_data
        if features[6] > 0:
            score += 0.1

        # Feature 8: is_flash_loan
        if features[8] > 0:
            score += 0.3

        # Feature 9: log_count (many events)
        if features[9] > 10:
            score += 0.15

        # Feature 17: is_new_address
        if features[17] > 0:
            score += 0.05

        return min(score, 1.0)

    def save(self, path: str):
        """
        Save model to disk

        Args:
            path: Directory path to save model files
        """
        os.makedirs(path, exist_ok=True)

        # Save Keras model
        model_path = os.path.join(path, 'signature_model.h5')
        self.model.save(model_path)
        logger.info(f"Model saved to {model_path}")

        # Save configuration
        config = {
            'threat_types': self.threat_types,
            'input_dim': self.input_dim,
            'is_trained': self.is_trained
        }
        config_path = os.path.join(path, 'signature_config.pkl')
        with open(config_path, 'wb') as f:
            pickle.dump(config, f)
        logger.info(f"Configuration saved to {config_path}")

    def load(self, path: str):
        """
        Load model from disk

        Args:
            path: Directory path containing model files
        """
        # Load Keras model
        model_path = os.path.join(path, 'signature_model.h5')
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model file not found: {model_path}")

        self.model = keras.models.load_model(model_path)
        logger.info(f"Model loaded from {model_path}")

        # Load configuration
        config_path = os.path.join(path, 'signature_config.pkl')
        if os.path.exists(config_path):
            with open(config_path, 'rb') as f:
                config = pickle.load(f)
            self.threat_types = config['threat_types']
            self.input_dim = config['input_dim']
            self.is_trained = config.get('is_trained', True)
            logger.info(f"Configuration loaded from {config_path}")
        else:
            logger.warning("Configuration file not found, using defaults")
            self.is_trained = True

    def get_model_summary(self) -> str:
        """Get model architecture summary"""
        from io import StringIO
        stream = StringIO()
        self.model.summary(print_fn=lambda x: stream.write(x + '\n'))
        return stream.getvalue()
