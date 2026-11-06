from pydantic import BaseModel, ConfigDict


class StrictRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
