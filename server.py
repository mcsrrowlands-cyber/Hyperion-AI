"""
Hyperion AI — Backend Server
Proxies chat requests to the Anthropic API using the key from .env.
Serves the static frontend files so the whole app runs on one origin.

Run:  uvicorn server:app --reload --port 8000
Then: open http://localhost:8000
"""

from __future__ import annotations

import os
from pathlib import Path

import anthropic
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

load_dotenv()

API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
if not API_KEY:
    raise RuntimeError(
        "ANTHROPIC_API_KEY is not set. "
        "Add it to the .env file in the project root."
    )

MODEL   = "claude-sonnet-4-6"
MAX_TOK = 2048

client = anthropic.Anthropic(api_key=API_KEY)

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(title="Hyperion AI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class Message(BaseModel):
    role: str      # "user" | "assistant"
    content: str

class ChatRequest(BaseModel):
    system:   str
    messages: list[Message]

class ChatResponse(BaseModel):
    content: str

# ---------------------------------------------------------------------------
# /chat endpoint
# ---------------------------------------------------------------------------

@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest) -> ChatResponse:
    if not req.messages:
        raise HTTPException(status_code=400, detail="messages must not be empty")

    try:
        resp = client.messages.create(
            model=MODEL,
            max_tokens=MAX_TOK,
            system=req.system,
            messages=[{"role": m.role, "content": m.content} for m in req.messages],
        )
        text = resp.content[0].text if resp.content else ""
        return ChatResponse(content=text)

    except anthropic.AuthenticationError:
        raise HTTPException(status_code=401, detail="Invalid Anthropic API key in .env")
    except anthropic.RateLimitError:
        raise HTTPException(status_code=429, detail="Anthropic rate limit reached")
    except anthropic.APIError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

# ---------------------------------------------------------------------------
# Serve static frontend
# ---------------------------------------------------------------------------
# StaticFiles mounted at "/" shadows POST /chat with a 405, so we use an
# explicit catch-all GET route instead. API routes registered above always
# win for their exact method+path combinations.

BASE_DIR = Path(__file__).parent

STATIC_EXTENSIONS = {
    ".html", ".css", ".js", ".json", ".txt",
    ".png", ".jpg", ".jpeg", ".svg", ".ico", ".woff", ".woff2",
}

@app.get("/")
async def serve_index():
    return FileResponse(BASE_DIR / "index.html")

@app.get("/{file_path:path}")
async def serve_static(file_path: str):
    target = (BASE_DIR / file_path).resolve()
    # Safety: never escape the project directory
    if not str(target).startswith(str(BASE_DIR.resolve())):
        raise HTTPException(status_code=403)
    if target.exists() and target.is_file() and target.suffix in STATIC_EXTENSIONS:
        return FileResponse(target)
    # Fall back to index.html for client-side navigation
    return FileResponse(BASE_DIR / "index.html")
