"""Runs the same MobileNetV2 .tflite model as the mobile app.

Preprocessing matches the app (lib/services/classifier_service.dart):
fix the EXIF rotation, convert to RGB, resize to 224x224, scale pixels to 0..1.
"""
import os
import threading

import numpy as np
from ai_edge_litert.interpreter import Interpreter
from PIL import Image, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(HERE, "model", "pinepal_mobilenetv2.tflite")
LABELS_PATH = os.path.join(HERE, "model", "labels.txt")

# The model's labels end with _Disease or _Disorder; the web uses the short names.
SUFFIXES = ("_Disease", "_Disorder")

# The model has a 7th class that PinePal does not use. It is left out of the results
# and the other scores are scaled back up so they still add up to 100%.
EXCLUDED = {"Root_Rot"}

_interpreter = None
_labels = []
_lock = threading.Lock()  # one image at a time, the interpreter is not thread safe


def short_label(raw):
    if raw == "No_Disease":  # already the web name, do not cut the suffix
        return raw
    for suffix in SUFFIXES:
        if raw.endswith(suffix):
            return raw[: -len(suffix)]
    return raw


def _load():
    global _interpreter, _labels
    if _interpreter is not None:
        return

    with open(LABELS_PATH, encoding="utf-8") as f:
        labels = [short_label(line.strip()) for line in f if line.strip()]

    interpreter = Interpreter(model_path=MODEL_PATH, num_threads=2)
    interpreter.allocate_tensors()

    classes = interpreter.get_output_details()[0]["shape"][-1]
    if classes != len(labels):
        raise RuntimeError(f"labels.txt has {len(labels)} labels but the model has {classes} outputs")

    _interpreter = interpreter
    _labels = labels


def _to_probabilities(raw):
    # some exports already end with softmax, some return raw logits
    if raw.min() >= 0 and abs(raw.sum() - 1.0) < 0.05:
        return raw
    exps = np.exp(raw - raw.max())
    return exps / exps.sum()


def classify(image_file, top=3):
    """image_file: a path or file object. Returns [{label, confidence}] best first."""
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

    scores = _to_probabilities(output.astype(np.float64))

    keep = [i for i, name in enumerate(_labels) if name not in EXCLUDED]
    kept_total = scores[keep].sum()
    ranked = sorted(keep, key=lambda i: scores[i], reverse=True)[:top]
    return [{"label": _labels[i], "confidence": round(float(scores[i] / kept_total), 4)} for i in ranked]
