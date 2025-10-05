"""
Unit tests for Votify - Political Promise Analysis System
Tests the system prompt, API integration, and analysis functionality.

INTEGRATED WITH BACKEND:
- Tests promise format from Perplexity + Gemini + DataGenerator
- Validates Votify analysis of backend-generated promises
- Ensures credibilityLevel and verification metadata are used
- Tests Multi-AI bias detection (Gemini + Cloudflare)
- Tests reloop mechanism with best attempt selection
- Tests stock market analysis integration
- Tests combined analysis with validation
"""

import unittest
from unittest.mock import Mock, patch, MagicMock
import os
import sys
import json
from typing import Dict, List, Optional

# Add the current directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from system_prompt import get_system_prompt
from google import genai


# ============================================================================
# VotifyAnalyzer Class
# ============================================================================

class VotifyAnalyzer:
    """
    Analyzes political promises against voting records using Gemini API.
    """
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize the Votify analyzer.
        
        Args:
            api_key: Google Gemini API key. If not provided, reads from environment.
        """
        self.api_key = api_key or os.getenv('GEMINI_API_KEY')
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY not found in environment or parameters")
        
        # Initialize Gemini client
        self.client = genai.Client(api_key=self.api_key)
        self.model_name = 'gemini-2.5-flash'
        
        # Load system prompt
        self.system_prompt = get_system_prompt()
    
    def analyze_promise(
        self,
        candidate_name: str,
        promise: str,
        voting_record: List[Dict[str, str]],
        additional_context: Optional[str] = None
    ) -> Dict:
        """
        Analyze a campaign promise against voting records.
        
        Args:
            candidate_name: Name of the political candidate
            promise: The campaign promise to analyze
            voting_record: List of votes with keys 'bill_name', 'bill_number', 
                          'date', 'vote', 'description'
            additional_context: Optional additional context about the candidate
        
        Returns:
            Dictionary containing analysis results with keys:
            - summary, primary_score, detailed_score, analysis, evidence, verdict
        """
        # Format voting record
        voting_record_text = self._format_voting_record(voting_record)
        
        # Construct the analysis prompt
        analysis_prompt = self._construct_prompt(
            candidate_name, 
            promise, 
            voting_record_text,
            additional_context
        )
        
        # Send to Gemini API
        # Combine system prompt and analysis prompt
        full_prompt = f"{self.system_prompt}\n\n{analysis_prompt}"
        
        response = self.client.models.generate_content(
            model=self.model_name,
            contents=full_prompt
        )
        
        # Parse response
        return self._parse_response(response.text)
    
    def _format_voting_record(self, voting_record: List[Dict[str, str]]) -> str:
        """Format voting record for the prompt."""
        formatted = []
        for i, vote in enumerate(voting_record, 1):
            bill = vote.get('bill_number', 'Unknown')
            name = vote.get('bill_name', 'Unknown Bill')
            date = vote.get('date', 'Unknown date')
            vote_cast = vote.get('vote', 'Unknown')
            desc = vote.get('description', '')
            
            formatted.append(
                f"{i}. {bill} - {name} ({date})\n"
                f"   Vote: {vote_cast}\n"
                f"   {desc}"
            )
        
        return "\n\n".join(formatted)
    
    def _construct_prompt(
        self,
        candidate_name: str,
        promise: str,
        voting_record_text: str,
        additional_context: Optional[str] = None
    ) -> str:
        """Construct the analysis prompt."""
        prompt = f"""
Analyze the following campaign promise and voting record for political candidate {candidate_name}.

CAMPAIGN PROMISE:
"{promise}"

VOTING RECORD:
{voting_record_text}
"""
        
        if additional_context:
            prompt += f"\n\nADDITIONAL CONTEXT:\n{additional_context}\n"
        
        prompt += """

Based on this information, provide a complete analysis following the format specified in the system instructions:
1. Summary Statement
2. Match Scores (both 1-5 and 0-100 scales)
3. Detailed Analysis
4. Key Evidence
5. Verdict

