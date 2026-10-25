import pymysql
import os
from dotenv import load_dotenv

# override=True: values in backend/.env win over any DB_* variables already set in Windows
load_dotenv(override=True)

def connect(**options):
    """Open a MySQL connection from the DB_* settings in .env.

    DB_PORT defaults to 3306 (local XAMPP). For a hosted database like Aiven, set
    DB_SSL_CA to the path of the downloaded CA certificate so the connection uses SSL.
    """
    settings = dict(
        host=os.getenv("DB_HOST"),
        port=int(os.getenv("DB_PORT", "3306")),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
    )

    ca = os.getenv("DB_SSL_CA")
    if ca:
        if not os.path.isabs(ca):
            ca = os.path.join(os.path.dirname(os.path.abspath(__file__)), ca)
        settings["ssl"] = {"ca": ca}

    settings.update(options)
    return pymysql.connect(**settings)

def get_connection():

    connection = connect(
        database=os.getenv("DB_NAME"),
        cursorclass=pymysql.cursors.DictCursor
    )

    return connection
