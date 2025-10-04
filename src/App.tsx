import React from 'react';
import './App.css';

// Navigation Bar Component
const Navbar: React.FC = () => {
  return (
    <nav className="navbar">
      <div className="container">
        <a href="#" className="logo">
          <div className="logo-icon">G</div>
          GovCheck
        </a>
        <ul className="nav-links">
          <li><a href="#features">Features</a></li>
          <li><a href="#about">About</a></li>
        </ul>
        <a href="#contact" className="nav-cta">Get Started</a>
      </div>
    </nav>
  );
};

// Hero Section Component
const HeroSection: React.FC = () => {
  return (
    <section className="hero">
      <div className="container">
        <div className="hero-content">
          <div className="hero-text-section">
            <h1>AI-Powered Government Fact Checking</h1>
            <p className="subtitle">
              Upload government documents, speeches, or policies and get instant fact-checking 
              with AI-powered analysis and verification against official sources.
            </p>
            <div className="cta-buttons">
              <a href="#upload" className="hero-cta">
                <svg className="hero-cta-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Get started for free
              </a>
              <a href="#demo" className="demo-link">
                Try the demo →
              </a>
            </div>
            <div className="user-avatars">
              <div className="avatar-circle">A</div>
              <div className="avatar-circle">B</div>
              <div className="avatar-circle">C</div>
              <div className="avatar-circle">D</div>
              <div className="avatar-circle">E</div>
              <span className="avatar-text">Loved by millions of happy users!</span>
            </div>
          </div>
          
          <div className="hero-demo-section">
            <div className="demo-browser-window">
              <div className="browser-header">
                <div className="browser-dots">
                  <div className="browser-dot red"></div>
                  <div className="browser-dot yellow"></div>
                  <div className="browser-dot green"></div>
                </div>
                <div className="browser-url">govcheck.ai/documents/policy-analysis</div>
              </div>
              <div className="browser-content">
                <div className="demo-placeholder-text">
                  Demo Video Coming Soon
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

// Features Section Component
const FeaturesSection: React.FC = () => {
  const features = [
    {
      icon: "📄",
      title: "Upload documents",
      description: "Easily upload the PDF documents you'd like to chat with."
    },
    {
      icon: "💬",
      title: "Instant answers",
      description: "Ask questions, extract information, and summarize documents with AI."
    },
    {
      icon: "🔗",
      title: "Sources included",
      description: "Every response is backed by sources extracted from the uploaded document."
    }
  ];

  const documentTypes = [
    "President Biden",
    "Donald Trump", 
    "Vice President Harris",
    "Ron DeSantis",
    "Gavin Newsom",
    "Mike Pence",
    "Nikki Haley",
    "Robert F. Kennedy Jr."
  ];

  return (
    <section id="features" className="features">
      <div className="container">
        <div className="features-intro">
          <h2>How it works</h2>
          <p>Simple, fast, and reliable government document analysis powered by AI.</p>
        </div>
        <div className="features-grid">
          {features.map((feature, index) => (
            <div key={index} className="feature-card">
              <div className="feature-icon-container">
                <div className="feature-icon">
                  {feature.icon}
                </div>
              </div>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
      
      <div className="use-cases">
        <div className="use-cases-content">
          <h2>Built for any use case</h2>
          <p className="use-cases-subtitle">
            <span>Click on each option to try it out</span>
            <svg className="hand-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
            </svg>
          </p>
          <div className="document-tags-container">
            <div className="document-tags">
              {documentTypes.map((doc, index) => (
                <div key={index} className="document-tag">
                  {doc}
                </div>
              ))}
              {/* Duplicate for seamless loop */}
              {documentTypes.map((doc, index) => (
                <div key={`duplicate-${index}`} className="document-tag">
                  {doc}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

// Technology Stack Section Component
const TechStackSection: React.FC = () => {
  const technologies = [
    {
      icon: "🔍",
      title: "Fact Checking",
      description: "AI-powered verification of government claims against official databases and records"
    },
    {
      icon: "❌",
      title: "False Promises Detection",
      description: "Identify and flag unfulfilled campaign promises and policy commitments"
    },
    {
      icon: "🏛️",
      title: "Sector Tagging",
      description: "Automatically categorize government policies by economic sectors and impact areas"
    },
    {
      icon: "📈",
      title: "Stock Price Analysis",
      description: "Track how government announcements affect market performance and stock valuations"
    },
    {
      icon: "📊",
      title: "Policy Impact Tracking",
      description: "Monitor the real-world effects of legislation and executive actions over time"
    },
    {
      icon: "🤖",
      title: "AI-Powered Insights",
      description: "Advanced machine learning algorithms for comprehensive government transparency analysis"
    }
  ];

  return (
    <section className="tech-stack">
      <div className="container">
        <h2>Advanced Government Analysis</h2>
        <p className="tech-stack-subtitle">
          Our AI-powered platform provides comprehensive analysis of government actions, policies, and their real-world impact on citizens and markets.
        </p>
        
        <div className="tech-buttons">
          <button className="tech-btn-primary">
            Try Demo
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button className="tech-btn-secondary">
            Learn More
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </button>
        </div>
        
        <div className="tech-grid">
          {technologies.map((tech, index) => (
            <div key={index} className="tech-card">
              <div className="tech-icon">
                {tech.icon}
              </div>
              <h3>{tech.title}</h3>
              <p>{tech.description}</p>
            </div>
          ))}
        </div>
        
        <div className="code-block">
          <div className="code-comment">// Fact-checking results from recent government document analysis</div>
          <br />
          <div className="code-keyword">const</div> <span className="code-variable">factCheckResults</span> = <span className="code-keyword">await</span> <span className="code-variable">govCheck</span>.<span className="code-object-key">analyze</span>(<span className="code-string">'budget_proposal_2024.pdf'</span>);
          <br /><br />
          
          <div className="result-item verified">
            <div className="result-status verified">✅ VERIFIED</div>
            <div className="result-text">"The unemployment rate has decreased by 2% this quarter"</div>
            <div className="result-details">Source: Bureau of Labor Statistics • Confidence: 98%</div>
          </div>
          
          <div className="result-item false">
            <div className="result-status false">❌ FALSE</div>
            <div className="result-text">"Government spending has increased by 50% this year"</div>
            <div className="result-details">Actual increase: 12% • Source: Treasury Department records</div>
          </div>
          
          <div className="result-item unverified">
            <div className="result-status unverified">⚠️ UNVERIFIED</div>
            <div className="result-text">"The new policy will affect 2 million citizens"</div>
            <div className="result-details">Insufficient data available for verification</div>
          </div>
        </div>
      </div>
    </section>
  );
};

// Social Media Showcase Section Component
const SocialShowcaseSection: React.FC = () => {
  const socialPosts = [
    {
      id: 1,
      name: "Sarah Chen",
      handle: "@sarahchen_gov",
      profilePic: "S",
      content: "🔥 Game changer for policy analysis! GovCheck just fact-checked the latest budget proposal in seconds. Finally, transparency we can trust!",
      likes: 1247,
      date: "Dec 15, 2024",
      hasLink: false
    },
    {
      id: 2,
      name: "Mike Rodriguez",
      handle: "@mike_policy",
      profilePic: "M",
      content: "Used GovCheck to verify claims in the infrastructure bill. The AI caught 3 misleading statistics that even I missed. This tool is revolutionary for government accountability.",
      likes: 892,
      date: "Dec 12, 2024",
      hasLink: false
    },
    {
      id: 3,
      name: "Dr. Lisa Park",
      handle: "@lisapark_research",
      profilePic: "L",
      content: "As a policy researcher, I've been waiting for this. GovCheck's sector tagging and impact tracking is exactly what we need for evidence-based policy analysis.",
      likes: 634,
      date: "Dec 10, 2024",
      hasLink: false
    },
    {
      id: 4,
      name: "Alex Thompson",
      handle: "@alexthompson_news",
      profilePic: "A",
      content: "Breaking: GovCheck exposed false promises in campaign speeches with 98% accuracy. The future of political fact-checking is here.",
      likes: 2156,
      date: "Dec 8, 2024",
      hasLink: false
    },
    {
      id: 5,
      name: "Emma Wilson",
      handle: "@emmawilson_ai",
      profilePic: "E",
      content: "The stock price analysis feature is incredible. GovCheck predicted market reactions to policy announcements with scary accuracy. govcheck.ai",
      likes: 743,
      date: "Dec 5, 2024",
      hasLink: true
    },
    {
      id: 6,
      name: "David Kim",
      handle: "@davidkim_tech",
      profilePic: "D",
      content: "Finally, an AI that understands government complexity. The policy impact tracking over time is exactly what we need for long-term accountability.",
      likes: 1567,
      date: "Dec 3, 2024",
      hasLink: false
    }
  ];

  return (
    <section className="social-showcase">
      <div className="container">
        <h2>Wall of Love</h2>
        <p className="social-showcase-subtitle">
          See what government professionals, researchers, and citizens are saying about GovCheck's impact on transparency and accountability.
        </p>
        
        <div className="social-grid">
          {socialPosts.map((post) => (
            <div key={post.id} className="social-card">
              <div className="social-card-header">
                <div className="social-profile-pic">
                  {post.profilePic}
                </div>
                <div className="social-user-info">
                  <div className="social-username">{post.name}</div>
                  <div className="social-handle">{post.handle}</div>
                </div>
                <button className="social-close">×</button>
              </div>
              
              <div className="social-content">
                {post.content}
              </div>
              
              <div className="social-footer">
                <div className="social-likes">
                  <span className="social-heart">❤️</span>
                  <span>{post.likes}</span>
                </div>
                <div className="social-date">{post.date}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// Get Started Section Component
const GetStartedSection: React.FC = () => {
  return (
    <section className="get-started-section">
      <div className="container">
        <h2>Get started</h2>
        <p className="get-started-description">
          Upload a government document and start fact-checking today. No credit card required.
        </p>
        
        <div className="get-started-buttons">
          <a href="#" className="get-started-primary">
            Sign up for free
          </a>
          <a href="#" className="get-started-secondary">
            Try the demo →
          </a>
        </div>
      </div>
    </section>
  );
};

// Footer Component
const Footer: React.FC = () => {
  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-left">
          <div className="footer-logo">
            <div className="footer-logo-icon">G</div>
            <div className="footer-logo-text">GovCheck</div>
          </div>
          <p className="footer-description">
            Fact-check government documents: verify claims, detect false promises, track policy impacts, and ensure transparency in government communications.
          </p>
          <div className="footer-social">
            <a href="#" className="footer-social-icon" aria-label="TikTok">
              ♪
            </a>
            <a href="#" className="footer-social-icon" aria-label="Instagram">
              📷
            </a>
            <a href="#" className="footer-social-icon" aria-label="Twitter/X">
              𝕏
            </a>
            <a href="#" className="footer-social-icon" aria-label="YouTube">
              ▶
            </a>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <div className="footer-copyright">
          <span className="footer-copyright-icon">©</span>
          <span>2024 GovCheck. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
};

// Main App Component
const App: React.FC = () => {
  return (
    <div className="App">
      <Navbar />
      <HeroSection />
      <FeaturesSection />
      <TechStackSection />
      <SocialShowcaseSection />
      <GetStartedSection />
      <Footer />
    </div>
  );
};

export default App;