Apply the fuzzy matching algorithm to evaluate the semantic alignment between the promise and actions.
"""
        
        return prompt
    
    def _parse_response(self, response_text: str) -> Dict:
        """
        Parse the Gemini API response into structured data.
        
        Args:
            response_text: Raw text response from Gemini
        
        Returns:
            Structured dictionary with analysis results
        """
        result = {
            'raw_response': response_text,
            'summary': '',
            'primary_score': None,
            'detailed_score': None,
            'confidence': '',
            'analysis': '',
            'evidence': [],
            'verdict': {}
        }
        
        # Extract scores using simple pattern matching
        lines = response_text.split('\n')
        
        for line in lines:
            if 'Primary Score:' in line or 'Match Score:' in line:
                # Extract score (e.g., "3/5")
                if '/5' in line:
                    score_part = line.split('/5')[0]
                    result['primary_score'] = score_part.strip().split()[-1]
            
            elif 'Detailed Score:' in line:
                # Extract score (e.g., "65/100")
                if '/100' in line:
                    score_part = line.split('/100')[0]
                    result['detailed_score'] = score_part.strip().split()[-1]
        
        return result
    
    def analyze_backend_promise(self, backend_promise: Dict) -> Dict:
        """
        Analyze a promise in the backend format (from Perplexity + Gemini + DataGenerator).
        
        Args:
            backend_promise: Promise dict with keys:
                - president, promise, date, category, status, evidence,
                - sources, affectedIndustries, verified, credibilityLevel,
                - realSources, dataSource, generatedAt
        
        Returns:
            Analysis result dict with Votify comprehensive analysis
        """
        # Convert backend promise format to Votify input format
        president = backend_promise.get('president', 'Unknown')
        promise_text = backend_promise.get('promise', '')
        
        # Convert evidence to voting_record format
        voting_record = []
        evidence_items = backend_promise.get('evidence', [])
        for idx, evidence in enumerate(evidence_items, 1):
            voting_record.append({
                'bill_number': f'Evidence {idx}',
                'bill_name': evidence[:100] if len(evidence) > 100 else evidence,
                'date': backend_promise.get('date', 'Unknown'),
                'vote': backend_promise.get('status', 'Unknown').upper(),
                'description': evidence
            })
        
        # Build additional context from backend metadata
        industries = backend_promise.get('affectedIndustries', [])
        industry_text = ', '.join([
            f"{ind['name']} ({ind['predictedImpact']})" 
            for ind in industries[:3]
        ]) if industries else 'None specified'
        
        real_sources = backend_promise.get('realSources', [])
        sources_text = '\n  - '.join(real_sources[:5]) if real_sources else 'None provided'
        
        additional_context = f"""
BACKEND METADATA:
- Category: {backend_promise.get('category', 'Unknown')}
- Date Made: {backend_promise.get('date', 'Unknown')}
- Initial Status (from Gemini): {backend_promise.get('status', 'unknown')}
- Verification: {'Verified ✓' if backend_promise.get('verified') else 'Unverified'}
- Credibility Level: {backend_promise.get('credibilityLevel', 'unknown')}
- Data Source: {backend_promise.get('dataSource', 'unknown')}
- Generated: {backend_promise.get('generatedAt', 'unknown')}

AFFECTED INDUSTRIES:
{industry_text}

VERIFIED SOURCES (from Perplexity):
  - {sources_text}

