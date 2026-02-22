
import sys
import os
import asyncio
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Fix Windows asyncio socket warnings
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# Add api directory to path for absolute imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
#from controllers import face_router
from controllers.email_controller import router as email_router
from controllers.auth_controller import router as auth_router
from controllers.chat_controller import router as chat_router
from controllers.gifts_controller import router as gifts_router

# Initialize FastAPI app
app = FastAPI(
    title="Face Auth API",
    description="Face authentication API with liveness detection and gender analysis",
    version="2.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
#app.include_router(face_router)
app.include_router(email_router)
app.include_router(auth_router)
app.include_router(chat_router)
app.include_router(gifts_router)


@app.get("/")
async def root():
    """API root endpoint"""
    return {
        "name": "Face Auth API",
        "version": "2.0.0",
        "docs": "/docs"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=5000,
        loop="asyncio",
        http="h11"
    )
