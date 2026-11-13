"""
API endpoints for managing knowledge sources (websites, documents)
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from pydantic import BaseModel, HttpUrl
from typing import List, Optional, Dict
from datetime import datetime, timedelta
import logging
import os
import shutil
import uuid
from pathlib import Path

from app.db.session import SessionLocal
from app.db.models.knowledge import KnowledgeSource, KnowledgeContent, SourceType
from app.db.models.subscription import UserAccount
from app.api.auth import get_current_user
from app.services.web_crawler import WebCrawler
from app.services.document_processor import DocumentProcessor
from app.services.embeddings_service import get_embedding_with_profile
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

router = APIRouter()

# Upload directory for documents
# Knowledge files must not live under the publicly served /uploads mount.
UPLOAD_DIR = Path(os.getenv("HUEMN_PRIVATE_KNOWLEDGE_DIR", "private_uploads/knowledge"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
LEGACY_UPLOAD_DIR = Path("uploads/knowledge")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def _trigger_crawl_async(source_id: int, user_id: int):
    """Helper function to trigger crawl asynchronously"""
    import time
    time.sleep(1)  # Wait a bit for the source to be fully committed
    
    db = None
    try:
        logger.info(f"Starting async crawl for source {source_id} (user {user_id})")
        db = SessionLocal()
        source = db.query(KnowledgeSource).filter(
            KnowledgeSource.id == source_id,
            KnowledgeSource.user_id == user_id
        ).first()
        
        if not source:
            logger.warning(f"Source {source_id} not found for user {user_id}")
            return
        
        if not source.is_active:
            logger.warning(f"Source {source_id} is not active")
            return
        
        # Update status to crawling
        source.crawl_status = "crawling"
        source.error_message = None
        db.commit()
        logger.info(f"Set source {source_id} status to crawling")
        
        content_chunks = []
        
        if source.source_type == SourceType.WEBSITE:
            if not source.url:
                raise ValueError("URL is required for website sources")
            
            logger.info(f"Crawling website: {source.url}")
            crawler = WebCrawler(max_depth=2, max_pages=50, delay=1.0)
            crawled_pages = crawler.crawl_website(source.url)
            logger.info(f"Crawled {len(crawled_pages)} pages from {source.url}")
            
            if not crawled_pages:
                logger.warning(f"No pages crawled from {source.url}")
                raise ValueError(f"Failed to crawl any content from {source.url}. The website might be blocking crawlers or require authentication.")
            
            for page in crawled_pages:
                embedding, embedding_profile = get_embedding_with_profile(page['content'])
                
                content = KnowledgeContent(
                    source_id=source.id,
                    title=page['title'],
                    url=page['url'],
                    content=page['content'],
                    embedding=embedding,
                    content_metadata={**(page.get("metadata") or {}), "embedding_profile": embedding_profile},
                    word_count=len(page['content'].split())
                )
                content_chunks.append(content)
        
        else:
            # Process document
            if not source.file_path or not os.path.exists(source.file_path):
                raise FileNotFoundError(f"Document file not found: {source.file_path}")
            
            processor = DocumentProcessor()
            doc_data = processor.process_file(source.file_path)
            
            words = doc_data['content'].split()
            chunk_size = 5000
            
            for i in range(0, len(words), chunk_size):
                chunk_words = words[i:i+chunk_size]
                chunk_content = ' '.join(chunk_words)
                
                embedding, embedding_profile = get_embedding_with_profile(chunk_content)
                
                content = KnowledgeContent(
                    source_id=source.id,
                    title=doc_data['title'] if i == 0 else f"{doc_data['title']} (Part {i//chunk_size + 1})",
                    content=chunk_content,
                    embedding=embedding,
                    chunk_index=i // chunk_size,
                    content_metadata={**(doc_data.get("metadata") or {}), "embedding_profile": embedding_profile},
                    word_count=len(chunk_words)
                )
                content_chunks.append(content)
        
        # Delete old content
        db.query(KnowledgeContent).filter(KnowledgeContent.source_id == source.id).delete()
        
        # Add new content
        for content in content_chunks:
            db.add(content)
        
        # Update source
        source.crawl_status = "completed"
        source.last_crawled_at = datetime.utcnow()
        if source.auto_crawl:
            source.next_crawl_at = datetime.utcnow() + timedelta(hours=source.crawl_interval_hours)
        
        db.commit()
        logger.info(f"Successfully crawled source {source_id}: {len(content_chunks)} chunks saved")
    except Exception as e:
        logger.error(f"Error in async crawl for source {source_id}: {e}", exc_info=True)
        error_db = None
        try:
            error_db = SessionLocal()
            source = error_db.query(KnowledgeSource).filter(KnowledgeSource.id == source_id).first()
            if source:
                source.crawl_status = "failed"
                source.error_message = str(e)[:500]  # Limit error message length
                error_db.commit()
                logger.info(f"Set source {source_id} status to failed: {str(e)[:100]}")
        except Exception as db_error:
            logger.error(f"Error updating failed status: {db_error}", exc_info=True)
        finally:
            if error_db:
                error_db.close()
    finally:
        if db:
            db.close()

class SourceCreateRequest(BaseModel):
    name: str
    source_type: str  # "website" or document type
    url: Optional[str] = None
    auto_crawl: bool = False
    crawl_interval_hours: int = 24

class SourceUpdateRequest(BaseModel):
    name: Optional[str] = None
    auto_crawl: Optional[bool] = None
    crawl_interval_hours: Optional[int] = None
    is_active: Optional[bool] = None

@router.post("/sources")
async def create_source(
    request: SourceCreateRequest,
    user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new knowledge source"""
    try:
        # Validate source type
        try:
            source_type = SourceType(request.source_type.lower())
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid source type: {request.source_type}")
        
        # Validate URL for websites
        if source_type == SourceType.WEBSITE and not request.url:
            raise HTTPException(status_code=400, detail="URL is required for website sources")
        
        # Create source
        source = KnowledgeSource(
            user_id=user.id,
            name=request.name,
            source_type=source_type,
            url=request.url,
            auto_crawl=request.auto_crawl,
            crawl_interval_hours=request.crawl_interval_hours,
            is_active=True,
            crawl_status="pending"
        )
        
        db.add(source)
        db.commit()
        db.refresh(source)
        
        # Automatically trigger crawl for websites immediately (in background)
        if source_type == SourceType.WEBSITE:
            if request.auto_crawl:
                source.next_crawl_at = datetime.utcnow()
            db.commit()  # Commit source first
            
            # Trigger immediate crawl in background thread
            try:
                from threading import Thread
                def crawl_thread():
                    try:
                        _trigger_crawl_async(source.id, user.id)
                    except Exception as e:
                        logger.error(f"Background crawl thread error: {e}", exc_info=True)
                
                thread = Thread(target=crawl_thread, daemon=True)
                thread.start()
                logger.info(f"Started auto-crawl thread for website source {source.id}")
            except Exception as e:
                logger.error(f"Could not start auto-crawl thread: {e}", exc_info=True)
                # Set status to failed if thread can't start
                source.crawl_status = "failed"
                source.error_message = f"Could not start crawl: {str(e)}"
                db.commit()
        
        return {
            "success": True,
            "source": {
                "id": source.id,
                "name": source.name,
                "source_type": source.source_type.value,
                "url": source.url,
                "auto_crawl": source.auto_crawl,
                "crawl_status": source.crawl_status,
                "created_at": source.created_at.isoformat()
            }
        }
    except Exception as e:
        logger.error(f"Error creating source: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error creating source: {str(e)}")

