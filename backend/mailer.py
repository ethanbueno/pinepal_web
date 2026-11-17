"""Send email through a Gmail account (used for password reset codes, password_reset.py).

Set these in backend/.env (and in Render's environment when deployed):
    MAIL_USERNAME=pinepal.app@gmail.com     the Gmail address that sends the emails
    MAIL_APP_PASSWORD=abcd efgh ijkl mnop    a Gmail "app password", NOT the account's password
    MAIL_FROM_NAME=PinePal                   optional, the sender name people see

To make an app password: sign in to that Gmail account, turn on 2-Step Verification
(myaccount.google.com/security), then open myaccount.google.com/apppasswords, create one
named "PinePal" and copy the 16 letters. Gmail only accepts app passwords for this.

It connects to smtp.gmail.com on port 465 over SSL, so the email and the login are encrypted
on the way to Google.
"""
import logging
import os
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr

from dotenv import load_dotenv

load_dotenv(override=True)

log = logging.getLogger(__name__)

SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 465
TIMEOUT_SECONDS = 15


def is_configured():
    return bool(os.getenv("MAIL_USERNAME") and os.getenv("MAIL_APP_PASSWORD"))


def send_email(to, subject, text, html=None):
    """Send one email. Returns True when Gmail accepted it, False otherwise (logged)."""
    if not is_configured():
        log.error("Email is not set up: put MAIL_USERNAME and MAIL_APP_PASSWORD in backend/.env")
        return False

    sender = os.getenv("MAIL_USERNAME")
    message = EmailMessage()
    message["From"] = formataddr((os.getenv("MAIL_FROM_NAME") or "PinePal", sender))
    message["To"] = to
    message["Subject"] = subject
    message.set_content(text)
    if html:
        message.add_alternative(html, subtype="html")

    try:
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=ssl.create_default_context(),
                              timeout=TIMEOUT_SECONDS) as server:
            # Google shows app passwords in groups of four; the spaces aren't part of it
            server.login(sender, os.getenv("MAIL_APP_PASSWORD").replace(" ", ""))
            server.send_message(message)
        return True
    except (smtplib.SMTPException, OSError):
        log.exception("Could not send an email through Gmail")
        return False
