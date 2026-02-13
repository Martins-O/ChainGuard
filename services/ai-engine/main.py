from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
import logging
from datetime import datetime
import asyncio
from typing import Optional

from app.models import AnalysisRequest, AnalysisResponse, HealthResponse, TransactionInput
from app.database import get_database, init_db, close_db
from app.analyzer import AIThreatAnalyzer

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="ChainGuard AI Engine",
    description="AI-powered security analysis for Avalanche subnet transactions",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global analyzer instance
analyzer = AIThreatAnalyzer()

@app.on_event("startup")
async def startup_event():
    """Initialize the application"""
    logger.info("Starting ChainGuard AI Engine...")

    # Initialize MongoDB database connection
    await init_db()

    # Initialize analyzer
    await analyzer.initialize()

    # Start background transaction processing
    asyncio.create_task(analyzer.process_transaction_queue())

    logger.info("ChainGuard AI Engine started successfully")

@app.on_event("shutdown")
async def shutdown_event():
    """Clean shutdown"""
    logger.info("Shutting down ChainGuard AI Engine...")

    # Close database connection
    await close_db()

    logger.info("ChainGuard AI Engine shutdown complete")

@app.post("/analyze", response_model=AnalysisResponse)
async def analyze_transaction(
    request: AnalysisRequest,
    background_tasks: BackgroundTasks
):
    """Analyze a single transaction for security threats"""
    try:
        # Convert transaction to dict format
        tx_data = {
            "hash": request.transaction.tx_hash,
            "from": request.transaction.from_address,
            "to": request.transaction.to_address,
            "value": "0x" + format(int(request.transaction.value), 'x'),
            "gas": "0x" + format(int(request.transaction.gas_used), 'x'),
            "gasLimit": "0x" + format(int(request.transaction.gas_limit), 'x'),
            "gasPrice": "0x" + format(int(request.transaction.gas_price or "0"), 'x'),
            "input": "0x",  # Would come from actual transaction data
            "logs": request.transaction.logs,
            "status": request.transaction.status,
            "timestamp": request.transaction.timestamp,
            "blockNumber": request.transaction.block_number,
            "transactionIndex": request.transaction.transaction_index,
        }
        
        # Analyze transaction
        analysis = await analyzer.analyze_transaction(tx_data)
        
        return AnalysisResponse(
            success=True,
            analysis=analysis
        )
        
    except Exception as e:
        logger.error(f"Error analyzing transaction: {e}")
        return AnalysisResponse(
            success=False,
            error=str(e)
        )

@app.get("/analysis/{tx_hash}")
async def get_analysis(tx_hash: str):
    """Get existing analysis for a transaction"""
    try:
        analysis = await analyzer.get_analysis_by_hash(tx_hash)
        
        if not analysis:
            raise HTTPException(status_code=404, detail="Analysis not found")
        
        return {"success": True, "analysis": analysis}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    try:
        queue_length = await analyzer.get_queue_length()
        
        return HealthResponse(
            status="healthy",
            timestamp=datetime.utcnow(),
            models_loaded=True,
            queue_length=queue_length
        )
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return HealthResponse(
            status="unhealthy",
            timestamp=datetime.utcnow(),
            models_loaded=False,
            queue_length=0
        )

@app.get("/metrics")
async def get_metrics():
    """Basic metrics endpoint"""
    try:
        queue_length = await analyzer.get_queue_length()
        
        return {
            "queue_length": queue_length,
            "timestamp": datetime.utcnow().isoformat(),
            "status": "running"
        }
        
    except Exception as e:
        logger.error(f"Error getting metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "ChainGuard AI Engine",
        "status": "running",
        "timestamp": datetime.utcnow().isoformat()
    }

if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )