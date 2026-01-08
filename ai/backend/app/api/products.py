from fastapi import APIRouter, HTTPException

router = APIRouter()

PRODUCTS = [
    {
        "slug": "customer-service",
        "title": "Customer Service",
        "desc": "Customer-facing assistance and conversational support for users.",
    },
    {
        "slug": "ticket-assigner",
        "title": "Ticket Assigner",
        "desc": "Automated ticket routing and intelligent assignment to teams and agents.",
    },
    {
        "slug": "status-updater",
        "title": "Status Updater",
        "desc": "Automated status updates for requests, incidents, and workflows.",
    },
    {
        "slug": "hr-services",
        "title": "HR Services",
        "desc": "Employee lifecycle support: hiring, onboarding, policies, and HR queries.",
    },
    {
        "slug": "knowledge-ai",
        "title": "Knowledge AI",
        "desc": "Search and surface SOPs, documents, and internal knowledge effectively.",
    },
    {
        "slug": "economic-trends",
        "title": "Economic Trends Tracker",
        "desc": "Track national, international, and state-level economic trends with AI-powered analysis and guidance.",
    },
]


@router.get("/")
async def list_products():
    return PRODUCTS


@router.get("/{slug}")
async def get_product(slug: str):
    for p in PRODUCTS:
        if p["slug"] == slug:
            return p
    raise HTTPException(status_code=404, detail="Product not found")
