from sqlalchemy import create_engine, MetaData
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Boolean, JSON
from datetime import datetime, timezone
import os

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://chainguard:chainguard_password@localhost:5432/chainguard")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class ThreatAnalysis(Base):
    __tablename__ = "threat_analyses"
    
    id = Column(Integer, primary_key=True, index=True)
    tx_hash = Column(String, unique=True, index=True, nullable=False)
    raw_transaction = Column(JSON, nullable=False)
    signature_score = Column(Float)
    anomaly_score = Column(Float)
    behavioral_score = Column(Float)
    final_score = Column(Float, nullable=False)
    threat_level = Column(String, nullable=False)
    explanation = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    Base.metadata.create_all(bind=engine)