# YOLOv8 Pothole Detection

![Docker](https://img.shields.io/badge/Docker-GPU%20Ready-2496ED) ![FastAPI](https://img.shields.io/badge/API-FastAPI-009688) ![YOLOv8](https://img.shields.io/badge/Model-YOLOv8-blue) ![License](https://img.shields.io/badge/License-Apache--2.0-green)

YOLOv8 Pothole Detection is used to detect potholes in road images, deploys a GPU inference API using FastAPI and Docker, and consumes it from a React Native (Expo) mobile app with real-time bounding box visualization. Nebius Cloud was used for training and inference.

The repository demonstrates the full ML lifecycle:

```
dataset → training → evaluation → deployment → client integration.
```

## Project Overview

In this project, I fine-tuned a Yolov8 model on a pothole dataset (model can be found in huggingface), i trained the model on Nebius Cloud GPUs (CUDA) and then the inference is done using `FastAPI`. Also for the inference part, i had created a GPU-enabled Docker container so it can be easily setup in the Virtual machine. Then in the `app` part, i created a mobile app using react-native (expo) that would render the boxes our the pothole and gives you the confidence score.

## Sample Screenshot using the App


| ![sample-inference-00](/images/sample-inference-00.png) | ![sample-inference-01](/images/sample-inference-01.png) |
|:--:|:--:|


## Repository Structure

```
├── App/
│   ├── backend/     # FastAPI backend (canonical)
│   └── frontend/    # Web user dashboard (canonical)
├── training/        # YOLOv8 fine-tuning, configs, metrics (legacy)
├── inference/       # Inference server + Dockerfile (legacy)
├── mobile/          # React Native (Expo) app (legacy)
├── README.md        # Project Readme
```

## Local development (canonical apps)

### Backend API (FastAPI) — port 8000

From `pothole-detection-yolo/`:

```bash
cd App/backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

- **Health check**: `http://127.0.0.1:8000/health`
- **Detect**: `http://127.0.0.1:8000/detect` (multipart form field name: `file`)

Notes:
- The backend is a proper Python package under `App/backend/app/` so imports look like `from app.auth import ...`.
- Dependencies are **pinned** in `App/backend/requirements.txt` (generated from `requirements.in` via `pip-tools`).
- If pothole **count** feels off, tune inference with env vars:
  - `YOLO_CONF` (default `0.20`): lower to detect more (may increase false positives), raise to be stricter
  - `YOLO_IOU` (default `0.45`): lower to merge duplicates more aggressively, raise if nearby potholes get merged
  - `YOLO_IMGSZ` (default `960`): raise to better detect small potholes (slower)
  - `YOLO_MAXDET` (default `100`): upper bound on detections returned

### User panel (web dashboard) — port 5173

From `pothole-detection-yolo/`:

```bash
cd App/frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

- **User panel link**: `http://127.0.0.1:5173/`
- **Routes** (3-zone dashboard: sidebar · main · trust panel):
  - **Home** (`/`): quick actions, live status, recent reports, AI activity, map preview, drafts/offline.
  - **Scan road** (`/scan`): YOLO scan (feeds the “live AI result” + activity feed).
  - **Report issue** (`/report`): guided report wizard (device-scoped list via `device_id`).
  - **My reports** (`/reports`), **Saved places** (`/places`), **Notifications** (`/notifications`), **Settings** (`/settings`), **Privacy** (`/privacy`).
- Configure the web app with `App/frontend/.env` (see `App/frontend/.env.example`):
  - `VITE_API_BASE_URL` (e.g. `http://127.0.0.1:8000`)
  - `VITE_API_KEY` (must match backend `API_KEY` when auth is enabled)

### Citizen reporting API (backend)

All routes require the same `x-api-key` header as the rest of the API when `API_KEY` is set.

- `POST /citizen/geocode/reverse` — JSON `{ "lat", "lon" }` → address line, landmark suggestions, ward hint (uses [Nominatim](https://nominatim.org/); set a real contact in `NOMINATIM_USER_AGENT`).
- `POST /citizen/reports/preview-message` — draft authority message without saving (for the confirmation step).
- `POST /citizen/reports/submit` — `multipart/form-data`: field `payload` (JSON) + optional `image` file.
- `GET /citizen/reports?device_id=...` — list reports for that device only (omit `device_id` → empty list).
- `GET /citizen/reports/{report_id}` — tracking metadata + **demo lifecycle** (`lifecycle` block simulates authority progression by report age; replace with real webhooks in production).

**LLM drafting (optional):** set `ANTHROPIC_API_KEY` on the server only. If unset, the API falls back to a deterministic template message. **Never** put provider API keys in the frontend or in git.

### Authority panel (web dashboard) — port 5174 (planned)

We will implement this as a **separate app** so it opens on its own link/port (separate from the user panel).

- **Planned canonical location**: `pothole-detection-yolo/apps/authority-dashboard`
- **Planned link**: `http://127.0.0.1:5174/`

## Model Training

```
Model: YOLOv8s
Task: Object Detection
Classes: 1 (pothole)
Image Size: 640×640
Epochs: 100
Framework: Ultralytics YOLO
```

The training command used:

```
yolo detect train \
  model=yolov8s.pt \
  data=data.yaml \
  epochs=100 \
  imgsz=640 \
  batch=8
```

The `data.yml` is the format for `Yolov8` to be able to understand the dataset. The `epochs` is one full pass over the entire training dataset, `imgsz` resizes all the images to 640×640 before training and `batch=8` means 8 images are processed together per training step, and multiple batches make up one epoch.

The Dataset used is the following:

[Pothole dataset](https://huggingface.co/datasets/Ryukijano/Pothole-detection-Yolov8)

The training results and the model can be found in huggingface:

[Yolov8 pothole detection model](https://huggingface.co/peterhdd/pothole-detection-yolov8)


## Inference 

The stack used is:

```
FastAPI
Ultralytics YOLO
PyTorch
Docker (GPU)
```

Endpoints:

- `/detect` endpoint for image inference
- `/health` endpoint for readiness checks

The server has the following features:

- API key authentication for security
- Structured logging
- CORS enabled
- GPU/CPU auto-selection

Example response:

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

### Docker (GPU Inference)

The inference service is packaged as a CUDA-enabled Docker container.

Build:

```bash
docker build -t pothole-api-gpu .
```

Run (GPU):

```bash
docker run --gpus all -p 8000:8000 \
  -e API_KEY=your_api_key \
  -e MODEL_PATH=https://huggingface.co/peterhdd/pothole-detection-yolov8/resolve/main/best.pt \
  pothole-api-gpu
```

## Mobile App (React Native)

The app is built using React Native (Expo), I use the device camera to caputre images and then call the `/detect` endpoint which then reads the file and the model performs the prediction and sends it back to the mobile app. After recieving the result, the bounding boxes are drawn and the confidence probability and label are added.

## License

Apache License 2.0

## Support!
Support the repository by joining the [stargazers](https://github.com/PeterHdd/pothole-detection-yolo/stargazers) for this repo ⭐

### Created & Maintained By

[Peter](https://github.com/peterhdd) ([@peterndev](https://www.twitter.com/peterndev))

If you found this project helpful or you learned something from the tutorials and want to thank me, consider buying me a cup of :coffee:

<a href="https://www.buymeacoffee.com/peterhaddad" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-red.png" alt="Buy Me A Coffee" height= "45px" width="174px"></a>
