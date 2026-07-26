/**
 * validation.js — Input validation for trade form fields.
 * Returns an array of { fieldId, message } errors or empty array if valid.
 */

/**
 * Validate a single trade form submission.
 * @param {Object} fields - { ticker, deposit, entry, exit, volume }
 * @param {Object} t - current language translation object
 * @returns {{ valid: boolean, errors: Array<{field: string, msg: string}> }}
 */
function validateTradeForm(fields, t) {
  const errors = [];

  // Ticker — required, non-empty
  if (!fields.ticker || !fields.ticker.trim()) {
    errors.push({ field: 'fTicker', msg: t.val_required });
  }

  // Deposit — optional, but if provided must be a positive number
  if (fields.deposit !== '' && fields.deposit !== undefined) {
    const dep = parseFloat(fields.deposit);
    if (isNaN(dep) || dep < 0) {
      errors.push({ field: 'fDeposit', msg: t.val_positive });
    }
  }

  // Entry — optional, but if provided must be a positive number
  if (fields.entry !== '' && fields.entry !== undefined) {
    const entry = parseFloat(fields.entry);
    if (isNaN(entry) || entry <= 0) {
      errors.push({ field: 'fEntry', msg: t.val_positive });
    }
  }

  // Exit — optional, but if provided must be a positive number
  if (fields.exit !== '' && fields.exit !== undefined) {
    const exit = parseFloat(fields.exit);
    if (isNaN(exit) || exit <= 0) {
      errors.push({ field: 'fExit', msg: t.val_positive });
    }
  }

  // Volume — optional, but if provided must be a positive number
  if (fields.volume !== '' && fields.volume !== undefined) {
    const vol = parseFloat(fields.volume);
    if (isNaN(vol) || vol <= 0) {
      errors.push({ field: 'fVolume', msg: t.val_positive });
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Highlight invalid fields with the .invalid CSS class.
 * @param {Array<{field: string, msg: string}>} errors
 */
function showValidationErrors(errors) {
  // Clear all previous invalid states
  document.querySelectorAll('.f-input.invalid, .f-select.invalid').forEach(el => {
    el.classList.remove('invalid');
  });
  errors.forEach(err => {
    const el = document.getElementById(err.field);
    if (el) {
      el.classList.add('invalid');
      el.focus();
    }
  });
}

/**
 * Clear all validation error highlights.
 */
function clearValidationErrors() {
  document.querySelectorAll('.f-input.invalid, .f-select.invalid').forEach(el => {
    el.classList.remove('invalid');
  });
}
