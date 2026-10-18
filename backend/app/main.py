import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.pipeline import router as pipeline_router

frontend_origins = [
    origin.strip()
    for origin in os.getenv(
        "FRONTEND_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]

app = FastAPI(
    title="AutoBPMN Core Engine API",
    description="Engine Ekstraksi Cerdas Dokumen SOP Menjadi Executable BPMN 2.0 Berbasis Representasi Logika Graf",
    version="1.0.0"
)

# Konfigurasi CORS agar frontend (Vite/React/Vue) dapat mengakses API
app.add_middleware(
    CORSMiddleware,
    allow_origins=frontend_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Hubungkan router modular
app.include_router(pipeline_router, prefix="/api/v1")

@app.get("/health", tags=["Health Check"])
def health_check():
    return {
        "status": "healthy",
        "service": "AutoBPMN Core Engine",
        "tkt_target": "TKT 3 / TKT 5 Functional Prototype"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)