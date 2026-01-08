from fastapi import APIRouter

router = APIRouter()

@router.post("/")
async def feedback(data: dict):
    return {"received": True, "data": data}
