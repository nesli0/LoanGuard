import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.database import get_db
from src.core.dependencies import get_current_user
from src.core.schemas import ApiResponse
from src.models.user_model import User
from src.modules.chat.chat_schemas import ChatMessageResponse, ChatRequest, ChatSessionResponse
from src.modules.chat import chat_service

router = APIRouter(prefix="/chat", tags=["Chat"])

@router.get("/sessions", response_model=ApiResponse[list[ChatSessionResponse]])
async def list_sessions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    sessions = await chat_service.get_user_sessions(db, current_user.id)
    return ApiResponse(success=True, data=sessions)

@router.get("/messages", response_model=ApiResponse[list[ChatMessageResponse]])
async def get_messages(
    session_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    history = await chat_service.get_user_chat_history(db, current_user.id, session_id)
    return ApiResponse(success=True, data=history)

@router.post("/", response_model=ApiResponse[ChatMessageResponse])
async def send_message(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # If no session_id, create a new session
    session_id = request.session_id
    if not session_id:
        new_session = await chat_service.create_chat_session(db, current_user.id)
        session_id = new_session.id

    # Save user message
    await chat_service.save_message(db, current_user.id, "user", request.message, session_id)
    
    # Generate and save AI response
    ai_response_text = await chat_service.generate_ai_response(db, current_user.id, request.message, session_id)
    ai_message = await chat_service.save_message(db, current_user.id, "assistant", ai_response_text, session_id)
    
    return ApiResponse(success=True, data=ai_message)

@router.delete("/sessions/{session_id}", response_model=ApiResponse[None])
async def delete_session(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    await chat_service.delete_chat_session(db, current_user.id, session_id)
    return ApiResponse(success=True, message="Sohbet oturumu silindi.")

@router.delete("/", response_model=ApiResponse[None])
async def clear_all_history(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    await chat_service.clear_chat_history(db, current_user.id)
    return ApiResponse(success=True, message="Tüm sohbet geçmişi temizlendi.")
