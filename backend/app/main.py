from fastapi import FastAPI

app = FastAPI(
    title="RuralCare Connect API",
    description="Prototype API for rural healthcare coordination.",
    version="0.1.0",
)


@app.get("/health", tags=["system"])
def health_check() -> dict[str, str]:
    return {"status": "ok"}
