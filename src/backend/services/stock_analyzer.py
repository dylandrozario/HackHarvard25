"""
Stock Market Analyzer - Uses yfinance to get historical stock data
and calculate actual market impact of political promises.
"""
import yfinance as yf
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import json

# Industry to Stock Ticker Mapping
INDUSTRY_TICKERS = {
    # Energy
    "Renewable Energy": ["NEE", "ENPH", "SEDG", "FSLR"],  
    "Fossil Fuels": ["XOM", "CVX", "COP"], 
    "Oil and Gas": ["XOM", "CVX", "COP", "OXY"],
    "Nuclear Energy": ["NEE", "DUK", "EXC"], 
    "Coal": ["BTU", "ARCH"], 
    "Energy": ["XLE"],  
    
    # Healthcare
    "Healthcare": ["XLV", "UNH", "JNJ", "PFE"],  
    "Health Insurance": ["UNH", "CVS", "CI", "HUM"],  
    "Healthcare Services": ["HCA", "UNH", "CVS"],
    "Pharmaceuticals": ["PFE", "JNJ", "MRK", "ABBV"],
    
    # Technology
    "Technology": ["XLK", "AAPL", "MSFT", "GOOGL"],  
    "Software": ["MSFT", "ORCL", "CRM"],
    "Hardware": ["AAPL", "HPQ", "DELL"],
    
    # Finance
    "Financial Services (Banks, Investment Firms)": ["XLF", "JPM", "BAC", "GS"],
    "Banks": ["JPM", "BAC", "WFC", "C"],
    "Investment Firms": ["GS", "MS", "BLK"], 
    "Economy": ["SPY"],  
    
    # Defense
    "Defense": ["LMT", "BA", "RTX", "NOC"],  
    "Defense Contractors": ["LMT", "BA", "RTX", "GD"],
    "Defense Contractors (Logistics, Security, Support)": ["LMT", "GD", "L3H"],
    
    # Other
    "Education": ["LRN", "STRA", "CHGG"],  
    "Agriculture": ["ADM", "BG", "MON"],  
    "Construction": ["CAT", "DE", "VMC"], 
    "Intelligence Agencies & Contractors": ["LDOS", "CACI", "SAIC"],  
    "Immigration": ["GEO", "CXW"],  
    "Manufacturing": ["XLI", "CAT", "GE"],  
    "Retail": ["XRT", "WMT", "AMZN"], 
    "Transportation": ["XTN", "UPS", "FDX"], 
}


def get_ticker_for_industry(industry_name: str) -> List[str]:
    """
    Get stock tickers for an industry.
    
    Args:
        industry_name: Name of the industry
        
    Returns:
        List of stock ticker symbols
    """
    # Try exact match first
    if industry_name in INDUSTRY_TICKERS:
        return INDUSTRY_TICKERS[industry_name]
    
    # Try partial match
    for key, tickers in INDUSTRY_TICKERS.items():
        if industry_name.lower() in key.lower() or key.lower() in industry_name.lower():
            return tickers
    
    # Default to S&P 500 if no match
    return ["SPY"]


def calculate_stock_impact(
    ticker: str, 
    start_date: str, 
    months: int = 6
) -> Optional[Dict]:
    """
    Calculate stock price change over a period.
    
    Args:
        ticker: Stock ticker symbol
        start_date: Start date in YYYY-MM-DD format
        months: Number of months to analyze (6 or 12)
        
    Returns:
        Dict with price change data or None if failed
    """
    try:
        start = datetime.strptime(start_date, "%Y-%m-%d")
        end = start + timedelta(days=months * 30) 
        
        # Fetch historical data
        stock = yf.Ticker(ticker)
        hist = stock.history(start=start, end=end)
        
        if hist.empty or len(hist) < 2:
            return None
        
        # Calculate percentage change
        start_price = hist['Close'].iloc[0]
        end_price = hist['Close'].iloc[-1]
        percent_change = ((end_price - start_price) / start_price) * 100
        
        return {
            'ticker': ticker,
            'startPrice': round(float(start_price), 2),
            'endPrice': round(float(end_price), 2),
            'percentChange': round(percent_change, 2),
            'period': f'{months}mo',
            'startDate': start.strftime("%Y-%m-%d"),
            'endDate': end.strftime("%Y-%m-%d")
        }
        
    except Exception as e:
        print(f"Error fetching data for {ticker}: {e}")
        return None


