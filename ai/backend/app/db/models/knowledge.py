from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean, JSON, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
from app.db.base import Base
import enum

class SourceType(str, enum.Enum):
    WEBSITE = "website"
    DOCUMENT = "document"
    PDF = "pdf"
    DOCX = "docx"
    TXT = "txt"
    MD = "markdown"
    HTML = "html"
    CSV = "csv"
    JSON = "json"

class KnowledgeSource(Base):
    """Knowledge sources (websites, documents)"""
    __tablename__ = "knowledge_sources"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("user_accounts.id"), nullable=False)
    
    # Source identification
    name = Column(String, nullable=False)  # User-friendly name
    source_type = Column(SQLEnum(SourceType), nullable=False)  # website, document, etc.
    url = Column(String, nullable=True)  # For websites or document URLs
    file_path = Column(String, nullable=True)  # For uploaded documents
    
    # Crawling settings
    auto_crawl = Column(Boolean, default=False)  # Auto-crawl daily for websites
    crawl_interval_hours = Column(Integer, default=24)  # Hours between crawls
    last_crawled_at = Column(DateTime, nullable=True)
    next_crawl_at = Column(DateTime, nullable=True)
    
    # Status
    is_active = Column(Boolean, default=True)
    crawl_status = Column(String, default="pending")  # pending, crawling, completed, failed
    error_message = Column(Text, nullable=True)
    
    # Metadata
    source_metadata = Column(JSON, nullable=True)  # Additional metadata (file size, page count, etc.)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    user = relationship("UserAccount", backref="knowledge_sources")
    content_chunks = relationship("KnowledgeContent", back_populates="source", cascade="all, delete-orphan")

class KnowledgeContent(Base):
    """Crawled/processed content from knowledge sources"""
    __tablename__ = "knowledge_content"
    
    id = Column(Integer, primary_key=True)
    source_id = Column(Integer, ForeignKey("knowledge_sources.id"), nullable=False)
    
    # Content identification
    title = Column(String, nullable=True)  # Page title, document title, etc.
    url = Column(String, nullable=True)  # Specific URL for website pages
    content = Column(Text, nullable=False)  # Extracted text content
    
    # Embedding and search
    embedding = Column(JSON, nullable=True)  # Vector embedding for semantic search
    chunk_index = Column(Integer, default=0)  # For large documents split into chunks
    
    # Metadata
    content_metadata = Column(JSON, nullable=True)  # Page metadata, document metadata, etc.
    word_count = Column(Integer, default=0)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    source = relationship("KnowledgeSource", back_populates="content_chunks")

