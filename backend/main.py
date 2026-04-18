from __future__ import annotations

import ssl  # Fix SSL certificate verification on Python 3.14 / Windows
ssl._create_default_https_context = ssl._create_unverified_context  # type: ignore[attr-defined]

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

try:
    from backend.api.router import api_router
    from backend.config.settings import get_settings
    from backend.auth_db import init_db
except ModuleNotFoundError:  # pragma: no cover - supports execution from backend/
    from api.router import api_router
    from config.settings import get_settings
    from auth_db import init_db


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="AlgoVision API",
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.frontend_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router)
    
    init_db()
    
    return app


app = create_app()
