export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidPhone(phone: string): boolean {
  return /^\+?[0-9]{9,15}$/.test(phone.replace(/[\s-]/g, ''));
}

export function isStrongPassword(password: string): boolean {
  return password.length >= 8;
}
