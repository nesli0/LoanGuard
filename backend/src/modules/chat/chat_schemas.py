import uuid
from datetime import datetime
from pydantic import BaseModel

class ChatSessionResponse(BaseModel):
    id: uuid.UUID
    title: str
    created_at: datetime

    class Config:
        from_attributes = True

class ChatMessageResponse(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID | None = None
    role: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True

class ChatRequest(BaseModel):
    message: str
    session_id: uuid.UUID | None = None
