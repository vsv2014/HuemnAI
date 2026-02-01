from fastapi import APIRouter, HTTPException

router = APIRouter()

PRODUCTS = [
    {
        "slug": "customer-service",
        "title": "Customer Service & Agent Console",
        "desc": "Unified platform for customer support and agent ticket resolution. Handles L1 analysis, auto-assignment, and ticket solving.",
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
