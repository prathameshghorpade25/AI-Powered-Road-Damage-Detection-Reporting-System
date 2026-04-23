## Backend (canonical)

### Layout

The backend is a Python package under `app/`:

- `app/main.py`: ASGI app (`app.main:app`)
- `app/app_factory.py`: FastAPI app factory
- `app/*`: auth, detection, services, stores

### Run

```bash
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### Tests

```bash
python -m pytest
```

### Dependency pinning

Pinned deps are in `requirements.txt` (generated).

To update pins:

```bash
python -m pip install pip-tools
python -m piptools compile --generate-hashes --allow-unsafe --output-file requirements.txt requirements.in
```

# YOLOv8 Pothole Detection – Inference

This folder contains the inference service for the pothole detection model, implemented using FastAPI and served via a GPU enabled Docker container.

The API receives an image, runs YOLOv8 inference, and returns bounding boxes and confidence scores.

## Overview

The service is built using `FastAPI` and it is serving the custom model that was trained in the `training` pipeline. Then the application was containerized with Docker and configured to run on GPU (CUDA) for accelerated inference.

## API Endpoints

`GET /health`

Health checkpoint used to verify if the server is up and running

Response:

```json
{
  "status": "ok"
}
```

`POST /detect`

This is the main endpoint, it runs the pothole detection:

Headers:

```
x-api-key: <API_KEY>
```

You can generate an `API_KEY` using `uuid.uuid4()`

Body:

```
multipart/form-data
file: image/jpeg
```

Response:

```json
{
  "detections": [
    {
      "label": "pothole",
      "confidence": 0.78,
      "box": [x1, y1, x2, y2]
    }
  ],
  "duration_ms": 496.8
}
```

`confidence` would be between [0,1] and the `box` coordinates are the source image pixel space

## Running with Docker

To build the image execute the following command:

```bash
docker build -t pothole-api-gpu .
```

To run the container, execute the following:

```bash
docker run --gpus all -p 8000:8000 \
  -e API_KEY=your_secret_key \
  -e MODEL_PATH=https://huggingface.co/peterhdd/pothole-detection-yolov8/resolve/main/best.pt \
  -e YOLO_DEVICE=cuda:0 \
  pothole-api-gpu
```

So here we specify that we want to run it in a GPU environment, also we add the environment variable `MODEL_PATH` specifying the model we trained, `API_KEY` for authentication and `YOLO_DEVICE` with `cuda:0` to specify to use the first available Nvidia GPU in the system.

After running the API will be available at:

```
http://<server-ip>:8000
```

## Testing the API

To check if the server is running:

```bash
curl http://localhost:8000/health
```

To test the `detect` endpoint:

```bash
curl -X POST http://localhost:8000/detect \
  -H "x-api-key: your_secret_key" \
  -F "file=@test.jpg"
```

## Security Notes

- This API uses header-based API key authentication
- Intended for controlled client access (mobile app, internal services)
- Not exposed publicly without authentication

## Related Components

- Training: See `/training` folder
- Mobile client: See `/app` folder
- Model: https://huggingface.co/peterhdd/pothole-detection-yolov8