def analyze_industry_impact(
    industry_name: str,
    promise_date: str
) -> Dict:
    """
    Analyze market impact for an industry after a promise date.
    
    Args:
        industry_name: Name of the industry
        promise_date: Date of promise in YYYY-MM-DD format
        
    Returns:
        Dict with 6mo and 12mo impact data
    """
    tickers = get_ticker_for_industry(industry_name)
    
    results_6mo = []
    results_12mo = []
    
    for ticker in tickers[:2]: 
        impact_6mo = calculate_stock_impact(ticker, promise_date, months=6)
        impact_12mo = calculate_stock_impact(ticker, promise_date, months=12)
        
        if impact_6mo:
            results_6mo.append(impact_6mo)
        if impact_12mo:
            results_12mo.append(impact_12mo)
    
    # Calculate average impact
    avg_6mo = None
    avg_12mo = None
    
    if results_6mo:
        avg_change_6mo = sum(r['percentChange'] for r in results_6mo) / len(results_6mo)
        avg_6mo = {
            'averageChange': round(avg_change_6mo, 2),
            'stocksAnalyzed': len(results_6mo),
            'details': results_6mo
        }
    
    if results_12mo:
        avg_change_12mo = sum(r['percentChange'] for r in results_12mo) / len(results_12mo)
        avg_12mo = {
            'averageChange': round(avg_change_12mo, 2),
            'stocksAnalyzed': len(results_12mo),
            'details': results_12mo
        }
    
    return {
        'industry': industry_name,
        'tickers': tickers[:2],
        'impact6mo': avg_6mo,
        'impact12mo': avg_12mo,
        'dataSource': 'yfinance'
    }


def enrich_promise_with_stock_data(promise: Dict) -> Dict:
    """
    Enrich a promise with actual stock market data.
    
    Args:
        promise: Promise dict with affectedIndustries
        
    Returns:
        Enhanced promise with actualMarketImpact data
    """
    print(f"\nAnalyzing stock impact for: {promise['promise'][:80]}...")
    print(f"   Date: {promise['date']}")
    
    affected_industries = promise.get('affectedIndustries', [])
    
    if not affected_industries:
        print("    No affected industries to analyze")
        return promise
    
    actual_impacts = []
    
    for industry in affected_industries[:3]: 
        industry_name = industry['name']
        predicted = industry['predictedImpact']
        
        print(f"   Analyzing {industry_name} (predicted: {predicted})...")
        
        impact_data = analyze_industry_impact(industry_name, promise['date'])
        
        if impact_data['impact6mo'] or impact_data['impact12mo']:
            # Determine if prediction was accurate
            actual_6mo = impact_data['impact6mo']['averageChange'] if impact_data['impact6mo'] else None
            actual_12mo = impact_data['impact12mo']['averageChange'] if impact_data['impact12mo'] else None
            
            accuracy = None
            if actual_6mo is not None:
                # Check if direction matches prediction
                if (predicted == 'positive' and actual_6mo > 0) or \
                   (predicted == 'negative' and actual_6mo < 0):
                    accuracy = 'correct'
                elif (predicted == 'positive' and actual_6mo < 0) or \
                     (predicted == 'negative' and actual_6mo > 0):
                    accuracy = 'incorrect'
                else:
                    accuracy = 'mixed'
            
            actual_impacts.append({
                **impact_data,
                'predictedImpact': predicted,
                'predictionAccuracy': accuracy
            })
            
            print(f"       6mo: {actual_6mo:+.2f}% | 12mo: {actual_12mo:+.2f}% | Prediction: {accuracy}")
        else:
            print(f"      No stock data available")
    
    # Add actual market impact to promise
    promise['actualMarketImpact'] = {
        'industries': actual_impacts,
        'analyzedAt': datetime.now().isoformat(),
        'dataSource': 'yfinance (Yahoo Finance)'
    }
    
    return promise


def enrich_all_promises(promises_file: str = '../data/promises.json') -> List[Dict]:
    """
    Enrich all promises in the file with stock data.
    
    Args:
        promises_file: Path to promises JSON file (relative to script location)
        
    Returns:
        List of enriched promises
    """
    print("\n" + "="*80)
    print("STOCK MARKET IMPACT ANALYZER")
    print("="*80)
    print("Using yfinance to fetch historical stock data from Yahoo Finance\n")
    
    # Resolve path relative to this script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(script_dir, promises_file)
    
    print(f"Loading from: {file_path}\n")
    
    # Load promises
    with open(file_path, 'r') as f:
        promises = json.load(f)
    
    print(f"Loaded {len(promises)} promises\n")
    
    enriched_promises = []
    
    for idx, promise in enumerate(promises, 1):
        print(f"\n[{idx}/{len(promises)}] Processing: {promise['president']}")
        enriched = enrich_promise_with_stock_data(promise)
        enriched_promises.append(enriched)
    
    print("\n" + "="*80)
    print("ENRICHMENT COMPLETE")
    print("="*80)
    
    # Calculate statistics
    total_analyzed = sum(
        1 for p in enriched_promises 
        if 'actualMarketImpact' in p and p['actualMarketImpact']['industries']
    )
    
    print(f"\nPromises with stock data: {total_analyzed}/{len(promises)}")
    
    return enriched_promises


if __name__ == '__main__':
    import sys
    import os
    
    # Add parent directory to path
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    
    # Run enrichment
    enriched = enrich_all_promises()
    
    # Save back to the same file (promises.json)
    script_dir = os.path.dirname(os.path.abspath(__file__))
    output_file = os.path.join(script_dir, '../data/promises.json')
    
    with open(output_file, 'w') as f:
        json.dump(enriched, f, indent=2)
    
    print(f"\n Saved enriched data back to: {output_file}")
    print(f"   File size: {os.path.getsize(output_file) / 1024:.2f} KB\n")

