"""
Reliability patterns for Enterprise Grade stability.
Includes Circuit Breaker and Retry logic.
"""
import time
import asyncio
import logging
from typing import Callable, Any, Dict, Optional
from functools import wraps

logger = logging.getLogger(__name__)

class CircuitBreakerOpenException(Exception):
    """Raised when the circuit breaker is open"""
    pass

class CircuitBreaker:
    """
    Implements the Circuit Breaker pattern to prevent cascading failures.
    
    States:
    - CLOSED: Normal operation, requests pass through.
    - OPEN: Failing, requests are blocked immediately.
    - HALF-OPEN: Testing if service has recovered.
    """
    
    def __init__(
        self, 
        failure_threshold: int = 5, 
        recovery_timeout: int = 60,
        name: str = "default"
    ):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.name = name
        
        self.failure_count = 0
        self.last_failure_time = 0
        self.state = "CLOSED"  # CLOSED, OPEN, HALF-OPEN
        
    def allow_request(self) -> bool:
        if self.state == "CLOSED":
            return True
            
        if self.state == "OPEN":
            if time.time() - self.last_failure_time > self.recovery_timeout:
                self.state = "HALF-OPEN"
                logger.info(f"Circuit Breaker '{self.name}' entering HALF-OPEN state")
                return True
            return False
            
        if self.state == "HALF-OPEN":
            # In half-open, we allow one trial request. 
            # In a real distributed system, this needs a lock.
            # For this simple implementation, we assume single process or accept race conditions.
            return True
            
        return True

    def record_success(self):
        if self.state == "HALF-OPEN":
            self.state = "CLOSED"
            self.failure_count = 0
            logger.info(f"Circuit Breaker '{self.name}' recovered (CLOSED)")
        elif self.state == "CLOSED":
            self.failure_count = 0

    def record_failure(self):
        self.failure_count += 1
        self.last_failure_time = time.time()
        
        if self.state == "CLOSED" and self.failure_count >= self.failure_threshold:
            self.state = "OPEN"
            logger.warning(f"Circuit Breaker '{self.name}' opened due to {self.failure_count} failures")
        
        elif self.state == "HALF-OPEN":
            self.state = "OPEN"
            logger.warning(f"Circuit Breaker '{self.name}' reopened after failed trial")

    async def call(self, func: Callable, *args, **kwargs) -> Any:
        """
        Wrap an async function call with circuit breaker logic.
        """
        if not self.allow_request():
            raise CircuitBreakerOpenException(f"Circuit '{self.name}' is OPEN")
            
        try:
            result = await func(*args, **kwargs)
            self.record_success()
            return result
        except Exception as e:
            # We don't count CircuitBreakerOpenException as a failure (it shouldn't happen here anyway)
            # We might want to filter which exceptions cause a failure (e.g. 404 might not be a system failure)
            self.record_failure()
            raise e

# Global registry for circuit breakers
_breakers: Dict[str, CircuitBreaker] = {}

def get_circuit_breaker(name: str, **kwargs) -> CircuitBreaker:
    if name not in _breakers:
        _breakers[name] = CircuitBreaker(name=name, **kwargs)
    return _breakers[name]

def with_circuit_breaker(name: str, failure_threshold: int = 5, recovery_timeout: int = 60):
    """Decorator for async functions"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            breaker = get_circuit_breaker(name, failure_threshold=failure_threshold, recovery_timeout=recovery_timeout)
            return await breaker.call(func, *args, **kwargs)
        return wrapper
    return decorator

def retry_with_backoff(
    retries: int = 3, 
    backoff_in_seconds: float = 1.0, 
    max_backoff: float = 10.0,
    exponential: bool = True
):
    """
    Decorator for async functions to retry on failure.
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            attempt = 0
            current_backoff = backoff_in_seconds
            
            while True:
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    attempt += 1
                    if attempt > retries:
                        raise e
                    
                    # Don't retry if circuit breaker is open
                    if isinstance(e, CircuitBreakerOpenException):
                        raise e
                        
                    wait_time = current_backoff
                    if exponential:
                        current_backoff = min(current_backoff * 2, max_backoff)
                        
                    logger.warning(f"Retry attempt {attempt}/{retries} for '{func.__name__}' after error: {str(e)}. Waiting {wait_time}s")
                    await asyncio.sleep(wait_time)
        return wrapper
    return decorator
