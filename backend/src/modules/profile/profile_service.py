import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.profile_model import Profile


async def get_or_create_profile(db: AsyncSession, user_id: uuid.UUID) -> Profile:
    """Kullanıcının profilini getir, yoksa oluştur."""
    result = await db.execute(select(Profile).where(Profile.user_id == user_id))
    profile = result.scalar_one_or_none()

    if not profile:
        profile = Profile(user_id=user_id)
        db.add(profile)
        await db.commit()
        await db.refresh(profile)

    return profile


async def update_profile(
    db: AsyncSession, user_id: uuid.UUID, update_data: dict
) -> Profile:
    """Kullanıcı profilini günceller."""
    profile = await get_or_create_profile(db, user_id)

    # Gelen verideki field'ları güncelle
    for key, value in update_data.items():
        if value is not None:
            setattr(profile, key, value)

    db.add(profile)
    await db.commit()
    await db.refresh(profile)

    return profile
