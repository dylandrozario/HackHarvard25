#!/usr/bin/env python3
"""
Wrapper script for Bias Checker
Called by Node.js API to check VoteVerify results for bias/hallucinations
"""

import sys
import json
import os
from google import genai

# Add current directory to path so we can import bias_checker
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)

# Import the bias checker prompt
try:
    from bias_checker import get_bias_checker_prompt
except ImportError:
    # If bias_checker.py is not found, define prompt inline
    def get_bias_checker_prompt():
        return """[The bias checker prompt from your document]"""


def check_bias(voteverify_result):
    """
    Check VoteVerify analysis for bias and hallucinations
    
    Args:
        voteverify_result: Dict with VoteVerify analysis output
    
    Returns:
        Dict with bias checking results
    """
    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key:
        return {
            'error': 'GEMINI_API_KEY not set',
            'finalDecision': {'action': 'reject'}
        }
    
    try:
        # Initialize Gemini client
        client = genai.Client(api_key=api_key)
        
        # Get bias checker prompt
        system_prompt = get_bias_checker_prompt()
        
        # Construct evaluation prompt
        analysis_text = voteverify_result.get('analysis', '')
        primary_score = voteverify_result.get('primary_score', 0)
        detailed_score = voteverify_result.get('detailed_score', 0)
        
        eval_prompt = f"""
Evaluate this VoteVerify analysis for bias, hallucinations, and quality.

ANALYSIS TO EVALUATE:
{analysis_text}

SCORES PROVIDED:
- Primary Score: {primary_score}/5
- Detailed Score: {detailed_score}/100

Perform a complete evaluation following the bias checker system prompt.
Return ONLY valid JSON with all required fields.
"""
        
        # Send to Gemini
        full_prompt = f"{system_prompt}\n\n{eval_prompt}"
        response = client.models.generate_content(
            model='gemini-1.5-flash',
            contents=full_prompt
        )
        
        response_text = response.text
        
        # Extract JSON from response
        import re
        json_match = re.search(r'\{[\s\S]*\}', response_text)
        
        if json_match:
            result = json.loads(json_match.group(0))
            return result
        else:
            # Fallback if JSON parsing fails
            return {
                'evaluationId': 'eval_' + str(int(os.time.time())),
                'biasDetection': {
                    'score': 50,
                    'level': 'unknown',
                    'detected': False,
                    'recommendation': 'verify'
                },
                'hallucinationDetection': {
                    'score': 50,
                    'level': 'unknown',
                    'detected': False,
                    'recommendation': 'verify'
                },
                'citationQuality': {
                    'score': 50,
                    'level': 'fair'
                },
                'accuracyVerification': {
                    'score': 50,
                    'level': 'fair'
                },
                'overallSatisfaction': {
                    'score': 50,
                    'level': 'fair',
                    'userReady': False
                },
                'finalDecision': {
                    'action': 'warn',
                    'reasoning': 'Could not parse bias checker response',
                    'improvementNeeded': ['Manual review required']
                }
            }
            
    except Exception as e:
        return {
            'error': str(e),
            'finalDecision': {
                'action': 'reject',
                'reasoning': f'Bias check failed: {str(e)}'
            }
        }


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'No input file provided'}))
        sys.exit(1)
    
    input_file = sys.argv[1]
    
    try:
        with open(input_file, 'r') as f:
            voteverify_result = json.load(f)
        
        # Run bias checking
        result = check_bias(voteverify_result)
        
        # Output JSON to stdout
        print(json.dumps(result, indent=2))
        sys.exit(0)
        
    except Exception as e:
        print(json.dumps({
            'error': f'Bias check failed: {str(e)}',
            'finalDecision': {'action': 'reject'}
        }))
        sys.exit(1)