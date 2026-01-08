from celery import Celery
from app.core.config import settings

broker = settings.CELERY_BROKER_URL or settings.REDIS_URL
backend = settings.CELERY_RESULT_BACKEND or settings.REDIS_URL

celery_app = Celery("huemn", broker=broker, backend=backend)
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
)


@celery_app.task
def sample_add(a, b):
    return a + b
