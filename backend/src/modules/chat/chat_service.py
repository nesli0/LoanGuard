import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from src.models.chat_model import ChatMessage
import asyncio

async def get_user_chat_history(db: AsyncSession, user_id: uuid.UUID) -> list[ChatMessage]:
    query = select(ChatMessage).where(ChatMessage.user_id == user_id).order_by(ChatMessage.created_at.asc())
    result = await db.execute(query)
    return list(result.scalars().all())

async def save_message(db: AsyncSession, user_id: uuid.UUID, role: str, content: str) -> ChatMessage:
    db_message = ChatMessage(user_id=user_id, role=role, content=content)
    db.add(db_message)
    await db.commit()
    await db.refresh(db_message)
    return db_message

async def generate_mock_ai_response(user_message: str) -> str:
    # A simple mock response generator
    await asyncio.sleep(1) # Simulate network delay
    return f"Finansal asistan olarak mesajınızı aldım: '{user_message}'. Sistem henüz geliştirme aşamasında olduğu için size yapay zeka entegrasyonu tamamlandığında detaylı analiz sunabileceğim."
