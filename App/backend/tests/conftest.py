import os

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(autouse=True)
def _disable_model_load_for_tests():
    # Must be set before importing app modules that might load the model.
    os.environ["DISABLE_MODEL_LOAD"] = "1"
    os.environ["MONGODB_URI"] = ""
    os.environ["DISABLE_DOTENV_LOAD"] = "1"
    yield


@pytest.fixture
def client():
    from app.main import app

    return TestClient(app)

