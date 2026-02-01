import logging
from typing import List, Dict, Any
from duckduckgo_search import DDGS
from app.db.models.knowledge import KnowledgeSource, KnowledgeContent, SourceType
from app.services.embeddings_service import get_embedding
from app.db.session import SessionLocal
from datetime import datetime

logger = logging.getLogger(__name__)

class WebSearchService:
    def __init__(self):
        self.ddgs = DDGS()

    def search(self, query: str, max_results: int = 5) -> List[Dict[str, Any]]:
        """
        Search the web using DuckDuckGo.
        Returns a list of results with title, href, body.
        """
        try:
            logger.info(f"Searching web for: {query}")
            results = list(self.ddgs.text(query, max_results=max_results))
            return results
        except Exception as e:
            logger.error(f"Web search failed: {e}")
            return []

    def learn_from_search(self, query: str, results: List[Dict[str, Any]], user_id: int):
        """
        Save search results to Knowledge Base as 'web_discovery' sources.
        This enables 'auto-learning'.
        """
        if not results or not user_id:
            return

        db = SessionLocal()
        try:
            # Create a container source for this query
            source_name = f"Web Research: {query[:30]}..."
            
            source = KnowledgeSource(
                user_id=user_id,
                name=source_name,
                source_type=SourceType.WEBSITE,
                url="https://duckduckgo.com",
                auto_crawl=False,
                crawl_status="completed",
                is_active=True,
                source_metadata={"query": query, "provider": "duckduckgo", "type": "web_discovery"}
            )
            db.add(source)
            db.commit()
            db.refresh(source)
            
            # Add content
            for res in results:
                title = res.get('title', 'No Title')
                url = res.get('href', '')
                body = res.get('body', '')
                
                if not body:
                    continue
                    
                # Create embedding
                embedding = None
                try:
                    embedding = get_embedding(f"{title}\n{body}")
                except Exception as emb_err:
                    logger.warning(f"Failed to create embedding for web result: {emb_err}")
                
                content = KnowledgeContent(
                    source_id=source.id,
                    title=title,
                    url=url,
                    content=body,
                    embedding=embedding,
                    content_metadata={"source": "web_search", "query": query},
                    word_count=len(body.split())
                )
                db.add(content)
            
            db.commit()
            logger.info(f"Learned {len(results)} new items from web search for query: {query}")
            
        except Exception as e:
            logger.error(f"Error learning from search: {e}")
            db.rollback()
        finally:
            db.close()

web_search_service = WebSearchService()
