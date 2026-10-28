'use strict';
// Shared validation for registration, profile edits, and server saves.
(function (root) {
  const fields = [
    { key: 'name', label: 'First name', autocomplete: 'given-name', max: 60 },
    { key: 'lastName', label: 'Last name', autocomplete: 'family-name', max: 60 },
    { key: 'dateOfBirth', label: 'Date of birth (optional)', type: 'date', autocomplete: 'bday' },
    { key: 'phone', label: 'Phone (optional)', type: 'tel', autocomplete: 'tel', max: 40 },
    { key: 'city', label: 'City (optional)', autocomplete: 'address-level2', max: 100 },
    { key: 'region', label: 'State / region (optional)', autocomplete: 'address-level1', max: 100 },
    { key: 'country', label: 'Country (optional)', autocomplete: 'country-name', max: 100 },
    { key: 'headline', label: 'Professional headline (optional)', max: 150 },
    { key: 'school', label: 'School / university (optional)', max: 150 },
    { key: 'degree', label: 'Degree / field of study (optional)', max: 150 },
    { key: 'graduationYear', label: 'Graduation year (optional)', type: 'number' },
    { key: 'linkedinUrl', label: 'LinkedIn profile URL (optional)', type: 'url', max: 500 },
    { key: 'indeedUrl', label: 'Indeed profile URL (optional)', type: 'url', max: 500 },
    { key: 'portfolioUrl', label: 'Portfolio / website (optional)', type: 'url', max: 500 },
    { key: 'summary', label: 'Professional summary (optional)', type: 'textarea', max: 2000 },
  ];
  function today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function validate(profile, requireNames = false) {
    for (const field of fields) {
      const value = profile[field.key];
      if (value === undefined || value === '') {
        if (requireNames && ['name', 'lastName'].includes(field.key)) return `${field.label} is required.`;
        continue;
      }
      if (typeof value !== 'string') return `${field.label} must be text.`;
      if (field.max && value.length > field.max) return `${field.label} is too long.`;
      if (requireNames && ['name', 'lastName'].includes(field.key) && !value.trim()) return `${field.label} is required.`;
      if (field.key === 'dateOfBirth') {
        const date = new Date(value + 'T00:00:00Z');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value || value < '1900-01-01' || value > today()) return 'Enter a real date of birth between January 1, 1900 and today.';
      }
      if (field.key === 'graduationYear' && (!/^\d{4}$/.test(value) || Number(value) < 1950 || Number(value) > new Date().getFullYear() + 15)) return 'Enter a graduation year between 1950 and 15 years from now.';
      if (field.type === 'url') {
        let url;
        try { url = new URL(value); } catch { return `Enter a full ${field.label.replace(' (optional)', '')}, starting with https://.`; }
        if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return 'Profile links must use http:// or https:// and contain no login credentials.';
        const domain = field.key === 'linkedinUrl' ? 'linkedin.com' : field.key === 'indeedUrl' ? 'indeed.com' : null;
        if (domain && url.hostname !== domain && !url.hostname.endsWith('.' + domain)) return `Use a ${domain} profile link.`;
      }
    }
    return '';
  }
  const api = { fields, validate, today, empty: () => Object.fromEntries(fields.map(f => [f.key, ''])) };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LaunchpadProfile = api;
})(typeof window !== 'undefined' ? window : globalThis);
