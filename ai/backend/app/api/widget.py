from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from app.api.auth import get_current_user
from app.db.models.subscription import UserAccount, UserIntegration
from app.db.session import get_db
from sqlalchemy.orm import Session

router = APIRouter()


@router.get("/widget/subscribed-tools")
async def get_subscribed_tools(
    user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's subscribed tools/integrations"""
    integrations = db.query(UserIntegration).filter(
        UserIntegration.user_id == user.id,
        UserIntegration.is_active == True
    ).all()
    
    return {
        "tools": [
            {
                "id": int.id,
                "type": int.integration_type,
                "name": int.integration_name,
                "is_active": int.is_active
            }
            for int in integrations
        ]
    }


@router.get("/widget/embed.js", response_class=HTMLResponse)
async def get_embed_script():
    """Return JavaScript embed script for third-party tools"""
    api_base = "http://127.0.0.1:8001"  # In production, use environment variable
    frontend_base = "http://localhost:3000"  # In production, use environment variable
    
    script = f"""
(function() {{
    'use strict';
    
    const API_BASE = '{api_base}';
    const FRONTEND_BASE = '{frontend_base}';
    
    // Create widget container
    function createWidget() {{
        const widget = document.createElement('div');
        widget.id = 'humane-os-widget';
        widget.style.cssText = 'position: fixed; top: 10px; right: 10px; z-index: 999999;';
        
        // Inject React component (simplified version)
        widget.innerHTML = `
            <div style="background: #1a1f2e; border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; padding: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
                <button id="humane-widget-btn" style="display: flex; align-items: center; gap: 8px; padding: 6px 12px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; color: white; cursor: pointer; font-size: 14px;">
                    <span>🟢</span>
                    <span>Online</span>
                    <span style="font-size: 10px;">▼</span>
                </button>
            </div>
        `;
        
        document.body.appendChild(widget);
        
        // Add click handler
        document.getElementById('humane-widget-btn').addEventListener('click', function() {{
            // Open widget in new window or iframe
            window.open(FRONTEND_BASE + '/widget/status', 'humane-os-widget', 'width=400,height=600');
        }});
    }}
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {{
        document.addEventListener('DOMContentLoaded', createWidget);
    }} else {{
        createWidget();
    }}
}})();
"""
    return HTMLResponse(content=script, media_type="application/javascript")


@router.get("/widget/status")
async def get_widget_status_page():
    """Widget status page (can be embedded in iframe)"""
    html = """
<!DOCTYPE html>
<html>
<head>
    <title>HUMANE.OS Status Widget</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0b0f19;
            color: white;
        }
    </style>
</head>
<body>
    <div id="root"></div>
    <script>
        // This would load the React widget component
        // For now, redirect to main app
        window.location.href = 'http://localhost:3000/widget/status';
    </script>
</body>
</html>
"""
    return HTMLResponse(content=html)

