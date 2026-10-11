/**
 * Generador ÚNICO del correo institucional oficial:
 *   [primerNombre][primerApellido]_[DNI]@colegio.edu.pe
 * (minúsculas, sin tildes ni símbolos). Todo el backend usa esta función.
 */
const clean = (s: string): string =>
  (s || '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');

const TITLES = /^(prof\.|lic\.|mg\.|dr\.|dra\.|ing\.|sr\.|sra\.|srta\.)\s+/i;

export function buildInstitutionalEmail(fullOrFirstName: string, lastName: string, dni: string): string {
  const firstName = (fullOrFirstName || '').replace(/\([^)]*\)/g, '').replace(TITLES, '').trim();
  const first = clean(firstName.split(/\s+/)[0]);
  const surname = clean((lastName || '').replace(TITLES, '').trim().split(/\s+/)[0]);
  const cleanDni = (dni || '').replace(/[^0-9]/g, '');
  if (!first || !cleanDni) {
    throw new Error('Nombre y DNI son obligatorios para generar el correo institucional.');
  }
  return `${first}${surname}_${cleanDni}@colegio.edu.pe`;
}

export const INSTITUTIONAL_EMAIL_REGEX = /^[a-z0-9]+_[0-9]{8}@colegio\.edu\.pe$/;
