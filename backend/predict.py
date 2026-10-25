import random

CLASSES = [
    "Black Rot",
    "Fruitlet Core Rot",
    "Heart Rot",
    "Mealybug Wilt",
    "Healthy",
]


def predict(image_path):
    """Return (predicted_class, confidence_percent) for an image file.

    PLACEHOLDER: no CNN model was provided, so this returns a random class.
    Replace the body with your model's inference, e.g. load a Keras/PyTorch
    model once at import time and run it on `image_path`.
    """
    return random.choice(CLASSES), round(random.uniform(70, 99), 2)
