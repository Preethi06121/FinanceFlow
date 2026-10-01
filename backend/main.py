from fastapi import FastAPI

app = FastAPI(title="FinanceFlow API")

@app.get("/")
def root():
    return {"message": "FinanceFlow API is running"}