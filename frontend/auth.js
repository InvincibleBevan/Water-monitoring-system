// Core Auth Logic
class AuthService {
    constructor() {
        this.users = JSON.parse(localStorage.getItem('aquasense_users')) || [];
        this.currentUser = JSON.parse(localStorage.getItem('aquasense_user')) || null;
    }

    login(email, password) {
        // Find user by email
        const user = this.users.find(u => u.email === email);
        
        if (!user) {
            return { success: false, message: 'Invalid email or password' };
        }

        if (user.password !== password) {
            return { success: false, message: 'Invalid email or password' };
        }

        // Login successful
        this.currentUser = { id: user.id, name: user.name, email: user.email };
        localStorage.setItem('aquasense_user', JSON.stringify(this.currentUser));
        return { success: true };
    }

    register(name, email, password) {
        // Check if email already exists
        if (this.users.some(u => u.email === email)) {
            return { success: false, message: 'Email address is already registered' };
        }

        // Create new user
        const newUser = {
            id: Date.now().toString(),
            name,
            email,
            password 
        };

        this.users.push(newUser);
        localStorage.setItem('aquasense_users', JSON.stringify(this.users));
        
        return { success: true };
    }

    logout() {
        this.currentUser = null;
        localStorage.removeItem('aquasense_user');
        window.location.href = 'login.html';
    }

    isAuthenticated() {
        return this.currentUser !== null;
    }
}

const auth = new AuthService();

// Route Protection Logic
const isLoginPage = window.location.href.includes('login.html');
const isRegisterPage = window.location.href.includes('register.html');
const isHomePage = window.location.href.includes('index.html') || window.location.pathname.endsWith('/') || window.location.pathname.endsWith('\\');
const isPublicPage = isLoginPage || isRegisterPage || isHomePage;

if (!isPublicPage && !auth.isAuthenticated()) {
    // Redirect unauthenticated users to landing page if they try to access secure areas
    window.location.href = 'index.html';
} else if ((isLoginPage || isRegisterPage) && auth.isAuthenticated()) {
    // Redirect authenticated users trying to access login/register back to dashboard
    window.location.href = 'dashboard.html';
}

// DOM Dependent Logic
document.addEventListener('DOMContentLoaded', () => {
    // Update Home Page Buttons if elements exist
    const landingNav = document.querySelector('.landing-nav');
    if (landingNav && auth.isAuthenticated()) {
        const navLinks = landingNav.querySelector('.nav-links');
        if (navLinks) {
            navLinks.innerHTML = `
                <span style="margin-right: 16px; color: var(--text-muted); font-size: 0.9rem;">Welcome, ${auth.currentUser.name}</span>
                <a href="dashboard.html" class="btn-primary" style="padding: 10px 24px; font-size: 0.9rem;">Go to Dashboard</a>
            `;
        }
        
        const heroBtns = document.querySelector('.hero-btns');
        if (heroBtns) {
            heroBtns.innerHTML = `
                <a href="dashboard.html" class="btn-primary">Go to Dashboard</a>
                <a href="#features" class="btn-secondary">Explore Features</a>
            `;
        }
    }

    // Event Listeners for Login Form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            const errorEl = document.getElementById('login-error');
            
            const result = auth.login(email, password);
            
            if (result.success) {
                window.location.href = 'dashboard.html';
            } else {
                errorEl.innerText = result.message;
                errorEl.style.display = 'block';
            }
        });
    }

    // Event Listeners for Registration Form
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const name = document.getElementById('reg-name').value;
            const email = document.getElementById('reg-email').value;
            const password = document.getElementById('reg-password').value;
            const confirmPassword = document.getElementById('reg-confirm').value;
            
            const errorEl = document.getElementById('register-error');
            const successEl = document.getElementById('register-success');
            
            // Basic validation
            if (password !== confirmPassword) {
                errorEl.innerText = "Passwords do not match";
                errorEl.style.display = 'block';
                successEl.style.display = 'none';
                return;
            }

            if (password.length < 6) {
                errorEl.innerText = "Password must be at least 6 characters";
                errorEl.style.display = 'block';
                successEl.style.display = 'none';
                return;
            }
            
            const result = auth.register(name, email, password);
            
            if (result.success) {
                errorEl.style.display = 'none';
                successEl.style.display = 'block';
                
                // Auto login then redirect to dashboard
                setTimeout(() => {
                    auth.login(email, password);
                    window.location.href = 'dashboard.html';
                }, 1500);
                
            } else {
                errorEl.innerText = result.message;
                errorEl.style.display = 'block';
                successEl.style.display = 'none';
            }
        });
    }

    // Modal Toggling Logic for Home Page
    const loginModal = document.getElementById('login-modal');
    const loginTriggers = document.querySelectorAll('.btn-login-trigger');
    const closeModal = document.querySelector('.close-modal');

    if (loginModal && loginTriggers.length > 0) {
        loginTriggers.forEach(trigger => {
            trigger.addEventListener('click', (e) => {
                e.preventDefault();
                loginModal.style.display = 'flex';
            });
        });

        if (closeModal) {
            closeModal.addEventListener('click', () => {
                loginModal.style.display = 'none';
            });
        }

        // Close on outside click
        window.addEventListener('click', (e) => {
            if (e.target === loginModal) {
                loginModal.style.display = 'none';
            }
        });
    }

    // Event Listeners for Logout
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', (e) => {
            e.preventDefault();
            auth.logout();
        });
    }
});
