from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.database import get_db
from src.core.dependencies import get_current_user
from src.core.schemas import ApiResponse
from src.models.user_model import User
from src.modules.chat.chat_schemas import ChatMessageResponse, ChatRequest
from src.modules.chat import chat_service

router = APIRouter(prefix="/chat", tags=["Chat"])

@router.get("/", response_model=ApiResponse[list[ChatMessageResponse]])
async def get_history(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    history = await chat_service.get_user_chat_history(db, current_user.id)
    return ApiResponse(success=True, data=history)

@router.post("/", response_model=ApiResponse[ChatMessageResponse])
async def send_message(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Save user message
    await chat_service.save_message(db, current_user.id, "user", request.message)
    
    # Generate and save AI response
    ai_response_text = await chat_service.generate_ai_response(db, current_user.id, request.message)
    ai_message = await chat_service.save_message(db, current_user.id, "assistant", ai_response_text)
    
    return ApiResponse(success=True, data=ai_message)
