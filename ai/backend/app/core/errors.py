from fastapi import HTTPException

def bad_request(msg):
    raise HTTPException(status_code=400, detail=msg)
