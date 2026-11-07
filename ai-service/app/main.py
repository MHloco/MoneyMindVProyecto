from secrets import compare_digest
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from starlette.concurrency import run_in_threadpool

from .config import settings
from .gemini import reply
from .orchestrator import analyze
from .schemas import AnalysisRequest, AnalysisResponse, ChatRequest, ChatResponse

app = FastAPI(title='MoneyMindV Financial Agents', version='1.0.0')
bearer = HTTPBearer(auto_error=False)


def require_backend(credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]):
    token = settings()['token']
    if len(token) < 32:
        raise HTTPException(503, 'El servicio de agentes no está configurado.')
    if not credentials or not compare_digest(credentials.credentials.encode(), token.encode()):
        raise HTTPException(401, 'Credenciales de servicio inválidas.')


@app.exception_handler(RequestValidationError)
async def invalid_request(request, exc):
    # Avoid reflecting financial input or tokens through validation errors.
    return JSONResponse(status_code=422, content={'detail': 'Solicitud inválida para los agentes.'})


@app.exception_handler(ValueError)
async def invalid_finances(request, exc):
    return JSONResponse(status_code=422, content={'detail': 'Revisa las fechas y valores de tus datos financieros.'})


@app.get('/health')
def health():
    return {'status': 'ok', 'service': 'moneymind-agents'}


@app.get('/v1/status', dependencies=[Depends(require_backend)])
def status():
    return {'analysis': True, 'chat': bool(settings()['api_key'])}


@app.post('/v1/analyze', response_model=AnalysisResponse, dependencies=[Depends(require_backend)])
def analyze_finances(request: AnalysisRequest):
    return analyze(request)


@app.post('/v1/chat', response_model=ChatResponse, dependencies=[Depends(require_backend)])
async def chat(request: ChatRequest):
    analysis = await run_in_threadpool(analyze, request)
    return await reply(request, analysis)
