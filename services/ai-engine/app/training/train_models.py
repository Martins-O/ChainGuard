"""
Model Training Script for ChainGuard AI Engine

Trains all three models:
1. Signature Detection DNN
2. Anomaly Detection Ensemble
3. Behavioral LSTM

Usage:
    python -m app.training.train_models [--days-back 30] [--model-version v1]
"""

import asyncio
import logging
import os
import sys
import argparse
import numpy as np
from datetime import datetime

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from training.data_pipeline import TrainingDataPipeline
from models.signature_detection import SignatureDetectionDNN
from models.anomaly_detection import AnomalyDetectionEnsemble
from models.behavioral_sequence import BehavioralLSTM
from sklearn.metrics import classification_report, roc_auc_score, confusion_matrix

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def train_all_models(
    days_back: int = 30,
    model_version: str = 'v1',
    min_samples: int = 100
):
    """
    Main training pipeline for all models

    Args:
        days_back: Number of days of historical data to use
        model_version: Version identifier for saved models
        min_samples: Minimum number of samples required
    """
    logger.info("=" * 80)
    logger.info("ChainGuard AI Model Training Pipeline")
    logger.info("=" * 80)

    # Initialize data pipeline
    logger.info("\n[1/6] Initializing data pipeline...")
    pipeline = TrainingDataPipeline()

    try:
        await pipeline.connect()

        # Collect training data
        logger.info(f"\n[2/6] Collecting training data (last {days_back} days)...")
        X_train, X_val, y_train, y_val = await pipeline.create_train_val_split(
            test_size=0.2,
            days_back=days_back
        )

        if len(X_train) < min_samples:
            logger.error(f"Insufficient training data ({len(X_train)} < {min_samples})")
            logger.error("Please collect more data or reduce min_samples parameter")
            return

        # Display dataset statistics
        logger.info("\nDataset Statistics:")
        logger.info(f"  Feature dimension: {X_train.shape[1]}")
        logger.info(f"  Training samples: {len(X_train)} (threats: {np.sum(y_train)})")
        logger.info(f"  Validation samples: {len(X_val)} (threats: {np.sum(y_val)})")
        logger.info(f"  Threat ratio: {np.mean(y_train):.2%}")

        # Create models directory
        models_dir = f'./models/{model_version}'
        os.makedirs(models_dir, exist_ok=True)
        logger.info(f"\nModel save directory: {models_dir}")

        # ===== Train Signature Detection DNN =====
        logger.info("\n[3/6] Training Signature Detection DNN...")
        logger.info("-" * 80)

        signature_model = SignatureDetectionDNN(input_dim=X_train.shape[1])
        logger.info("Model architecture:")
        logger.info(signature_model.get_model_summary())

        sig_history = signature_model.train(
            X_train, y_train,
            X_val, y_val,
            epochs=50,
            batch_size=32
        )

        signature_model.save(models_dir)
        logger.info(f"✓ Signature Detection DNN saved to {models_dir}")

        # Evaluate
        logger.info("\nSignature Detection DNN Evaluation:")
        sig_preds = np.array([signature_model.predict(x) for x in X_val])
        sig_binary = (sig_preds > 0.5).astype(int)
        logger.info(classification_report(y_val, sig_binary, target_names=['Normal', 'Threat']))

        # ===== Train Anomaly Detection Ensemble =====
        logger.info("\n[4/6] Training Anomaly Detection Ensemble...")
        logger.info("-" * 80)

        anomaly_model = AnomalyDetectionEnsemble(input_dim=X_train.shape[1])

        anomaly_model.train(X_train, X_val)
        anomaly_model.save(models_dir)
        logger.info(f"✓ Anomaly Detection Ensemble saved to {models_dir}")

        # Evaluate
        logger.info("\nAnomaly Detection Ensemble Evaluation:")
        anom_preds = np.array([anomaly_model.predict(x) for x in X_val])
        anom_binary = (anom_preds > 0.5).astype(int)
        logger.info(classification_report(y_val, anom_binary, target_names=['Normal', 'Threat']))

        # ===== Train Behavioral LSTM =====
        logger.info("\n[5/6] Training Behavioral LSTM...")
        logger.info("-" * 80)

        # Create sequence data
        X_train_seq, X_val_seq, y_train_seq, y_val_seq = await pipeline.create_sequence_data(
            sequence_length=7,
            days_back=days_back
        )

        behavioral_model = BehavioralLSTM(
            feature_dim=X_train.shape[1],
            sequence_length=7
        )

        logger.info("Model architecture:")
        logger.info(behavioral_model.get_model_summary())

        behav_history = behavioral_model.train(
            X_train_seq, y_train_seq,
            X_val_seq, y_val_seq,
            epochs=50,
            batch_size=32
        )

        behavioral_model.save(models_dir)
        logger.info(f"✓ Behavioral LSTM saved to {models_dir}")

        # ===== Ensemble Evaluation =====
        logger.info("\n[6/6] Evaluating Ensemble...")
        logger.info("-" * 80)

        # Combine all models with weights
        ensemble_preds = (
            sig_preds * 0.4 +
            anom_preds * 0.3 +
            anom_preds * 0.3  # Note: Using anomaly twice as placeholder for behavioral
        ) * 100  # Scale to 0-100

        ensemble_binary = (ensemble_preds > 70).astype(int)

        logger.info("\nEnsemble Model Evaluation (threshold=70):")
        logger.info(classification_report(y_val, ensemble_binary, target_names=['Normal', 'Threat']))

        # Confusion matrix
        cm = confusion_matrix(y_val, ensemble_binary)
        logger.info("\nConfusion Matrix:")
        logger.info(f"              Predicted Normal  Predicted Threat")
        logger.info(f"Actual Normal       {cm[0][0]:6d}           {cm[0][1]:6d}")
        logger.info(f"Actual Threat       {cm[1][0]:6d}           {cm[1][1]:6d}")

        # ROC AUC
        if len(np.unique(y_val)) > 1:
            auc = roc_auc_score(y_val, ensemble_preds)
            logger.info(f"\nEnsemble ROC AUC Score: {auc:.4f}")

        # Save training metadata
        metadata = {
            'training_date': datetime.utcnow().isoformat(),
            'days_back': days_back,
            'model_version': model_version,
            'training_samples': len(X_train),
            'validation_samples': len(X_val),
            'feature_dim': X_train.shape[1],
            'threat_ratio': float(np.mean(y_train)),
            'ensemble_auc': float(auc) if len(np.unique(y_val)) > 1 else None
        }

        import json
        metadata_path = os.path.join(models_dir, 'training_metadata.json')
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)
        logger.info(f"\n✓ Training metadata saved to {metadata_path}")

        logger.info("\n" + "=" * 80)
        logger.info("All models trained successfully!")
        logger.info("=" * 80)

    except Exception as e:
        logger.error(f"Error during training: {e}", exc_info=True)
        raise

    finally:
        await pipeline.disconnect()


def main():
    """Command-line interface for training"""
    parser = argparse.ArgumentParser(
        description='Train ChainGuard AI models'
    )

    parser.add_argument(
        '--days-back',
        type=int,
        default=30,
        help='Number of days of historical data to use (default: 30)'
    )

    parser.add_argument(
        '--model-version',
        type=str,
        default='v1',
        help='Model version identifier (default: v1)'
    )

    parser.add_argument(
        '--min-samples',
        type=int,
        default=100,
        help='Minimum number of training samples required (default: 100)'
    )

    args = parser.parse_args()

    # Run training
    asyncio.run(train_all_models(
        days_back=args.days_back,
        model_version=args.model_version,
        min_samples=args.min_samples
    ))


if __name__ == "__main__":
    main()
