"""
Web crawler service for extracting content from websites
"""
import logging
import requests
from typing import List, Dict, Optional
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
import time
import re

logger = logging.getLogger(__name__)

class WebCrawler:
    """Web crawler for extracting content from websites"""
    
    def __init__(self, max_depth: int = 2, max_pages: int = 50, delay: float = 1.0):
        """
        Initialize web crawler
        
        Args:
            max_depth: Maximum depth to crawl (0 = only base URL, 1 = base + 1 level deep, etc.)
            max_pages: Maximum number of pages to crawl
            delay: Delay between requests in seconds
        """
        self.max_depth = max_depth
        self.max_pages = max_pages
        self.delay = delay
        self.visited_urls = set()
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })
    
    def extract_text_from_html(self, html: str, url: str) -> Dict[str, str]:
        """
        Extract text content from HTML
        
        Returns:
            Dict with 'title', 'content', 'metadata'
        """
        try:
            soup = BeautifulSoup(html, 'html.parser')
            
            # Remove script and style elements
            for script in soup(["script", "style", "nav", "footer", "header"]):
                script.decompose()
            
            # Extract title
            title = ""
            if soup.title:
                title = soup.title.string.strip() if soup.title.string else ""
            elif soup.find('h1'):
                title = soup.find('h1').get_text().strip()
            
            # Extract main content
            # Try to find main content area
            main_content = None
            for selector in ['main', 'article', '[role="main"]', '.content', '#content', 'body']:
                main_content = soup.select_one(selector)
                if main_content:
                    break
            
            if not main_content:
                main_content = soup.body if soup.body else soup
            
            # Extract text
            text = main_content.get_text(separator='\n', strip=True)
            
            # Clean up text
            text = re.sub(r'\n{3,}', '\n\n', text)  # Remove excessive newlines
            text = text.strip()
            
            # Extract metadata
            metadata = {
                'description': '',
                'keywords': '',
                'language': soup.get('lang', ''),
            }
            
            # Meta description
            meta_desc = soup.find('meta', attrs={'name': 'description'})
            if meta_desc and meta_desc.get('content'):
                metadata['description'] = meta_desc['content']
            
            # Meta keywords
            meta_keywords = soup.find('meta', attrs={'name': 'keywords'})
            if meta_keywords and meta_keywords.get('content'):
                metadata['keywords'] = meta_keywords['content']
            
            return {
                'title': title or url,
                'content': text,
                'metadata': metadata
            }
        except Exception as e:
            logger.error(f"Error extracting text from HTML: {e}")
            return {
                'title': url,
                'content': '',
                'metadata': {}
            }
    
    def get_page_links(self, html: str, base_url: str) -> List[str]:
        """Extract all links from a page"""
        try:
            soup = BeautifulSoup(html, 'html.parser')
            links = []
            
            base_domain = urlparse(base_url).netloc
            
            for link in soup.find_all('a', href=True):
                href = link['href']
                absolute_url = urljoin(base_url, href)
                
                # Only include links from the same domain
                parsed = urlparse(absolute_url)
                if parsed.netloc == base_domain:
                    # Remove fragments and query params for deduplication
                    clean_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
                    if clean_url not in self.visited_urls:
                        links.append(absolute_url)
            
            return links
        except Exception as e:
            logger.error(f"Error extracting links: {e}")
            return []
    
    def crawl_url(self, url: str, depth: int = 0) -> List[Dict[str, any]]:
        """
        Crawl a URL and extract content
        
        Args:
            url: URL to crawl
            depth: Current crawl depth
            
        Returns:
            List of extracted content dictionaries
        """
        if depth > self.max_depth or len(self.visited_urls) >= self.max_pages:
            return []
        
        if url in self.visited_urls:
            return []
        
        self.visited_urls.add(url)
        
        try:
            logger.info(f"Crawling {url} (depth: {depth})")
            
            # Fetch page
            response = self.session.get(url, timeout=10)
            response.raise_for_status()
            
            # Extract content
            content_data = self.extract_text_from_html(response.text, url)
            
            if not content_data['content']:
                logger.warning(f"No content extracted from {url}")
                return []
            
            result = {
                'url': url,
                'title': content_data['title'],
                'content': content_data['content'],
                'metadata': content_data['metadata'],
                'depth': depth
            }
            
            results = [result]
            
            # If not at max depth, crawl linked pages
            if depth < self.max_depth and len(self.visited_urls) < self.max_pages:
                time.sleep(self.delay)  # Be respectful with delays
                
                links = self.get_page_links(response.text, url)
                for link in links[:10]:  # Limit to 10 links per page
                    if len(self.visited_urls) >= self.max_pages:
                        break
                    results.extend(self.crawl_url(link, depth + 1))
                    time.sleep(self.delay)
            
            return results
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Error crawling {url}: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error crawling {url}: {e}")
            return []
    
    def crawl_website(self, base_url: str) -> List[Dict[str, any]]:
        """
        Crawl a website starting from base URL
        
        Args:
            base_url: Base URL to start crawling from
            
        Returns:
            List of extracted content dictionaries
        """
        self.visited_urls.clear()
        
        # Ensure base_url has scheme
        if not base_url.startswith(('http://', 'https://')):
            base_url = 'https://' + base_url
        
        logger.info(f"Starting crawl of {base_url}")
        results = self.crawl_url(base_url, depth=0)
        logger.info(f"Crawled {len(results)} pages from {base_url}")
        
        return results

