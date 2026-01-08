"""
Scheduled job for automatically crawling knowledge sources
"""
import logging
from datetime import datetime, timedelta
from threading import Thread
import time
from app.db.session import SessionLocal
from app.db.models.knowledge import KnowledgeSource, SourceType
from app.services.web_crawler import WebCrawler
from app.services.document_processor import DocumentProcessor
from app.services.embeddings_service import get_embedding

logger = logging.getLogger(__name__)

def crawl_source_background(source_id: int):
    """Crawl a source in the background"""
    try:
        from app.api.knowledge_sources import crawl_source
        # This will be called from the API endpoint, so we'll trigger it via API
        # For now, we'll implement the crawling logic directly here
        db = SessionLocal()
        try:
            source = db.query(KnowledgeSource).filter(KnowledgeSource.id == source_id).first()
            if not source or not source.is_active:
                return
            
            source.crawl_status = "crawling"
            source.error_message = None
            db.commit()
            
            content_chunks = []
            
            if source.source_type == SourceType.WEBSITE:
                if not source.url:
                    raise ValueError("URL is required for website sources")
                
                crawler = WebCrawler(max_depth=2, max_pages=50, delay=1.0)
                crawled_pages = crawler.crawl_website(source.url)
                
                for page in crawled_pages:
                    embedding = None
                    try:
                        embedding = get_embedding(page['content'])
                    except Exception as e:
                        logger.warning(f"Error creating embedding: {e}")
                    
                    from app.db.models.knowledge import KnowledgeContent
                    content = KnowledgeContent(
                        source_id=source.id,
                        title=page['title'],
                        url=page['url'],
                        content=page['content'],
                        embedding=embedding,
                        metadata=page.get('metadata', {}),
                        word_count=len(page['content'].split())
                    )
                    content_chunks.append(content)
            
            else:
                if not source.file_path:
                    raise FileNotFoundError(f"Document file not found: {source.file_path}")
                
                import os
                if not os.path.exists(source.file_path):
                    raise FileNotFoundError(f"Document file not found: {source.file_path}")
                
                processor = DocumentProcessor()
                doc_data = processor.process_file(source.file_path)
                
                words = doc_data['content'].split()
                chunk_size = 5000
                
                for i in range(0, len(words), chunk_size):
                    chunk_words = words[i:i+chunk_size]
                    chunk_content = ' '.join(chunk_words)
                    
                    embedding = None
                    try:
                        embedding = get_embedding(chunk_content)
                    except Exception as e:
                        logger.warning(f"Error creating embedding: {e}")
                    
                    from app.db.models.knowledge import KnowledgeContent
                    content = KnowledgeContent(
                        source_id=source.id,
                        title=doc_data['title'] if i == 0 else f"{doc_data['title']} (Part {i//chunk_size + 1})",
                        content=chunk_content,
                        embedding=embedding,
                        chunk_index=i // chunk_size,
                        metadata=doc_data.get('metadata', {}),
                        word_count=len(chunk_words)
                    )
                    content_chunks.append(content)
            
            # Delete old content
            from app.db.models.knowledge import KnowledgeContent
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
            logger.info(f"Successfully crawled source {source_id}: {len(content_chunks)} chunks")
            
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error crawling source {source_id}: {e}", exc_info=True)
        db = SessionLocal()
        try:
            source = db.query(KnowledgeSource).filter(KnowledgeSource.id == source_id).first()
            if source:
                source.crawl_status = "failed"
                source.error_message = str(e)
                db.commit()
        finally:
            db.close()

def start_knowledge_crawler_scheduler():
    """Start the background scheduler for automatic crawling"""
    def scheduler_loop():
        logger.info("Starting knowledge crawler scheduler")
        while True:
            try:
                db = SessionLocal()
                try:
                    # Find sources that need crawling
                    now = datetime.utcnow()
                    sources_to_crawl = db.query(KnowledgeSource).filter(
                        KnowledgeSource.is_active == True,
                        KnowledgeSource.auto_crawl == True,
                        KnowledgeSource.crawl_status != "crawling",
                        (
                            (KnowledgeSource.next_crawl_at <= now) |
                            (KnowledgeSource.next_crawl_at.is_(None))
                        )
                    ).all()
                    
                    for source in sources_to_crawl:
                        logger.info(f"Scheduling crawl for source {source.id}: {source.name}")
                        # Run crawl in background thread
                        thread = Thread(target=crawl_source_background, args=(source.id,), daemon=True)
                        thread.start()
                        time.sleep(5)  # Stagger crawls
                    
                finally:
                    db.close()
                
                # Check every hour
                time.sleep(3600)
            except Exception as e:
                logger.error(f"Error in knowledge crawler scheduler: {e}", exc_info=True)
                time.sleep(3600)
    
    thread = Thread(target=scheduler_loop, daemon=True)
    thread.start()
    logger.info("Knowledge crawler scheduler started")

