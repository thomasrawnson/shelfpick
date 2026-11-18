from typing import Any

from pydantic import BaseModel, Field


class ScoresheetWrite(BaseModel):
    """A custom sheet in scoresheet format 1 (see scoresheets/SCHEMA.md).

    The body is validated against ``schema.v1.json`` by the service; this
    model only bounds its size.
    """

    schema_: dict[str, Any] = Field(alias="schema", max_length=20)
