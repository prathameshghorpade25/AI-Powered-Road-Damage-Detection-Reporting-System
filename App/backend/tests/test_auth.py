import os


def test_detect_rejects_without_key_when_configured(client):
    os.environ["API_KEY"] = "secret"

    # Reload dependency by importing fresh module state.
    from importlib import reload

    import app.config as config
    import app.auth as auth

    reload(config)
    reload(auth)

    res = client.post("/detect", files={"file": ("x.jpg", b"not-an-image", "image/jpeg")})
    assert res.status_code == 401


def test_detect_allows_without_key_when_not_configured(client):
    os.environ.pop("API_KEY", None)

    from importlib import reload

    import app.config as config
    import app.auth as auth

    reload(config)
    reload(auth)

    # With API key disabled, request should proceed and fail on invalid image (400).
    res = client.post("/detect", files={"file": ("x.jpg", b"not-an-image", "image/jpeg")})
    assert res.status_code == 400

