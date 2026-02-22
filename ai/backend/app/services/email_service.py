import logging
import smtplib
import base64
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.core.config import settings
import requests

logger = logging.getLogger(__name__)

def get_otp_email_template(otp_code: str) -> str:
    """Generate HTML template for OTP email"""
    html_content = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your Verification Code</title>
        <style>
            @keyframes glow {{
                0%, 100% {{ 
                    filter: drop-shadow(0 0 10px rgba(59, 130, 246, 0.5)) 
                            drop-shadow(0 0 20px rgba(59, 130, 246, 0.3))
                            drop-shadow(0 0 30px rgba(147, 51, 234, 0.2));
                }}
                50% {{ 
                    filter: drop-shadow(0 0 20px rgba(59, 130, 246, 0.8)) 
                            drop-shadow(0 0 30px rgba(59, 130, 246, 0.5))
                            drop-shadow(0 0 40px rgba(147, 51, 234, 0.4));
                }}
            }}
            .logo-container {{
                text-align: center;
                padding: 30px 0;
                animation: glow 3s ease-in-out infinite;
            }}
            .logo {{
                display: inline-block;
                width: 80px;
                height: 80px;
                background: linear-gradient(135deg, #3b82f6 0%, #9333ea 100%);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 40px;
                font-weight: bold;
                color: white;
                box-shadow: 0 0 30px rgba(59, 130, 246, 0.5),
                           0 0 60px rgba(147, 51, 234, 0.3);
            }}
            body {{
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                background-color: #0b0f19;
                color: #ffffff;
                margin: 0;
                padding: 0;
            }}
            .container {{
                max-width: 600px;
                margin: 0 auto;
                background-color: #1a1f2e;
                border-radius: 12px;
                overflow: hidden;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
            }}
            .header {{
                background: linear-gradient(135deg, #1a1f2e 0%, #0b0f19 100%);
                padding: 40px 30px;
                text-align: center;
            }}
            .content {{
                padding: 40px 30px;
                line-height: 1.8;
                text-align: center;
            }}
            .content h1 {{
                color: #ffffff;
                font-size: 28px;
                margin-bottom: 20px;
            }}
            .content p {{
                color: #e0e0e0;
                font-size: 16px;
                margin-bottom: 20px;
            }}
            .otp-code {{
                font-size: 36px;
                font-weight: 800;
                letter-spacing: 8px;
                color: #3b82f6;
                margin: 30px 0;
                padding: 20px;
                background: rgba(59, 130, 246, 0.1);
                border-radius: 8px;
                border: 1px dashed rgba(59, 130, 246, 0.3);
                display: inline-block;
            }}
            .footer {{
                background-color: #0b0f19;
                padding: 30px;
                text-align: center;
                border-top: 1px solid rgba(255, 255, 255, 0.1);
            }}
            .footer p {{
                color: #a0a0a0;
                font-size: 14px;
                margin: 5px 0;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo-container">
                    <div class="logo">H</div>
                </div>
            </div>
            <div class="content">
                <h1>Verification Code</h1>
                <p>Please use the following code to verify your email address. This code will expire in 10 minutes.</p>
                
                <div class="otp-code">{otp_code}</div>
                
                <p>If you didn't request this code, you can safely ignore this email.</p>
            </div>
            <div class="footer">
                <p><strong>HUEMN.Ai</strong></p>
                <p>Reimagine the enterprise with AI</p>
                <p style="margin-top: 20px; font-size: 12px; color: #666;">
                    This is an automated message. Please do not reply directly to this email.
                </p>
            </div>
        </div>
    </body>
    </html>
    """
    return html_content

async def send_otp_email(email: str, otp_code: str) -> bool:
    """Send OTP email"""
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.warning("SMTP not configured. Skipping OTP email.")
        # For development, print OTP to console so we can still test
        print(f"============================================")
        print(f"DEV OTP for {email}: {otp_code}")
        print(f"============================================")
        return True # Return True in dev to simulate success

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "Your Verification Code - HUEMN.Ai"
        msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
        msg["To"] = email

        html_content = get_otp_email_template(otp_code)
        msg.attach(MIMEText(html_content, "html"))

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            if settings.SMTP_USE_TLS:
                server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
            
        logger.info(f"OTP email sent to {email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send OTP email to {email}: {str(e)}")
        return False

async def send_welcome_email(email: str, username: str) -> bool:
    """Send welcome email (Stub)"""
    logger.info(f"Welcome email stub called for {email}")
    return True

async def send_login_notification_email(email: str, ip_address: str, user_agent: str) -> bool:
    """Send login notification email to admin address."""
    admin_email = settings.LOGIN_ALERT_EMAIL or settings.SMTP_USER
    if not admin_email:
        logger.warning("No admin email configured for login notifications.")
        return True

    subject = f"HUEMN Login: {email}"
    body = (
        f"A user has logged in.\n\n"
        f"Email: {email}\n"
        f"IP Address: {ip_address}\n"
        f"User Agent: {user_agent or 'unknown'}\n"
    )

    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.warning("SMTP not configured. Skipping login notification email.")
        print("============================================")
        print(f"DEV Login notification to {admin_email}")
        print(f"Subject: {subject}")
        print(f"Body:\n{body}")
        print("============================================")
        return True

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
        msg["To"] = admin_email

        text_part = MIMEText(body, "plain")
        html_part = MIMEText(
            f"""
            <html>
              <body style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color: #0b0f19; color: #ffffff; padding: 24px;">
                <div style="max-width: 600px; margin: 0 auto; background-color: #1a1f2e; border-radius: 12px; overflow: hidden; border: 1px solid rgba(255,255,255,0.08);">
                  <div style="padding: 20px 24px; border-bottom: 1px solid rgba(255,255,255,0.06);">
                    <h1 style="margin: 0; font-size: 20px; color: #ffffff;">New login</h1>
                  </div>
                  <div style="padding: 20px 24px; font-size: 14px; line-height: 1.7; color: #e5e7eb; white-space: pre-wrap;">
                    <p>A user has logged in to HUEMN.</p>
                    <p><strong>Email:</strong> {email}</p>
                    <p><strong>IP Address:</strong> {ip_address}</p>
                    <p><strong>User Agent:</strong> {user_agent or 'unknown'}</p>
                  </div>
                  <div style="padding: 16px 24px; font-size: 12px; color: #9ca3af; border-top: 1px solid rgba(255,255,255,0.06);">
                    HUEMN.Ai · Login Notification
                  </div>
                </div>
              </body>
            </html>
            """,
            "html",
        )

        msg.attach(text_part)
        msg.attach(html_part)

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            if settings.SMTP_USE_TLS:
                server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)

        logger.info(f"Login notification email sent to admin for {email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send login notification email for {email}: {str(e)}")
        return False

async def send_password_reset_email(email: str, token: str) -> bool:
    """Send password reset email (Stub)"""
    logger.info(f"Password reset stub called for {email} with token {token}")
    return True

async def send_demo_thank_you_email(email: str, name: str) -> bool:
    """Send demo thank you email (Stub)"""
    logger.info(f"Demo thank you email stub called for {email}")
    return True

async def send_hr_announcement_email(to_email: str, subject: str, body: str, google_access_token: str | None = None) -> bool:
    """Send an HR announcement email using Gmail API when available, otherwise SMTP."""
    # Build the message once
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["To"] = to_email

    text_part = MIMEText(body, "plain")
    html_part = MIMEText(
        f"""
        <html>
          <body style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color: #0b0f19; color: #ffffff; padding: 24px;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #1a1f2e; border-radius: 12px; overflow: hidden; border: 1px solid rgba(255,255,255,0.08);">
              <div style="padding: 20px 24px; border-bottom: 1px solid rgba(255,255,255,0.06);">
                <h1 style="margin: 0; font-size: 20px; color: #ffffff;">{subject}</h1>
              </div>
              <div style="padding: 20px 24px; font-size: 14px; line-height: 1.7; color: #e5e7eb; white-space: pre-wrap;">
                {body}
              </div>
              <div style="padding: 16px 24px; font-size: 12px; color: #9ca3af; border-top: 1px solid rgba(255,255,255,0.06);">
                Sent from HUEMN.Ai · HR Services
              </div>
            </div>
          </body>
        </html>
        """,
        "html",
    )

    msg.attach(text_part)
    msg.attach(html_part)

    # 1. Try Gmail API if we have a Google access token
    if google_access_token:
        try:
            raw_message = base64.urlsafe_b64encode(msg.as_bytes()).decode()
            response = requests.post(
                "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
                headers={
                    "Authorization": f"Bearer {google_access_token}",
                    "Content-Type": "application/json",
                },
                json={"raw": raw_message},
                timeout=10,
            )
            if response.status_code in (200, 202):
                logger.info(f"HR announcement email sent via Gmail API to {to_email}")
                return True
            logger.error(
                f"Gmail API send failed for {to_email}: {response.status_code} {response.text}"
            )
        except Exception as e:
            logger.error(f"Gmail API send error for {to_email}: {str(e)}")

    # 2. Fallback to SMTP configuration
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.warning("SMTP not configured. Skipping HR announcement email.")
        print("============================================")
        print(f"DEV HR announcement email to {to_email}")
        print(f"Subject: {subject}")
        print(f"Body: {body}")
        print("============================================")
        return True

    try:
        msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            if settings.SMTP_USE_TLS:
                server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)

        logger.info(f"HR announcement email sent to {to_email} via SMTP")
        return True
    except Exception as e:
        logger.error(f"Failed to send HR announcement email to {to_email}: {str(e)}")
        return False
