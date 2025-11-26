#!/usr/bin/env python3
"""
Stable Diffusion backend server for Dungeon Scribe.
Uses SDXL Turbo for fast image generation.
"""

import io
import base64
import logging
from contextlib import asynccontextmanager

import torch
from PIL import Image
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from diffusers import AutoPipelineForText2Image

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global pipeline
pipe = None

class GenerateRequest(BaseModel):
    prompt: str
    negative_prompt: str = "blurry, low quality, distorted, ugly"
    width: int = 1024
    height: int = 1024
    steps: int = 4
    seed: int = -1

class GenerateResponse(BaseModel):
    success: bool
    image_base64: str = ""
    seed: int = 0
    error: str = ""

class HealthResponse(BaseModel):
    status: str
    model: str
    device: str

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load model on startup."""
    global pipe
    logger.info("Loading SDXL Turbo model...")
    
    try:
        device = "cuda" if torch.cuda.is_available() else "cpu"
        dtype = torch.float16 if device == "cuda" else torch.float32
        
        logger.info(f"Using device: {device}")
        
        pipe = AutoPipelineForText2Image.from_pretrained(
            "stabilityai/sdxl-turbo",
            torch_dtype=dtype,
            variant="fp16" if device == "cuda" else None,
        )
        pipe.to(device)
        logger.info("Model loaded successfully!")
    except Exception as e:
        logger.error(f"Failed to load model: {e}")
        raise
    
    yield
    
    # Cleanup
    if pipe is not None:
        del pipe
        torch.cuda.empty_cache()

app = FastAPI(title="Dungeon Scribe SD Backend", lifespan=lifespan)

# Allow CORS for Electron
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health", response_model=HealthResponse)
async def health():
    """Check if the server is ready."""
    if pipe is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    return HealthResponse(
        status="ready",
        model="sdxl-turbo",
        device=str(pipe.device)
    )

@app.post("/generate", response_model=GenerateResponse)
async def generate(request: GenerateRequest):
    """Generate an image from a prompt."""
    if pipe is None:
        return GenerateResponse(success=False, error="Model not loaded")
    
    try:
        # Set seed
        device = str(pipe.device)
        if request.seed >= 0:
            generator = torch.Generator(device).manual_seed(request.seed)
            seed = request.seed
        else:
            seed = torch.randint(0, 2**32, (1,)).item()
            generator = torch.Generator(device).manual_seed(seed)
        
        logger.info(f"Generating: {request.prompt[:50]}...")
        
        # Generate image
        image = pipe(
            prompt=request.prompt,
            negative_prompt=request.negative_prompt,
            width=request.width,
            height=request.height,
            num_inference_steps=request.steps,
            guidance_scale=0.0,  # SDXL Turbo doesn't need guidance
            generator=generator,
        ).images[0]
        
        # Convert to base64
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        image_base64 = base64.b64encode(buffer.getvalue()).decode()
        
        logger.info(f"Generated image with seed {seed}")
        
        return GenerateResponse(
            success=True,
            image_base64=image_base64,
            seed=seed
        )
    
    except Exception as e:
        logger.error(f"Generation failed: {e}")
        return GenerateResponse(success=False, error=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=7860)

