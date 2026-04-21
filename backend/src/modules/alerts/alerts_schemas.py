import uuid
from datetime import datetime
from pydantic import BaseModel

class AlertResponse(BaseModel):
    id: uuid.UUID
    rule_id: str
    level: str
    title: str
    message: str
    is_read: bool
    is_dismissed: bool
    triggered_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True

class AlertCreate(BaseModel):
    rule_id: str
    level: str
    title: str
    message: str
