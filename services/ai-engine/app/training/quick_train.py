"""
Quick Training Script for ChainGuard AI Engine

Creates basic trained models using:
1. Existing transaction features (as normal)
2. Synthetic threat patterns

Usage:
    python -m app.training.quick_train
"""

import asyncio
import logging
import os
import sys
import numpy as np
from datetime import datetime

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.signature_detection import SignatureDetectionDNN
from models.anomaly_detection import AnomalyDetectionEnsemble
from models.behavioral_sequence import BehavioralLSTM

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def create_synthetic_data(n_samples: int = 1000, feature_dim: int = 26):
    """Create synthetic training data"""
    
    # Normal transactions (realistic patterns)
    X_normal = np.random.randn(n_samples, feature_dim) * 0.5 + 0.5
    X_normal = np.clip(X_normal, 0, 1)
    y_normal = np.zeros(n_samples)
    
    # Threat patterns (suspicious characteristics)
    X_threat = np.random.randn(n_samples, feature_dim) * 0.8
    
    # Make threats look suspicious:
    # - Very high gas price (index ~4)
    X_threat[:, 4] = np.random.uniform(0.8, 1.0, n_samples)
    # - Unusual value patterns (index ~2)  
    X_threat[:, 2] = np.random.uniform(0.7, 1.0, n_samples)
    # - New contract interactions (index ~12)
    X_threat[:, 12] = np.random.uniform(0.8, 1.0, n_samples)
    # - Multiple token transfers (index ~8)
    X_threat[:, 8] = np.random.uniform(0.6, 1.0, n_samples)
    
    X_threat = np.clip(X_threat, 0, 1)
    y_threat = np.ones(n_samples)
    
    # Combine
    X = np.vstack([X_normal, X_threat])
    y = np.hstack([y_normal, y_threat])
    
    # Shuffle
    indices = np.random.permutation(len(X))
    X = X[indices]
    y = y[indices]
    
    return X, y


async def quick_train():
    """Quick training with synthetic data"""
    
    logger.info("=" * 60)
    logger.info("ChainGuard Quick Model Training")
    logger.info("=" * 60)
    
    feature_dim = 26
    n_samples = 1000
    
    # Create training data
    logger.info("\n[1/3] Creating synthetic training data...")
    X, y = create_synthetic_data(n_samples, feature_dim)
    
    # Split
    split = int(len(X) * 0.8)
    X_train, X_val = X[:split], X[split:]
    y_train, y_val = y[:split], y[split:]
    
    logger.info(f"  Training: {len(X_train)} samples")
    logger.info(f"  Validation: {len(X_val)} samples")
    logger.info(f"  Threats: {int(sum(y))} ({sum(y)/len(y)*100:.1f}%)")
    
    # Create models directory
    models_dir = './models/v1'
    os.makedirs(models_dir, exist_ok=True)
    
    # Train Signature Detection
    logger.info("\n[2/3] Training Signature Detection DNN...")
    sig_model = SignatureDetectionDNN(feature_dim)
    sig_model.train(X_train, y_train, X_val, y_val, epochs=30, batch_size=32)
    sig_model.save(models_dir)
    logger.info(f"  ✓ Saved to {models_dir}")
    
    # Train Anomaly Detection
    logger.info("\n[3/3] Training Anomaly Detection Ensemble...")
    anom_model = AnomalyDetectionEnsemble(feature_dim)
    anom_model.train(X_train, X_val)
    anom_model.save(models_dir)
    logger.info(f"  ✓ Saved to {models_dir}")
    
    # Train Behavioral LSTM
    logger.info("\n[Bonus] Training Behavioral LSTM...")
    # Create sequence data (repeat samples for sequences)
    X_seq = np.tile(X_train[:100], (1, 1))
    y_seq = y_train[:100]
    for i in range(1, 7):
        X_seq = np.concatenate([X_seq, X_train[i*100:(i+1)*100]], axis=1)
        y_seq = np.concatenate([y_seq, y_train[i*100:(i+1)*100]])
    
    behav_model = BehavioralLSTM(feature_dim, 7)
    behav_model.train(X_seq.reshape(-1, 7, feature_dim), y_seq, 
                     X_val.reshape(-1, 7, feature_dim), y_val, epochs=20, batch_size=16)
    behav_model.save(models_dir)
    logger.info(f"  ✓ Saved to {models_dir}")
    
    logger.info("\n" + "=" * 60)
    logger.info("✓ All models trained successfully!")
    logger.info("Models saved to: ./models/v1/")
    logger.info("=" * 60)


if __name__ == "__main__":
    asyncio.run(quick_train())
