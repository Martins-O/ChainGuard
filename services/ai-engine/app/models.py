from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

class ThreatLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"

class TransactionInput(BaseModel):
    tx_hash: str
    from_address: str
    to_address: Optional[str]
    value: str
    gas_used: str
    gas_limit: str
    gas_price: Optional[str]
    timestamp: datetime
    block_number: int
    transaction_index: int
    decoded_call: Optional[Dict[str, Any]]
    logs: List[Dict[str, Any]]
    status: bool

class ModelScores(BaseModel):
    signature_detection: Optional[float] = None
    anomaly_detection: Optional[float] = None
    behavioral_sequence: Optional[float] = None

class ThreatAnalysis(BaseModel):
    id: Optional[int] = None
    tx_hash: str
    raw_transaction: Dict[str, Any]
    model_scores: ModelScores
    final_score: float
    threat_level: ThreatLevel
    explanation: str
    created_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class AnalysisRequest(BaseModel):
    transaction: TransactionInput

class AnalysisResponse(BaseModel):
    success: bool
    analysis: Optional[ThreatAnalysis] = None
    error: Optional[str] = None

class HealthResponse(BaseModel):
    status: str
    timestamp: datetime
    models_loaded: bool
    queue_length: int