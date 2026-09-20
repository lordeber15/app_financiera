from pydantic import BaseModel


class LoginRequest(BaseModel):
    password: str


class MeResponse(BaseModel):
    authenticated: bool = True
