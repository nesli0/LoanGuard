import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ProfileBase(BaseModel):
    first_name: str | None = Field(default=None, description="Ad")
    last_name: str | None = Field(default=None, description="Soyad")
    phone: str | None = Field(default=None, description="Telefon numarası")
    avatar_url: str | None = Field(default=None, description="Profil fotoğrafı URL")
    
    age: int | None = Field(default=None, ge=18, le=120, description="Yaş")
    marital_status: str | None = Field(default=None, description="bekar | evli | dul | boşanmış")
    employment_type: str | None = Field(default=None, description="maaşlı | serbest | işsiz | emekli")
    education: str | None = Field(default=None, description="ilkokul | lise | üniversite | yükseklisans")
    dependents: int | None = Field(default=None, ge=0, description="Bakmakla yükümlü olunan kişi sayısı")
    city: str | None = Field(default=None, description="Şehir")


class ProfileUpdateRequest(ProfileBase):
    pass


class ProfileResponse(ProfileBase):
    id: uuid.UUID
    user_id: uuid.UUID
    dependents: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
