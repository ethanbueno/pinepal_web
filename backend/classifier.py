"""Runs the same PinePal .tflite model as the mobile app.

Preprocessing matches the app (lib/services/classifier_service.dart):
fix the EXIF rotation, convert to RGB, resize to 224x224, scale pixels to 0..1.

The v2 model (MobileNetV3-Large) has one output of [1, 7]:
  index 0     = how sure it is that the photo shows a pineapple
  indexes 1-6 = the 6 conditions, in labels.txt order
File names and both thresholds come from model/pinepal_model_config.json, so a
retrained model only needs its three files replaced.
"""
import json
import os
import threading

import numpy as np
from ai_edge_litert.interpreter import Interpreter
from PIL import Image, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(HERE, "model")
CONFIG_PATH = os.path.join(MODEL_DIR, "pinepal_model_config.json")

# Used when the config is missing a value
DEFAULTS = {
    "model": "pinepal_model.tflite",
    "labels_file": "labels.txt",
    "gate_threshold": 0.5,
    "disease_threshold": 0.6,
}

# Older models' labels end with _Disease or _Disorder; the web uses the short names.
SUFFIXES = ("_Disease", "_Disorder")

# A class PinePal does not use. It is left out of the results and the other
# scores are scaled back up so they still add up to 100%.
EXCLUDED = {"Root_Rot"}

_interpreter = None
_labels = []
_config = dict(DEFAULTS)
_has_pineapple_output = False
_lock = threading.Lock()  # one image at a time, the interpreter is not thread safe


def short_label(raw):
    if raw == "No_Disease":  # already the web name, do not cut the suffix
        return raw
    for suffix in SUFFIXES:
        if raw.endswith(suffix):
            return raw[: -len(suffix)]
    return raw


def _load():
    global _interpreter, _labels, _config, _has_pineapple_output
    if _interpreter is not None:
        return

    config = dict(DEFAULTS)
    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH, encoding="utf-8") as f:
            config.update({k: v for k, v in json.load(f).items() if v is not None})

    with open(os.path.join(MODEL_DIR, config["labels_file"]), encoding="utf-8") as f:
        labels = [short_label(line.strip()) for line in f if line.strip()]

    interpreter = Interpreter(model_path=os.path.join(MODEL_DIR, config["model"]), num_threads=2)
    interpreter.allocate_tensors()

    # labels.txt lists the conditions only. The v2 model has one extra output in
    # front of them for the pineapple check; an older model has none.
    outputs = interpreter.get_output_details()[0]["shape"][-1]
    if outputs == len(labels) + 1:
        has_pineapple = True
    elif outputs == len(labels):
        has_pineapple = False
    else:
        raise RuntimeError(f"{config['labels_file']} has {len(labels)} labels but the model has {outputs} outputs")

    _interpreter = interpreter
    _labels = labels
    _config = config
    _has_pineapple_output = has_pineapple


def thresholds():
    """(pineapple threshold, disease threshold) from the config."""
    with _lock:
        _load()
        return float(_config["gate_threshold"]), float(_config["disease_threshold"])


def _to_probabilities(raw):
    # some exports already end with softmax, some return raw logits
    if raw.min() >= 0 and abs(raw.sum() - 1.0) < 0.05:
        return raw
    exps = np.exp(raw - raw.max())
    return exps / exps.sum()


def analyze(image_file, top=3):
    """image_file: a path or file object.

    Returns {
        "is_pineapple": bool,
        "pineapple_score": float or None (None for an older model without the check),
        "predictions": [{label, confidence}] best first,
    }
    """
    image = Image.open(image_file)
    image = ImageOps.exif_transpose(image).convert("RGB")

    with _lock:
        _load()
        size = _interpreter.get_input_details()[0]["shape"][1]
        resized = image.resize((size, size), Image.BILINEAR)
        batch = np.asarray(resized, dtype=np.float32)[np.newaxis] / 255.0

        _interpreter.set_tensor(_interpreter.get_input_details()[0]["index"], batch)
        _interpreter.invoke()
        output = _interpreter.get_tensor(_interpreter.get_output_details()[0]["index"])[0]
        has_pineapple = _has_pineapple_output
        gate = float(_config["gate_threshold"])

    output = output.astype(np.float64)
    pineapple_score = None
    if has_pineapple:
        pineapple_score = float(output[0])
        output = output[1:]

    scores = _to_probabilities(output)

    keep = [i for i, name in enumerate(_labels) if name not in EXCLUDED]
    kept_total = scores[keep].sum()
    ranked = sorted(keep, key=lambda i: scores[i], reverse=True)[:top]
    return {
        "is_pineapple": pineapple_score is None or pineapple_score >= gate,
        "pineapple_score": None if pineapple_score is None else round(pineapple_score, 4),
        "predictions": [
            {"label": _labels[i], "confidence": round(float(scores[i] / kept_total), 4)} for i in ranked
        ],
    }


def classify(image_file, top=3):
    """Old interface: only the disease predictions, best first."""
    return analyze(image_file, top)["predictions"]