@router.post("/sources/upload")
async def upload_document(
    file: UploadFile = File(...),
    name: str = Form(...),
    auto_crawl: bool = Form(False),
    user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload a document file"""
    try:
        # Drop any path components from client filenames; use a random storage name.
        original_filename = Path((file.filename or "").replace("\\", "/")).name
        if original_filename in ("", ".", ".."):
            raise HTTPException(status_code=400, detail="A valid document filename is required")
        # Determine file type
        file_ext = Path(original_filename).suffix.lower()
        source_type_map = {
            '.pdf': SourceType.PDF,
            '.docx': SourceType.DOCX,
            '.doc': SourceType.DOCUMENT,
            '.txt': SourceType.TXT,
            '.md': SourceType.MD,
            '.html': SourceType.HTML,
            '.csv': SourceType.CSV,
            '.json': SourceType.JSON,
        }
        
        if file_ext not in source_type_map:
            raise HTTPException(status_code=400, detail=f"Unsupported file type: {file_ext}")
        
        source_type = source_type_map[file_ext]
        
        # Create source first to get ID (without file_path initially)
        source = KnowledgeSource(
            user_id=user.id,
            name=name,
            source_type=source_type,
            file_path=None,  # Will be set after file is saved
            source_metadata={"original_filename": original_filename},
            auto_crawl=auto_crawl,
            is_active=True,
            crawl_status="pending"
        )
        
        db.add(source)
        db.commit()
        db.refresh(source)
        
        # Save file with source ID
        file_path = UPLOAD_DIR / f"{user.id}_{source.id}_{uuid.uuid4().hex}{file_ext}"
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Update source with file path
        source.file_path = str(file_path)
        db.commit()
        
        # Automatically trigger document processing in background thread
        try:
            from threading import Thread
            Thread(target=lambda: _trigger_crawl_async(source.id, user.id), daemon=True).start()
            logger.info(f"Started auto-process for document source {source.id}")
        except Exception as e:
            logger.warning(f"Could not start auto-process: {e}")
        
        return {
            "success": True,
            "source": {
                "id": source.id,
                "name": source.name,
                "source_type": source.source_type.value,
                "file_path": None,  # Raw server file paths must not be exposed to clients.
                "download_url": f"/api/knowledge/sources/{source.id}/download",
                "crawl_status": source.crawl_status,
                "created_at": source.created_at.isoformat()
            }
        }
    except Exception as e:
        logger.error(f"Error uploading document: {e}", exc_info=True)
        db.rollback()
        if 'file_path' in locals() and file_path.exists():
            file_path.unlink()
        raise HTTPException(status_code=500, detail=f"Error uploading document: {str(e)}")

@router.get("/sources")
async def list_sources(
    user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all knowledge sources for the user"""
    sources = db.query(KnowledgeSource).filter(
        KnowledgeSource.user_id == user.id
    ).order_by(KnowledgeSource.created_at.desc()).all()
    
    return {
        "success": True,
        "sources": [
            {
                "id": s.id,
                "name": s.name,
                "source_type": s.source_type.value,
                "url": s.url,
                "file_path": None,
                "download_url": f"/api/knowledge/sources/{s.id}/download" if s.file_path else None,
                "auto_crawl": s.auto_crawl,
                "crawl_status": s.crawl_status,
                "last_crawled_at": s.last_crawled_at.isoformat() if s.last_crawled_at else None,
                "next_crawl_at": s.next_crawl_at.isoformat() if s.next_crawl_at else None,
                "is_active": s.is_active,
                "error_message": s.error_message,
                "content_count": len(s.content_chunks),
                "created_at": s.created_at.isoformat()
            }
            for s in sources
        ]
    }

def _safe_knowledge_path(file_path: str) -> Path:
    """Resolve only private knowledge files or explicitly supported legacy uploads."""
    path = Path(file_path).resolve()
    allowed_roots = (UPLOAD_DIR.resolve(), LEGACY_UPLOAD_DIR.resolve())
    if not any(path.is_relative_to(root) for root in allowed_roots):
        raise HTTPException(status_code=404, detail="Document not found")
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Document not found")
    return path


@router.get("/sources/{source_id}/download")
async def download_source(
    source_id: int,
    user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Download a knowledge document only when the authenticated user owns it."""
    source = db.query(KnowledgeSource).filter(
        KnowledgeSource.id == source_id,
        KnowledgeSource.user_id == user.id,
    ).first()
    if not source or not source.file_path:
        raise HTTPException(status_code=404, detail="Document not found")
    path = _safe_knowledge_path(source.file_path)
    original_name = (source.source_metadata or {}).get("original_filename") or path.name
    filename = Path(str(original_name).replace("\\", "/")).name
    return FileResponse(
        path=path,
        media_type="application/octet-stream",
        filename=filename,
        headers={"Cache-Control": "private, no-store"},
    )


@router.get("/sources/{source_id}")
async def get_source(
    source_id: int,
    user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific knowledge source"""
    source = db.query(KnowledgeSource).filter(
        KnowledgeSource.id == source_id,
        KnowledgeSource.user_id == user.id
    ).first()
    
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    
    return {
        "success": True,
        "source": {
            "id": source.id,
            "name": source.name,
            "source_type": source.source_type.value,
            "url": source.url,
            "file_path": None,
            "download_url": f"/api/knowledge/sources/{source.id}/download" if source.file_path else None,
            "auto_crawl": source.auto_crawl,
            "crawl_interval_hours": source.crawl_interval_hours,
            "crawl_status": source.crawl_status,
            "last_crawled_at": source.last_crawled_at.isoformat() if source.last_crawled_at else None,
            "next_crawl_at": source.next_crawl_at.isoformat() if source.next_crawl_at else None,
            "is_active": source.is_active,
            "error_message": source.error_message,
            "source_metadata": source.source_metadata,
            "content_count": len(source.content_chunks),
            "created_at": source.created_at.isoformat()
        }
    }

@router.put("/sources/{source_id}")
async def update_source(
    source_id: int,
    request: SourceUpdateRequest,
    user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a knowledge source"""
    source = db.query(KnowledgeSource).filter(
        KnowledgeSource.id == source_id,
        KnowledgeSource.user_id == user.id
    ).first()
    
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    
    if request.name is not None:
        source.name = request.name
    if request.auto_crawl is not None:
        source.auto_crawl = request.auto_crawl
    if request.crawl_interval_hours is not None:
        source.crawl_interval_hours = request.crawl_interval_hours
    if request.is_active is not None:
        source.is_active = request.is_active
    
    db.commit()
    db.refresh(source)
    
    return {
        "success": True,
        "source": {
            "id": source.id,
            "name": source.name,
            "auto_crawl": source.auto_crawl,
            "crawl_interval_hours": source.crawl_interval_hours,
            "is_active": source.is_active
        }
    }

@router.delete("/sources/{source_id}")
async def delete_source(
    source_id: int,
    user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a knowledge source and its content"""
    source = db.query(KnowledgeSource).filter(
        KnowledgeSource.id == source_id,
        KnowledgeSource.user_id == user.id
    ).first()
    
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    
    # Delete file if it exists
    if source.file_path and os.path.exists(source.file_path):
        try:
            os.remove(source.file_path)
        except Exception as e:
            logger.warning(f"Error deleting file {source.file_path}: {e}")
    
    db.delete(source)
    db.commit()
    
    return {"success": True, "message": "Source deleted successfully"}

@router.post("/sources/{source_id}/crawl")
async def crawl_source(
    source_id: int,
    user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Manually trigger crawling for a source"""
    source = db.query(KnowledgeSource).filter(
        KnowledgeSource.id == source_id,
        KnowledgeSource.user_id == user.id
    ).first()
    
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    
    if not source.is_active:
        raise HTTPException(status_code=400, detail="Source is not active")
    
    try:
        source.crawl_status = "crawling"
        source.error_message = None
        db.commit()
        
        content_chunks = []
        
        if source.source_type == SourceType.WEBSITE:
            # Crawl website
            if not source.url:
                raise ValueError("URL is required for website sources")
            
            logger.info(f"Manually crawling website: {source.url}")
            crawler = WebCrawler(max_depth=2, max_pages=50, delay=1.0)
            crawled_pages = crawler.crawl_website(source.url)
            logger.info(f"Crawled {len(crawled_pages)} pages from {source.url}")
            
            if not crawled_pages:
                raise ValueError(f"Failed to crawl any content from {source.url}. The website might be blocking crawlers, require authentication, or the URL might be invalid.")
            
            # Store each page as a content chunk
            for page in crawled_pages:
                # Create embedding
                embedding, embedding_profile = get_embedding_with_profile(page['content'])
                
                content = KnowledgeContent(
                    source_id=source.id,
                    title=page['title'],
                    url=page['url'],
                    content=page['content'],
                    embedding=embedding,
                    content_metadata={**(page.get("metadata") or {}), "embedding_profile": embedding_profile},
                    word_count=len(page['content'].split())
                )
                content_chunks.append(content)
        
        else:
            # Process document
            if not source.file_path or not os.path.exists(source.file_path):
                raise FileNotFoundError(f"Document file not found: {source.file_path}")
            
            processor = DocumentProcessor()
            doc_data = processor.process_file(source.file_path)
            
            # Split large documents into chunks (max 5000 words per chunk)
            words = doc_data['content'].split()
            chunk_size = 5000
            
            for i in range(0, len(words), chunk_size):
                chunk_words = words[i:i+chunk_size]
                chunk_content = ' '.join(chunk_words)
                
                # Create embedding
                embedding, embedding_profile = get_embedding_with_profile(chunk_content)
                
                content = KnowledgeContent(
                    source_id=source.id,
                    title=doc_data['title'] if i == 0 else f"{doc_data['title']} (Part {i//chunk_size + 1})",
                    content=chunk_content,
                    embedding=embedding,
                    chunk_index=i // chunk_size,
                    content_metadata={**(doc_data.get("metadata") or {}), "embedding_profile": embedding_profile},
                    word_count=len(chunk_words)
                )
                content_chunks.append(content)
        
        # Delete old content
        db.query(KnowledgeContent).filter(KnowledgeContent.source_id == source.id).delete()
        
        # Add new content
        for content in content_chunks:
            db.add(content)
        
        # Update source
        source.crawl_status = "completed"
        source.last_crawled_at = datetime.utcnow()
        if source.auto_crawl:
            source.next_crawl_at = datetime.utcnow() + timedelta(hours=source.crawl_interval_hours)
        
        db.commit()
        
        return {
            "success": True,
            "message": f"Crawled {len(content_chunks)} content chunks",
            "content_count": len(content_chunks)
        }
        
    except Exception as e:
        logger.error(f"Error crawling source {source_id}: {e}", exc_info=True)
        source.crawl_status = "failed"
        source.error_message = str(e)
        db.commit()
        raise HTTPException(status_code=500, detail=f"Error crawling source: {str(e)}")

