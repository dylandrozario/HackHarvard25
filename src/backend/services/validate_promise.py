"""
Wrapper script for VoteVerify validation
Called by Node.js API to validate a single promise
"""

import sys
import json
import os
from .env import GEMINI_API_KEY

# Add parent directory to path to import test_voteverify
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from test_voteverify import VoteVerifyAnalyzer


def validate_promise(promise_data):
    """
    Validate a single promise using VoteVerify
    
    Args:
        promise_data: Dict with promise from promises.json
    
    Returns:
        Dict with validation results
    """
    # Get API key from environment
    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key:
        return {
            'error': 'GEMINI_API_KEY not set',
            'primary_score': 0,
            'detailed_score': 0
        }
    
    try:
        # Initialize VoteVerify analyzer
        analyzer = VoteVerifyAnalyzer(api_key=api_key)
        
        # Run analysis using analyze_backend_promise
        result = analyzer.analyze_backend_promise(promise_data)
        
        # Return structured result
        return {
            'success': True,
            'primary_score': int(result.get('primary_score', 0)),
            'detailed_score': int(result.get('detailed_score', 0)),
            'confidence': result.get('confidence', 'unknown'),
            'analysis': result.get('raw_response', ''),
            'backend_metadata': result.get('backend_metadata', {})
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'primary_score': 0,
            'detailed_score': 0
        }


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'No input file provided'}))
        sys.exit(1)
    
    # Read promise data from temp file
    input_file = sys.argv[1]
    
    try:
        with open(input_file, 'r') as f:
            promise_data = json.load(f)
        
        # Run validation
        result = validate_promise(promise_data)
        
        # Output JSON result to stdout
        print(json.dumps(result, indent=2))
        
        # Exit with success
        sys.exit(0)
        
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': f'Validation failed: {str(e)}'
        }))
        sys.exit(1)