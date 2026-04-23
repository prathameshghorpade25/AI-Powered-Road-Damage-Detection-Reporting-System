import io

from PIL import Image


class _StubBox:
    def __init__(self, cls_idx: int, conf: float, xyxy):
        self.cls = cls_idx
        self.conf = conf
        self.xyxy = [xyxy]


class _StubResult:
    def __init__(self):
        self.names = {0: "pothole", 1: "person"}
        self.boxes = [
            _StubBox(0, 0.8, [10.0, 10.0, 110.0, 110.0]),
            _StubBox(1, 0.9, [0.0, 0.0, 50.0, 50.0]),
        ]


class _StubModel:
    def predict(
        self,
        image,
        imgsz: int,
        conf: float,
        iou: float = 0.45,
        max_det: int = 100,
        verbose: bool = False,
    ):
        return [_StubResult()]


def test_detect_returns_only_pothole_class(client, monkeypatch):
    from app import detection_service

    detection_service.set_model_for_tests(_StubModel())
    monkeypatch.setattr(detection_service, "DISABLE_MODEL_LOAD", False, raising=False)

    img = Image.new("RGB", (200, 200), color=(255, 255, 255))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)

    res = client.post("/detect", files={"file": ("x.png", buf.read(), "image/png")})
    assert res.status_code == 200
    data = res.json()
    assert "detections" in data
    assert len(data["detections"]) == 1
    assert data["detections"][0]["label"] == "pothole"
    assert data["detections"][0]["condition"] in {"minor", "moderate", "serious"}

