from app.core.celery_app import celery_app

@celery_app.task
def multiply(a, b):
    return a * b