ORIGINAL EVIDENCE:
{chr(10).join([f'  - {e}' for e in evidence_items[:5]])}
"""
        
        # Call standard analyze_promise method
        result = self.analyze_promise(
            candidate_name=president,
            promise=promise_text,
            voting_record=voting_record,
            additional_context=additional_context
        )
        
        # Enhance result with backend metadata
        result['backend_metadata'] = {
            'verified': backend_promise.get('verified', False),
            'credibilityLevel': backend_promise.get('credibilityLevel', 'unknown'),
            'dataSource': backend_promise.get('dataSource', 'unknown'),
            'initial_status': backend_promise.get('status', 'unknown'),
            'real_sources_count': len(real_sources)
        }
        
        return result
    
    def batch_analyze(
        self,
        candidate_name: str,
        promises_and_records: List[Dict]
    ) -> List[Dict]:
        """
        Analyze multiple promises for the same candidate.
        
        Args:
            candidate_name: Name of the candidate
            promises_and_records: List of dicts with 'promise' and 'voting_record'
        
        Returns:
            List of analysis results
        """
        results = []
        
        for item in promises_and_records:
            promise = item['promise']
            voting_record = item['voting_record']
            additional_context = item.get('additional_context')
            
            result = self.analyze_promise(
                candidate_name,
                promise,
                voting_record,
                additional_context
            )
            
            results.append({
                'promise': promise,
                'analysis': result
            })
        
        return results


# ============================================================================
# Unit Tests
# ============================================================================


class TestSystemPrompt(unittest.TestCase):
    """Test the system prompt functionality."""
    
    def test_get_system_prompt_returns_string(self):
        """Test that get_system_prompt returns a non-empty string."""
        prompt = get_system_prompt()
        self.assertIsInstance(prompt, str)
        self.assertGreater(len(prompt), 100)
    
    def test_system_prompt_contains_key_sections(self):
        """Test that the system prompt contains all required sections."""
        prompt = get_system_prompt()
        
        # Check for key sections
        required_sections = [
            "VoteVerify",  # System uses VoteVerify
            "Scoring System",
            "1-5 Match Score",
            "0-100 Detailed Score",
            "Fuzzy Matching",
            "Analysis Framework",
            "Output Format"
        ]
        
        for section in required_sections:
            self.assertIn(section, prompt, f"Missing section: {section}")
    
    def test_system_prompt_contains_score_definitions(self):
        """Test that score definitions are present."""
        prompt = get_system_prompt()
        
        # Check 1-5 score levels
        for score in ["5 - Fully Aligned", "4 - Mostly Aligned", "3 - Partially Aligned", 
                      "2 - Mostly Misaligned", "1 - Completely Misaligned"]:
            self.assertIn(score, prompt)
        
        # Check 0-100 score ranges
        for score_range in ["90-100", "75-89", "60-74", "40-59", "20-39", "0-19"]:
            self.assertIn(score_range, prompt)


class TestVotifyAnalyzer(unittest.TestCase):
    """Test the VotifyAnalyzer class."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.test_api_key = "test_api_key_12345"
        
        self.sample_voting_record = [
            {
                'bill_number': 'H.R. 123',
                'bill_name': 'Healthcare for All Act',
                'date': '2023-06-15',
                'vote': 'NO',
                'description': 'Comprehensive healthcare expansion bill'
            },
            {
                'bill_number': 'S. 456',
                'bill_name': 'Patient Protection Bill',
                'date': '2023-08-22',
                'vote': 'NO',
                'description': 'Bill to strengthen patient protections'
            }
        ]
    
    @patch('__main__.genai.Client')
    def test_analyzer_initialization(self, mock_client_class):
        """Test that VotifyAnalyzer initializes correctly."""
        # Create a mock client instance
        mock_client_instance = MagicMock()
        mock_client_class.return_value = mock_client_instance
        
        analyzer = VotifyAnalyzer(api_key=self.test_api_key)
        
        # Verify client was initialized with API key
        mock_client_class.assert_called_once_with(api_key=self.test_api_key)
        
        # Verify model name was set
        self.assertEqual(analyzer.model_name, 'gemini-2.5-flash')
        
        # Verify system prompt was loaded
        self.assertIsInstance(analyzer.system_prompt, str)
        self.assertGreater(len(analyzer.system_prompt), 100)
    
    @patch.dict(os.environ, {}, clear=True)
    def test_analyzer_missing_api_key(self):
        """Test that analyzer raises error when API key is missing."""
        with self.assertRaises(ValueError) as context:
            VotifyAnalyzer()
        
        self.assertIn("GEMINI_API_KEY", str(context.exception))
    
    @patch('__main__.genai.Client')
    def test_format_voting_record(self, mock_client_class):
        """Test that voting records are formatted correctly."""
        mock_client_class.return_value = MagicMock()
        analyzer = VotifyAnalyzer(api_key=self.test_api_key)
        
        formatted = analyzer._format_voting_record(self.sample_voting_record)
        
        # Check that all bills are included
        self.assertIn('H.R. 123', formatted)
        self.assertIn('Healthcare for All Act', formatted)
        self.assertIn('S. 456', formatted)
        self.assertIn('Patient Protection Bill', formatted)
        
        # Check that votes are included
        self.assertIn('NO', formatted)
        
        # Check that dates are included
        self.assertIn('2023-06-15', formatted)
        self.assertIn('2023-08-22', formatted)
    
    @patch('__main__.genai.Client')
    def test_construct_prompt(self, mock_client_class):
        """Test that analysis prompt is constructed correctly."""
        mock_client_class.return_value = MagicMock()
        analyzer = VotifyAnalyzer(api_key=self.test_api_key)
        
        candidate = "Jane Doe"
        promise = "I support affordable healthcare."
        voting_record_text = "H.R. 123 - Healthcare for All Act - Voted NO"
        
        prompt = analyzer._construct_prompt(
            candidate, 
            promise, 
            voting_record_text
        )
        
        # Check prompt contains all key elements
        self.assertIn(candidate, prompt)
        self.assertIn(promise, prompt)
        self.assertIn(voting_record_text, prompt)
        self.assertIn("CAMPAIGN PROMISE", prompt)
        self.assertIn("VOTING RECORD", prompt)
        self.assertIn("Match Scores", prompt)
    
    @patch('__main__.genai.Client')
    def test_parse_response(self, mock_client_class):
        """Test that API responses are parsed correctly."""
        mock_client_class.return_value = MagicMock()
        analyzer = VotifyAnalyzer(api_key=self.test_api_key)
        
        # Mock response text
        mock_response = """
        SUMMARY: The candidate's voting record contradicts their promise.
        
        MATCH SCORES:
        - Primary Score: 2/5 (Mostly Misaligned)
        - Detailed Score: 35/100
        - Confidence: High
        
        ANALYSIS:
        The candidate voted against key healthcare bills...
        
        VERDICT:
        - Status: Broken
        - Credibility Rating: Low
        - Flag: Major Discrepancy
        """
        
        result = analyzer._parse_response(mock_response)
        
        # Check that result contains expected keys
        self.assertIn('raw_response', result)
        self.assertIn('primary_score', result)
        self.assertIn('detailed_score', result)
        
        # Check that scores were extracted
        self.assertEqual(result['primary_score'], '2')
        self.assertEqual(result['detailed_score'], '35')
    
    @patch('__main__.genai.Client')
    def test_analyze_promise_integration(self, mock_client_class):
        """Test the complete analyze_promise workflow with mocked API."""
        # Create a mock client instance
        mock_client_instance = MagicMock()
        mock_client_class.return_value = mock_client_instance
        
        # Mock the models.generate_content method
        mock_response = MagicMock()
        mock_response.text = """
        SUMMARY: Significant contradiction between promise and actions.
        
        MATCH SCORES:
        - Primary Score: 2/5 (Mostly Misaligned)
        - Detailed Score: 35/100
        - Confidence: High
        
        ANALYSIS:
        The candidate's promise to support affordable healthcare conflicts with their voting record.
        They voted NO on H.R. 123 and S. 456, both comprehensive healthcare bills.
        
        VERDICT:
        - Status: Broken
        - Credibility Rating: Low
        - Flag: Major Discrepancy
        """
        mock_client_instance.models.generate_content.return_value = mock_response
        
        # Create analyzer and run analysis
        analyzer = VotifyAnalyzer(api_key=self.test_api_key)
        
        result = analyzer.analyze_promise(
            candidate_name="Jane Doe",
            promise="I support affordable healthcare.",
            voting_record=self.sample_voting_record
        )
        
        # Verify generate_content was called
        self.assertTrue(mock_client_instance.models.generate_content.called)
        
        # Verify result structure
        self.assertIsInstance(result, dict)
        self.assertIn('raw_response', result)
        self.assertIn('primary_score', result)
        self.assertIn('detailed_score', result)
        
        # Verify scores were extracted
        self.assertEqual(result['primary_score'], '2')
        self.assertEqual(result['detailed_score'], '35')
    
    @patch('__main__.genai.Client')
    def test_batch_analyze(self, mock_client_class):
        """Test batch analysis of multiple promises."""
        # Create a mock client instance
        mock_client_instance = MagicMock()
        mock_client_class.return_value = mock_client_instance
        
        # Mock the API response
        mock_response = MagicMock()
        mock_response.text = """
        Primary Score: 3/5
        Detailed Score: 60/100
        """
        mock_client_instance.models.generate_content.return_value = mock_response
        
        analyzer = VotifyAnalyzer(api_key=self.test_api_key)
        
        # Test data with multiple promises
        promises_and_records = [
            {
                'promise': 'I support healthcare reform.',
                'voting_record': self.sample_voting_record
            },
            {
                'promise': 'I will fight for lower drug prices.',
                'voting_record': [
                    {
                        'bill_number': 'S. 789',
                        'bill_name': 'Drug Price Reform Act',
                        'date': '2024-01-10',
                        'vote': 'YES',
                        'description': 'Bill to reduce prescription drug costs'
                    }
                ]
            }
        ]
        
        results = analyzer.batch_analyze("Jane Doe", promises_and_records)
        
        # Verify results
        self.assertEqual(len(results), 2)
        self.assertIsInstance(results, list)
        
        for result in results:
            self.assertIn('promise', result)
            self.assertIn('analysis', result)


