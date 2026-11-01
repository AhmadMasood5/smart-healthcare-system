import { useState } from 'react';
import { fieldErrorMap, validate } from './validation';

// Controlled form state + client validation + backend error mapping.
export function useForm(initial, schema = {}) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const onChange = (e) => {
    const { name, value } = e.target;
    setValues((v) => ({ ...v, [name]: value }));
  };

  // Runs client validation, then the request; maps backend field errors back onto inputs.
  async function submit(request) {
    const clientErrors = validate(values, schema);
    setErrors(clientErrors);
    setApiError(null);
    if (Object.keys(clientErrors).length) return false;
    setSubmitting(true);
    try {
      await request(values);
      return true;
    } catch (err) {
      setApiError(err);
      setErrors(fieldErrorMap(err));
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  const reset = (next = initial) => {
    setValues(next);
    setErrors({});
    setApiError(null);
  };

  return { values, setValues, onChange, errors, apiError, setApiError, submitting, submit, reset };
}
