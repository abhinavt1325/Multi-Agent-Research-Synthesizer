import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import './LandingPage.css';

const agents = [
  {
    name: "Planner",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
      </svg>
    ),
    description: "Map out your research objectives and structure your approach intelligently."
  },
  {
    name: "Literature Hunter",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
    description: "Discover and aggregate high-quality academic papers across top databases."
  },
  {
    name: "Paper Reader",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
      </svg>
    ),
    description: "Deep-read full PDFs, extract methodologies, and summarize key findings instantly."
  },
  {
    name: "Comparator",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 3 21 3 21 8" /><line x1="4" y1="20" x2="21" y2="3" />
        <polyline points="21 16 21 21 16 21" /><line x1="15" y1="15" x2="21" y2="21" />
      </svg>
    ),
    description: "Synthesize findings across multiple papers to identify consensus and diverge points."
  },
  {
    name: "Contradiction Detector",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
    description: "Automatically flag conflicting claims and experimental inconsistencies in literature."
  },
  {
    name: "Research Gap",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a10 10 0 110 20 10 10 0 010-20z" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
    description: "Pinpoint unexplored territories and formulate novel hypotheses for your next study."
  }
];

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const fadeInUp = {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15
      }
    }
  };

  return (
    <div className="landing-page">
      <div className="landing-bg" />
      <div className="landing-grid" />
      
      {/* Animated Graph Nodes representing moving topology */}
      <motion.div 
        className="graph-node node-1"
        animate={{ y: [0, -20, 0], x: [0, 15, 0] }}
        transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
      />
      <motion.div 
        className="graph-node node-2"
        animate={{ y: [0, 30, 0], x: [0, -20, 0] }}
        transition={{ repeat: Infinity, duration: 7, ease: "easeInOut" }}
      />
      <motion.div 
        className="graph-node node-3"
        animate={{ y: [0, -15, 0], x: [0, -25, 0] }}
        transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
      />

      <nav className={`landing-nav ${scrolled ? 'navbar-scrolled' : ''}`}>
        <Link to="/" className="landing-logo">
          <img src="/logo.jpg" alt="AlgoVision" />
          <span>AlgoVision</span>
        </Link>
        <div className="landing-nav-links">
          <Link to="/login" className="landing-link">Login</Link>
          <Link to="/signup" className="btn-primary">Sign up</Link>
        </div>
      </nav>

      <main>
        <section className="hero-section">
          <motion.h1 
            className="hero-title"
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
          >
            AI Research Workspace for Serious Researchers
          </motion.h1>
          <motion.p 
            className="hero-subtitle"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0, y: 40 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut", delay: 0.15 } }
            }}
          >
            Search, compare, analyze, detect contradictions, and discover research gaps using multi-agent intelligence. Built for complex literature synthesis.
          </motion.p>
          <motion.div 
            className="hero-actions"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0, y: 40 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut", delay: 0.3 } }
            }}
          >
            <Link to="/signup" className="btn-primary">Get Started</Link>
            <Link to="/login" className="btn-secondary">Login</Link>
          </motion.div>
        </section>

        <section className="showcase-section">
          <motion.h2 
            className="section-title"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
          >
            A Suite of Specialized AI Agents
          </motion.h2>
          
          <motion.div 
            className="cards-grid"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
          >
            {agents.map((agent) => (
              <motion.div key={agent.name} variants={fadeInUp} style={{ height: '100%' }}>
                <Link to="/login" className="feature-card-link">
                  <div className="feature-card">
                    <div className="feature-icon">{agent.icon}</div>
                    <h3 className="feature-title">{agent.name}</h3>
                    <p className="feature-desc">{agent.description}</p>
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </section>

        <section className="value-section">
          <motion.div 
            className="value-grid"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
          >
            <motion.div className="value-card" variants={fadeInUp}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ec4899" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto" }}>
                <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                <polyline points="2 17 12 22 22 17"></polyline>
                <polyline points="2 12 17 22 12"></polyline>
              </svg>
              <h3>Multi-Agent Research Intelligence</h3>
              <p>Harness a collaborative network of specialized AI agents working together to synthesize complex literature at unmatched speeds.</p>
            </motion.div>
            <motion.div className="value-card" variants={fadeInUp}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ec4899" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto" }}>
                <circle cx="18" cy="5" r="3"></circle>
                <circle cx="6" cy="12" r="3"></circle>
                <circle cx="18" cy="19" r="3"></circle>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
              </svg>
              <h3>Research Memory Graph</h3>
              <p>Visualize your curated ecosystem of sources and insights in an interactive 3D knowledge graph.</p>
            </motion.div>
            <motion.div className="value-card" variants={fadeInUp}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ec4899" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto" }}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              <h3>Exportable Outputs</h3>
              <p>Generate highly structured, publication-ready markdown reports that perfectly capture your agents' findings.</p>
            </motion.div>
          </motion.div>
        </section>

        {/* Final CTA Section */}
        <section className="cta-section">
          <motion.div 
            className="cta-container"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
          >
            <h2>Ready to elevate your research?</h2>
            <p>Join cutting-edge researchers utilizing AlgoVision to accelerate discovery.</p>
            <Link to="/signup" className="btn-primary cta-btn">Create your Workspace</Link>
          </motion.div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="footer-logo">AlgoVision © 2026</div>
        <div className="footer-links">
          <Link to="#" className="footer-link">About</Link>
          <Link to="#" className="footer-link">Contact</Link>
          <Link to="#" className="footer-link">Privacy</Link>
        </div>
      </footer>
    </div>
  );
}