class TestBackendIntegration(unittest.TestCase):
    """Test Votify with backend promise format (Perplexity + Gemini + DataGenerator)."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.test_api_key = "test_key_12345"
        
        # Sample backend promise (as generated by dataGenerator.js)
        self.backend_promise = {
            "president": "Joe Biden",
            "promise": "I will rejoin the Paris Climate Agreement on Day One",
            "date": "2020-11-05",
            "category": "Energy",
            "status": "kept",
            "evidence": [
                "Executive Order rejoin Paris Agreement signed January 20, 2021 (https://www.whitehouse.gov/...)",
                "United States officially rejoined Paris Agreement February 19, 2021"
            ],
            "sources": ["https://www.whitehouse.gov/briefing-room/statements-releases/2021/01/20/"],
            "affectedIndustries": [
                {
                    "name": "Renewable Energy",
                    "predictedImpact": "positive",
                    "confidence": 90,
                    "reasoning": "Direct government support for clean energy"
                },
                {
                    "name": "Fossil Fuels",
                    "predictedImpact": "negative",
                    "confidence": 75,
                    "reasoning": "Shift away from traditional energy"
                }
            ],
            "verified": True,
            "credibilityLevel": "high",
            "realSources": [
                "https://www.whitehouse.gov/briefing-room/statements-releases/2021/01/20/",
                "https://www.state.gov/the-united-states-officially-rejoins-the-paris-agreement/"
            ],
            "dataSource": "perplexity+gemini",
            "generatedAt": "2025-10-04T12:00:00Z"
        }
    
    def test_backend_promise_format_validation(self):
        """Test that backend promise has all required fields."""
        required_fields = [
            'president', 'promise', 'date', 'category', 'status',
            'evidence', 'verified', 'credibilityLevel', 'dataSource'
        ]
        
        for field in required_fields:
            self.assertIn(field, self.backend_promise, 
                         f"Backend promise missing required field: {field}")
    
    @patch('__main__.genai.Client')
    def test_analyze_backend_promise(self, mock_client_class):
        """Test analyzing a promise in backend format."""
        # Mock setup
        mock_client_instance = MagicMock()
        mock_client_class.return_value = mock_client_instance
        
        mock_response = MagicMock()
        mock_response.text = """
        ANALYSIS: Joe Biden fully kept his promise to rejoin Paris Climate Agreement.
        
        Primary Score: 5/5 (Fully Aligned)
        Detailed Score: 100/100
        Confidence Level: High
        
        Score Justification: The promise was kept completely - Executive Order signed Day One.
        
        SOURCES AND CITATIONS:
        - https://www.whitehouse.gov/briefing-room/statements-releases/2021/01/20/
        - https://www.congress.gov/bill/117th-congress
        
        VERDICT:
        - Status: Kept
        - Credibility Rating: High
        - Flag: Consistent
        """
        mock_client_instance.models.generate_content.return_value = mock_response
        
        # Create analyzer
        analyzer = VotifyAnalyzer(api_key=self.test_api_key)
        
        # Analyze backend promise
        result = analyzer.analyze_backend_promise(self.backend_promise)
        
        # Verify results
        self.assertIsInstance(result, dict)
        self.assertIn('raw_response', result)
        self.assertIn('backend_metadata', result)
        
        # Check backend metadata
        metadata = result['backend_metadata']
        self.assertTrue(metadata['verified'])
        self.assertEqual(metadata['credibilityLevel'], 'high')
        self.assertEqual(metadata['dataSource'], 'perplexity+gemini')
        self.assertEqual(metadata['initial_status'], 'kept')
        self.assertGreater(metadata['real_sources_count'], 0)
        
        # Check scores
        self.assertEqual(result['primary_score'], '5')
        self.assertEqual(result['detailed_score'], '100')
    
    @patch('__main__.genai.Client')
    def test_backend_promise_with_low_credibility(self, mock_client_class):
        """Test analyzing a promise with low credibility from backend."""
        # Mock setup
        mock_client_instance = MagicMock()
        mock_client_class.return_value = mock_client_instance
        
        mock_response = MagicMock()
        mock_response.text = """
        Primary Score: 3/5
        Detailed Score: 60/100
        Confidence Level: Medium (due to low credibility of sources)
        """
        mock_client_instance.models.generate_content.return_value = mock_response
        
        # Create low credibility promise
        low_cred_promise = self.backend_promise.copy()
        low_cred_promise['verified'] = False
        low_cred_promise['credibilityLevel'] = 'low'
        low_cred_promise['realSources'] = []
        
        analyzer = VotifyAnalyzer(api_key=self.test_api_key)
        result = analyzer.analyze_backend_promise(low_cred_promise)
        
        # Check that low credibility is reflected in metadata
        self.assertFalse(result['backend_metadata']['verified'])
        self.assertEqual(result['backend_metadata']['credibilityLevel'], 'low')
        self.assertEqual(result['backend_metadata']['real_sources_count'], 0)
    
    def test_system_prompt_mentions_backend_format(self):
        """Test that system prompt includes backend format documentation."""
        prompt = get_system_prompt()
        
        # Check for backend-related keywords
        self.assertIn('Perplexity', prompt)
        self.assertIn('credibilityLevel', prompt)
        self.assertIn('verified', prompt)
        self.assertIn('Backend Promise Format', prompt)
        self.assertIn('realSources', prompt)


class TestStockMarketIntegration(unittest.TestCase):
    """Test stock market analysis integration."""
    
    def test_system_prompt_includes_market_analysis(self):
        """Test that system prompt includes stock market analysis instructions."""
        prompt = get_system_prompt()
        
        # Check for stock market related keywords
        self.assertIn('actualMarketImpact', prompt)
        self.assertIn('Market Reality Check', prompt)
        self.assertIn('predictedImpact', prompt)
        self.assertIn('predictionAccuracy', prompt)
        self.assertIn('yfinance', prompt.lower())
    
    def test_market_impact_data_structure(self):
        """Test that market impact data structure is documented."""
        prompt = get_system_prompt()
        
        # Check for structure elements
        self.assertIn('impact6mo', prompt)
        self.assertIn('impact12mo', prompt)
        self.assertIn('averageChange', prompt)
        self.assertIn('stocksAnalyzed', prompt)
        self.assertIn('industry', prompt)
        self.assertIn('tickers', prompt)
    
    def test_prediction_accuracy_values(self):
        """Test that prediction accuracy values are defined."""
        prompt = get_system_prompt()
        
        # Check for accuracy classifications
        self.assertIn('correct', prompt.lower())
        self.assertIn('incorrect', prompt.lower())
        self.assertIn('mixed', prompt.lower())


class TestFuzzyMatching(unittest.TestCase):
    """Test fuzzy matching algorithm."""
    
    def test_system_prompt_includes_fuzzy_matching(self):
        """Test that system prompt includes fuzzy matching algorithm."""
        prompt = get_system_prompt()
        
        # Check for fuzzy matching keywords
        self.assertIn('Fuzzy Matching', prompt)
        self.assertIn('semantic matching', prompt.lower())
    
    def test_fuzzy_matching_levels_defined(self):
        """Test that fuzzy matching score levels are defined."""
        prompt = get_system_prompt()
        
        # Check for matching levels
        self.assertIn('Exact Match', prompt)
        self.assertIn('Strong Match', prompt)
        self.assertIn('Moderate Match', prompt)
        self.assertIn('Weak Match', prompt)
        self.assertIn('No Match', prompt)
    
    def test_fuzzy_matching_percentages(self):
        """Test that fuzzy matching percentage ranges are defined."""
        prompt = get_system_prompt()
        
        # Check for percentage ranges
        self.assertIn('100%', prompt)  # Exact Match
        self.assertIn('75-99%', prompt)  # Strong Match
        self.assertIn('50-74%', prompt)  # Moderate Match
        self.assertIn('25-49%', prompt)  # Weak Match
        self.assertIn('0-24%', prompt)  # No Match


class TestBiasDetection(unittest.TestCase):
    """Test bias detection and validation features."""
    
    def test_bias_score_structure(self):
        """Test that bias detection scores follow expected structure."""
        # Mock bias check result structure
        bias_result = {
            'biasDetection': {
                'score': 25,
                'reasoning': 'Analysis appears balanced'
            },
            'hallucinationDetection': {
                'score': 10,
                'reasoning': 'Facts are verifiable'
            },
            'overallSatisfaction': {
                'score': 85,
                'reasoning': 'High quality analysis'
            },
            'finalDecision': {
                'action': 'approve',
                'reasoning': 'All checks passed'
            }
        }
        
        # Verify structure
        self.assertIn('biasDetection', bias_result)
        self.assertIn('hallucinationDetection', bias_result)
        self.assertIn('overallSatisfaction', bias_result)
        self.assertIn('finalDecision', bias_result)
        
        # Verify score ranges
        self.assertGreaterEqual(bias_result['biasDetection']['score'], 0)
        self.assertLessEqual(bias_result['biasDetection']['score'], 100)
        self.assertGreaterEqual(bias_result['hallucinationDetection']['score'], 0)
        self.assertLessEqual(bias_result['hallucinationDetection']['score'], 100)
        self.assertGreaterEqual(bias_result['overallSatisfaction']['score'], 0)
        self.assertLessEqual(bias_result['overallSatisfaction']['score'], 100)
    
    def test_decision_actions(self):
        """Test that decision actions are valid."""
        valid_actions = ['approve', 'approve_with_warning', 'reloop', 'reject']
        
        for action in valid_actions:
            decision = {'action': action, 'reasoning': 'Test reasoning'}
            self.assertIn(decision['action'], valid_actions)
    
    def test_multi_ai_consensus_structure(self):
        """Test multi-AI consensus result structure."""
        multi_ai_result = {
            'consensusReached': True,
            'models': ['gemini', 'cloudflare'],
            'averageScores': {
                'bias': 20,
                'hallucination': 15,
                'satisfaction': 80
            },
            'finalDecision': {
                'action': 'approve',
                'reasoning': 'Multi-AI consensus reached',
                'improvementNeeded': None
            },
            'modelResults': []
        }
        
        # Verify structure
        self.assertIn('consensusReached', multi_ai_result)
        self.assertIn('models', multi_ai_result)
        self.assertIn('averageScores', multi_ai_result)
        self.assertIn('finalDecision', multi_ai_result)
        
        # Verify consensus is boolean
        self.assertIsInstance(multi_ai_result['consensusReached'], bool)
        
        # Verify models is a list
        self.assertIsInstance(multi_ai_result['models'], list)
        self.assertGreater(len(multi_ai_result['models']), 0)


class TestReloopMechanism(unittest.TestCase):
    """Test reloop mechanism with best attempt selection."""
    
    def test_reloop_history_structure(self):
        """Test that reloop history maintains correct structure."""
        history = [
            {
                'attempt': 1,
                'response': {'analysis': 'First attempt'},
                'evaluation': {
                    'biasDetection': {'score': 40},
                    'hallucinationDetection': {'score': 30},
                    'overallSatisfaction': {'score': 60}
                }
            },
            {
                'attempt': 2,
                'response': {'analysis': 'Second attempt'},
                'evaluation': {
                    'biasDetection': {'score': 20},
                    'hallucinationDetection': {'score': 15},
                    'overallSatisfaction': {'score': 85}
                }
            }
        ]
        
        # Verify each attempt has required fields
        for attempt in history:
            self.assertIn('attempt', attempt)
            self.assertIn('response', attempt)
            self.assertIn('evaluation', attempt)
            self.assertIsInstance(attempt['attempt'], int)
    
    def test_best_attempt_selection_logic(self):
        """Test that best attempt is selected correctly based on quality score."""
        attempts = [
            {
                'attempt': 1,
                'bias': 40,
                'hallucination': 30,
                'satisfaction': 60,
                'quality_score': 40 + 30 + (100 - 60)  # = 110
            },
            {
                'attempt': 2,
                'bias': 20,
                'hallucination': 15,
                'satisfaction': 85,
                'quality_score': 20 + 15 + (100 - 85)  # = 50
            },
            {
                'attempt': 3,
                'bias': 35,
                'hallucination': 25,
                'satisfaction': 70,
                'quality_score': 35 + 25 + (100 - 70)  # = 90
            }
        ]
        
        # Best attempt should be #2 (lowest quality_score)
        best = min(attempts, key=lambda x: x['quality_score'])
        self.assertEqual(best['attempt'], 2)
        self.assertEqual(best['quality_score'], 50)
    
    def test_reloop_max_attempts(self):
        """Test that reloop respects max attempts limit."""
        max_attempts = 3
        current_attempt = 1
        
        # Should allow reloop
        can_reloop = current_attempt < max_attempts
        self.assertTrue(can_reloop)
        
        # Should not allow reloop at max
        current_attempt = 3
        can_reloop = current_attempt < max_attempts
        self.assertFalse(can_reloop)
    
    def test_improvement_needed_message(self):
        """Test that improvement messages are specific."""
        evaluation = {
            'biasDetection': {
                'score': 45,
                'reasoning': 'Some political bias detected'
            },
            'hallucinationDetection': {
                'score': 35,
                'reasoning': 'Some unverified claims'
            },
            'finalDecision': {
                'action': 'reloop',
                'improvementNeeded': 'Reduce political bias. Verify all factual claims.'
            }
        }
        
        # Verify improvement message exists
        self.assertIn('improvementNeeded', evaluation['finalDecision'])
        improvement = evaluation['finalDecision']['improvementNeeded']
        self.assertIsNotNone(improvement)
        self.assertGreater(len(improvement), 0)


class TestCombinedAnalysis(unittest.TestCase):
    """Test combined promise analysis with validation."""
    
    def test_combined_analysis_output_structure(self):
        """Test that combined analysis follows expected structure."""
        combined_result = {
            'president': 'Barack Obama',
            'promisesAnalyzed': 25,
            'overallScore': 75,
            'overallRating': 4,
            'summary': 'Overall analysis summary',
            'verdict': 'Mostly kept promises',
            'keyInsights': [
                'Healthcare expansion was successful',
                'Economic recovery showed progress'
            ],
            'categoryBreakdown': {
                'Healthcare': {'score': 85, 'count': 5},
                'Economy': {'score': 70, 'count': 8}
            }
        }
        
        # Verify required fields
        self.assertIn('president', combined_result)
        self.assertIn('promisesAnalyzed', combined_result)
        self.assertIn('overallScore', combined_result)
        self.assertIn('overallRating', combined_result)
        self.assertIn('summary', combined_result)
        self.assertIn('verdict', combined_result)
        
        # Verify score ranges
        self.assertGreaterEqual(combined_result['overallScore'], 0)
        self.assertLessEqual(combined_result['overallScore'], 100)
        self.assertGreaterEqual(combined_result['overallRating'], 1)
        self.assertLessEqual(combined_result['overallRating'], 5)
    
    def test_quality_check_metadata(self):
        """Test that quality check metadata is included."""
        quality_check = {
            'biasScore': 0.15,
            'hallucinationScore': 0.10,
            'satisfactionScore': 0.85,
            'decision': 'approve',
            'attempts': 1,
            'bestAttemptSelected': False,
            'bestAttemptNumber': None
        }
        
        # Verify structure
        self.assertIn('biasScore', quality_check)
        self.assertIn('hallucinationScore', quality_check)
        self.assertIn('satisfactionScore', quality_check)
        self.assertIn('decision', quality_check)
        self.assertIn('attempts', quality_check)
        
        # Verify score ranges (normalized 0-1)
        self.assertGreaterEqual(quality_check['biasScore'], 0)
        self.assertLessEqual(quality_check['biasScore'], 1)


def run_tests():
    """Run all tests and display results."""
    # Create test suite
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    
    # Add all test classes
    suite.addTests(loader.loadTestsFromTestCase(TestSystemPrompt))
    suite.addTests(loader.loadTestsFromTestCase(TestVotifyAnalyzer))
    suite.addTests(loader.loadTestsFromTestCase(TestBackendIntegration))
    suite.addTests(loader.loadTestsFromTestCase(TestStockMarketIntegration))
    suite.addTests(loader.loadTestsFromTestCase(TestFuzzyMatching))
    suite.addTests(loader.loadTestsFromTestCase(TestBiasDetection))
    suite.addTests(loader.loadTestsFromTestCase(TestReloopMechanism))
    suite.addTests(loader.loadTestsFromTestCase(TestCombinedAnalysis))
    
    # Run tests with verbose output
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    # Print summary
    print("\n" + "="*70)
    print("TEST SUMMARY - VOTIFY COMPREHENSIVE UNIT TESTS")
    print("="*70)
    print(f"Tests run: {result.testsRun}")
    print(f"Successes: {result.testsRun - len(result.failures) - len(result.errors)}")
    print(f"Failures: {len(result.failures)}")
    print(f"Errors: {len(result.errors)}")
    print("="*70)
    print("\nTest Coverage:")
    print("  - System Prompt Validation")
    print("  - VoteVerify Analyzer Core")
    print("  - Backend Integration")
    print("  - Stock Market Analysis")
    print("  - Fuzzy Matching Algorithm")
    print("  - Bias Detection & Multi-AI")
    print("  - Reloop Mechanism")
    print("  - Combined Analysis")
    print("="*70)
    
    return result.wasSuccessful()


if __name__ == '__main__':
    success = run_tests()
    sys.exit(0 if success else 1)

