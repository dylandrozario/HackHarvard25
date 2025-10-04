// Navbar scroll effect
window.addEventListener('scroll', () => {
  const navbar = document.querySelector('.navbar');
  if (window.scrollY > 50) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }
});

// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  });
});

// Document tag click handlers
document.querySelectorAll('.document-tag').forEach(tag => {
  tag.addEventListener('click', function() {
    // Remove active class from all tags
    document.querySelectorAll('.document-tag').forEach(t => t.classList.remove('active'));
    
    // Add active class to clicked tag
    this.classList.add('active');
    
    // You can add functionality here to show specific content for each politician
    const politicianName = this.textContent;
    console.log(`Selected politician: ${politicianName}`);
    
    // Example: Show a modal or update content
    // showPoliticianInfo(politicianName);
  });
});

// Social card close button handlers
document.querySelectorAll('.social-close').forEach(button => {
  button.addEventListener('click', function() {
    const card = this.closest('.social-card');
    card.style.opacity = '0';
    card.style.transform = 'translateY(-10px)';
    
    setTimeout(() => {
      card.style.display = 'none';
    }, 200);
  });
});

// Tech stack button handlers
document.querySelectorAll('.tech-btn').forEach(button => {
  button.addEventListener('click', function() {
    if (this.classList.contains('primary')) {
      // Handle "Try Demo" button
      console.log('Try Demo clicked');
      // You can add demo functionality here
    } else if (this.classList.contains('secondary')) {
      // Handle "Learn More" button
      console.log('Learn More clicked');
      // You can add learn more functionality here
    }
  });
});

// Get started button handlers
document.querySelectorAll('.get-started-primary').forEach(button => {
  button.addEventListener('click', function(e) {
    e.preventDefault();
    console.log('Sign up for free clicked');
    // You can add signup functionality here
    alert('Sign up functionality would be implemented here!');
  });
});

document.querySelectorAll('.get-started-secondary').forEach(button => {
  button.addEventListener('click', function(e) {
    e.preventDefault();
    console.log('Try the demo clicked');
    // You can add demo functionality here
    alert('Demo functionality would be implemented here!');
  });
});

// Social media icon handlers
document.querySelectorAll('.footer-social-icon').forEach(icon => {
  icon.addEventListener('click', function(e) {
    e.preventDefault();
    const platform = this.getAttribute('aria-label');
    console.log(`${platform} clicked`);
    // You can add social media functionality here
    alert(`${platform} link would open here!`);
  });
});

// Hero CTA button handler
document.querySelectorAll('.hero-cta').forEach(button => {
  button.addEventListener('click', function(e) {
    e.preventDefault();
    console.log('Get started for free clicked');
    // Scroll to get started section
    document.querySelector('.get-started-section').scrollIntoView({
      behavior: 'smooth'
    });
  });
});

// Demo link handler
document.querySelectorAll('.demo-link').forEach(link => {
  link.addEventListener('click', function(e) {
    e.preventDefault();
    console.log('Try the demo clicked');
    // Scroll to demo section or show demo
    document.querySelector('.demo-browser-window').scrollIntoView({
      behavior: 'smooth'
    });
  });
});

// Add hover effects for interactive elements
document.querySelectorAll('.tech-card').forEach(card => {
  card.addEventListener('mouseenter', function() {
    this.style.transform = 'translateY(-4px) scale(1.02)';
  });
  
  card.addEventListener('mouseleave', function() {
    this.style.transform = 'translateY(0) scale(1)';
  });
});

// Add click animation for social cards
document.querySelectorAll('.social-card').forEach(card => {
  card.addEventListener('click', function() {
    this.style.transform = 'scale(0.98)';
    setTimeout(() => {
      this.style.transform = 'translateY(-2px)';
    }, 100);
  });
});

// Intersection Observer for animations
const observerOptions = {
  threshold: 0.1,
  rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
    }
  });
}, observerOptions);

// Observe elements for scroll animations
document.querySelectorAll('.feature-card, .tech-card, .social-card').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(20px)';
  el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
  observer.observe(el);
});

// Add loading animation for the demo browser
window.addEventListener('load', () => {
  const browserContent = document.querySelector('.browser-content');
  const placeholderText = document.querySelector('.demo-placeholder-text');
  
  // Simulate loading
  setTimeout(() => {
    placeholderText.style.opacity = '0';
    setTimeout(() => {
      placeholderText.textContent = 'Demo Video Loading...';
      placeholderText.style.opacity = '1';
    }, 300);
  }, 1000);
});

// Add typing animation to hero title
function typeWriter(element, text, speed = 50) {
  let i = 0;
  element.textContent = '';
  
  function type() {
    if (i < text.length) {
      element.textContent += text.charAt(i);
      i++;
      setTimeout(type, speed);
    }
  }
  
  type();
}

// Initialize typing animation on page load
window.addEventListener('load', () => {
  const heroTitle = document.querySelector('.hero h1');
  const originalText = heroTitle.textContent;
  
  // Add a slight delay before starting the animation
  setTimeout(() => {
    typeWriter(heroTitle, originalText, 30);
  }, 500);
});

// Add parallax effect to background
window.addEventListener('scroll', () => {
  const scrolled = window.pageYOffset;
  const background = document.querySelector('body::before');
  
  if (background) {
    background.style.transform = `translateY(${scrolled * 0.5}px)`;
  }
});

// Add counter animation for user avatars
function animateCounter(element, target, duration = 2000) {
  let start = 0;
  const increment = target / (duration / 16);
  
  function updateCounter() {
    start += increment;
    if (start < target) {
      element.textContent = `+${Math.floor(start).toLocaleString()} government professionals trust GovCheck`;
      requestAnimationFrame(updateCounter);
    } else {
      element.textContent = `+${target.toLocaleString()} government professionals trust GovCheck`;
    }
  }
  
  updateCounter();
}

// Initialize counter animation
window.addEventListener('load', () => {
  const avatarText = document.querySelector('.avatar-text');
  if (avatarText) {
    setTimeout(() => {
      animateCounter(avatarText, 2847);
    }, 2000);
  }
});

// Add ripple effect to buttons
function createRipple(event) {
  const button = event.currentTarget;
  const ripple = document.createElement('span');
  const rect = button.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const x = event.clientX - rect.left - size / 2;
  const y = event.clientY - rect.top - size / 2;
  
  ripple.style.width = ripple.style.height = size + 'px';
  ripple.style.left = x + 'px';
  ripple.style.top = y + 'px';
  ripple.classList.add('ripple');
  
  button.appendChild(ripple);
  
  setTimeout(() => {
    ripple.remove();
  }, 600);
}

// Add ripple effect to all buttons
document.querySelectorAll('.hero-cta, .tech-btn, .get-started-primary').forEach(button => {
  button.addEventListener('click', createRipple);
});

// Add CSS for ripple effect
const style = document.createElement('style');
style.textContent = `
  .ripple {
    position: absolute;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.3);
    transform: scale(0);
    animation: ripple-animation 0.6s linear;
    pointer-events: none;
  }
  
  @keyframes ripple-animation {
    to {
      transform: scale(4);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

console.log('GovCheck website initialized successfully!');
