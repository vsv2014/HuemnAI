import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)


def get_email_template(name: str, company: str, selected_tools: List[str], use_case: str) -> str:
    """
    Generate HTML email template with glowing logo for demo thank you message.
    """
    tools_list = ", ".join([tool.replace("_", " ").title() for tool in selected_tools])
    
    html_content = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Thank You for Your Demo Request</title>
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
            }}
            .content h1 {{
                color: #ffffff;
                font-size: 28px;
                margin-bottom: 20px;
                text-align: center;
            }}
            .content p {{
                color: #e0e0e0;
                font-size: 16px;
                margin-bottom: 20px;
            }}
            .highlight {{
                background: linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(147, 51, 234, 0.2) 100%);
                border-left: 4px solid #3b82f6;
                padding: 20px;
                margin: 30px 0;
                border-radius: 8px;
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
            .button {{
                display: inline-block;
                margin-top: 20px;
                padding: 12px 30px;
                background: linear-gradient(135deg, #3b82f6 0%, #9333ea 100%);
                color: white;
                text-decoration: none;
                border-radius: 6px;
                font-weight: 600;
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
                <h1>Thank You for Requesting a Demo!</h1>
                <p>Dear {name},</p>
                <p>Thank you for your interest in HUEMN.Ai! We've received your demo request and are excited to show you how our AI-powered platform can transform your enterprise operations.</p>
                
                <div class="highlight">
                    <p style="margin: 0; font-weight: 600; color: #ffffff;">Your Request Details:</p>
                    <p style="margin: 10px 0 0 0;"><strong>Company:</strong> {company}</p>
                    <p style="margin: 5px 0;"><strong>Tools of Interest:</strong> {tools_list}</p>
                    {f'<p style="margin: 5px 0;"><strong>Use Case:</strong> {use_case}</p>' if use_case else ''}
                </div>
                
                <p><strong>What Happens Next?</strong></p>
                <p>We will get in touch with you as soon as possible. One of our leadership team members will reach out to schedule a personalized demo tailored to your specific needs and use cases.</p>
                
                <p>In the meantime, feel free to explore our platform and learn more about how HUEMN.Ai can help your organization.</p>
                
                <div style="text-align: center;">
                    <a href="https://huemn.ai" class="button">Visit Our Website</a>
                </div>
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

def get_welcome_email_template(name: str) -> str:
    """Generate HTML template for welcome email"""
    html_content = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to HUEMN.Ai</title>
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
            }}
            .content h1 {{
                color: #ffffff;
                font-size: 28px;
                margin-bottom: 20px;
                text-align: center;
            }}
            .content p {{
                color: #e0e0e0;
                font-size: 16px;
                margin-bottom: 20px;
            }}
            .button {{
                display: inline-block;
                margin-top: 20px;
                padding: 12px 30px;
                background: linear-gradient(135deg, #3b82f6 0%, #9333ea 100%);
                color: white;
                text-decoration: none;
                border-radius: 6px;
                font-weight: 600;
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
                <h1>Welcome to HUEMN.Ai!</h1>
                <p>Dear {name},</p>
                <p>Welcome aboard! Your account has been successfully created. We are thrilled to have you join our community of innovators.</p>
                <p>HUEMN.Ai empowers you with cutting-edge AI tools to transform your enterprise operations. You now have access to our suite of intelligent agents and services.</p>
                <p>To get started, simply log in to your dashboard and explore the possibilities.</p>
                <div style="text-align: center;">
                    <a href="{settings.FRONTEND_URL}/auth/login" class="button">Log In to Dashboard</a>
                </div>
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

def get_login_notification_template(name: str, time: str, ip: str) -> str:
    """Generate HTML template for login notification"""
    html_content = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Login Detected</title>
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
            }}
            .content h1 {{
                color: #ffffff;
                font-size: 24px;
                margin-bottom: 20px;
                text-align: center;
            }}
            .content p {{
                color: #e0e0e0;
                font-size: 16px;
                margin-bottom: 20px;
            }}
            .highlight {{
                background: rgba(59, 130, 246, 0.1);
                border-left: 4px solid #3b82f6;
                padding: 15px;
                margin: 20px 0;
                border-radius: 4px;
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
                <h1>New Login Alert</h1>
                <p>Dear {name},</p>
                <p>We detected a new login to your HUEMN.Ai account.</p>
                <div class="highlight">
                    <p style="margin: 5px 0;"><strong>Time:</strong> {time}</p>
                    <p style="margin: 5px 0;"><strong>IP Address:</strong> {ip}</p>
                </div>
                <p>If this was you, you can safely ignore this email.</p>
                <p style="color: #ef4444;">If you did not log in, please contact support immediately.</p>
            </div>
            <div class="footer">
                <p><strong>HUEMN.Ai</strong></p>
                <p style="margin-top: 20px; font-size: 12px; color: #666;">
                    This is an automated security notification.
                </p>
            </div>
        </div>
    </body>
    </html>
    """
    return html_content

async def send_demo_thank_you_email(
    name: str,
    email: str,
    company: str,
    selected_tools: List[str],
    use_case: str,
) -> bool:
    """
    Send a thank you email to the user after they submit a demo request.
    Returns True if email was sent successfully, False otherwise.
    """
    # If SMTP is not configured, log and return False
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.warning(
            "SMTP not configured. Set SMTP_USER and SMTP_PASSWORD in environment variables to enable email sending."
        )
        return False

    try:
        # Create message
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "Thank You for Your Demo Request - HUEMN.Ai"
        msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
        msg["To"] = email

        # Create HTML content
        html_content = get_email_template(name, company, selected_tools, use_case)
        html_part = MIMEText(html_content, "html")
        msg.attach(html_part)

        # Send email
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            if settings.SMTP_USE_TLS:
                server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)

        logger.info(f"Demo thank you email sent successfully to {email}")
        return True

    except Exception as e:
        logger.error(f"Failed to send demo thank you email to {email}: {str(e)}")
        return False

async def send_welcome_email(name: str, email: str) -> bool:
    """Send welcome email to new user"""
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.warning("SMTP not configured. Skipping welcome email.")
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "Welcome to HUEMN.Ai - Your Account is Ready"
        msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
        msg["To"] = email

        html_content = get_welcome_email_template(name)
        msg.attach(MIMEText(html_content, "html"))

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            if settings.SMTP_USE_TLS:
                server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
        
        logger.info(f"Welcome email sent to {email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send welcome email to {email}: {str(e)}")
        return False

async def send_login_notification_email(name: str, email: str, ip: str) -> bool:
    """Send login notification email"""
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.warning("SMTP not configured. Skipping login notification email.")
        return False

    try:
        from datetime import datetime
        current_time = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
        
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "New Login Detected - HUEMN.Ai"
        msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
        msg["To"] = email

        html_content = get_login_notification_template(name, current_time, ip)
        msg.attach(MIMEText(html_content, "html"))

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            if settings.SMTP_USE_TLS:
                server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
            
        logger.info(f"Login notification sent to {email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send login notification to {email}: {str(e)}")
        return False

async def send_password_reset_email(name: str, email: str, token: str) -> bool:
    """Send password reset email"""
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.warning("SMTP not configured. Skipping password reset email.")
        return False

    try:
        # Construct reset link
        reset_link = f"{settings.FRONTEND_URL}/auth/reset-password?token={token}"
        
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "Reset Your Password - HUEMN.Ai"
        msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
        msg["To"] = email

        html_content = get_password_reset_template(name, reset_link)
        msg.attach(MIMEText(html_content, "html"))

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            if settings.SMTP_USE_TLS:
                server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
            
        logger.info(f"Password reset email sent to {email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send password reset email to {email}: {str(e)}")
        return False
