let currentStep = 1;
let selectedAccountType = 'breeder';

function nextStep(step) {
  if (step === 2) {
    const name = document.getElementById('fullName').value;
    const email = document.getElementById('email').value;
    if (!name || !email) {
      showToast('Please fill in all fields', 'error');
      return;
    }
  }

  document.getElementById(`formStep${currentStep}`).classList.remove('active');
  document.getElementById(`formStep${step}`).classList.add('active');
  
  document.getElementById(`step${currentStep}`).classList.remove('active');
  document.getElementById(`step${currentStep}`).classList.add('completed');
  document.getElementById(`step${step}`).classList.add('active');
  
  const progress = ((step - 1) / 2) * 100;
  document.getElementById('progressFill').style.width = progress + '%';
  
  const texts = ['', "Let's start with the basics", 'What describes you best?', 'Secure your account'];
  document.getElementById('stepText').textContent = texts[step];
  
  currentStep = step;
}

function prevStep(step) {
  document.getElementById(`formStep${currentStep}`).classList.remove('active');
  document.getElementById(`formStep${step}`).classList.add('active');
  
  document.getElementById(`step${currentStep}`).classList.remove('active');
  document.getElementById(`step${step}`).classList.remove('completed');
  document.getElementById(`step${step}`).classList.add('active');
  
  const progress = ((step - 1) / 2) * 100;
  document.getElementById('progressFill').style.width = progress + '%';
  
  const texts = ['', "Let's start with the basics", 'What describes you best?', 'Secure your account'];
  document.getElementById('stepText').textContent = texts[step];
  
  currentStep = step;
}

function selectType(element, type) {
  document.querySelectorAll('.account-type').forEach(el => el.classList.remove('selected'));
  element.classList.add('selected');
  selectedAccountType = type;
}

function updatePasswordStrength(passwordInput, strengthIndicator) {
  const password = passwordInput.value;
  let strength = 0;
  if (password.length >= 8) strength++;
  if (password.match(/[a-z]/) && password.match(/[A-Z]/)) strength++;
  if (password.match(/[0-9]/) && password.match(/[^a-zA-Z0-9]/)) strength++;
  
  const seg1 = document.getElementById('seg1');
  const seg2 = document.getElementById('seg2');
  const seg3 = document.getElementById('seg3');
  const text = document.getElementById('strengthText');
  
  seg1.className = 'strength-segment';
  seg2.className = 'strength-segment';
  seg3.className = 'strength-segment';
  
  const texts = ['⚪ Enter a password', '🔴 Weak password', '🟡 Fair password', '🟢 Strong password'];
  const colors = ['var(--text-muted)', 'var(--pass)', 'var(--wheat)', 'var(--green-primary)'];
  
  text.innerHTML = `<span style="color: ${colors[strength]}">${texts[strength].split(' ')[0]}</span> ${texts[strength].split(' ').slice(1).join(' ')}`;
  
  if (strength >= 1) seg1.classList.add('weak');
  if (strength >= 2) seg2.classList.add('medium');
  if (strength >= 3) seg3.classList.add('strong');
}

// ===== FIXED: Use auth.js User.signup() =====
async function createAccount() {
  const name = document.getElementById('fullName').value;
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const confirm = document.getElementById('confirmPassword').value;
  const terms = document.getElementById('terms').checked;
  
  // Validation
  if (password.length < 8) {
    showToast('Password must be at least 8 characters', 'error');
    return;
  }
  
  if (password !== confirm) {
    showToast('Passwords do not match', 'error');
    return;
  }
  
  if (!terms) {
    showToast('Please accept the terms', 'error');
    return;
  }
  
  const btn = document.getElementById('createBtn');
  btn.textContent = 'Creating...';
  btn.disabled = true;
  
  try {
    // Use the User.signup from auth.js
    const user = await User.signup({
      name: name,
      email: email,
      password: password,
      accountType: selectedAccountType
    });
    
    // Show success
    document.getElementById(`formStep${currentStep}`).classList.remove('active');
    document.getElementById('successState').classList.add('active');
    document.querySelector('.progress-bar').style.display = 'none';
    document.querySelector('.signup-header').style.display = 'none';
    document.querySelector('.logo-container').style.display = 'none';
    
    showToast(`Welcome to BreedLink, ${user.name}! 🎉`);
    
  } catch (error) {
    showToast(error.message, 'error');
    btn.textContent = 'Create Account';
    btn.disabled = false;
  }
}