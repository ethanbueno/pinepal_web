from flask import Flask, jsonify
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from dotenv import load_dotenv
import os
from auth import auth
from users import users
from scans import scans
from web_auth import web_auth
from diagnose import diagnose
from mobile_scans import mobile_scans
from mobile_sync import mobile_sync
from farmers import farmers

load_dotenv()

app = Flask(__name__)

app.config["JWT_SECRET_KEY"] = os.getenv(
    "JWT_SECRET_KEY"
)
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024  # 10 MB uploads

jwt = JWTManager(app)
CORS(app)

app.register_blueprint(auth)
app.register_blueprint(users)
app.register_blueprint(scans)
app.register_blueprint(web_auth)
app.register_blueprint(diagnose)
app.register_blueprint(mobile_scans)
app.register_blueprint(mobile_sync)
app.register_blueprint(farmers)

# Home
@app.route("/")
def home():
    return jsonify({
        "message": "PinePal API is running"
    })


if __name__ == "__main__":
    app.run(debug=True)
