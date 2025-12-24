document.addEventListener('DOMContentLoaded', function() {
  const passwordInput = document.getElementById('password') || document.getElementById('new-password');
  const strengthIndicator = document.getElementById('password-strength');

  if (passwordInput && strengthIndicator) {
    passwordInput.addEventListener('input', function() {
      const password = this.value;
      let strength = 0;
      let message = '';
      let className = '';

      if (password.length >= 8) strength++;
      if (password.length >= 12) strength++;
      if (/[a-z]/.test(password)) strength++;
      if (/[A-Z]/.test(password)) strength++;
      if (/[0-9]/.test(password)) strength++;
      if (/[^a-zA-Z0-9]/.test(password)) strength++;

      if (strength <= 2) {
        message = 'Weak';
        className = 'weak';
      } else if (strength <= 4) {
        message = 'Medium';
        className = 'medium';
      } else {
        message = 'Strong';
        className = 'strong';
      }

      strengthIndicator.textContent = password.length > 0 ? `Password Strength: ${message}` : '';
      strengthIndicator.className = `password-strength ${className}`;
    });
  }
});
