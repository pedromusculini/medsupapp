// This file intentionally left empty - register is at /register
export default function RegisterRedirect() {
  if (typeof window !== 'undefined') {
    window.location.href = '/register';
  }
  return null;
}