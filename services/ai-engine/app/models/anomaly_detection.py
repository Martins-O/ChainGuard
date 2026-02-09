"""
Anomaly Detection Ensemble

Combines IsolationForest and Autoencoder for robust anomaly detection.
- IsolationForest: Tree-based anomaly detection
- Autoencoder: Reconstruction-based anomaly detection
- Ensemble: Weighted combination of both methods
"""

from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
import numpy as np
import pickle
import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)


class AnomalyDetectionEnsemble:
    """Ensemble of IsolationForest and Autoencoder for anomaly detection"""

    def __init__(self, input_dim: int = 26):
        """
        Initialize the Anomaly Detection Ensemble

        Args:
            input_dim: Number of input features (default: 26)
        """
        self.input_dim = input_dim

        # IsolationForest configuration
        self.isolation_forest = IsolationForest(
            contamination=0.05,  # Expected proportion of anomalies
            n_estimators=200,
            max_samples=256,
            random_state=42,
            n_jobs=-1  # Use all CPU cores
        )

        # Autoencoder
        self.autoencoder: Optional[keras.Model] = None
        self.autoencoder = self._build_autoencoder(input_dim)

        # Feature scaler
        self.scaler = StandardScaler()

        # Training state
        self.is_trained = False
        self.reconstruction_threshold: Optional[float] = None

        # Ensemble weights
        self.iso_weight = 0.6  # IsolationForest weight
        self.ae_weight = 0.4   # Autoencoder weight

        logger.info(f"AnomalyDetectionEnsemble initialized with {input_dim} input features")

    def _build_autoencoder(self, input_dim: int) -> keras.Model:
        """
        Build autoencoder for reconstruction-based anomaly detection

        Architecture:
        - Encoder: input_dim -> 16 -> 8 -> 4 (bottleneck)
        - Decoder: 4 -> 8 -> 16 -> input_dim

        Args:
            input_dim: Number of input features

        Returns:
            Compiled autoencoder model
        """
        # Encoder
        encoder_input = layers.Input(shape=(input_dim,), name='encoder_input')
        encoded = layers.Dense(16, activation='relu', name='encoder_1')(encoder_input)
        encoded = layers.Dense(8, activation='relu', name='encoder_2')(encoded)
        encoded = layers.Dense(4, activation='relu', name='bottleneck')(encoded)

        # Decoder
        decoded = layers.Dense(8, activation='relu', name='decoder_1')(encoded)
        decoded = layers.Dense(16, activation='relu', name='decoder_2')(decoded)
        decoder_output = layers.Dense(input_dim, activation='linear', name='decoder_output')(decoded)

        # Autoencoder model
        autoencoder = keras.Model(encoder_input, decoder_output, name='Autoencoder')

        autoencoder.compile(
            optimizer=keras.optimizers.Adam(learning_rate=0.001),
            loss='mse'  # Mean squared error for reconstruction
        )

        return autoencoder

    def train(
        self,
        X_train: np.ndarray,
        X_val: Optional[np.ndarray] = None
    ):
        """
        Train both IsolationForest and Autoencoder

        Args:
            X_train: Training features (N, input_dim)
            X_val: Validation features (optional)
        """
        logger.info(f"Training AnomalyDetectionEnsemble with {len(X_train)} samples")

        # Scale features
        X_scaled = self.scaler.fit_transform(X_train)

        # Train IsolationForest
        logger.info("Training IsolationForest...")
        self.isolation_forest.fit(X_scaled)
        logger.info("IsolationForest training completed")

        # Train Autoencoder
        logger.info("Training Autoencoder...")
        validation_data = None
        if X_val is not None:
            X_val_scaled = self.scaler.transform(X_val)
            validation_data = (X_val_scaled, X_val_scaled)

        callbacks = [
            keras.callbacks.EarlyStopping(
                monitor='val_loss' if X_val is not None else 'loss',
                patience=10,
                restore_best_weights=True,
                verbose=1
            )
        ]

        self.autoencoder.fit(
            X_scaled, X_scaled,  # Autoencoder targets = inputs
            epochs=100,
            batch_size=32,
            validation_data=validation_data,
            callbacks=callbacks,
            verbose=1
        )
        logger.info("Autoencoder training completed")

        # Calculate reconstruction threshold (95th percentile of training errors)
        reconstructions = self.autoencoder.predict(X_scaled, verbose=0)
        reconstruction_errors = np.mean(np.square(X_scaled - reconstructions), axis=1)
        self.reconstruction_threshold = np.percentile(reconstruction_errors, 95)

        logger.info(f"Reconstruction threshold set to: {self.reconstruction_threshold:.4f}")

        self.is_trained = True
        logger.info("AnomalyDetectionEnsemble training completed")

    def predict(self, features: np.ndarray) -> float:
        """
        Predict anomaly score using ensemble

        Args:
            features: Feature vector (input_dim,)

        Returns:
            Anomaly score (0-1), where higher = more anomalous
        """
        if not self.is_trained:
            logger.warning("Model not trained, returning default score")
            return 0.1

        # Ensure features are 2D
        if features.ndim == 1:
            features = features.reshape(1, -1)

        # Scale features
        features_scaled = self.scaler.transform(features)

        # IsolationForest score
        # decision_function returns negative values for anomalies, positive for normal
        iso_score = self.isolation_forest.decision_function(features_scaled)[0]
        # Normalize to 0-1 range (higher = more anomalous)
        iso_anomaly = (-iso_score + 1) / 2
        iso_anomaly = np.clip(iso_anomaly, 0, 1)

        # Autoencoder reconstruction error
        reconstruction = self.autoencoder.predict(features_scaled, verbose=0)
        reconstruction_error = np.mean(np.square(features_scaled - reconstruction))

        # Normalize by threshold
        if self.reconstruction_threshold and self.reconstruction_threshold > 0:
            ae_anomaly = reconstruction_error / self.reconstruction_threshold
        else:
            ae_anomaly = reconstruction_error

        ae_anomaly = np.clip(ae_anomaly, 0, 1)

        # Ensemble: weighted average
        anomaly_score = self.iso_weight * iso_anomaly + self.ae_weight * ae_anomaly
        anomaly_score = np.clip(anomaly_score, 0, 1)

        return float(anomaly_score)

    def predict_with_details(self, features: np.ndarray) -> dict:
        """
        Predict anomaly score with detailed breakdown

        Args:
            features: Feature vector (input_dim,)

        Returns:
            Dictionary with anomaly scores and details
        """
        if not self.is_trained:
            return {
                'anomaly_score': 0.1,
                'iso_score': 0.0,
                'ae_score': 0.0,
                'reconstruction_error': 0.0,
                'is_anomaly': False
            }

        # Ensure features are 2D
        if features.ndim == 1:
            features = features.reshape(1, -1)

        # Scale features
        features_scaled = self.scaler.transform(features)

        # IsolationForest score
        iso_score = self.isolation_forest.decision_function(features_scaled)[0]
        iso_anomaly = (-iso_score + 1) / 2
        iso_anomaly = np.clip(iso_anomaly, 0, 1)

        # Autoencoder reconstruction error
        reconstruction = self.autoencoder.predict(features_scaled, verbose=0)
        reconstruction_error = np.mean(np.square(features_scaled - reconstruction))

        if self.reconstruction_threshold and self.reconstruction_threshold > 0:
            ae_anomaly = reconstruction_error / self.reconstruction_threshold
        else:
            ae_anomaly = reconstruction_error

        ae_anomaly = np.clip(ae_anomaly, 0, 1)

        # Ensemble score
        anomaly_score = self.iso_weight * iso_anomaly + self.ae_weight * ae_anomaly
        anomaly_score = np.clip(anomaly_score, 0, 1)

        return {
            'anomaly_score': float(anomaly_score),
            'iso_score': float(iso_anomaly),
            'ae_score': float(ae_anomaly),
            'reconstruction_error': float(reconstruction_error),
            'is_anomaly': anomaly_score > 0.5
        }

    def save(self, path: str):
        """
        Save models to disk

        Args:
            path: Directory path to save model files
        """
        os.makedirs(path, exist_ok=True)

        # Save IsolationForest
        iso_path = os.path.join(path, 'isolation_forest.pkl')
        with open(iso_path, 'wb') as f:
            pickle.dump(self.isolation_forest, f)
        logger.info(f"IsolationForest saved to {iso_path}")

        # Save Autoencoder
        ae_path = os.path.join(path, 'autoencoder.h5')
        self.autoencoder.save(ae_path)
        logger.info(f"Autoencoder saved to {ae_path}")

        # Save configuration
        config = {
            'scaler': self.scaler,
            'threshold': self.reconstruction_threshold,
            'input_dim': self.input_dim,
            'iso_weight': self.iso_weight,
            'ae_weight': self.ae_weight,
            'is_trained': self.is_trained
        }
        config_path = os.path.join(path, 'anomaly_config.pkl')
        with open(config_path, 'wb') as f:
            pickle.dump(config, f)
        logger.info(f"Configuration saved to {config_path}")

    def load(self, path: str):
        """
        Load models from disk

        Args:
            path: Directory path containing model files
        """
        # Load IsolationForest
        iso_path = os.path.join(path, 'isolation_forest.pkl')
        if not os.path.exists(iso_path):
            raise FileNotFoundError(f"IsolationForest file not found: {iso_path}")

        with open(iso_path, 'rb') as f:
            self.isolation_forest = pickle.load(f)
        logger.info(f"IsolationForest loaded from {iso_path}")

        # Load Autoencoder
        ae_path = os.path.join(path, 'autoencoder.h5')
        if not os.path.exists(ae_path):
            raise FileNotFoundError(f"Autoencoder file not found: {ae_path}")

        self.autoencoder = keras.models.load_model(ae_path)
        logger.info(f"Autoencoder loaded from {ae_path}")

        # Load configuration
        config_path = os.path.join(path, 'anomaly_config.pkl')
        if os.path.exists(config_path):
            with open(config_path, 'rb') as f:
                config = pickle.load(f)
            self.scaler = config['scaler']
            self.reconstruction_threshold = config['threshold']
            self.input_dim = config['input_dim']
            self.iso_weight = config.get('iso_weight', 0.6)
            self.ae_weight = config.get('ae_weight', 0.4)
            self.is_trained = config.get('is_trained', True)
            logger.info(f"Configuration loaded from {config_path}")
        else:
            logger.warning("Configuration file not found, using defaults")
            self.is_trained = True

    def get_reconstruction_error(self, features: np.ndarray) -> float:
        """
        Get reconstruction error for features

        Args:
            features: Feature vector (input_dim,)

        Returns:
            Reconstruction error (MSE)
        """
        if not self.is_trained:
            return 0.0

        if features.ndim == 1:
            features = features.reshape(1, -1)

        features_scaled = self.scaler.transform(features)
        reconstruction = self.autoencoder.predict(features_scaled, verbose=0)
        error = np.mean(np.square(features_scaled - reconstruction))

        return float(error)
