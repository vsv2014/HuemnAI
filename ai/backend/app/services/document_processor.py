"""
Document processor service for extracting content from various document types
"""
import logging
import os
from typing import Dict, List, Optional
from pathlib import Path
import mimetypes

logger = logging.getLogger(__name__)

class DocumentProcessor:
    """Process various document types and extract text content"""
    
    def __init__(self):
        self.supported_types = {
            '.pdf': self._process_pdf,
            '.docx': self._process_docx,
            '.doc': self._process_doc,
            '.txt': self._process_txt,
            '.md': self._process_markdown,
            '.html': self._process_html,
            '.csv': self._process_csv,
            '.json': self._process_json,
        }
    
    def is_supported(self, file_path: str) -> bool:
        """Check if file type is supported"""
        ext = Path(file_path).suffix.lower()
        return ext in self.supported_types
    
    def process_file(self, file_path: str) -> Dict[str, any]:
        """
        Process a document file and extract content
        
        Args:
            file_path: Path to the document file
            
        Returns:
            Dict with 'title', 'content', 'metadata'
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")
        
        ext = Path(file_path).suffix.lower()
        
        if ext not in self.supported_types:
            raise ValueError(f"Unsupported file type: {ext}")
        
        try:
            processor = self.supported_types[ext]
            result = processor(file_path)
            
            # Add file metadata
            file_stat = os.stat(file_path)
            result['metadata'] = result.get('metadata', {})
            result['metadata'].update({
                'file_size': file_stat.st_size,
                'file_path': file_path,
                'file_type': ext,
                'mime_type': mimetypes.guess_type(file_path)[0]
            })
            
            return result
        except Exception as e:
            logger.error(f"Error processing file {file_path}: {e}")
            raise
    
    def _process_pdf(self, file_path: str) -> Dict[str, any]:
        """Process PDF file"""
        try:
            import PyPDF2
            
            title = Path(file_path).stem
            content_parts = []
            
            with open(file_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                
                # Extract title from metadata if available
                if pdf_reader.metadata and pdf_reader.metadata.get('/Title'):
                    title = pdf_reader.metadata['/Title']
                
                # Extract text from all pages
                for page_num, page in enumerate(pdf_reader.pages):
                    text = page.extract_text()
                    if text.strip():
                        content_parts.append(text)
            
            content = '\n\n'.join(content_parts)
            
            return {
                'title': title,
                'content': content,
                'metadata': {
                    'page_count': len(pdf_reader.pages) if 'pdf_reader' in locals() else 0
                }
            }
        except ImportError:
            logger.warning("PyPDF2 not installed. Install it with: pip install PyPDF2")
            # Fallback: return basic info
            return {
                'title': Path(file_path).stem,
                'content': f"[PDF file: {Path(file_path).name} - PyPDF2 not installed]",
                'metadata': {}
            }
        except Exception as e:
            logger.error(f"Error processing PDF {file_path}: {e}")
            raise
    
    def _process_docx(self, file_path: str) -> Dict[str, any]:
        """Process DOCX file"""
        try:
            from docx import Document
            
            doc = Document(file_path)
            
            # Extract title (first heading or filename)
            title = Path(file_path).stem
            if doc.paragraphs:
                first_para = doc.paragraphs[0]
                if first_para.style.name.startswith('Heading'):
                    title = first_para.text.strip()
            
            # Extract text from all paragraphs
            content_parts = []
            for para in doc.paragraphs:
                text = para.text.strip()
                if text:
                    content_parts.append(text)
            
            content = '\n\n'.join(content_parts)
            
            return {
                'title': title,
                'content': content,
                'metadata': {
                    'paragraph_count': len(doc.paragraphs)
                }
            }
        except ImportError:
            logger.warning("python-docx not installed. Install it with: pip install python-docx")
            return {
                'title': Path(file_path).stem,
                'content': f"[DOCX file: {Path(file_path).name} - python-docx not installed]",
                'metadata': {}
            }
        except Exception as e:
            logger.error(f"Error processing DOCX {file_path}: {e}")
            raise
    
    def _process_doc(self, file_path: str) -> Dict[str, any]:
        """Process DOC file (legacy Word format)"""
        # DOC files are harder to process, might need additional libraries
        # For now, return a placeholder
        logger.warning(f"DOC files require additional processing. File: {file_path}")
        return {
            'title': Path(file_path).stem,
            'content': f"[DOC file: {Path(file_path).name} - Legacy format, conversion needed]",
            'metadata': {}
        }
    
    def _process_txt(self, file_path: str) -> Dict[str, any]:
        """Process plain text file"""
        try:
            with open(file_path, 'r', encoding='utf-8') as file:
                content = file.read()
            
            # Use first line as title if it looks like a title
            lines = content.split('\n')
            title = Path(file_path).stem
            if lines and len(lines[0]) < 100 and not lines[0].startswith(' '):
                title = lines[0].strip()
                content = '\n'.join(lines[1:])
            
            return {
                'title': title,
                'content': content,
                'metadata': {}
            }
        except Exception as e:
            logger.error(f"Error processing TXT {file_path}: {e}")
            raise
    
    def _process_markdown(self, file_path: str) -> Dict[str, any]:
        """Process Markdown file"""
        try:
            with open(file_path, 'r', encoding='utf-8') as file:
                content = file.read()
            
            # Extract title from first heading
            lines = content.split('\n')
            title = Path(file_path).stem
            for line in lines[:10]:  # Check first 10 lines
                if line.strip().startswith('# '):
                    title = line.strip()[2:].strip()
                    break
            
            return {
                'title': title,
                'content': content,
                'metadata': {}
            }
        except Exception as e:
            logger.error(f"Error processing Markdown {file_path}: {e}")
            raise
    
    def _process_html(self, file_path: str) -> Dict[str, any]:
        """Process HTML file"""
        try:
            from bs4 import BeautifulSoup
            
            with open(file_path, 'r', encoding='utf-8') as file:
                html = file.read()
            
            soup = BeautifulSoup(html, 'html.parser')
            
            # Extract title
            title = Path(file_path).stem
            if soup.title:
                title = soup.title.string.strip() if soup.title.string else title
            
            # Remove script and style
            for script in soup(["script", "style"]):
                script.decompose()
            
            # Extract text
            content = soup.get_text(separator='\n', strip=True)
            
            return {
                'title': title,
                'content': content,
                'metadata': {}
            }
        except Exception as e:
            logger.error(f"Error processing HTML {file_path}: {e}")
            raise
    
    def _process_csv(self, file_path: str) -> Dict[str, any]:
        """Process CSV file"""
        try:
            import csv
            
            content_parts = []
            with open(file_path, 'r', encoding='utf-8') as file:
                csv_reader = csv.reader(file)
                for row in csv_reader:
                    content_parts.append(', '.join(row))
            
            content = '\n'.join(content_parts)
            
            return {
                'title': Path(file_path).stem,
                'content': content,
                'metadata': {
                    'row_count': len(content_parts)
                }
            }
        except Exception as e:
            logger.error(f"Error processing CSV {file_path}: {e}")
            raise
    
    def _process_json(self, file_path: str) -> Dict[str, any]:
        """Process JSON file"""
        try:
            import json
            
            with open(file_path, 'r', encoding='utf-8') as file:
                data = json.load(file)
            
            # Convert JSON to readable text
            content = json.dumps(data, indent=2)
            
            return {
                'title': Path(file_path).stem,
                'content': content,
                'metadata': {}
            }
        except Exception as e:
            logger.error(f"Error processing JSON {file_path}: {e}")
            raise

